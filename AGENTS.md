# AGENTS.md

## 项目概述

[`launchd-panel`](README.md) 是一个基于 [`Wails`](wails.json) 的桌面应用，用于统一管理 macOS 上的 [`launchd`](main.go:1) 任务与 plist 配置。

项目当前结构由 Go 后端与 React 前端组成：
- 后端入口：[`main.go`](main.go)
- 应用结构：[`app.go`](app.go)
- 前端目录：[`frontend/`](frontend)
- 前端主界面入口：[`frontend/src/App.jsx`](frontend/src/App.jsx)

## 技术栈

### 后端
- Go
- [`Wails`](wails.json)

### 前端
- React 18
- Vite
- [`antd`](frontend/package.json:13)
- [`@ant-design/icons`](frontend/package.json:12)
- [`simplebar-react`](frontend/package.json:16)
- [`tailwindcss`](frontend/package.json:17)

## 目录说明

```text
launchd-panel/
├── app.go
├── main.go
├── go.mod
├── README.md
├── wails.json
├── build/
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── src/
    │   ├── App.jsx
    │   ├── style.css
    │   └── components/
    │       ├── ConfigurationPanel.jsx
    │       ├── DetailPanel.jsx
    │       ├── LogHistoryPanel.jsx
    │       ├── Navigation.jsx
    │       ├── ScrollArea.jsx
    │       ├── StatusTag.jsx
    │       ├── SummarySection.jsx
    │       ├── TasksTable.jsx
    │       └── mockData.jsx
    └── wailsjs/
```

## 前端架构约定

### 页面组织
当前前端以 [`App()`](frontend/src/App.jsx:24) 作为工作台页面容器，负责：
- 布局骨架
- antd 主题配置
- 导航状态管理
- 当前任务选择状态
- 侧边栏与内容区滚动容器编排
- 首屏按“紧凑概览 + 任务列表”组织主工作区
- 任务列表单击默认打开详情抽屉，右键通过上下文菜单选择详情、编辑或日志
- 表格提供显式“操作”列下拉菜单，方便新用户发现详情、编辑与日志入口
- 选中任务后的详情、编辑、日志均通过右侧抽屉承载，避免挤压任务列表

### 组件拆分
界面按职责拆分为以下子组件：
- [`Navigation`](frontend/src/components/Navigation.jsx:8)：侧边导航
- [`SummarySection`](frontend/src/components/SummarySection.jsx:7)：顶部紧凑统计概览
- [`TasksTable`](frontend/src/components/TasksTable.jsx:9)：任务列表表格
- [`ConfigurationPanel`](frontend/src/components/ConfigurationPanel.jsx:8)：配置编辑展示区
- [`LogHistoryPanel`](frontend/src/components/LogHistoryPanel.jsx:8)：日志与执行历史
- [`DetailPanel`](frontend/src/components/DetailPanel.jsx:15)：任务详情与风险信息
- [`ScrollArea`](frontend/src/components/ScrollArea.jsx:15)：统一滚动区域封装
- [`StatusTag`](frontend/src/components/StatusTag.jsx:21)：状态展示组件

### 数据组织
原型阶段的展示数据集中在 [`frontend/src/components/mockData.jsx`](frontend/src/components/mockData.jsx)。

后续接入真实数据时建议：
- 将 UI mock 数据替换为接口层或 Wails runtime 数据层
- 保持组件只负责渲染，不直接耦合数据获取逻辑
- 将状态映射逻辑继续保留在独立模块中

## 设计与交互约定

### UI 框架原则
- 优先使用 [`antd`](frontend/package.json:12) 原生组件
- 避免重复造轮子
- 自定义样式仅用于布局补充、日志区、响应式细节与品牌层

### 视觉风格
- 保持中性灰白背景
- 避免高饱和蓝紫主色
- 当前项目既有主题色已固定为 antd 默认蓝体系，主色为 `#1677ff`，相关高亮、选中、标签与概览数值需保持一致，除非用户明确要求，否则不要改动
- 卡片、表格、抽屉、标签等遵循 antd 默认语义
- 危险操作使用红色或警告色强调

### 响应式策略
- 大屏：左侧导航 + 中间内容，详情与配置通过右侧抽屉展示
- 中屏：维持列表主视图，详情、配置、日志继续使用抽屉
- 小屏：侧边栏上移为顶部区块，主内容继续纵向排布
- 表格保留横向滚动，不强行压缩字段语义

## 代码规范

### 通用原则
- 遵循 KISS、DRY、YAGNI
- 优先小而清晰的组件
- 避免单文件堆积大量无复用逻辑
- 不在循环中执行 I/O 密集操作

### 注释规范
- 注释必须使用中文
- 每个方法必须有注释
- 条件分支处需要写清楚意图
- 不写无意义注释

### React 约定
- 使用函数组件
- 组件职责单一
- 展示型组件优先无副作用
- 复用的状态映射逻辑放入独立方法或模块

### 样式约定
- 全局样式入口：[`frontend/src/style.css`](frontend/src/style.css)
- 通过 [`frontend/postcss.config.js`](frontend/postcss.config.js) 接入 Tailwind CSS v4
- 优先复用 antd token、Tailwind 工具类与组件语义类
- 谨慎覆盖 antd 默认样式，避免破坏一致性

## 构建与开发

### 前端开发
在 [`frontend/package.json`](frontend/package.json:6) 中定义了以下命令：
- [`pnpm dev`](frontend/package.json:7)
- [`pnpm build`](frontend/package.json:8)
- [`pnpm preview`](frontend/package.json:9)

推荐使用 pnpm。

### 构建检查
前端改动后至少执行：
- [`pnpm build`](frontend/package.json:8)

当前已知情况：
- 构建可通过
- antd 引入后存在 chunk 体积偏大的警告
- 如后续继续扩展页面，建议考虑按页面或功能做动态拆包

## 后续开发建议

### 数据接入
后续建议将以下模块逐步替换为真实数据：
- 任务列表
- 任务详情
- 日志内容
- 历史记录
- 配置校验结果

### 推荐优先级
1. 建立 Go -> Wails -> React 的数据桥接
2. 定义 launchd 任务领域模型
3. 接入真实扫描结果与任务状态
4. 实现配置读写与校验
5. 实现日志读取与历史记录

## Agent 工作指引

### 修改前
- 先阅读相关文件
- 优先判断是否已有可复用组件
- 不要直接推翻现有 antd 结构

### 修改时
- 新增 UI 优先拆为子组件
- 展示数据与结构数据尽量分离
- 保持移动端和窄窗口可用
- 保持 launchd 专业术语与用户可读说明并存

### 修改后
- 如涉及前端代码，执行 [`pnpm build`](frontend/package.json:8)
- 如新增组件，补充到本文件目录说明中
- 如架构变化明显，及时更新 [`README.md`](README.md) 与本文件

## 禁止事项
- 不要无必要替换 [`antd`](frontend/package.json:12) 为其他 UI 框架
- 不要将大量静态数据重新散落到多个页面文件
- 不要引入与当前需求无关的复杂状态管理库
- 不要为“未来可能用到”提前做重型抽象

## 文档维护
当以下内容变化时，应同步更新 [`AGENTS.md`](AGENTS.md)：
- 技术栈
- 目录结构
- 核心组件划分
- 构建命令
- 响应式策略
- Agent 协作约束
