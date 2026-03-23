package main

import (
	"context"

	"launchd-panel/internal/launchd"
)

// App 聚合 Wails 暴露给前端的业务方法。
type App struct {
	ctx     context.Context
	service *launchd.Service
}

// NewApp 创建应用实例并初始化 launchd 服务。
func NewApp() *App {
	service, err := launchd.NewService()
	if err != nil {
		panic(err)
	}

	return &App{
		service: service,
	}
}

// startup 在应用启动时缓存上下文。
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetThemeMode 返回当前持久化的主题模式。
func (a *App) GetThemeMode() string {
	return loadPersistedThemeMode()
}

// SaveThemeMode 保存当前主题模式，供下次启动时恢复窗口外观。
func (a *App) SaveThemeMode(themeMode string) error {
	return savePersistedThemeMode(themeMode)
}

// GetWorkspaceSnapshot 返回工作区首页数据。
func (a *App) GetWorkspaceSnapshot() (launchd.WorkspaceSnapshot, error) {
	return a.service.GetWorkspaceSnapshot(a.requestContext())
}

// GetServiceDetail 返回任务详情。
func (a *App) GetServiceDetail(id string) (launchd.ServiceDetail, error) {
	return a.service.GetServiceDetail(a.requestContext(), id)
}

// GetServiceEditor 返回任务编辑器数据。
func (a *App) GetServiceEditor(id string) (launchd.ServiceEditorState, error) {
	return a.service.GetServiceEditor(a.requestContext(), id)
}

// ValidateServiceConfig 校验任务配置。
func (a *App) ValidateServiceConfig(req launchd.ValidateServiceConfigRequest) (launchd.ValidateServiceConfigResponse, error) {
	return a.service.ValidateServiceConfig(a.requestContext(), req)
}

// SaveServiceConfig 保存任务配置。
func (a *App) SaveServiceConfig(req launchd.SaveServiceConfigRequest) (launchd.SaveServiceConfigResponse, error) {
	return a.service.SaveServiceConfig(a.requestContext(), req)
}

// ExecuteServiceAction 执行任务动作。
func (a *App) ExecuteServiceAction(req launchd.ExecuteServiceActionRequest) (launchd.ExecuteServiceActionResponse, error) {
	return a.service.ExecuteServiceAction(a.requestContext(), req)
}

// ReadServiceLogs 读取任务日志。
func (a *App) ReadServiceLogs(req launchd.ReadServiceLogsRequest) (launchd.ReadServiceLogsResponse, error) {
	return a.service.ReadServiceLogs(a.requestContext(), req)
}

// ClearServiceLogs 清空任务日志。
func (a *App) ClearServiceLogs(req launchd.ClearServiceLogsRequest) (launchd.ClearServiceLogsResponse, error) {
	return a.service.ClearServiceLogs(a.requestContext(), req)
}

// ListServiceHistory 返回任务历史。
func (a *App) ListServiceHistory(id string) ([]launchd.HistoryEntry, error) {
	return a.service.ListServiceHistory(a.requestContext(), id)
}

// BatchExecute 执行批量动作。
func (a *App) BatchExecute(req launchd.BatchExecuteRequest) (launchd.BatchExecuteResponse, error) {
	return a.service.BatchExecute(a.requestContext(), req)
}

// requestContext 返回可用的请求上下文。
func (a *App) requestContext() context.Context {
	// Wails 生命周期外调用时退回到 Background，避免空上下文导致崩溃。
	if a.ctx == nil {
		return context.Background()
	}
	return a.ctx
}
