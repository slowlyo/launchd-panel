package main

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

const (
	defaultThemeMode    = "system"
	appSettingsDirName  = "launchd-panel"
	appSettingsFileName = "preferences.json"
)

var supportedThemeModes = map[string]struct{}{
	"light":  {},
	"dark":   {},
	"system": {},
}

type persistedAppSettings struct {
	ThemeMode string `json:"themeMode"`
}

// normalizePersistedThemeMode 统一主题模式，避免异常值污染配置。
func normalizePersistedThemeMode(themeMode string) string {
	if _, ok := supportedThemeModes[themeMode]; !ok {
		return defaultThemeMode
	}

	return themeMode
}

// resolveSettingsFilePath 返回应用设置文件路径。
func resolveSettingsFilePath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, appSettingsDirName, appSettingsFileName), nil
}

// loadPersistedThemeMode 读取本地保存的主题模式。
func loadPersistedThemeMode() string {
	settingsPath, err := resolveSettingsFilePath()
	if err != nil {
		return defaultThemeMode
	}

	content, err := os.ReadFile(settingsPath)
	if err != nil {
		return defaultThemeMode
	}

	var settings persistedAppSettings
	if err := json.Unmarshal(content, &settings); err != nil {
		return defaultThemeMode
	}

	return normalizePersistedThemeMode(settings.ThemeMode)
}

// savePersistedThemeMode 保存主题模式到本地配置文件。
func savePersistedThemeMode(themeMode string) error {
	settingsPath, err := resolveSettingsFilePath()
	if err != nil {
		return err
	}

	// 先确保配置目录存在，再写入最新偏好。
	if err := os.MkdirAll(filepath.Dir(settingsPath), 0o755); err != nil {
		return err
	}

	content, err := json.MarshalIndent(persistedAppSettings{
		ThemeMode: normalizePersistedThemeMode(themeMode),
	}, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(settingsPath, content, 0o644)
}

// resolveMacAppearance 根据主题模式决定窗口外观。
func resolveMacAppearance(themeMode string) mac.AppearanceType {
	switch normalizePersistedThemeMode(themeMode) {
	case "light":
		return mac.NSAppearanceNameAqua
	case "dark":
		return mac.NSAppearanceNameDarkAqua
	default:
		return mac.DefaultAppearance
	}
}
