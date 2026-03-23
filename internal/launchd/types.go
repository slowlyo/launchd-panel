package launchd

import "time"

const (
	// ScopeUserAgent 表示当前用户可写的 LaunchAgent。
	ScopeUserAgent = "user-agent"
	// ScopeAllAgent 表示 /Library 下的全局 Agent。
	ScopeAllAgent = "all-agent"
	// ScopeSystemAgent 表示 /System/Library 下的系统 Agent。
	ScopeSystemAgent = "system-agent"
	// ScopeDaemon 表示所有 Daemon。
	ScopeDaemon = "daemon"
	// ScopeUnknown 表示无法正确归类的配置。
	ScopeUnknown = "unknown"

	// ActionStart 表示启动任务。
	ActionStart = "start"
	// ActionStop 表示停止任务。
	ActionStop = "stop"
	// ActionEnable 表示启用任务。
	ActionEnable = "enable"
	// ActionDisable 表示停用任务。
	ActionDisable = "disable"
	// ActionReload 表示重载任务。
	ActionReload = "reload"
	// ActionDelete 表示删除任务。
	ActionDelete = "delete"
	// ActionValidate 表示校验任务。
	ActionValidate = "validate"
)

// WorkspaceSnapshot 表示首页工作区的完整快照。
type WorkspaceSnapshot struct {
	RefreshedAt      string            `json:"refreshedAt"`
	NavigationGroups []NavigationGroup `json:"navigationGroups"`
	SummaryCards     []SummaryCard     `json:"summaryCards"`
	Tasks            []ServiceSummary  `json:"tasks"`
}

// NavigationGroup 表示侧边导航分组。
type NavigationGroup struct {
	Key   string           `json:"key"`
	Title string           `json:"title"`
	Items []NavigationItem `json:"items"`
}

// NavigationItem 表示导航项。
type NavigationItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

// SummaryCard 表示顶部概览卡片。
type SummaryCard struct {
	Label  string `json:"label"`
	Value  int    `json:"value"`
	Suffix string `json:"suffix"`
	Note   string `json:"note"`
}

// ServiceSummary 表示列表中的任务摘要。
type ServiceSummary struct {
	ID           string          `json:"id"`
	Status       string          `json:"status"`
	StatusText   string          `json:"statusText"`
	StatusDetail string          `json:"statusDetail"`
	Label        string          `json:"label"`
	File         string          `json:"file"`
	ScopeKey     string          `json:"scopeKey"`
	Scope        string          `json:"scope"`
	Type         string          `json:"type"`
	Command      string          `json:"command"`
	Args         string          `json:"args"`
	Schedule     string          `json:"schedule"`
	Result       string          `json:"result"`
	Path         string          `json:"path"`
	ReadOnly     bool            `json:"readOnly"`
	Disabled     bool            `json:"disabled"`
	Invalid      bool            `json:"invalid"`
	HasLogs      bool            `json:"hasLogs"`
	HistoryCount int             `json:"historyCount"`
	Capabilities CapabilityFlags `json:"capabilities"`
}

// CapabilityFlags 表示任务可执行能力矩阵。
type CapabilityFlags struct {
	CanStart    bool `json:"canStart"`
	CanStop     bool `json:"canStop"`
	CanEdit     bool `json:"canEdit"`
	CanDelete   bool `json:"canDelete"`
	CanEnable   bool `json:"canEnable"`
	CanDisable  bool `json:"canDisable"`
	CanReload   bool `json:"canReload"`
	CanReadLogs bool `json:"canReadLogs"`
}

// ServiceDetail 表示详情抽屉数据。
type ServiceDetail struct {
	ServiceSummary
	Alerts          []DetailAlert     `json:"alerts"`
	Groups          []DetailGroup     `json:"groups"`
	Validation      []ValidationIssue `json:"validation"`
	RuntimeDump     string            `json:"runtimeDump"`
	LastAction      *HistoryEntry     `json:"lastAction,omitempty"`
	AvailableStream []string          `json:"availableStream"`
}

// DetailAlert 表示详情告警。
type DetailAlert struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// DetailGroup 表示详情分组。
type DetailGroup struct {
	Key   string       `json:"key"`
	Title string       `json:"title"`
	Items []DetailItem `json:"items"`
}

// DetailItem 表示详情字段。
type DetailItem struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// ValidationIssue 表示校验问题。
type ValidationIssue struct {
	Level   string `json:"level"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ServiceEditorState 表示编辑器所需数据。
type ServiceEditorState struct {
	ServiceID      string            `json:"serviceId"`
	Mode           string            `json:"mode"`
	ReadOnly       bool              `json:"readOnly"`
	ScopeKey       string            `json:"scopeKey"`
	Scope          string            `json:"scope"`
	FileName       string            `json:"fileName"`
	RawXML         string            `json:"rawXML"`
	Form           ServiceFormData   `json:"form"`
	EditableFields []string          `json:"editableFields"`
	Validation     []ValidationIssue `json:"validation"`
}

// ServiceFormData 表示结构化表单数据。
type ServiceFormData struct {
	Label                     string            `json:"label"`
	FileName                  string            `json:"fileName"`
	Program                   string            `json:"program"`
	ProgramArguments          []string          `json:"programArguments"`
	WorkingDirectory          string            `json:"workingDirectory"`
	RunAtLoad                 bool              `json:"runAtLoad"`
	KeepAlive                 bool              `json:"keepAlive"`
	StartInterval             int               `json:"startInterval"`
	StartCalendarIntervalJSON string            `json:"startCalendarIntervalJson"`
	StandardOutPath           string            `json:"standardOutPath"`
	StandardErrorPath         string            `json:"standardErrorPath"`
	EnvironmentVariables      map[string]string `json:"environmentVariables"`
	WatchPaths                []string          `json:"watchPaths"`
}

// ValidateServiceConfigRequest 表示配置校验请求。
type ValidateServiceConfigRequest struct {
	ID        string          `json:"id"`
	Scope     string          `json:"scope"`
	FileName  string          `json:"fileName"`
	RawXML    string          `json:"rawXML"`
	FormPatch ServiceFormData `json:"formPatch"`
	Mode      string          `json:"mode"`
}

// ValidateServiceConfigResponse 表示配置校验结果。
type ValidateServiceConfigResponse struct {
	OK         bool              `json:"ok"`
	RawXML     string            `json:"rawXML"`
	Form       ServiceFormData   `json:"form"`
	Validation []ValidationIssue `json:"validation"`
}

// SaveServiceConfigResponse 表示保存配置后的结果。
type SaveServiceConfigRequest struct {
	ID        string          `json:"id"`
	Scope     string          `json:"scope"`
	FileName  string          `json:"fileName"`
	RawXML    string          `json:"rawXML"`
	FormPatch ServiceFormData `json:"formPatch"`
	Mode      string          `json:"mode"`
	ApplyLoad bool            `json:"applyLoad"`
}

// SaveServiceConfigResponse 表示保存配置后的结果。
type SaveServiceConfigResponse struct {
	ServiceID  string             `json:"serviceId"`
	Detail     ServiceDetail      `json:"detail"`
	Editor     ServiceEditorState `json:"editor"`
	Snapshot   WorkspaceSnapshot  `json:"snapshot"`
	Validation []ValidationIssue  `json:"validation"`
}

// ExecuteServiceActionRequest 表示任务动作请求。
type ExecuteServiceActionRequest struct {
	ID     string `json:"id"`
	Action string `json:"action"`
}

// ExecuteServiceActionResponse 表示任务动作结果。
type ExecuteServiceActionResponse struct {
	Success  bool              `json:"success"`
	Message  string            `json:"message"`
	Detail   ServiceDetail     `json:"detail"`
	Snapshot WorkspaceSnapshot `json:"snapshot"`
}

// ReadServiceLogsRequest 表示日志读取请求。
type ReadServiceLogsRequest struct {
	ID     string `json:"id"`
	Stream string `json:"stream"`
	Limit  int    `json:"limit"`
}

// ReadServiceLogsResponse 表示日志读取结果。
type ReadServiceLogsResponse struct {
	ServiceID string        `json:"serviceId"`
	Stream    string        `json:"stream"`
	Lines     []LogLine     `json:"lines"`
	Warnings  []DetailAlert `json:"warnings"`
	Paths     []string      `json:"paths"`
}

// ClearServiceLogsRequest 表示日志清空请求。
type ClearServiceLogsRequest struct {
	ID     string `json:"id"`
	Stream string `json:"stream"`
}

// ClearServiceLogsResponse 表示日志清空结果。
type ClearServiceLogsResponse struct {
	ServiceID    string   `json:"serviceId"`
	Stream       string   `json:"stream"`
	ClearedPaths []string `json:"clearedPaths"`
}

// LogLine 表示日志行。
type LogLine struct {
	Source string `json:"source"`
	Text   string `json:"text"`
}

// BatchExecuteRequest 表示批量操作请求。
type BatchExecuteRequest struct {
	IDs    []string `json:"ids"`
	Action string   `json:"action"`
}

// BatchExecuteResponse 表示批量操作响应。
type BatchExecuteResponse struct {
	Results  []BatchActionResult `json:"results"`
	Snapshot WorkspaceSnapshot   `json:"snapshot"`
}

// BatchActionResult 表示单条批量动作结果。
type BatchActionResult struct {
	ID      string            `json:"id"`
	Label   string            `json:"label"`
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Issues  []ValidationIssue `json:"issues"`
}

// HistoryEntry 表示应用内动作历史。
type HistoryEntry struct {
	ID        string    `json:"id"`
	ServiceID string    `json:"serviceId"`
	Label     string    `json:"label"`
	Action    string    `json:"action"`
	Success   bool      `json:"success"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}
