package launchd

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeRunner 用于替代外部命令执行。
type fakeRunner struct {
	outputs map[string]string
	calls   []string
}

// Run 记录命令并返回预设结果。
func (f *fakeRunner) Run(_ context.Context, name string, args ...string) (string, error) {
	call := name + " " + strings.Join(args, " ")
	f.calls = append(f.calls, call)
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
