import './App.css';

const navigationGroups = [
  {
    title: '工作区',
    items: [
      { label: '总览', count: null, active: false },
      { label: '任务', count: 184, active: true },
      { label: '配置', count: 212, active: false },
      { label: '日志', count: 36, active: false },
      { label: '历史', count: 1280, active: false },
    ],
  },
  {
    title: '按作用域',
    items: [
      { label: '当前用户 Agent', count: 62, active: false },
      { label: '全部用户 Agent', count: 49, active: false },
      { label: '系统 Daemon', count: 73, active: false },
      { label: '未归类配置', count: 9, active: false },
    ],
  },
  {
    title: '智能视图',
    items: [
      { label: '正在运行', count: 28, active: false },
      { label: '已加载未运行', count: 46, active: false },
      { label: '启动失败', count: 7, active: false },
      { label: '配置无效', count: 4, active: false },
      { label: '权限不足', count: 11, active: false },
      { label: '日志不可用', count: 18, active: false },
    ],
  },
];

const summaryCards = [
  { label: '全部任务', value: '184', note: '扫描范围包含用户级与系统级' },
  { label: '已加载', value: '74', note: '近 5 分钟刷新' },
  { label: '运行中', value: '28', note: '含 6 个常驻服务' },
  { label: '启动失败', value: '7', note: '建议优先处理 stderr 不可用项' },
];

const filterChips = [
  'scope:all',
  'type:agent,daemon',
  'status:failed,running,loaded',
  'risk:root',
  'logs:any',
];

const taskRows = [
  {
    status: { tone: 'running', text: '运行中', detail: 'PID 812' },
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
    status: { tone: 'failed', text: '启动失败', detail: '退出码 78' },
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
    status: { tone: 'loaded', text: '已加载', detail: '当前无活动进程' },
    label: 'com.apple.metadata.mds',
    file: 'com.apple.metadata.mds.plist',
    scope: '系统 Daemon',
    command: '/usr/libexec/mds',
    args: '按需启动',
    schedule: 'MachService 激活',
    result: '暂无最近结果',
    path: '/System/Library/LaunchDaemons/com.apple.metadata.mds.plist',
  },
  {
    status: { tone: 'warning', text: '权限不足', detail: '只读查看' },
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
    status: { tone: 'idle', text: '仅配置存在', detail: '尚未加载' },
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

const detailGroups = [
  {
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

const formSections = [
  {
    title: '基础',
    description: '用于定义唯一标识、作用域和保存位置。',
    fields: [
      { label: 'Label', value: 'com.team.cleanup.weekly', helper: '当前扫描范围内唯一。' },
      { label: '作用域', value: '当前用户 Agent', helper: '保存到 ~/Library/LaunchAgents。' },
      { label: '文件名', value: 'com.team.cleanup.weekly.plist', helper: '建议与 Label 一致。' },
    ],
  },
  {
    title: '命令',
    description: '优先使用 Program + ProgramArguments 组合。',
    fields: [
      { label: 'Program', value: '/Users/demo/bin/cleanup.sh', helper: '路径存在，具备执行权限。' },
      { label: 'ProgramArguments', value: '--deep --report', helper: '数组编辑器拆分为独立参数。' },
      { label: 'WorkingDirectory', value: '/Users/demo/workspace', helper: '目录可访问。' },
    ],
  },
  {
    title: '调度',
    description: '统一支持 RunAtLoad、KeepAlive、StartInterval 与日历计划。',
    fields: [
      { label: 'RunAtLoad', value: '开启', helper: '登录后立即执行。' },
      { label: 'StartCalendarInterval', value: '每周日 03:30', helper: '下次执行：03 月 24 日 03:30。' },
      { label: 'KeepAlive', value: '关闭', helper: '一次性维护任务建议关闭。' },
    ],
  },
  {
    title: '日志与环境',
    description: '建议同时配置 stdout 与 stderr。',
    fields: [
      { label: 'StandardOutPath', value: '/Users/demo/Library/Logs/cleanup.log', helper: '首次运行时自动创建。' },
      { label: 'StandardErrorPath', value: '/Users/demo/Library/Logs/cleanup.error.log', helper: '当前可写。' },
      { label: 'EnvironmentVariables', value: 'TEAM=ops, MODE=deep', helper: '支持键值表格编辑。' },
    ],
  },
];

const logLines = [
  '2026-03-21 13:49:58 [INFO] backup-job started with profile=full',
  '2026-03-21 13:49:59 [INFO] scanning source=/Volumes/archive',
  '2026-03-21 13:50:01 [ERROR] destination is not writable',
  '2026-03-21 13:50:01 [ERROR] job exited with code 78',
];

const historyEvents = [
  { time: '13:50:01', action: '任务退出', result: '失败 · 退出码 78' },
  { time: '13:49:58', action: '手动启动', result: '成功发起' },
  { time: '13:42:10', action: '编辑配置', result: '已保存并重新加载' },
  { time: '昨天 02:00', action: '计划执行', result: '成功' },
];

function NavigationGroup({ title, items }) {
  return (
    <section className="nav-group">
      <div className="nav-group__title">{title}</div>
      <div className="nav-group__items">
        {items.map((item) => (
          <button key={item.label} className={`nav-item${item.active ? ' is-active' : ''}`} type="button">
            <span className="nav-item__label">{item.label}</span>
            {item.count !== null && <span className="nav-item__count">{item.count}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ label, value, note }) {
  return (
    <article className="summary-card">
      <div className="summary-card__label">{label}</div>
      <div className="summary-card__value">{value}</div>
      <div className="summary-card__note">{note}</div>
    </article>
  );
}

function StatusBadge({ tone, text, detail }) {
  return (
    <div className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__dot" />
      <div>
        <div className="status-badge__text">{text}</div>
        <div className="status-badge__detail">{detail}</div>
      </div>
    </div>
  );
}

function DataGroup({ title, items }) {
  return (
    <section className="panel-card data-group">
      <div className="panel-card__header">
        <h3>{title}</h3>
      </div>
      <div className="data-group__list">
        {items.map(([label, value]) => (
          <div key={label} className="data-row">
            <div className="data-row__label">{label}</div>
            <div className="data-row__value">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FormSection({ title, description, fields }) {
  return (
    <section className="panel-card form-section">
      <div className="panel-card__header panel-card__header--stacked">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="form-grid">
        {fields.map((field) => (
          <div key={field.label} className="form-field">
            <label>{field.label}</label>
            <div className="form-field__control">{field.value}</div>
            <p>{field.helper}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 渲染 launchd 管理台主界面。
 */
function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__eyebrow">launchd-panel</div>
          <h1>macOS 任务工作台</h1>
          <p>统一管理 LaunchAgents、LaunchDaemons 与 plist 配置。</p>
        </div>
        {navigationGroups.map((group) => (
          <NavigationGroup key={group.title} title={group.title} items={group.items} />
        ))}
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__search">搜索 Label、程序、参数、路径、环境变量</div>
          <div className="topbar__actions">
            <button type="button" className="ghost-button">当前作用域：全部</button>
            <button type="button" className="ghost-button">最近刷新 12 秒前</button>
            <button type="button" className="primary-button">新建配置</button>
          </div>
        </header>

        <section className="hero-banner">
          <div>
            <div className="hero-banner__title">任务视图 · 全部任务</div>
            <p>聚合显示配置存在、已加载、运行中、失败、权限与日志状态。</p>
          </div>
          <div className="hero-banner__meta">
            <span className="pill pill--warning">当前仅拥有系统级只读权限</span>
            <span className="pill">未授予完全磁盘访问时，日志可能不可用</span>
          </div>
        </section>

        <section className="summary-grid">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="content-grid">
          <div className="main-column">
            <section className="panel-card">
              <div className="panel-card__header panel-card__header--between">
                <div>
                  <h2>任务列表</h2>
                  <p>按作用域分类展示任务，支持快速筛选、批量操作与右侧预览。</p>
                </div>
                <div className="toolbar-inline">
                  <button type="button" className="ghost-button">批量校验</button>
                  <button type="button" className="ghost-button danger-button">批量停用</button>
                </div>
              </div>

              <div className="chip-row">
                {filterChips.map((chip) => (
                  <span key={chip} className="filter-chip">{chip}</span>
                ))}
                <button type="button" className="link-button">清空筛选</button>
              </div>

              <div className="table-card">
                <div className="table-header table-grid">
                  <span>状态</span>
                  <span>Label</span>
                  <span>作用域</span>
                  <span>主命令</span>
                  <span>调度方式</span>
                  <span>最近结果</span>
                  <span>配置路径</span>
                </div>
                <div className="table-body">
                  {taskRows.map((row) => (
                    <article key={row.label} className="table-row table-grid">
                      <StatusBadge {...row.status} />
                      <div className="table-cell table-cell--stacked">
                        <strong>{row.label}</strong>
                        <span>{row.file}</span>
                      </div>
                      <div className="table-cell">{row.scope}</div>
                      <div className="table-cell table-cell--stacked">
                        <strong>{row.command}</strong>
                        <span>{row.args}</span>
                      </div>
                      <div className="table-cell">{row.schedule}</div>
                      <div className="table-cell">{row.result}</div>
                      <div className="table-cell table-cell--muted">{row.path}</div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="split-grid">
              <section className="panel-card">
                <div className="panel-card__header panel-card__header--between">
                  <div>
                    <h2>创建 / 编辑配置</h2>
                    <p>通过表单模式降低 plist 编辑复杂度，并保留专业字段语义。</p>
                  </div>
                  <div className="segmented-control">
                    <button type="button" className="is-active">表单模式</button>
                    <button type="button">原始 plist</button>
                  </div>
                </div>
                <div className="form-sections">
                  {formSections.map((section) => (
                    <FormSection key={section.title} {...section} />
                  ))}
                </div>
                <div className="form-footer">
                  <div className="validation-box">
                    <strong>校验摘要</strong>
                    <p>2 条建议 · 日志路径完整，KeepAlive 已关闭，适合一次性维护任务。</p>
                  </div>
                  <div className="toolbar-inline">
                    <button type="button" className="ghost-button">保存草稿</button>
                    <button type="button" className="ghost-button">校验</button>
                    <button type="button" className="primary-button">保存并加载</button>
                  </div>
                </div>
              </section>

              <section className="panel-card">
                <div className="panel-card__header panel-card__header--between">
                  <div>
                    <h2>日志查看</h2>
                    <p>支持 stdout、stderr 与合并视图，适合故障排查与回放。</p>
                  </div>
                  <div className="toolbar-inline">
                    <button type="button" className="ghost-button">stdout</button>
                    <button type="button" className="ghost-button is-selected">stderr</button>
                    <button type="button" className="ghost-button">自动刷新</button>
                  </div>
                </div>
                <div className="log-meta">
                  <span className="pill pill--danger">日志状态：可读取</span>
                  <span className="pill">路径：/var/log/backup-job.error.log</span>
                </div>
                <div className="log-viewer">
                  {logLines.map((line) => (
                    <div key={line} className={`log-line${line.includes('[ERROR]') ? ' is-error' : ''}`}>
                      {line}
                    </div>
                  ))}
                </div>
                <div className="history-panel">
                  <div className="panel-card__header panel-card__header--stacked">
                    <h3>最近执行历史</h3>
                    <p>查看最近执行结果、手动操作与配置变更。</p>
                  </div>
                  <div className="history-list">
                    {historyEvents.map((event) => (
                      <div key={`${event.time}-${event.action}`} className="history-item">
                        <span>{event.time}</span>
                        <strong>{event.action}</strong>
                        <em>{event.result}</em>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </section>
          </div>

          <aside className="detail-column">
            <section className="panel-card sticky-card">
              <div className="panel-card__header panel-card__header--between">
                <div>
                  <h2>任务详情</h2>
                  <p>聚焦当前选中任务的配置、运行与诊断信息。</p>
                </div>
                <StatusBadge tone="failed" text="启动失败" detail="退出码 78" />
              </div>

              <div className="detail-header">
                <div>
                  <div className="detail-header__title">com.ops.backup.daily</div>
                  <div className="detail-header__subtitle">系统 Daemon · 已加载 · 最近 8 分钟前失败</div>
                </div>
                <div className="toolbar-inline toolbar-inline--wrap">
                  <button type="button" className="ghost-button">启动</button>
                  <button type="button" className="ghost-button danger-button">停止</button>
                  <button type="button" className="ghost-button">校验</button>
                  <button type="button" className="primary-button">编辑</button>
                </div>
              </div>

              <div className="notice-stack">
                <div className="notice notice--danger">
                  启动失败：目标卷无写权限，建议先检查 StandardErrorPath 与备份路径。
                </div>
                <div className="notice notice--warning">
                  这是系统级任务，修改、停用或卸载前需要管理员授权与二次确认。
                </div>
              </div>

              <div className="tab-row">
                <button type="button" className="tab-row__item is-active">概览</button>
                <button type="button" className="tab-row__item">配置</button>
                <button type="button" className="tab-row__item">运行状态</button>
                <button type="button" className="tab-row__item">日志</button>
                <button type="button" className="tab-row__item">历史</button>
              </div>

              <div className="detail-groups">
                {detailGroups.map((group) => (
                  <DataGroup key={group.title} title={group.title} items={group.items} />
                ))}
              </div>

              <section className="panel-card risk-card">
                <div className="panel-card__header panel-card__header--stacked">
                  <h3>危险操作确认</h3>
                  <p>系统级任务的停用、卸载、覆盖保存都必须先展示影响范围。</p>
                </div>
                <div className="confirmation-box">
                  <div className="confirmation-box__row">
                    <span>操作</span>
                    <strong>卸载系统级任务</strong>
                  </div>
                  <div className="confirmation-box__row">
                    <span>影响</span>
                    <strong>备份服务将不再由 launchd 托管</strong>
                  </div>
                  <div className="confirmation-box__row">
                    <span>二次确认</span>
                    <div className="confirmation-box__input">输入 UNLOAD</div>
                  </div>
                </div>
              </section>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
