package main

import "testing"

// TestCompareVersions 验证版本比较逻辑覆盖正式版与预发布版本。
func TestCompareVersions(t *testing.T) {
	testCases := []struct {
		name     string
		left     string
		right    string
		expected int
	}{
		{name: "major", left: "1.2.0", right: "0.9.0", expected: 1},
		{name: "minor", left: "0.2.0", right: "0.1.9", expected: 1},
		{name: "patch", left: "0.1.2", right: "0.1.3", expected: -1},
		{name: "same", left: "0.1.2", right: "0.1.2", expected: 0},
		{name: "stable beats prerelease", left: "0.1.2", right: "0.1.2-beta.1", expected: 1},
		{name: "numeric prerelease", left: "0.1.2-beta.2", right: "0.1.2-beta.10", expected: -1},
		{name: "invalid current treated older", left: "dev", right: "0.1.2", expected: -1},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			actual := compareVersions(testCase.left, testCase.right)
			if actual != testCase.expected {
				t.Fatalf("compareVersions(%q, %q) = %d, want %d", testCase.left, testCase.right, actual, testCase.expected)
			}
		})
	}
}

// TestSelectReleaseAssetFor 验证 darwin 平台优先选择 universal 包。
func TestSelectReleaseAssetFor(t *testing.T) {
	assets := []githubReleaseAsset{
		{Name: "launchd-panel_0.1.2_darwin_arm64.zip"},
		{Name: "launchd-panel_0.1.2_darwin_universal.zip"},
		{Name: "launchd-panel_0.1.2_darwin_universal.zip.sha256"},
	}

	selected, ok := selectReleaseAssetFor("darwin", "arm64", assets)
	if !ok {
		t.Fatal("expected to select a darwin asset")
	}

	if selected.Name != "launchd-panel_0.1.2_darwin_universal.zip" {
		t.Fatalf("unexpected asset selected: %s", selected.Name)
	}
}
