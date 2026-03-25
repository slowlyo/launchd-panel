package launchd

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeRunner 用于替代外部命令执行。
type fakeRunner struct {
	outputs map[string]string
	errors  map[string]error
	calls   []string
}

// Run 记录命令并返回预设结果。
func (f *fakeRunner) Run(_ context.Context, name string, args ...string) (string, error) {
	call := name + " " + strings.Join(args, " ")
	f.calls = append(f.calls, call)

	// 命中预设错误时直接返回，模拟 launchctl 失败链路。
	if err, ok := f.errors[call]; ok {
		return f.outputs[call], err
	}

	return f.outputs[call], nil
}

// TestParseDomainServices 确保 launchctl 域摘要能被稳定解析。
func TestParseDomainServices(t *testing.T) {
	output := `
gui/501 = {
	services = {
	     812      - 	com.company.sync-agent
	       0      78 	com.ops.backup.daily
	}
}`

	results := parseDomainServices(output)

	if len(results) != 2 {
		t.Fatalf("expected 2 services, got %d", len(results))
	}
	if results["com.company.sync-agent"].pid != 812 {
		t.Fatalf("expected pid 812, got %d", results["com.company.sync-agent"].pid)
	}
	if results["com.ops.backup.daily"].exitCode == nil || *results["com.ops.backup.daily"].exitCode != 78 {
		t.Fatalf("expected exit code 78, got %#v", results["com.ops.backup.daily"].exitCode)
	}
}

// TestParseDisabledServices 确保停用状态能正确解析。
func TestParseDisabledServices(t *testing.T) {
	output := `
disabled services = {
	"com.apple.weather.menu" => enabled
	"com.apple.ScriptMenuApp" => disabled
}`

	results := parseDisabledServices(output)

	if results["com.apple.weather.menu"] {
		t.Fatalf("expected com.apple.weather.menu to be enabled")
	}
	if !results["com.apple.ScriptMenuApp"] {
		t.Fatalf("expected com.apple.ScriptMenuApp to be disabled")
	}
}

// TestApplyFormToMapPreservesUnknownKeys 确保表单保存不会误删未覆盖字段。
func TestApplyFormToMapPreservesUnknownKeys(t *testing.T) {
	rawMap := map[string]interface{}{
		"Label":            "com.example.demo",
		"KeepAlive":        map[string]interface{}{"SuccessfulExit": false},
		"ThrottleInterval": 60,
	}

	applyFormToMap(rawMap, ServiceFormData{
		Label:      "com.example.demo",
		Program:    "/usr/bin/true",
		KeepAlive:  true,
		RunAtLoad:  true,
		WatchPaths: []string{"/tmp/demo"},
		FileName:   "com.example.demo.plist",
	})

	if _, ok := rawMap["ThrottleInterval"]; !ok {
		t.Fatalf("expected unknown key to be preserved")
	}
	if _, ok := rawMap["KeepAlive"].(map[string]interface{}); !ok {
		t.Fatalf("expected complex KeepAlive to be preserved")
	}
	if !readBool(rawMap["RunAtLoad"]) {
		t.Fatalf("expected RunAtLoad to be true")
	}
}

// TestNewServiceFormDataPrefillsLogPaths 确保新建任务会预填默认日志路径。
func TestNewServiceFormDataPrefillsLogPaths(t *testing.T) {
	service := &Service{
		homeDir: "/Users/demo",
	}

	form := service.newServiceFormData()

	if form.StandardOutPath != filepath.Join("/Users/demo", "Library", "Logs", "launchd-panel", "com.example.new-task.stdout.log") {
		t.Fatalf("unexpected stdout path: %s", form.StandardOutPath)
	}
	if form.StandardErrorPath != filepath.Join("/Users/demo", "Library", "Logs", "launchd-panel", "com.example.new-task.stderr.log") {
		t.Fatalf("unexpected stderr path: %s", form.StandardErrorPath)
	}
}

// TestDefaultLogPathsPreferLabel 确保日志路径优先使用任务标识。
func TestDefaultLogPathsPreferLabel(t *testing.T) {
	service := &Service{
		homeDir: "/Users/demo",
	}

	stdoutPath, stderrPath := service.defaultLogPaths("com.example.actual-label", "demo.plist")

	if stdoutPath != filepath.Join("/Users/demo", "Library", "Logs", "launchd-panel", "com.example.actual-label.stdout.log") {
		t.Fatalf("unexpected stdout path: %s", stdoutPath)
	}
	if stderrPath != filepath.Join("/Users/demo", "Library", "Logs", "launchd-panel", "com.example.actual-label.stderr.log") {
		t.Fatalf("unexpected stderr path: %s", stderrPath)
	}
}

// TestValidateCandidateMap 校验关键错误和警告都能被识别。
func TestValidateCandidateMap(t *testing.T) {
	runner := &fakeRunner{}
	issues := validateCandidateMap(context.Background(), runner, map[string]interface{}{
		"Program": "/path/not-found",
	}, "/tmp/demo.plist", "demo.plist")

	if len(issues) == 0 {
		t.Fatalf("expected validation issues")
	}
	if !hasErrorIssue(issues) {
		t.Fatalf("expected at least one error issue")
	}
}

// TestValidateCandidateMapAllowsCreatableLogDir 确保可自动创建的日志目录不会误报。
func TestValidateCandidateMapAllowsCreatableLogDir(t *testing.T) {
	tempDir := t.TempDir()
	commandPath := filepath.Join(tempDir, "demo.sh")
	if err := os.WriteFile(commandPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatalf("write command file failed: %v", err)
	}

	issues := validateCandidateMap(context.Background(), &fakeRunner{}, map[string]interface{}{
		"Label":           "demo",
		"Program":         commandPath,
		"StandardOutPath": filepath.Join(tempDir, "logs", "demo.stdout.log"),
	}, filepath.Join(tempDir, "demo.plist"), "demo.plist")

	for _, issue := range issues {
		if issue.Field == "StandardOutPath" {
			t.Fatalf("unexpected log path issue: %+v", issue)
		}
	}
}

// TestPrepareLogTargetsCreatesFiles 确保保存前会创建缺失的日志目录和文件。
func TestPrepareLogTargetsCreatesFiles(t *testing.T) {
	tempDir := t.TempDir()
	stdoutPath := filepath.Join(tempDir, "logs", "demo.stdout.log")
	stderrPath := filepath.Join(tempDir, "logs", "demo.stderr.log")

	if err := prepareLogTargets(map[string]interface{}{
		"StandardOutPath":   stdoutPath,
		"StandardErrorPath": stderrPath,
	}); err != nil {
		t.Fatalf("prepare log targets failed: %v", err)
	}

	if _, err := os.Stat(stdoutPath); err != nil {
		t.Fatalf("stdout log file missing: %v", err)
	}
	if _, err := os.Stat(stderrPath); err != nil {
		t.Fatalf("stderr log file missing: %v", err)
	}
}

// TestTruncateLogFilesClearsContent 确保日志清空仅截断内容，不删除文件。
func TestTruncateLogFilesClearsContent(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "demo.log")

	if err := os.WriteFile(logPath, []byte("line 1\nline 2\n"), 0o644); err != nil {
		t.Fatalf("write log file failed: %v", err)
	}

	if err := truncateLogFiles([]string{logPath}); err != nil {
		t.Fatalf("truncate log file failed: %v", err)
	}

	info, err := os.Stat(logPath)
	if err != nil {
		t.Fatalf("stat truncated log file failed: %v", err)
	}
	if info.Size() != 0 {
		t.Fatalf("expected log file to be empty, got %d", info.Size())
	}
}

// TestReadLogFileStripsANSIEscapeSequences 确保日志读取会移除 ANSI 控制序列。
func TestReadLogFileStripsANSIEscapeSequences(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "ansi.log")
	content := strings.Join([]string{
		"\x1b[1;33mWARN\x1b[0m rpc warning",
		"\x1b]0;launchd-panel\x07\x1b[1;32mNOTICE\x1b[0m 中文正常",
		"",
	}, "\n")

	if err := os.WriteFile(logPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write ansi log file failed: %v", err)
	}

	lines, warning := readLogFile(logPath, "stdout", 10)
	if warning != "" {
		t.Fatalf("expected empty warning, got %q", warning)
	}
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
	if lines[0].Text != "WARN rpc warning" {
		t.Fatalf("unexpected first line: %q", lines[0].Text)
	}
	if lines[1].Text != "NOTICE 中文正常" {
		t.Fatalf("unexpected second line: %q", lines[1].Text)
	}
}

// TestHistoryStoreAppendAndList 确保历史记录能落盘并按倒序返回。
func TestHistoryStoreAppendAndList(t *testing.T) {
	store := &HistoryStore{
		path: filepath.Join(t.TempDir(), "history.json"),
	}

	if err := store.Append(store.NewEntry("/tmp/a.plist", "a", "save", true, "ok")); err != nil {
		t.Fatalf("append first entry failed: %v", err)
	}
	if err := store.Append(store.NewEntry("/tmp/a.plist", "a", "reload", true, "ok")); err != nil {
		t.Fatalf("append second entry failed: %v", err)
	}
	if err := store.Append(store.NewEntry("/tmp/b.plist", "b", "save", true, "ok")); err != nil {
		t.Fatalf("append third entry failed: %v", err)
	}

	entries, err := store.ListByService("/tmp/a.plist", 10)
	if err != nil {
		t.Fatalf("list history failed: %v", err)
	}

	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if entries[0].Action != "reload" {
		t.Fatalf("expected latest action to be reload, got %s", entries[0].Action)
	}

	data, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read persisted history failed: %v", err)
	}
	if !strings.Contains(string(data), "\"serviceId\": \"/tmp/a.plist\"") {
		t.Fatalf("expected persisted history file to contain service id")
	}
}

// TestExecuteStartReturnsDetailedBootstrapError 确保启动失败时会透出具体原因。
func TestExecuteStartReturnsDetailedBootstrapError(t *testing.T) {
	runner := &fakeRunner{
		outputs: map[string]string{
			"launchctl bootstrap gui/501 /tmp/demo.plist": "Bootstrap failed: 5: Input/output error",
		},
		errors: map[string]error{
			"launchctl bootstrap gui/501 /tmp/demo.plist": errors.New("exit status 5"),
		},
	}
	service := &Service{
		runner: runner,
		gui:    "gui/501",
	}
	record := &serviceRecord{
		path:   "/tmp/demo.plist",
		label:  "com.example.demo",
		domain: "gui/501",
		loaded: false,
	}

	success, message, err := service.executeStart(context.Background(), record)

	if success {
		t.Fatalf("expected start to fail")
	}
	if err == nil {
		t.Fatalf("expected detailed error")
	}
	if !strings.Contains(message, "加载任务失败") {
		t.Fatalf("expected prefixed message, got %q", message)
	}
	if !strings.Contains(message, "exit status 5") {
		t.Fatalf("expected original bootstrap detail, got %q", message)
	}
}

// TestExecuteStopUsesBootout 确保停止动作会卸载任务，避免被 launchd 立即拉起。
func TestExecuteStopUsesBootout(t *testing.T) {
	runner := &fakeRunner{}
	service := &Service{
		runner: runner,
	}
	record := &serviceRecord{
		path:   "/tmp/demo.plist",
		label:  "com.example.demo",
		domain: "gui/501",
		loaded: true,
	}

	success, message, err := service.executeStop(context.Background(), record)

	if err != nil {
		t.Fatalf("expected stop to succeed, got %v", err)
	}
	if !success {
		t.Fatalf("expected stop to succeed")
	}
	if message != "任务已停止" {
		t.Fatalf("unexpected stop message: %q", message)
	}
	if len(runner.calls) != 1 {
		t.Fatalf("expected 1 launchctl call, got %d", len(runner.calls))
	}
	if runner.calls[0] != "launchctl bootout gui/501 /tmp/demo.plist" {
		t.Fatalf("unexpected launchctl call: %q", runner.calls[0])
	}
}
