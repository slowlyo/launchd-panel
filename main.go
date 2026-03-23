package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

// main 启动桌面应用并注册窗口配置。
func main() {
	// 创建应用实例，供窗口生命周期和前后端绑定使用。
	app := NewApp()
	themeMode := loadPersistedThemeMode()

	// 设置桌面应用窗口参数，限制最小尺寸以避免布局被过度压缩。
	err := wails.Run(&options.App{
		Title:     "launchd-panel",
		Width:     1100,
		Height:    768,
		MinWidth:  1000,
		MinHeight: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		Mac: &mac.Options{
			Appearance: resolveMacAppearance(themeMode),
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})

	// 启动失败时直接输出错误，便于本地排查初始化问题。
	if err != nil {
		println("Error:", err.Error())
	}
}
