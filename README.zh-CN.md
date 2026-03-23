# launchd-panel

<p align="center">
  <img src="./build/appicon.png" alt="launchd-panel logo" width="160" />
</p>

基于 Wails、Go 和 React 的 macOS `launchd` 任务与 plist 可视化管理工具。

[English](./README.md)

## 安装

前往 [GitHub Releases](https://github.com/slowlyo/launchd-panel/releases) 下载最新的 `darwin_universal.zip`，解压后将 `Launchd Panel.app` 放到“应用程序”目录即可。

当前版本未做 Apple 签名与公证，首次打开如果被 macOS 拦截：

- 在 Finder 中右键 `Launchd Panel.app`，选择“打开”
- 或前往“系统设置 → 隐私与安全性”，允许该应用继续打开

## 项目简介

`launchd-panel` 是一个面向 macOS 的 `launchd` 可视化管理面板。

它基于 Wails 构建，使用 Go 负责 `launchctl`、plist 与日志处理，使用 React 负责工作台界面，当前重点解决以下问题：

- 统一查看用户级、全局和系统级 `launchd` 任务
- 为当前用户 `LaunchAgent` 提供真实可执行的配置管理与运行控制
- 用更低门槛的界面维护 plist，而不是直接手写 XML
- 将日志、运行状态、配置校验和操作历史放到同一工作台

## 当前功能

### 工作区总览

- 扫描以下目录并生成统一快照
  - `~/Library/LaunchAgents`
  - `/Library/LaunchAgents`
  - `/Library/LaunchDaemons`
  - `/System/Library/LaunchAgents`
  - `/System/Library/LaunchDaemons`
- 合并 `launchctl print` 与 `launchctl print-disabled` 的运行态信息
- 展示任务状态、退出码、停用状态、调度方式、命令摘要、日志可用性与历史数量
- 提供顶部概览卡片与左侧导航计数
- 支持按导航分组、搜索词和当前选择状态筛选列表

### 任务管理

- 当前用户 `~/Library/LaunchAgents` 支持真实写操作
- 支持单任务操作
  - 启动
  - 停止
  - 启用
  - 停用
  - 重载
  - 校验
  - 删除
- 支持批量操作
  - 批量校验
  - 批量停用
- 系统级与全局目录任务真实展示，但保持只读

### 配置编辑

- 新建任务与编辑任务共用同一套配置抽屉
- 提供三种维护模式
  - 麻瓜模式
  - 专业表单
  - 原始 plist
- 支持结构化字段维护
  - `Label`
  - `Program`
  - `ProgramArguments`
  - `WorkingDirectory`
  - `RunAtLoad`
  - `KeepAlive`
  - `StartInterval`
  - `StartCalendarInterval`
  - `StandardOutPath`
  - `StandardErrorPath`
  - `EnvironmentVariables`
  - `WatchPaths`
- 保存时保留未覆盖的原始 plist 键
- 新建任务时自动补全更易用的文件名与日志路径建议值
- 可选择仅保存，或保存后立即重新加载任务

### 详情、日志与历史

- 详情抽屉展示
  - 关键状态摘要
  - 告警与校验结果
  - plist 派生字段
  - `launchctl print` 运行时信息
  - 最近操作记录
- 日志抽屉支持
  - `stdout`
  - `stderr`
  - 合并视图
  - 自动刷新
  - 实时跟踪
  - 下载当前日志
  - 清空当前日志文件
- 操作历史持久化到本地，重启应用后仍可查看

### 工作台设置

- 支持界面主题
  - 明亮
  - 暗色
  - 跟随系统
- 支持记住“是否展示系统任务”
- 设置保存在本机配置目录

## 管理范围

| 范围 | 路径 | 能力 |
| --- | --- | --- |
| 当前用户 Agent | `~/Library/LaunchAgents` | 完整管理 |
| 全局 Agent | `/Library/LaunchAgents` | 只读查看 |
| 全局 Daemon | `/Library/LaunchDaemons` | 只读查看 |
| 系统 Agent | `/System/Library/LaunchAgents` | 只读查看 |
| 系统 Daemon | `/System/Library/LaunchDaemons` | 只读查看 |

## 界面结构

- 首屏采用“紧凑概览 + 任务列表”布局
- 左侧导航负责范围、状态、日志、历史等维度切换
- 单击列表行默认打开详情抽屉
- 右键菜单和操作列下拉菜单可直接进入详情、编辑、日志或执行动作
- 配置、详情、日志统一通过右侧抽屉承载，避免打断主列表浏览

## 技术栈

### 后端

- Go 1.23
- Wails v2
- `howett.net/plist`

### 前端

- React 18
- Vite
- Ant Design
- Monaco Editor
- simplebar-react
- Tailwind CSS v4

## 目录结构

```text
launchd-panel/
├── .github/
│   └── workflows/
│       └── release.yml
├── app.go
├── main.go
├── settings.go
├── internal/
│   └── launchd/
│       ├── history.go
│       ├── service.go
│       ├── service_test.go
│       └── types.go
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── style.css
│   │   └── components/
│   │       ├── ConfigurationPanel.jsx
│   │       ├── DetailPanel.jsx
│   │       ├── LogHistoryPanel.jsx
│   │       ├── Navigation.jsx
│   │       ├── PlistEditor.jsx
│   │       ├── ScrollArea.jsx
│   │       ├── SettingsPanel.jsx
│   │       ├── StatusTag.jsx
│   │       ├── SummarySection.jsx
│   │       └── TasksTable.jsx
├── build/
├── README.md
├── README.zh-CN.md
└── wails.json
```

## 开发环境

### 环境要求

- macOS
- Go 1.23 或更高版本
- Node.js 18 或更高版本
- `pnpm`
- Wails CLI

### 安装依赖

```bash
cd "frontend"
pnpm install
```

### 前端开发

```bash
cd "frontend"
pnpm dev
```

### 桌面联调

```bash
wails dev
```

## 构建

### 前端构建

```bash
cd "frontend"
pnpm build
```

### 桌面应用构建

```bash
wails build
```

### Tag 发版

推送任意 tag 后都会自动触发 GitHub Actions，例如 `v0.1.0`。

流水线会完成以下动作：

- 执行 `wails build -clean -platform darwin/universal`
- 将 `build/bin/launchd-panel.app` 重命名为 `Launchd Panel.app` 后打包为 zip
- 自动创建 GitHub Release，并上传 zip 与 SHA-256 校验文件

## 说明

- 当前版本只对用户目录 `LaunchAgent` 开放写操作
- 系统级与全局任务默认隐藏，可在设置中手动打开
- 日志查看依赖任务实际配置的 `StandardOutPath` 与 `StandardErrorPath`
