import {
  AppstoreOutlined,
  BarsOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';

export const navigationGroups = [
  {
    key: 'workspace',
    title: '工作区',
    items: [
      { key: 'dashboard', label: '总览', icon: <AppstoreOutlined /> },
      { key: 'tasks', label: '任务', count: 184, icon: <BarsOutlined /> },
      { key: 'configs', label: '配置', count: 212, icon: <CodeOutlined /> },
      { key: 'logs', label: '日志', count: 36, icon: <FileSearchOutlined /> },
      { key: 'history', label: '历史', count: 1280, icon: <HistoryOutlined /> },
    ],
  },
  {
    key: 'scope',
    title: '按作用域',
    items: [
      { key: 'user-agent', label: '当前用户 Agent', count: 62, icon: <DesktopOutlined /> },
      { key: 'all-agent', label: '全部用户 Agent', count: 49, icon: <DesktopOutlined /> },
      { key: 'daemon', label: '系统 Daemon', count: 73, icon: <DatabaseOutlined /> },
      { key: 'unknown', label: '未归类配置', count: 9, icon: <FolderOpenOutlined /> },
    ],
  },
  {
    key: 'smart',
    title: '智能视图',
    items: [
      { key: 'running', label: '正在运行', count: 28, icon: <PlayCircleOutlined /> },
      { key: 'loaded', label: '已加载未运行', count: 46, icon: <InfoCircleOutlined /> },
      { key: 'failed', label: '启动失败', count: 7, icon: <WarningOutlined /> },
      { key: 'invalid', label: '配置无效', count: 4, icon: <ExclamationCircleOutlined /> },
      { key: 'forbidden', label: '权限不足', count: 11, icon: <SafetyCertificateOutlined /> },
      { key: 'nolog', label: '日志不可用', count: 18, icon: <FileTextOutlined /> },
    ],
  },
];

export const summaryCards = [
  { label: '全部任务', value: 184, suffix: '项', note: '扫描范围覆盖用户级与系统级' },
  { label: '已加载', value: 74, suffix: '项', note: '近 5 分钟内状态已刷新' },
  { label: '运行中', value: 28, suffix: '项', note: '含 6 个常驻服务' },
  { label: '启动失败', value: 7, suffix: '项', note: '建议优先查看 stderr 不可用任务' },
];

export const filterChips = ['scope:all', 'type:agent,daemon', 'status:failed,running,loaded', 'risk:root', 'logs:any'];

export const tasks = [
  {
    key: '1',
    status: 'running',
    statusText: '运行中',
    statusDetail: 'PID 812',
    label: 'com.company.sync-agent',
    file: 'com.company.sync-agent.plist',
    scope: '当前用户 Agent',
    command: '/usr/local/bin/sync-agent',
    args: '--watch ~/Documents --retry 3',
    schedule: 'RunAtLoad + KeepAlive',
    result: '成功 · 2 分钟前',
    path: '~/Library/LaunchAgents/com.company.sync-agent.plist',
  },
  {
    key: '2',
    status: 'failed',
    statusText: '启动失败',
    statusDetail: '退出码 78',
    label: 'com.ops.backup.daily',
    file: 'com.ops.backup.daily.plist',
    scope: '系统 Daemon',
    command: '/usr/local/bin/backup-job',
    args: '--target /Volumes/archive',
    schedule: '每天 02:00',
    result: '退出码 78 · 8 分钟前',
    path: '/Library/LaunchDaemons/com.ops.backup.daily.plist',
  },
  {
    key: '3',
    status: 'loaded',
    statusText: '已加载',
    statusDetail: '当前无活动进程',
    label: 'com.apple.metadata.mds',
    file: 'com.apple.metadata.mds.plist',
    scope: '系统 Daemon',
    command: '/usr/libexec/mds',
    args: 'MachService 按需激活',
    schedule: 'MachService 激活',
    result: '暂无最近结果',
    path: '/System/Library/LaunchDaemons/com.apple.metadata.mds.plist',
  },
  {
    key: '4',
    status: 'warning',
    statusText: '权限不足',
    statusDetail: '系统级只读',
    label: 'com.secure.audit.agent',
    file: 'com.secure.audit.agent.plist',
    scope: '全部用户 Agent',
    command: '/opt/audit/bin/audit-agent',
    args: '--profile baseline',
    schedule: '每 300 秒',
    result: '成功 · 昨天 21:13',
    path: '/Library/LaunchAgents/com.secure.audit.agent.plist',
  },
  {
    key: '5',
    status: 'idle',
    statusText: '仅配置存在',
    statusDetail: '尚未加载',
    label: 'com.team.cleanup.weekly',
    file: 'com.team.cleanup.weekly.plist',
    scope: '当前用户 Agent',
    command: '/Users/demo/bin/cleanup.sh',
    args: '--deep',
    schedule: '每周日 03:30',
    result: '暂无记录',
    path: '~/Library/LaunchAgents/com.team.cleanup.weekly.plist',
  },
];

export const detailGroups = [
  {
    key: 'basic',
    title: '基础信息',
    items: [
      ['Label', 'com.ops.backup.daily'],
      ['作用域', '系统 Daemon'],
      ['类型', 'LaunchDaemon'],
      ['配置路径', '/Library/LaunchDaemons/com.ops.backup.daily.plist'],
      ['最近修改', '今天 13:42'],
    ],
  },
  {
    key: 'command',
    title: '启动命令',
    items: [
      ['Program', '/usr/local/bin/backup-job'],
      ['ProgramArguments', '--target /Volumes/archive --full'],
      ['WorkingDirectory', '/usr/local/var/backup'],
      ['UserName', 'root'],
      ['SessionType', 'System'],
    ],
  },
  {
    key: 'schedule',
    title: '调度与保活',
    items: [
      ['RunAtLoad', '开启'],
      ['KeepAlive', '关闭'],
      ['StartInterval', '未设置'],
      ['StartCalendarInterval', '每天 02:00'],
      ['ThrottleInterval', '60 秒'],
    ],
  },
  {
    key: 'io',
    title: '日志与环境',
    items: [
      ['StandardOutPath', '/var/log/backup-job.log'],
      ['StandardErrorPath', '/var/log/backup-job.error.log'],
      ['EnvironmentVariables', '3 个变量'],
      ['MachServices', '未配置'],
      ['最近结果', '退出码 78 · 8 分钟前'],
    ],
  },
];

export const formSections = [
  {
    key: 'base',
    title: '基础',
    description: '用于定义唯一标识、作用域和保存位置。',
    fields: [
      { label: 'Label', value: 'com.team.cleanup.weekly', helper: '当前扫描范围内唯一。' },
      { label: '作用域', value: '当前用户 Agent', helper: '保存到 ~/Library/LaunchAgents。' },
      { label: '文件名', value: 'com.team.cleanup.weekly.plist', helper: '建议与 Label 保持一致。' },
    ],
  },
  {
    key: 'command',
    title: '命令',
    description: '优先使用 Program + ProgramArguments 组合。',
    fields: [
      { label: 'Program', value: '/Users/demo/bin/cleanup.sh', helper: '路径存在，具备执行权限。' },
      { label: 'ProgramArguments', value: '--deep --report', helper: '建议拆分为数组参数。' },
      { label: 'WorkingDirectory', value: '/Users/demo/workspace', helper: '目录可访问。' },
    ],
  },
  {
    key: 'schedule',
    title: '调度',
    description: '统一支持 RunAtLoad、KeepAlive、StartInterval 与日历计划。',
    fields: [
      { label: 'RunAtLoad', value: '开启', helper: '登录后立即执行。' },
      { label: 'StartCalendarInterval', value: '每周日 03:30', helper: '下次执行：03 月 24 日 03:30。' },
      { label: 'KeepAlive', value: '关闭', helper: '一次性维护任务建议关闭。' },
    ],
  },
  {
    key: 'io',
    title: '日志与环境',
    description: '建议同时配置 stdout 与 stderr。',
    fields: [
      { label: 'StandardOutPath', value: '/Users/demo/Library/Logs/cleanup.log', helper: '首次运行时自动创建。' },
      { label: 'StandardErrorPath', value: '/Users/demo/Library/Logs/cleanup.error.log', helper: '当前可写。' },
      { label: 'EnvironmentVariables', value: 'TEAM=ops, MODE=deep', helper: '支持键值表格编辑。' },
    ],
  },
];

export const logLines = [
  '2026-03-21 13:49:58 [INFO] backup-job started with profile=full',
  '2026-03-21 13:49:59 [INFO] scanning source=/Volumes/archive',
  '2026-03-21 13:50:01 [ERROR] destination is not writable',
  '2026-03-21 13:50:01 [ERROR] job exited with code 78',
];

export const historyEvents = [
  { color: 'red', children: '13:50:01 · 任务退出 · 失败，退出码 78' },
  { color: 'blue', children: '13:49:58 · 手动启动 · 成功发起' },
  { color: 'green', children: '13:42:10 · 编辑配置 · 已保存并重新加载' },
  { color: 'gray', children: '昨天 02:00 · 计划执行 · 成功' },
];
