//go:build darwin

package main

/*
#cgo LDFLAGS: -framework UniformTypeIdentifiers
*/
import "C"

// 链接 UniformTypeIdentifiers，修复 Wails 在新 macOS SDK 下引用 UTType 的链接失败。
