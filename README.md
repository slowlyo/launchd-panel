# launchd-panel

基于 [`Wails`](wails.json) 与 React 的 macOS [`launchd`](main.go:1) 任务管理面板。

## 技术栈

- Go
- Wails
- React 18
- [`antd`](frontend/package.json:13)
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

## 界面布局

- 首屏采用“紧凑概览 + 任务列表”结构，任务列表作为主工作区优先展示
- 单击任务列表项默认打开详情抽屉，右键可选择详情、编辑配置或日志
- 表格操作列提供同样的下拉菜单入口，降低新用户学习成本
- 详情、编辑配置和日志历史统一通过右侧抽屉承载，减少对任务浏览与筛选的干扰
