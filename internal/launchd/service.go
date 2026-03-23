package launchd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"howett.net/plist"
)

const snapshotTTL = 30 * time.Second

var (
	servicesLinePattern = regexp.MustCompile(`^\s*(\d+)\s+(-?\d+|-)\s+(.+)$`)
	disabledLinePattern = regexp.MustCompile(`^\s*"([^"]+)"\s+=>\s+(enabled|disabled)$`)
	logFileStemPattern  = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)
)

// commandRunner 抽象命令执行，便于测试替换。
type commandRunner interface {
	Run(ctx context.Context, name string, args ...string) (string, error)
}

// execCommandRunner 使用系统命令执行真实操作。
type execCommandRunner struct{}

// Run 执行外部命令并返回合并输出。
func (execCommandRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	command := exec.CommandContext(ctx, name, args...)
	output, err := command.CombinedOutput()
	text := strings.TrimSpace(string(output))

	// 命令失败时保留原始输出，便于界面定位问题。
	if err != nil {
		if text == "" {
			return "", err
		}
		return text, fmt.Errorf("%w: %s", err, text)
	}

	return text, nil
}

// Service 负责 launchd 相关的扫描、动作和配置读写。
type Service struct {
	mu      sync.RWMutex
	runner  commandRunner
	history *HistoryStore
	uid     int
	gui     string
	homeDir string
	cache   workspaceCache
}

// workspaceCache 缓存最近一次扫描结果。
type workspaceCache struct {
	builtAt  time.Time
	snapshot WorkspaceSnapshot
	records  map[string]*serviceRecord
}

// serviceRecord 表示扫描阶段的内部模型。
type serviceRecord struct {
	summary      ServiceSummary
	path         string
	label        string
	fileName     string
	scopeKey     string
	scope        string
	serviceType  string
	readOnly     bool
	domain       string
	modifiedAt   time.Time
	plistData    map[string]interface{}
	rawXML       string
	runtimeDump  string
	validation   []ValidationIssue
	hasLogs      bool
	disabled     bool
	loaded       bool
	running      bool
	pid          int
	lastExitCode *int
	state        string
	streams      []string
}

// domainRuntime 表示 launchctl 域摘要解析结果。
type domainRuntime struct {
	services map[string]runtimeStatus
	disabled map[string]bool
}

// runtimeStatus 表示单个服务的运行状态。
type runtimeStatus struct {
	pid      int
	exitCode *int
	loaded   bool
}

// candidateConfig 表示待校验或待保存的配置。
type candidateConfig struct {
	targetPath string
	fileName   string
	rawMap     map[string]interface{}
	rawXML     string
	form       ServiceFormData
	validation []ValidationIssue
	label      string
}

// NewService 创建 launchd 领域服务。
func NewService() (*Service, error) {
	// 历史文件独立落盘，避免动作记录随着窗口重启丢失。
	history, err := NewHistoryStore()
	if err != nil {
		return nil, err
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	uid := os.Getuid()

	return &Service{
		runner:  execCommandRunner{},
		history: history,
		uid:     uid,
		gui:     fmt.Sprintf("gui/%d", uid),
		homeDir: homeDir,
	}, nil
}

// GetWorkspaceSnapshot 返回最新工作区快照。
func (s *Service) GetWorkspaceSnapshot(ctx context.Context) (WorkspaceSnapshot, error) {
	return s.loadSnapshot(ctx, true)
}

// GetServiceDetail 返回指定服务的详情。
func (s *Service) GetServiceDetail(ctx context.Context, id string) (ServiceDetail, error) {
	snapshot, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return ServiceDetail{}, err
	}

	record, err := findRecord(records, id)
	if err != nil {
		return ServiceDetail{}, err
	}

	// 详情打开时再补充重型数据，避免列表扫描阶段为每条服务执行额外命令。
	if err := s.populateHeavyRecordData(ctx, record); err != nil {
		return ServiceDetail{}, err
	}

	detail := s.buildServiceDetail(snapshot, record)
	return detail, nil
}

// GetServiceEditor 返回指定服务的编辑器数据。
func (s *Service) GetServiceEditor(ctx context.Context, id string) (ServiceEditorState, error) {
	// 新建配置不依赖现有快照，直接返回模板，避免空弹窗触发全量扫描。
	if strings.TrimSpace(id) == "" {
		form := s.newServiceFormData()

		rawXML, err := encodeXML(map[string]interface{}{})
		if err != nil {
			return ServiceEditorState{}, err
		}

		return ServiceEditorState{
			ServiceID: "",
			Mode:      "form",
			ReadOnly:  false,
			ScopeKey:  ScopeUserAgent,
			Scope:     scopeLabel(ScopeUserAgent),
			FileName:  form.FileName,
			RawXML:    rawXML,
			Form:      form,
			EditableFields: []string{
				"Label", "Program", "ProgramArguments", "WorkingDirectory", "RunAtLoad",
				"KeepAlive", "StartInterval", "StartCalendarInterval", "StandardOutPath",
				"StandardErrorPath", "EnvironmentVariables", "WatchPaths",
			},
		}, nil
	}

	_, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return ServiceEditorState{}, err
	}

	record, err := findRecord(records, id)
	if err != nil {
		return ServiceEditorState{}, err
	}

	if err := s.populateHeavyRecordData(ctx, record); err != nil {
		return ServiceEditorState{}, err
	}

	return ServiceEditorState{
		ServiceID: record.path,
		Mode:      "form",
		ReadOnly:  record.readOnly,
		ScopeKey:  record.scopeKey,
		Scope:     record.scope,
		FileName:  record.fileName,
		RawXML:    record.rawXML,
		Form:      buildFormData(record.plistData, record.fileName),
		EditableFields: []string{
			"Label", "Program", "ProgramArguments", "WorkingDirectory", "RunAtLoad",
			"KeepAlive", "StartInterval", "StartCalendarInterval", "StandardOutPath",
			"StandardErrorPath", "EnvironmentVariables", "WatchPaths",
		},
		Validation: record.validation,
	}, nil
}

// ValidateServiceConfig 校验原始 XML 或表单配置。
func (s *Service) ValidateServiceConfig(ctx context.Context, req ValidateServiceConfigRequest) (ValidateServiceConfigResponse, error) {
	_, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return ValidateServiceConfigResponse{}, err
	}

	base, _ := records[req.ID]
	candidate, err := s.buildCandidateConfig(ctx, base, req.Scope, req.FileName, req.RawXML, req.FormPatch, req.Mode)
	if err != nil {
		return ValidateServiceConfigResponse{
			OK:         false,
			Validation: candidate.validation,
			RawXML:     candidate.rawXML,
			Form:       candidate.form,
		}, err
	}

	return ValidateServiceConfigResponse{
		OK:         !hasErrorIssue(candidate.validation),
		RawXML:     candidate.rawXML,
		Form:       candidate.form,
		Validation: candidate.validation,
	}, nil
}

// SaveServiceConfig 保存配置并按需加载。
func (s *Service) SaveServiceConfig(ctx context.Context, req SaveServiceConfigRequest) (SaveServiceConfigResponse, error) {
	_, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return SaveServiceConfigResponse{}, err
	}

	base, _ := records[req.ID]
	candidate, err := s.buildCandidateConfig(ctx, base, req.Scope, req.FileName, req.RawXML, req.FormPatch, req.Mode)
	if err != nil {
		return SaveServiceConfigResponse{
			Validation: candidate.validation,
		}, err
	}

	// 存在错误级问题时拒绝落盘，避免写入无效配置。
	if hasErrorIssue(candidate.validation) {
		return SaveServiceConfigResponse{
			Validation: candidate.validation,
			Editor: ServiceEditorState{
				ServiceID: req.ID,
				Mode:      req.Mode,
				ScopeKey:  ScopeUserAgent,
				Scope:     scopeLabel(ScopeUserAgent),
				FileName:  candidate.fileName,
				RawXML:    candidate.rawXML,
				Form:      candidate.form,
				ReadOnly:  false,
			},
		}, errors.New("配置校验未通过")
	}

	if err := prepareLogTargets(candidate.rawMap); err != nil {
		return SaveServiceConfigResponse{}, err
	}

	oldPath := ""
	oldDisabled := false
	if base != nil {
		oldPath = base.path
		oldDisabled = base.disabled
	}

	if err := writeAtomicFile(candidate.targetPath, []byte(candidate.rawXML), 0o644); err != nil {
		return SaveServiceConfigResponse{}, err
	}

	// 文件改名后需要清理旧文件，避免工作区残留两个同名任务。
	if oldPath != "" && oldPath != candidate.targetPath {
		_ = os.Remove(oldPath)
	}

	if req.ApplyLoad {
		if oldPath != "" {
			// 使用路径重载可以覆盖 label 变更场景，避免旧服务残留。
			_, _ = s.runLaunchctl(ctx, "bootout", s.gui, oldPath)
		} else {
			_, _ = s.runLaunchctl(ctx, "bootout", s.gui, candidate.targetPath)
		}

		if _, err := s.runLaunchctl(ctx, "bootstrap", s.gui, candidate.targetPath); err != nil {
			return SaveServiceConfigResponse{
				Validation: candidate.validation,
			}, fmt.Errorf("加载任务失败：%w", err)
		}

		// 原任务本来处于停用态时，重载后继续维持停用语义。
		if oldDisabled && candidate.label != "" {
			_, _ = s.runLaunchctl(ctx, "disable", serviceTarget(s.gui, candidate.label))
		}
	}

	s.invalidateCache()

	action := "save"
	message := "配置已保存"
	if req.ApplyLoad {
		action = "save_load"
		message = "配置已保存并重新加载"
	}

	_ = s.history.Append(s.history.NewEntry(candidate.targetPath, candidate.label, action, true, message))

	detail, detailErr := s.GetServiceDetail(ctx, candidate.targetPath)
	if detailErr != nil {
		// 新建草稿未加载时，详情仍然应该可读，因此失败时继续返回快照。
		detail = ServiceDetail{}
	}

	editor, editorErr := s.GetServiceEditor(ctx, candidate.targetPath)
	if editorErr != nil {
		editor = ServiceEditorState{}
	}

	snapshot, snapshotErr := s.loadSnapshot(ctx, true)
	if snapshotErr != nil {
		return SaveServiceConfigResponse{}, snapshotErr
	}

	return SaveServiceConfigResponse{
		ServiceID:  candidate.targetPath,
		Detail:     detail,
		Editor:     editor,
		Snapshot:   snapshot,
		Validation: candidate.validation,
	}, nil
}

// ExecuteServiceAction 执行单个服务动作。
func (s *Service) ExecuteServiceAction(ctx context.Context, req ExecuteServiceActionRequest) (ExecuteServiceActionResponse, error) {
	_, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return ExecuteServiceActionResponse{}, err
	}

	record, err := findRecord(records, req.ID)
	if err != nil {
		return ExecuteServiceActionResponse{}, err
	}

	success := false
	message := ""

	switch req.Action {
	case ActionValidate:
		message = issueSummary(record.validation)
		if message == "" {
			message = "配置校验通过"
		}
		success = !hasErrorIssue(record.validation)
	case ActionStart:
		success, message, err = s.executeStart(ctx, record)
	case ActionStop:
		success, message, err = s.executeManagedAction(ctx, record, []string{"kill", "SIGTERM", serviceTarget(record.domain, record.label)}, "停止信号已发送")
	case ActionEnable:
		success, message, err = s.executeManagedAction(ctx, record, []string{"enable", serviceTarget(record.domain, record.label)}, "任务已启用")
	case ActionDisable:
		success, message, err = s.executeManagedAction(ctx, record, []string{"disable", serviceTarget(record.domain, record.label)}, "任务已停用")
	case ActionReload:
		success, message, err = s.executeReload(ctx, record)
	case ActionDelete:
		success, message, err = s.executeDelete(ctx, record)
	default:
		return ExecuteServiceActionResponse{}, fmt.Errorf("不支持的动作: %s", req.Action)
	}

	_ = s.history.Append(s.history.NewEntry(record.path, record.label, req.Action, success, message))
	s.invalidateCache()

	snapshot, snapshotErr := s.loadSnapshot(ctx, true)
	if snapshotErr != nil {
		return ExecuteServiceActionResponse{}, snapshotErr
	}

	detail, detailErr := s.GetServiceDetail(ctx, record.path)
	if detailErr != nil && req.Action != ActionDelete {
		return ExecuteServiceActionResponse{}, detailErr
	}

	return ExecuteServiceActionResponse{
		Success:  success,
		Message:  message,
		Detail:   detail,
		Snapshot: snapshot,
	}, err
}

// ReadServiceLogs 读取标准输出或标准错误日志。
func (s *Service) ReadServiceLogs(ctx context.Context, req ReadServiceLogsRequest) (ReadServiceLogsResponse, error) {
	_, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return ReadServiceLogsResponse{}, err
	}

	record, err := findRecord(records, req.ID)
	if err != nil {
		return ReadServiceLogsResponse{}, err
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 200
	}

	stream := strings.TrimSpace(req.Stream)
	if stream == "" {
		stream = "stderr"
	}

	stdoutPath := readString(record.plistData["StandardOutPath"])
	stderrPath := readString(record.plistData["StandardErrorPath"])
	response := ReadServiceLogsResponse{
		ServiceID: record.path,
		Stream:    stream,
		Warnings:  []DetailAlert{},
		Paths:     []string{},
	}

	switch stream {
	case "stdout":
		lines, warning := readLogFile(stdoutPath, "stdout", limit)
		response.Lines = lines
		response.Paths = compactStrings([]string{stdoutPath})
		if warning != "" {
			response.Warnings = append(response.Warnings, DetailAlert{Type: "warning", Message: warning})
		}
	case "combined":
		stdoutLines, stdoutWarning := readLogFile(stdoutPath, "stdout", limit)
		stderrLines, stderrWarning := readLogFile(stderrPath, "stderr", limit)
		response.Lines = append(response.Lines, stdoutLines...)
		response.Lines = append(response.Lines, stderrLines...)
		response.Paths = compactStrings([]string{stdoutPath, stderrPath})
		if stdoutWarning != "" {
			response.Warnings = append(response.Warnings, DetailAlert{Type: "warning", Message: stdoutWarning})
		}
		if stderrWarning != "" {
			response.Warnings = append(response.Warnings, DetailAlert{Type: "warning", Message: stderrWarning})
		}
	default:
		lines, warning := readLogFile(stderrPath, "stderr", limit)
		response.Lines = lines
		response.Paths = compactStrings([]string{stderrPath})
		if warning != "" {
			response.Warnings = append(response.Warnings, DetailAlert{Type: "warning", Message: warning})
		}
	}

	return response, nil
}

// ListServiceHistory 返回指定服务的操作历史。
func (s *Service) ListServiceHistory(_ context.Context, id string) ([]HistoryEntry, error) {
	return s.history.ListByService(id, 50)
}

// BatchExecute 执行批量校验或批量停用。
func (s *Service) BatchExecute(ctx context.Context, req BatchExecuteRequest) (BatchExecuteResponse, error) {
	_, records, err := s.loadSnapshotWithRecords(ctx, false)
	if err != nil {
		return BatchExecuteResponse{}, err
	}

	results := make([]BatchActionResult, 0, len(req.IDs))

	for _, id := range req.IDs {
		record, found := records[id]
		if !found {
			results = append(results, BatchActionResult{
				ID:      id,
				Success: false,
				Message: "任务不存在",
			})
			continue
		}

		result := BatchActionResult{
			ID:    record.path,
			Label: record.label,
		}

		switch req.Action {
		case ActionValidate:
			result.Issues = record.validation
			result.Success = !hasErrorIssue(record.validation)
			result.Message = issueSummary(record.validation)
			if result.Message == "" {
				result.Message = "配置校验通过"
			}
		case ActionDisable:
			success, message, actionErr := s.executeManagedAction(ctx, record, []string{"disable", serviceTarget(record.domain, record.label)}, "任务已停用")
			result.Success = success
			result.Message = message
			if actionErr != nil && message == "" {
				result.Message = actionErr.Error()
			}
			_ = s.history.Append(s.history.NewEntry(record.path, record.label, ActionDisable, success, result.Message))
		default:
			return BatchExecuteResponse{}, fmt.Errorf("不支持的批量动作: %s", req.Action)
		}

		results = append(results, result)
	}

	s.invalidateCache()

	snapshot, err := s.loadSnapshot(ctx, true)
	if err != nil {
		return BatchExecuteResponse{}, err
	}

	return BatchExecuteResponse{
		Results:  results,
		Snapshot: snapshot,
	}, nil
}

// executeManagedAction 执行需要写权限的动作。
func (s *Service) executeManagedAction(ctx context.Context, record *serviceRecord, args []string, successMessage string) (bool, string, error) {
	// 只允许当前用户目录的任务执行真实修改，系统级统一保持只读。
	if record.readOnly {
		return false, "当前任务为只读范围，不能修改", errors.New("只读任务不允许执行写操作")
	}

	if record.label == "" {
		return false, "任务缺少 Label，无法操作", errors.New("任务缺少 label")
	}

	output, err := s.runLaunchctl(ctx, args...)
	if err != nil {
		if output != "" {
			return false, output, err
		}
		return false, err.Error(), err
	}

	if strings.TrimSpace(output) != "" {
		return true, output, nil
	}

	return true, successMessage, nil
}

// executeStart 启动已加载或仅落盘的当前用户任务。
func (s *Service) executeStart(ctx context.Context, record *serviceRecord) (bool, string, error) {
	// 未加载的任务需要先 bootstrap，随后再 kickstart。
	if !record.loaded {
		if record.readOnly {
			return false, "当前任务为只读范围，不能启动", errors.New("只读任务不允许启动")
		}

		if _, err := s.runLaunchctl(ctx, "bootstrap", s.gui, record.path); err != nil {
			message := buildActionErrorMessage("加载任务失败", err)
			return false, message, errors.New(message)
		}
	}

	return s.executeManagedAction(ctx, record, []string{"kickstart", "-kp", serviceTarget(record.domain, record.label)}, "任务已启动")
}

// executeReload 按路径执行 bootout + bootstrap。
func (s *Service) executeReload(ctx context.Context, record *serviceRecord) (bool, string, error) {
	// 只读任务不允许真实重载，避免误改系统服务。
	if record.readOnly {
		return false, "当前任务为只读范围，不能重载", errors.New("只读任务不允许重载")
	}

	_, _ = s.runLaunchctl(ctx, "bootout", s.gui, record.path)

	if _, err := s.runLaunchctl(ctx, "bootstrap", s.gui, record.path); err != nil {
		message := buildActionErrorMessage("重载失败", err)
		return false, message, errors.New(message)
	}

	if record.disabled {
		_, _ = s.runLaunchctl(ctx, "disable", serviceTarget(record.domain, record.label))
	}

	return true, "任务已重载", nil
}

// executeDelete 卸载并删除当前用户任务文件。
func (s *Service) executeDelete(ctx context.Context, record *serviceRecord) (bool, string, error) {
	// 删除属于不可恢复动作，但当前仅针对用户目录执行。
	if record.readOnly {
		return false, "当前任务为只读范围，不能删除", errors.New("只读任务不允许删除")
	}

	_, _ = s.runLaunchctl(ctx, "bootout", s.gui, record.path)
	if err := os.Remove(record.path); err != nil && !os.IsNotExist(err) {
		message := buildActionErrorMessage("删除文件失败", err)
		return false, message, errors.New(message)
	}

	return true, "任务已删除", nil
}

// buildActionErrorMessage 构造可直接展示给用户的失败原因。
func buildActionErrorMessage(prefix string, err error) string {
	text := strings.TrimSpace(prefix)

	// 没有底层错误时直接返回已有文案。
	if err == nil {
		return text
	}

	detail := strings.TrimSpace(err.Error())
	if detail == "" {
		return text
	}

	// 已经带有前缀时直接复用，避免重复拼接。
	if text == "" || strings.Contains(detail, text) {
		return detail
	}

	return fmt.Sprintf("%s：%s", text, detail)
}

// buildCandidateConfig 构造待校验或待保存的候选配置。
func (s *Service) buildCandidateConfig(ctx context.Context, base *serviceRecord, scope string, fileName string, rawXML string, form ServiceFormData, mode string) (candidateConfig, error) {
	scope = strings.TrimSpace(scope)
	if scope == "" {
		if base != nil {
			scope = base.scopeKey
		} else {
			scope = ScopeUserAgent
		}
	}

	// 首版仅允许编辑当前用户目录，避免提权链路复杂化。
	if scope != ScopeUserAgent {
		issue := ValidationIssue{Level: "error", Field: "scope", Message: "首版仅允许编辑当前用户 LaunchAgents"}
		return candidateConfig{
			validation: []ValidationIssue{issue},
		}, errors.New(issue.Message)
	}

	resolvedFileName, err := sanitizeFileName(firstNonEmpty(fileName, form.FileName, safeFileName(base)))
	if err != nil {
		issue := ValidationIssue{Level: "error", Field: "fileName", Message: err.Error()}
		return candidateConfig{
			validation: []ValidationIssue{issue},
		}, err
	}

	targetPath := filepath.Join(s.homeDir, "Library", "LaunchAgents", resolvedFileName)
	rawMap := map[string]interface{}{}

	switch strings.TrimSpace(mode) {
	case "raw":
		parsed, parseErr := decodeXMLMap(rawXML)
		if parseErr != nil {
			issue := ValidationIssue{Level: "error", Field: "rawXML", Message: parseErr.Error()}
			return candidateConfig{
				targetPath: targetPath,
				fileName:   resolvedFileName,
				rawXML:     rawXML,
				validation: []ValidationIssue{issue},
			}, parseErr
		}
		rawMap = parsed
	default:
		if base != nil {
			rawMap = cloneMap(base.plistData)
		}
		applyFormToMap(rawMap, form)
	}

	encodedXML, err := encodeXML(rawMap)
	if err != nil {
		issue := ValidationIssue{Level: "error", Field: "rawXML", Message: err.Error()}
		return candidateConfig{
			targetPath: targetPath,
			fileName:   resolvedFileName,
			validation: []ValidationIssue{issue},
		}, err
	}

	formData := buildFormData(rawMap, resolvedFileName)
	issues := validateCandidateMap(ctx, s.runner, rawMap, targetPath, resolvedFileName)

	return candidateConfig{
		targetPath: targetPath,
		fileName:   resolvedFileName,
		rawMap:     rawMap,
		rawXML:     encodedXML,
		form:       formData,
		validation: issues,
		label:      readString(rawMap["Label"]),
	}, nil
}

// loadSnapshotWithRecords 返回快照以及内部记录映射。
func (s *Service) loadSnapshotWithRecords(ctx context.Context, force bool) (WorkspaceSnapshot, map[string]*serviceRecord, error) {
	s.mu.RLock()
	if !force && time.Since(s.cache.builtAt) < snapshotTTL && s.cache.records != nil {
		snapshot := s.cache.snapshot
		records := s.cache.records
		s.mu.RUnlock()
		return snapshot, records, nil
	}
	s.mu.RUnlock()

	snapshot, records, err := s.scanWorkspace(ctx)
	if err != nil {
		return WorkspaceSnapshot{}, nil, err
	}

	s.mu.Lock()
	s.cache = workspaceCache{
		builtAt:  time.Now(),
		snapshot: snapshot,
		records:  records,
	}
	s.mu.Unlock()

	return snapshot, records, nil
}

// loadSnapshot 只返回工作区快照。
func (s *Service) loadSnapshot(ctx context.Context, force bool) (WorkspaceSnapshot, error) {
	snapshot, _, err := s.loadSnapshotWithRecords(ctx, force)
	return snapshot, err
}

// invalidateCache 让下一次读取强制走重新扫描。
func (s *Service) invalidateCache() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cache = workspaceCache{}
}

// scanWorkspace 扫描目录、解析 launchctl 状态并构造界面快照。
func (s *Service) scanWorkspace(ctx context.Context) (WorkspaceSnapshot, map[string]*serviceRecord, error) {
	guiRuntime, err := s.readDomainRuntime(ctx, s.gui)
	if err != nil {
		return WorkspaceSnapshot{}, nil, err
	}

	systemRuntime, err := s.readDomainRuntime(ctx, "system")
	if err != nil {
		return WorkspaceSnapshot{}, nil, err
	}

	historyCounts, err := s.history.CountMap()
	if err != nil {
		return WorkspaceSnapshot{}, nil, err
	}

	type scopeSpec struct {
		path        string
		scopeKey    string
		scope       string
		serviceType string
		readOnly    bool
		domain      string
		runtime     domainRuntime
	}

	specs := []scopeSpec{
		{
			path:        filepath.Join(s.homeDir, "Library", "LaunchAgents"),
			scopeKey:    ScopeUserAgent,
			scope:       scopeLabel(ScopeUserAgent),
			serviceType: "LaunchAgent",
			readOnly:    false,
			domain:      s.gui,
			runtime:     guiRuntime,
		},
		{
			path:        "/Library/LaunchAgents",
			scopeKey:    ScopeAllAgent,
			scope:       scopeLabel(ScopeAllAgent),
			serviceType: "LaunchAgent",
			readOnly:    true,
			domain:      s.gui,
			runtime:     guiRuntime,
		},
		{
			path:        "/System/Library/LaunchAgents",
			scopeKey:    ScopeSystemAgent,
			scope:       scopeLabel(ScopeSystemAgent),
			serviceType: "LaunchAgent",
			readOnly:    true,
			domain:      s.gui,
			runtime:     guiRuntime,
		},
		{
			path:        "/Library/LaunchDaemons",
			scopeKey:    ScopeDaemon,
			scope:       scopeLabel(ScopeDaemon),
			serviceType: "LaunchDaemon",
			readOnly:    true,
			domain:      "system",
			runtime:     systemRuntime,
		},
		{
			path:        "/System/Library/LaunchDaemons",
			scopeKey:    ScopeDaemon,
			scope:       scopeLabel(ScopeDaemon),
			serviceType: "LaunchDaemon",
			readOnly:    true,
			domain:      "system",
			runtime:     systemRuntime,
		},
	}

	records := make(map[string]*serviceRecord)

	for _, spec := range specs {
		entries, readErr := os.ReadDir(spec.path)
		if readErr != nil {
			continue
		}

		for _, entry := range entries {
			// 只处理 plist 文件，减少无关目录噪音。
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".plist") {
				continue
			}

			fullPath := filepath.Join(spec.path, entry.Name())
			record := s.buildRecord(ctx, fullPath, entry.Name(), spec, historyCounts)
			records[record.path] = record
		}
	}

	tasks := make([]ServiceSummary, 0, len(records))
	for _, record := range records {
		tasks = append(tasks, record.summary)
	}

	sort.Slice(tasks, func(left int, right int) bool {
		if tasks[left].Scope != tasks[right].Scope {
			return tasks[left].Scope < tasks[right].Scope
		}
		if tasks[left].Label != tasks[right].Label {
			return tasks[left].Label < tasks[right].Label
		}
		return tasks[left].Path < tasks[right].Path
	})

	snapshot := WorkspaceSnapshot{
		RefreshedAt:      time.Now().Format(time.RFC3339),
		NavigationGroups: buildNavigationGroups(tasks),
		SummaryCards:     buildSummaryCards(tasks),
		Tasks:            tasks,
	}

	return snapshot, records, nil
}

// buildRecord 构造单个 plist 文件的内部模型。
func (s *Service) buildRecord(ctx context.Context, fullPath string, fileName string, spec struct {
	path        string
	scopeKey    string
	scope       string
	serviceType string
	readOnly    bool
	domain      string
	runtime     domainRuntime
}, historyCounts map[string]int) *serviceRecord {
	record := &serviceRecord{
		path:        fullPath,
		fileName:    fileName,
		scopeKey:    spec.scopeKey,
		scope:       spec.scope,
		serviceType: spec.serviceType,
		readOnly:    spec.readOnly,
		domain:      spec.domain,
		plistData:   map[string]interface{}{},
	}

	info, statErr := os.Stat(fullPath)
	if statErr == nil {
		record.modifiedAt = info.ModTime()
	}

	data, readErr := os.ReadFile(fullPath)
	if readErr != nil {
		record.validation = append(record.validation, ValidationIssue{Level: "error", Field: "file", Message: readErr.Error()})
		record.summary = ServiceSummary{
			ID:         fullPath,
			Status:     "invalid",
			StatusText: "配置无效",
			Label:      strings.TrimSuffix(fileName, ".plist"),
			File:       fileName,
			ScopeKey:   ScopeUnknown,
			Scope:      scopeLabel(ScopeUnknown),
			Type:       spec.serviceType,
			Path:       fullPath,
			ReadOnly:   spec.readOnly,
			Invalid:    true,
		}
		return record
	}

	parsed, parseErr := decodeAnyMap(data)
	if parseErr != nil {
		record.rawXML = string(data)
		record.validation = append(record.validation, ValidationIssue{Level: "error", Field: "file", Message: parseErr.Error()})
	} else {
		record.plistData = parsed
		record.rawXML, _ = encodeXML(parsed)
	}

	record.label = firstNonEmpty(readString(record.plistData["Label"]), strings.TrimSuffix(fileName, ".plist"))

	if spec.runtime.services[record.label].loaded {
		record.loaded = true
		status := spec.runtime.services[record.label]
		record.pid = status.pid
		record.lastExitCode = status.exitCode
		record.running = status.pid > 0
	}

	record.disabled = spec.runtime.disabled[record.label]
	record.hasLogs = hasLogPaths(record.plistData)
	record.streams = availableStreams(record.plistData)

	// 列表扫描阶段只做轻量语义校验，避免全量执行外部命令。
	record.validation = append(record.validation, validateSummaryMap(record.plistData, fileName)...)

	if parseErr != nil {
		record.state = "invalid"
	} else if record.running {
		record.state = "running"
	} else if record.loaded && record.lastExitCode != nil && *record.lastExitCode != 0 {
		record.state = "failed"
	} else if record.loaded {
		record.state = "loaded"
	} else {
		record.state = "idle"
	}

	statusText, statusDetail := summarizeStatus(record)
	command, args := summarizeCommand(record.plistData)
	record.summary = ServiceSummary{
		ID:           fullPath,
		Status:       record.state,
		StatusText:   statusText,
		StatusDetail: statusDetail,
		Label:        record.label,
		File:         fileName,
		ScopeKey:     record.scopeKey,
		Scope:        record.scope,
		Type:         record.serviceType,
		Command:      command,
		Args:         args,
		Schedule:     buildScheduleSummary(record.plistData),
		Result:       buildResultSummary(record),
		Path:         fullPath,
		ReadOnly:     record.readOnly,
		Disabled:     record.disabled,
		Invalid:      record.state == "invalid" || hasErrorIssue(record.validation),
		HasLogs:      record.hasLogs,
		HistoryCount: historyCounts[fullPath],
	}
	record.summary.Capabilities = buildCapabilities(record)

	return record
}

// populateHeavyRecordData 在详情或编辑场景补充重型数据。
func (s *Service) populateHeavyRecordData(ctx context.Context, record *serviceRecord) error {
	if record.rawXML == "" {
		rawXML, err := encodeXML(record.plistData)
		if err != nil {
			return err
		}
		record.rawXML = rawXML
	}

	if record.runtimeDump == "" && record.label != "" {
		runtimeDump, _ := s.runLaunchctl(ctx, "print", serviceTarget(record.domain, record.label))
		record.runtimeDump = runtimeDump
	}

	// 详情和编辑场景才执行完整校验，避免首次加载被 1000 个 plutil 卡住。
	record.validation = validateExistingMap(ctx, s.runner, record.plistData, record.path, record.fileName)
	record.summary.Invalid = record.state == "invalid" || hasErrorIssue(record.validation)
	return nil
}

// buildServiceDetail 由内部记录生成详情结构。
func (s *Service) buildServiceDetail(_ WorkspaceSnapshot, record *serviceRecord) ServiceDetail {
	historyEntries, _ := s.history.ListByService(record.path, 50)

	alerts := make([]DetailAlert, 0, len(record.validation)+3)
	if record.readOnly {
		alerts = append(alerts, DetailAlert{Type: "warning", Message: "这是只读范围任务，首版仅支持查看，不支持写操作。"})
	}
	if record.disabled {
		alerts = append(alerts, DetailAlert{Type: "warning", Message: "当前任务处于停用状态，需先启用后才能被 launchd 正常调度。"})
	}
	if record.lastExitCode != nil && *record.lastExitCode != 0 {
		alerts = append(alerts, DetailAlert{Type: "error", Message: fmt.Sprintf("最近一次退出码为 %d，请优先检查 stderr 日志。", *record.lastExitCode)})
	}
	for _, issue := range record.validation {
		alerts = append(alerts, DetailAlert{Type: issue.Level, Message: issue.Message})
	}

	groups := []DetailGroup{
		{
			Key:   "basic",
			Title: "基础信息",
			Items: []DetailItem{
				{Label: "Label", Value: record.label},
				{Label: "作用域", Value: record.scope},
				{Label: "类型", Value: record.serviceType},
				{Label: "配置路径", Value: record.path},
				{Label: "最近修改", Value: formatTime(record.modifiedAt)},
			},
		},
		{
			Key:   "command",
			Title: "启动命令",
			Items: []DetailItem{
				{Label: "Program", Value: firstNonEmpty(readString(record.plistData["Program"]), "未设置")},
				{Label: "ProgramArguments", Value: strings.Join(readStringSlice(record.plistData["ProgramArguments"]), " ")},
				{Label: "WorkingDirectory", Value: firstNonEmpty(readString(record.plistData["WorkingDirectory"]), "未设置")},
				{Label: "UserName", Value: firstNonEmpty(readString(record.plistData["UserName"]), "未设置")},
			},
		},
		{
			Key:   "schedule",
			Title: "调度与保活",
			Items: []DetailItem{
				{Label: "RunAtLoad", Value: boolText(readBool(record.plistData["RunAtLoad"]))},
				{Label: "KeepAlive", Value: boolText(readKeepAlive(record.plistData["KeepAlive"]))},
				{Label: "StartInterval", Value: formatIntField(record.plistData["StartInterval"])},
				{Label: "StartCalendarInterval", Value: formatCalendar(record.plistData["StartCalendarInterval"])},
			},
		},
		{
			Key:   "io",
			Title: "日志与环境",
			Items: []DetailItem{
				{Label: "StandardOutPath", Value: firstNonEmpty(readString(record.plistData["StandardOutPath"]), "未设置")},
				{Label: "StandardErrorPath", Value: firstNonEmpty(readString(record.plistData["StandardErrorPath"]), "未设置")},
				{Label: "EnvironmentVariables", Value: formatMapSize(record.plistData["EnvironmentVariables"])},
				{Label: "WatchPaths", Value: formatSliceSize(record.plistData["WatchPaths"])},
				{Label: "最近结果", Value: record.summary.Result},
			},
		},
	}

	var lastAction *HistoryEntry
	if len(historyEntries) > 0 {
		lastAction = &historyEntries[0]
	}

	return ServiceDetail{
		ServiceSummary:  record.summary,
		Alerts:          alerts,
		Groups:          groups,
		Validation:      record.validation,
		RuntimeDump:     record.runtimeDump,
		LastAction:      lastAction,
		AvailableStream: record.streams,
	}
}

// readDomainRuntime 读取指定 launchd 域的运行与停用状态。
func (s *Service) readDomainRuntime(ctx context.Context, domain string) (domainRuntime, error) {
	printOutput, err := s.runLaunchctl(ctx, "print", domain)
	if err != nil {
		return domainRuntime{}, err
	}

	disabledOutput, err := s.runLaunchctl(ctx, "print-disabled", domain)
	if err != nil {
		return domainRuntime{}, err
	}

	return domainRuntime{
		services: parseDomainServices(printOutput),
		disabled: parseDisabledServices(disabledOutput),
	}, nil
}

// runLaunchctl 执行 launchctl 命令。
func (s *Service) runLaunchctl(ctx context.Context, args ...string) (string, error) {
	return s.runner.Run(ctx, "launchctl", args...)
}

// parseDomainServices 解析 launchctl print 的 services 段。
func parseDomainServices(output string) map[string]runtimeStatus {
	lines := strings.Split(output, "\n")
	results := make(map[string]runtimeStatus)
	inServices := false
	depth := 0

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "services = {" {
			inServices = true
			depth = 1
			continue
		}

		if !inServices {
			continue
		}

		depth += strings.Count(line, "{")
		depth -= strings.Count(line, "}")

		if depth <= 0 {
			inServices = false
			continue
		}

		matches := servicesLinePattern.FindStringSubmatch(line)
		if len(matches) != 4 {
			continue
		}

		pid, _ := strconv.Atoi(matches[1])
		exitCodeText := matches[2]
		label := strings.TrimSpace(matches[3])
		status := runtimeStatus{
			pid:    pid,
			loaded: true,
		}

		// exit code 为 - 时表示 launchctl 未暴露最近退出码。
		if exitCodeText != "-" {
			exitCode, _ := strconv.Atoi(exitCodeText)
			status.exitCode = &exitCode
		}

		results[label] = status
	}

	return results
}

// parseDisabledServices 解析 launchctl print-disabled 输出。
func parseDisabledServices(output string) map[string]bool {
	results := make(map[string]bool)

	for _, line := range strings.Split(output, "\n") {
		matches := disabledLinePattern.FindStringSubmatch(line)
		if len(matches) != 3 {
			continue
		}

		results[matches[1]] = matches[2] == "disabled"
	}

	return results
}

// validateExistingMap 校验已存在文件的 plist 数据。
func validateExistingMap(ctx context.Context, runner commandRunner, rawMap map[string]interface{}, targetPath string, fileName string) []ValidationIssue {
	return validateCandidateMap(ctx, runner, rawMap, targetPath, fileName)
}

// validateSummaryMap 执行列表扫描阶段的轻量校验。
func validateSummaryMap(rawMap map[string]interface{}, fileName string) []ValidationIssue {
	issues := make([]ValidationIssue, 0, 4)

	label := strings.TrimSpace(readString(rawMap["Label"]))
	if label == "" {
		issues = append(issues, ValidationIssue{Level: "error", Field: "Label", Message: "Label 不能为空"})
	}

	if readString(rawMap["Program"]) == "" && len(readStringSlice(rawMap["ProgramArguments"])) == 0 {
		issues = append(issues, ValidationIssue{Level: "error", Field: "Program", Message: "Program 与 ProgramArguments 至少配置一项"})
	}

	if label != "" && strings.TrimSuffix(fileName, ".plist") != label {
		issues = append(issues, ValidationIssue{Level: "warning", Field: "fileName", Message: "文件名与 Label 不一致，建议保持一致"})
	}

	return issues
}

// validateCandidateMap 执行 plutil 与语义校验。
func validateCandidateMap(ctx context.Context, runner commandRunner, rawMap map[string]interface{}, targetPath string, fileName string) []ValidationIssue {
	issues := make([]ValidationIssue, 0, 8)

	xmlText, err := encodeXML(rawMap)
	if err != nil {
		return append(issues, ValidationIssue{Level: "error", Field: "rawXML", Message: err.Error()})
	}

	tempFile, err := os.CreateTemp("", "launchd-panel-*.plist")
	if err == nil {
		defer os.Remove(tempFile.Name())
		_, _ = tempFile.WriteString(xmlText)
		_ = tempFile.Close()

		// 先走系统 lint，确保写回给 launchctl 前格式合法。
		if _, lintErr := runner.Run(ctx, "plutil", "-lint", tempFile.Name()); lintErr != nil {
			issues = append(issues, ValidationIssue{Level: "error", Field: "rawXML", Message: lintErr.Error()})
		}
	}

	label := strings.TrimSpace(readString(rawMap["Label"]))
	if label == "" {
		issues = append(issues, ValidationIssue{Level: "error", Field: "Label", Message: "Label 不能为空"})
	}

	program := strings.TrimSpace(readString(rawMap["Program"]))
	programArgs := readStringSlice(rawMap["ProgramArguments"])
	if program == "" && len(programArgs) == 0 {
		issues = append(issues, ValidationIssue{Level: "error", Field: "Program", Message: "Program 与 ProgramArguments 至少配置一项"})
	}

	command := program
	if command == "" && len(programArgs) > 0 {
		command = programArgs[0]
	}

	if command != "" {
		if !filepath.IsAbs(command) {
			issues = append(issues, ValidationIssue{Level: "warning", Field: "Program", Message: "Program 建议使用绝对路径"})
		} else if _, statErr := os.Stat(command); statErr != nil {
			issues = append(issues, ValidationIssue{Level: "warning", Field: "Program", Message: "Program 指向的文件不存在"})
		}
	}

	if label != "" && strings.TrimSuffix(fileName, ".plist") != label {
		issues = append(issues, ValidationIssue{Level: "warning", Field: "fileName", Message: "文件名与 Label 不一致，建议保持一致"})
	}

	for _, field := range []struct {
		key   string
		value string
	}{
		{key: "StandardOutPath", value: readString(rawMap["StandardOutPath"])},
		{key: "StandardErrorPath", value: readString(rawMap["StandardErrorPath"])},
	} {
		if strings.TrimSpace(field.value) == "" {
			continue
		}

		dir := filepath.Dir(field.value)
		info, statErr := os.Stat(dir)
		if statErr != nil {
			// 可自动创建的目录不再提示，避免新建任务时出现误报。
			if canPrepareDir(dir) {
				continue
			}
			issues = append(issues, ValidationIssue{Level: "warning", Field: field.key, Message: "日志目录不存在，且当前无法自动创建"})
			continue
		}

		// 目录路径如果落到文件上，直接提示用户修正。
		if !info.IsDir() {
			issues = append(issues, ValidationIssue{Level: "warning", Field: field.key, Message: "日志目录路径无效"})
			continue
		}

		// 目录存在但不可写时提前提示，避免保存后运行才失败。
		if info.Mode().Perm()&0o200 == 0 {
			issues = append(issues, ValidationIssue{Level: "warning", Field: field.key, Message: "日志目录当前不可写"})
		}
	}

	if calendar := rawMap["StartCalendarInterval"]; calendar != nil {
		if _, err := json.Marshal(calendar); err != nil {
			issues = append(issues, ValidationIssue{Level: "error", Field: "StartCalendarInterval", Message: "StartCalendarInterval 结构非法"})
		}
	}

	if workingDirectory := readString(rawMap["WorkingDirectory"]); workingDirectory != "" {
		if _, err := os.Stat(workingDirectory); err != nil {
			issues = append(issues, ValidationIssue{Level: "warning", Field: "WorkingDirectory", Message: "WorkingDirectory 不存在"})
		}
	}

	return issues
}

// applyFormToMap 将表单字段映射回 plist 字典。
func applyFormToMap(rawMap map[string]interface{}, form ServiceFormData) {
	setOrDeleteString(rawMap, "Label", form.Label)
	setOrDeleteString(rawMap, "Program", form.Program)
	setOrDeleteSlice(rawMap, "ProgramArguments", form.ProgramArguments)
	setOrDeleteString(rawMap, "WorkingDirectory", form.WorkingDirectory)
	setOrDeleteBool(rawMap, "RunAtLoad", form.RunAtLoad)

	// KeepAlive 为复杂类型时，表单只在关闭时移除，开启时保留原复杂结构。
	if form.KeepAlive {
		if _, exists := rawMap["KeepAlive"]; !exists {
			rawMap["KeepAlive"] = true
		}
	} else {
		delete(rawMap, "KeepAlive")
	}

	if form.StartInterval > 0 {
		rawMap["StartInterval"] = form.StartInterval
	} else {
		delete(rawMap, "StartInterval")
	}

	if strings.TrimSpace(form.StartCalendarIntervalJSON) != "" {
		var value interface{}
		if err := json.Unmarshal([]byte(form.StartCalendarIntervalJSON), &value); err == nil {
			rawMap["StartCalendarInterval"] = value
		}
	} else {
		delete(rawMap, "StartCalendarInterval")
	}

	setOrDeleteString(rawMap, "StandardOutPath", form.StandardOutPath)
	setOrDeleteString(rawMap, "StandardErrorPath", form.StandardErrorPath)

	if len(form.EnvironmentVariables) > 0 {
		rawMap["EnvironmentVariables"] = cloneStringMap(form.EnvironmentVariables)
	} else {
		delete(rawMap, "EnvironmentVariables")
	}

	setOrDeleteSlice(rawMap, "WatchPaths", form.WatchPaths)
}

// buildFormData 从 plist 字典提取表单字段。
func buildFormData(rawMap map[string]interface{}, fileName string) ServiceFormData {
	calendarJSON := ""
	if calendar := rawMap["StartCalendarInterval"]; calendar != nil {
		bytes, err := json.MarshalIndent(calendar, "", "  ")
		if err == nil {
			calendarJSON = string(bytes)
		}
	}

	return ServiceFormData{
		Label:                     readString(rawMap["Label"]),
		FileName:                  fileName,
		Program:                   readString(rawMap["Program"]),
		ProgramArguments:          readStringSlice(rawMap["ProgramArguments"]),
		WorkingDirectory:          readString(rawMap["WorkingDirectory"]),
		RunAtLoad:                 readBool(rawMap["RunAtLoad"]),
		KeepAlive:                 readKeepAlive(rawMap["KeepAlive"]),
		StartInterval:             readInt(rawMap["StartInterval"]),
		StartCalendarIntervalJSON: calendarJSON,
		StandardOutPath:           readString(rawMap["StandardOutPath"]),
		StandardErrorPath:         readString(rawMap["StandardErrorPath"]),
		EnvironmentVariables:      readStringMap(rawMap["EnvironmentVariables"]),
		WatchPaths:                readStringSlice(rawMap["WatchPaths"]),
	}
}

// buildNavigationGroups 根据任务集合生成导航计数。
func buildNavigationGroups(tasks []ServiceSummary) []NavigationGroup {
	countByScope := map[string]int{}
	countByStatus := map[string]int{}
	logCount := 0
	historyCount := 0
	invalidCount := 0
	readonlyCount := 0

	for _, task := range tasks {
		countByScope[task.ScopeKey]++
		countByStatus[task.Status]++
		if task.HasLogs {
			logCount++
		}
		if task.HistoryCount > 0 {
			historyCount++
		}
		if task.Invalid {
			invalidCount++
		}
		if task.ReadOnly {
			readonlyCount++
		}
	}

	return []NavigationGroup{
		{
			Key:   "workspace",
			Title: "工作区",
			Items: []NavigationItem{
				{Key: "dashboard", Label: "总览", Count: len(tasks)},
				{Key: "tasks", Label: "任务", Count: len(tasks)},
				{Key: "configs", Label: "配置", Count: len(tasks)},
				{Key: "logs", Label: "日志", Count: logCount},
				{Key: "history", Label: "历史", Count: historyCount},
			},
		},
		{
			Key:   "scope",
			Title: "按作用域",
			Items: []NavigationItem{
				{Key: ScopeUserAgent, Label: "当前用户 Agent", Count: countByScope[ScopeUserAgent]},
				{Key: ScopeAllAgent, Label: "全部用户 Agent", Count: countByScope[ScopeAllAgent]},
				{Key: ScopeSystemAgent, Label: "系统 Agent", Count: countByScope[ScopeSystemAgent]},
				{Key: ScopeDaemon, Label: "系统 Daemon", Count: countByScope[ScopeDaemon]},
				{Key: ScopeUnknown, Label: "未归类配置", Count: countByScope[ScopeUnknown]},
			},
		},
		{
			Key:   "smart",
			Title: "智能视图",
			Items: []NavigationItem{
				{Key: "running", Label: "正在运行", Count: countByStatus["running"]},
				{Key: "loaded", Label: "已加载未运行", Count: countByStatus["loaded"]},
				{Key: "failed", Label: "启动失败", Count: countByStatus["failed"]},
				{Key: "invalid", Label: "配置无效", Count: invalidCount},
				{Key: "forbidden", Label: "只读范围", Count: readonlyCount},
				{Key: "nolog", Label: "日志不可用", Count: len(tasks) - logCount},
			},
		},
	}
}

// buildSummaryCards 生成顶部概览卡片。
func buildSummaryCards(tasks []ServiceSummary) []SummaryCard {
	loaded := 0
	running := 0
	failed := 0

	for _, task := range tasks {
		if task.Status == "running" {
			running++
		}
		if task.Status == "loaded" || task.Status == "running" || task.Status == "failed" {
			loaded++
		}
		if task.Status == "failed" {
			failed++
		}
	}

	return []SummaryCard{
		{Label: "全部任务", Value: len(tasks), Suffix: "项", Note: "扫描范围覆盖用户级、本地级与系统级目录"},
		{Label: "已加载", Value: loaded, Suffix: "项", Note: "基于 launchctl 域摘要合并得出"},
		{Label: "运行中", Value: running, Suffix: "项", Note: "当前域中存在活动进程的服务"},
		{Label: "启动失败", Value: failed, Suffix: "项", Note: "最近一次退出码非 0 的已加载服务"},
	}
}

// buildCapabilities 计算任务可执行动作。
func buildCapabilities(record *serviceRecord) CapabilityFlags {
	canMutate := !record.readOnly && record.label != ""

	return CapabilityFlags{
		CanStart:    canMutate && !record.disabled,
		CanStop:     canMutate && record.loaded,
		CanEdit:     !record.readOnly,
		CanDelete:   !record.readOnly,
		CanEnable:   canMutate && record.disabled,
		CanDisable:  canMutate && record.loaded && !record.disabled,
		CanReload:   !record.readOnly,
		CanReadLogs: record.hasLogs,
	}
}

// summarizeStatus 根据内部状态生成列表状态文本。
func summarizeStatus(record *serviceRecord) (string, string) {
	switch record.state {
	case "running":
		return "运行中", fmt.Sprintf("PID %d", record.pid)
	case "failed":
		if record.lastExitCode != nil {
			return "启动失败", fmt.Sprintf("退出码 %d", *record.lastExitCode)
		}
		return "启动失败", "最近执行失败"
	case "loaded":
		return "已加载", "当前无活动进程"
	case "invalid":
		return "配置无效", issueSummary(record.validation)
	default:
		if record.disabled {
			return "已停用", "launchctl 已禁用"
		}
		return "仅配置存在", "尚未加载"
	}
}

// summarizeCommand 生成列表中的主命令与参数文本。
func summarizeCommand(rawMap map[string]interface{}) (string, string) {
	program := readString(rawMap["Program"])
	args := readStringSlice(rawMap["ProgramArguments"])

	if program != "" {
		if len(args) > 0 && args[0] == program {
			args = args[1:]
		}
		return program, strings.Join(args, " ")
	}

	if len(args) == 0 {
		return "未设置", ""
	}

	return args[0], strings.Join(args[1:], " ")
}

// buildScheduleSummary 将 launchd 调度字段转成简短摘要。
func buildScheduleSummary(rawMap map[string]interface{}) string {
	if calendar := rawMap["StartCalendarInterval"]; calendar != nil {
		return formatCalendar(calendar)
	}
	if interval := readInt(rawMap["StartInterval"]); interval > 0 {
		return fmt.Sprintf("每 %d 秒", interval)
	}
	if readKeepAlive(rawMap["KeepAlive"]) {
		return "KeepAlive"
	}
	if readBool(rawMap["RunAtLoad"]) {
		return "RunAtLoad"
	}
	if watchPaths := readStringSlice(rawMap["WatchPaths"]); len(watchPaths) > 0 {
		return "WatchPaths"
	}
	return "按需启动"
}

// buildResultSummary 生成列表最近结果文案。
func buildResultSummary(record *serviceRecord) string {
	if record.disabled {
		return "已停用"
	}
	if record.lastExitCode != nil {
		if *record.lastExitCode == 0 {
			return "成功"
		}
		return fmt.Sprintf("退出码 %d", *record.lastExitCode)
	}
	if record.running {
		return "运行中"
	}
	if record.loaded {
		return "已加载"
	}
	return "暂无记录"
}

// readLogFile 读取日志文件尾部内容。
func readLogFile(path string, source string, limit int) ([]LogLine, string) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Sprintf("%s 日志未配置路径", source)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Sprintf("%s 日志不可读取: %s", source, err.Error())
	}

	rawLines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	filtered := make([]string, 0, len(rawLines))
	for _, line := range rawLines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		filtered = append(filtered, line)
	}

	if len(filtered) > limit {
		filtered = filtered[len(filtered)-limit:]
	}

	lines := make([]LogLine, 0, len(filtered))
	for _, line := range filtered {
		lines = append(lines, LogLine{
			Source: source,
			Text:   line,
		})
	}

	return lines, ""
}

// decodeAnyMap 将任意 plist 内容解析为 map。
func decodeAnyMap(data []byte) (map[string]interface{}, error) {
	var raw interface{}
	if _, err := plist.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	rawMap, ok := raw.(map[string]interface{})
	if !ok {
		return nil, errors.New("plist 根节点不是字典结构")
	}

	return rawMap, nil
}

// decodeXMLMap 将 XML 字符串解析为 map。
func decodeXMLMap(rawXML string) (map[string]interface{}, error) {
	return decodeAnyMap([]byte(rawXML))
}

// encodeXML 将字典编码为规范 XML。
func encodeXML(rawMap map[string]interface{}) (string, error) {
	data, err := plist.MarshalIndent(rawMap, plist.XMLFormat, "\t")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

// writeAtomicFile 以原子方式写入文件。
func writeAtomicFile(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(path), "*.tmp")
	if err != nil {
		return err
	}

	tempPath := tempFile.Name()
	defer os.Remove(tempPath)

	if _, err := tempFile.Write(data); err != nil {
		_ = tempFile.Close()
		return err
	}
	if err := tempFile.Chmod(mode); err != nil {
		_ = tempFile.Close()
		return err
	}
	if err := tempFile.Close(); err != nil {
		return err
	}

	return os.Rename(tempPath, path)
}

// prepareLogTargets 提前准备日志目录和文件，避免任务首次运行时找不到目标路径。
func prepareLogTargets(rawMap map[string]interface{}) error {
	handled := map[string]struct{}{}

	for _, path := range compactStrings([]string{
		readString(rawMap["StandardOutPath"]),
		readString(rawMap["StandardErrorPath"]),
	}) {
		if _, exists := handled[path]; exists {
			continue
		}
		handled[path] = struct{}{}

		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return fmt.Errorf("准备日志目录失败: %w", err)
		}

		info, err := os.Stat(path)
		if err == nil {
			// 目标已存在时直接复用，避免误改用户已有日志文件。
			if info.IsDir() {
				return fmt.Errorf("日志路径不能指向目录: %s", path)
			}
			continue
		}
		if !os.IsNotExist(err) {
			return fmt.Errorf("检查日志文件失败: %w", err)
		}

		file, openErr := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o644)
		if openErr != nil {
			return fmt.Errorf("创建日志文件失败: %w", openErr)
		}
		if closeErr := file.Close(); closeErr != nil {
			return fmt.Errorf("关闭日志文件失败: %w", closeErr)
		}
	}

	return nil
}

// findRecord 返回指定路径对应的内部记录。
func findRecord(records map[string]*serviceRecord, id string) (*serviceRecord, error) {
	record, ok := records[id]
	if !ok {
		return nil, fmt.Errorf("未找到任务: %s", id)
	}
	return record, nil
}

// serviceTarget 拼接 launchctl 服务目标。
func serviceTarget(domain string, label string) string {
	return fmt.Sprintf("%s/%s", domain, label)
}

// scopeLabel 返回作用域中文标签。
func scopeLabel(scopeKey string) string {
	switch scopeKey {
	case ScopeUserAgent:
		return "当前用户 Agent"
	case ScopeAllAgent:
		return "全部用户 Agent"
	case ScopeSystemAgent:
		return "系统 Agent"
	case ScopeDaemon:
		return "系统 Daemon"
	default:
		return "未归类配置"
	}
}

// hasErrorIssue 判断是否存在错误级校验问题。
func hasErrorIssue(issues []ValidationIssue) bool {
	for _, issue := range issues {
		if issue.Level == "error" {
			return true
		}
	}
	return false
}

// issueSummary 生成校验问题摘要。
func issueSummary(issues []ValidationIssue) string {
	if len(issues) == 0 {
		return ""
	}
	return issues[0].Message
}

// safeFileName 返回记录上的安全文件名。
func safeFileName(base *serviceRecord) string {
	if base == nil {
		return ""
	}
	return base.fileName
}

// sanitizeFileName 校验并规范化文件名。
func sanitizeFileName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("文件名不能为空")
	}

	// 禁止把文件写到任意路径，避免越权覆盖用户目录外文件。
	if filepath.Base(name) != name {
		return "", errors.New("文件名不能包含路径")
	}

	if !strings.HasSuffix(name, ".plist") {
		name += ".plist"
	}

	return name, nil
}

// newServiceFormData 返回新建任务的默认表单数据。
func (s *Service) newServiceFormData() ServiceFormData {
	fileName := "com.example.new-task.plist"
	stdoutPath, stderrPath := s.defaultLogPaths("", fileName)

	return ServiceFormData{
		FileName:             fileName,
		StandardOutPath:      stdoutPath,
		StandardErrorPath:    stderrPath,
		EnvironmentVariables: map[string]string{},
		ProgramArguments:     []string{},
		WatchPaths:           []string{},
	}
}

// defaultLogPaths 生成默认日志文件路径。
func (s *Service) defaultLogPaths(label string, fileName string) (string, string) {
	stem := buildLogFileStem(firstNonEmpty(label, fileName))
	logDir := filepath.Join(s.homeDir, "Library", "Logs", "launchd-panel")

	return filepath.Join(logDir, stem+".stdout.log"), filepath.Join(logDir, stem+".stderr.log")
}

// buildLogFileStem 将任务文件名转换为日志文件名片段。
func buildLogFileStem(fileName string) string {
	stem := strings.TrimSpace(filepath.Base(fileName))
	stem = strings.TrimSuffix(stem, ".plist")
	stem = strings.TrimSpace(logFileStemPattern.ReplaceAllString(stem, "-"))
	stem = strings.Trim(stem, "-._")
	if stem == "" {
		return "task"
	}
	return stem
}

// cloneMap 深拷贝 map[string]interface{}。
func cloneMap(input map[string]interface{}) map[string]interface{} {
	output := make(map[string]interface{}, len(input))
	for key, value := range input {
		output[key] = deepClone(value)
	}
	return output
}

// deepClone 递归拷贝常见 plist 值。
func deepClone(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		return cloneMap(typed)
	case map[string]string:
		return cloneStringMap(typed)
	case []interface{}:
		items := make([]interface{}, 0, len(typed))
		for _, item := range typed {
			items = append(items, deepClone(item))
		}
		return items
	case []string:
		items := make([]string, len(typed))
		copy(items, typed)
		return items
	default:
		return typed
	}
}

// cloneStringMap 深拷贝 map[string]string。
func cloneStringMap(input map[string]string) map[string]string {
	output := make(map[string]string, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}

// readString 安全读取字符串值。
func readString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

// readStringSlice 安全读取字符串数组。
func readStringSlice(value interface{}) []string {
	switch typed := value.(type) {
	case []string:
		items := make([]string, len(typed))
		copy(items, typed)
		return items
	case []interface{}:
		items := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok {
				items = append(items, text)
			}
		}
		return items
	default:
		return []string{}
	}
}

// readStringMap 安全读取字符串映射。
func readStringMap(value interface{}) map[string]string {
	switch typed := value.(type) {
	case map[string]string:
		return cloneStringMap(typed)
	case map[string]interface{}:
		result := make(map[string]string, len(typed))
		for key, item := range typed {
			text, ok := item.(string)
			if ok {
				result[key] = text
			}
		}
		return result
	default:
		return map[string]string{}
	}
}

// readBool 安全读取布尔值。
func readBool(value interface{}) bool {
	typed, ok := value.(bool)
	return ok && typed
}

// readKeepAlive 兼容 KeepAlive 的布尔或复杂字典写法。
func readKeepAlive(value interface{}) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case map[string]interface{}:
		return len(typed) > 0
	default:
		return false
	}
}

// readInt 安全读取整数。
func readInt(value interface{}) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case uint64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}

// setOrDeleteString 根据值决定写入或删除字符串字段。
func setOrDeleteString(rawMap map[string]interface{}, key string, value string) {
	if strings.TrimSpace(value) == "" {
		delete(rawMap, key)
		return
	}
	rawMap[key] = strings.TrimSpace(value)
}

// setOrDeleteSlice 根据值决定写入或删除数组字段。
func setOrDeleteSlice(rawMap map[string]interface{}, key string, values []string) {
	filtered := compactStrings(values)
	if len(filtered) == 0 {
		delete(rawMap, key)
		return
	}
	rawMap[key] = filtered
}

// setOrDeleteBool 根据值决定写入或删除布尔字段。
func setOrDeleteBool(rawMap map[string]interface{}, key string, value bool) {
	if !value {
		delete(rawMap, key)
		return
	}
	rawMap[key] = true
}

// compactStrings 过滤空字符串。
func compactStrings(values []string) []string {
	results := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		results = append(results, strings.TrimSpace(value))
	}
	return results
}

// firstNonEmpty 返回首个非空字符串。
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// canPrepareDir 判断目录是否可由当前用户自动创建。
func canPrepareDir(path string) bool {
	current := strings.TrimSpace(path)
	if current == "" {
		return false
	}

	for {
		info, err := os.Stat(current)
		if err == nil {
			return info.IsDir() && info.Mode().Perm()&0o200 != 0
		}

		// 只允许沿着不存在的目录向上探测，其他错误直接视为不可准备。
		if !os.IsNotExist(err) {
			return false
		}

		parent := filepath.Dir(current)
		if parent == current {
			return false
		}
		current = parent
	}
}

// formatTime 格式化时间。
func formatTime(value time.Time) string {
	if value.IsZero() {
		return "未知"
	}
	return value.Format("2006-01-02 15:04:05")
}

// boolText 将布尔值转换为中文。
func boolText(value bool) string {
	if value {
		return "开启"
	}
	return "关闭"
}

// formatIntField 格式化整数详情字段。
func formatIntField(value interface{}) string {
	number := readInt(value)
	if number <= 0 {
		return "未设置"
	}
	return strconv.Itoa(number)
}

// formatCalendar 将 StartCalendarInterval 转成紧凑文本。
func formatCalendar(value interface{}) string {
	if value == nil {
		return "未设置"
	}

	bytes, err := json.Marshal(value)
	if err != nil {
		return "已设置"
	}

	return string(bytes)
}

// formatMapSize 返回映射大小说明。
func formatMapSize(value interface{}) string {
	return fmt.Sprintf("%d 项", len(readStringMap(value)))
}

// formatSliceSize 返回数组大小说明。
func formatSliceSize(value interface{}) string {
	return fmt.Sprintf("%d 项", len(readStringSlice(value)))
}

// hasLogPaths 判断任务是否配置了日志路径。
func hasLogPaths(rawMap map[string]interface{}) bool {
	return readString(rawMap["StandardOutPath"]) != "" || readString(rawMap["StandardErrorPath"]) != ""
}

// availableStreams 计算可查看的日志流。
func availableStreams(rawMap map[string]interface{}) []string {
	streams := make([]string, 0, 3)
	if readString(rawMap["StandardOutPath"]) != "" {
		streams = append(streams, "stdout")
	}
	if readString(rawMap["StandardErrorPath"]) != "" {
		streams = append(streams, "stderr")
	}
	if len(streams) > 1 {
		streams = append(streams, "combined")
	}
	return streams
}
