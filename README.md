# launchd-panel

基于 [`Wails`](wails.json) 与 React 的 macOS [`launchd`](main.go:1) 任务管理面板。

## 当前能力

- 扫描 `~/Library/LaunchAgents`、`/Library/LaunchAgents`、`/Library/LaunchDaemons`、`/System/Library/LaunchAgents`、`/System/Library/LaunchDaemons`
- 合并 `launchctl print` 与 `launchctl print-disabled` 的真实运行态、退出码和停用状态
- 当前用户 `LaunchAgent` 支持真实创建、编辑、校验、加载、重载、启停、停用与删除
- 系统级与全局目录任务真实展示但保持只读
- 读取 `StandardOutPath` / `StandardErrorPath` 日志，新建任务时自动预填日志路径，并持久化应用内操作历史
- 提供应用设置抽屉，支持按设备记住“是否展示系统任务”

## 技术栈

- Go
- Wails
- [`howett.net/plist`](go.mod)
- React 18
- [`antd`](frontend/package.json:13)
- [`@monaco-editor/react`](frontend/package.json:12)
- [`simplebar-react`](frontend/package.json:16)
- [`tailwindcss`](frontend/package.json:17)

## 开发

前端开发目录：[`frontend/`](frontend)

```bash
cd frontend
pnpm install
pnpm dev
```

桌面联调：

```bash
wails dev
```

## 构建

前端构建：

```bash
cd frontend
pnpm build
```

桌面应用构建：

```bash
wails build
```

## 样式方案

- 全局样式入口：[`frontend/src/style.css`](frontend/src/style.css)
- 通过 [`frontend/postcss.config.js`](frontend/postcss.config.js) 接入 Tailwind CSS v4
- 保留 [`antd`](frontend/package.json:13) 组件体系，使用 Tailwind 工具类与组件层样式简化布局和视觉定制
- 滚动区域统一通过 [`frontend/src/components/ScrollArea.jsx`](frontend/src/components/ScrollArea.jsx) 封装 [`simplebar-react`](frontend/package.json:16)

## 后端结构

- Wails 绑定入口：[`app.go`](app.go)
- launchd 领域服务：[`internal/launchd/service.go`](internal/launchd/service.go)
- 历史持久化：[`internal/launchd/history.go`](internal/launchd/history.go)
- 对外传输类型：[`internal/launchd/types.go`](internal/launchd/types.go)

## 界面布局

- 首屏采用“紧凑概览 + 任务列表”结构，任务列表作为主工作区优先展示
- 头部工具栏提供“设置”入口，当前默认隐藏系统级与全局任务，可按需打开
- 单击任务列表项默认打开详情抽屉，右键可选择详情、编辑配置或日志
- 表格操作列提供同样的下拉菜单入口，降低新用户学习成本
- 详情、编辑配置和日志历史统一通过右侧抽屉承载，减少对任务浏览与筛选的干扰
- 配置抽屉支持“麻瓜模式 / 专业表单 / 原始 plist”三种维护模式
- 原始 plist 模式使用 Monaco Editor 处理 XML，便于维护复杂键和值
- 表格支持多选后批量校验与批量停用
