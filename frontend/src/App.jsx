import {
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Empty,
  Flex,
  Input,
  Layout,
  Menu,
  Space,
  Spin,
  Tag,
  Tooltip,
  message,
  theme as antdTheme,
} from 'antd';
import {
  AppstoreOutlined,
  BarsOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BatchExecute, GetThemeMode, GetWorkspaceSnapshot, SaveThemeMode } from '../wailsjs/go/main/App';
import ConfigurationPanel from './components/ConfigurationPanel';
import DetailPanel from './components/DetailPanel';
import LogHistoryPanel from './components/LogHistoryPanel';
import Navigation, { SidebarBrand } from './components/Navigation';
import SettingsPanel from './components/SettingsPanel';
import ScrollArea from './components/ScrollArea';
import SummarySection from './components/SummarySection';
import TasksTable from './components/TasksTable';

const { Header, Sider, Content } = Layout;
const CONTEXT_MENU_WIDTH = 152;
const CONTEXT_MENU_OFFSET = 12;
const APP_SETTINGS_STORAGE_KEY = 'launchd-panel:app-settings';
const THEME_MODE_OPTIONS = new Set(['light', 'dark', 'system']);
const DEFAULT_APP_SETTINGS = {
  showSystemTasks: false,
  themeMode: 'system',
};
const SYSTEM_SCOPE_KEYS = new Set(['all-agent', 'system-agent', 'daemon']);
const TASK_STATUS_PRIORITY = {
  invalid: 0,
  failed: 1,
  running: 2,
  loaded: 3,
  idle: 4,
};

/**
 * 归一化主题模式，避免本地缓存被污染后产生异常值。
 */
function normalizeThemeMode(themeMode) {
  if (!THEME_MODE_OPTIONS.has(themeMode)) {
    return DEFAULT_APP_SETTINGS.themeMode;
  }

  return themeMode;
}

/**
 * 读取系统当前偏好的配色方案。
 */
function getSystemThemeMode() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 计算当前实际生效的主题模式。
 */
function resolveThemeMode(themeMode, systemThemeMode) {
  if (themeMode === 'system') {
    return systemThemeMode;
  }

  return themeMode;
}

/**
 * 判断当前是否运行在 macOS 环境。
 */
function isMacOS() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /mac/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '');
}

/**
 * 读取本地持久化的应用设置。
 */
function readAppSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const rawValue = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);

    // 首次启动没有配置时直接使用默认值。
    if (!rawValue) {
      return { ...DEFAULT_APP_SETTINGS };
    }

    const parsedValue = JSON.parse(rawValue);

    return {
      ...DEFAULT_APP_SETTINGS,
      showSystemTasks: Boolean(parsedValue?.showSystemTasks),
      themeMode: normalizeThemeMode(parsedValue?.themeMode),
    };
  } catch (error) {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

/**
 * 持久化当前应用设置。
 */
function writeAppSettings(settings) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // 本地存储失败不影响主流程，直接忽略即可。
  }
}

/**
 * 判断当前任务是否属于系统级或全局范围。
 */
function isSystemTask(task) {
  return SYSTEM_SCOPE_KEYS.has(task.scopeKey);
}

/**
 * 基于应用设置过滤当前可见任务。
 */
function filterVisibleTasks(tasks, settings) {
  // 用户显式开启后，保留完整工作区内容。
  if (settings.showSystemTasks) {
    return tasks;
  }

  return tasks.filter((task) => !isSystemTask(task));
}

/**
 * 为导航项补齐图标。
 */
function buildNavigationIcon(key) {
  switch (key) {
    case 'dashboard':
      return <AppstoreOutlined />;
    case 'tasks':
      return <BarsOutlined />;
    case 'configs':
      return <CodeOutlined />;
    case 'logs':
      return <FileSearchOutlined />;
    case 'history':
      return <HistoryOutlined />;
    case 'user-agent':
    case 'all-agent':
    case 'system-agent':
      return <DesktopOutlined />;
    case 'daemon':
      return <DatabaseOutlined />;
    case 'unknown':
      return <FolderOpenOutlined />;
    case 'running':
      return <PlayCircleOutlined />;
    case 'loaded':
      return <InfoCircleOutlined />;
    case 'failed':
      return <WarningOutlined />;
    case 'invalid':
      return <ExclamationCircleOutlined />;
    case 'forbidden':
      return <SafetyCertificateOutlined />;
    case 'nolog':
      return <EyeOutlined />;
    default:
      return null;
  }
}

/**
 * 根据当前可见任务重建导航分组。
 */
function buildNavigationGroups(tasks, settings) {
  const countByScope = {};
  const countByStatus = {};
  let logCount = 0;
  let historyCount = 0;
  let invalidCount = 0;
  let readonlyCount = 0;

  tasks.forEach((task) => {
    countByScope[task.scopeKey] = (countByScope[task.scopeKey] || 0) + 1;
    countByStatus[task.status] = (countByStatus[task.status] || 0) + 1;

    // 有日志、历史、校验异常的任务需要在导航上给出准确数量。
    if (task.hasLogs) {
      logCount += 1;
    }
    if (task.historyCount > 0) {
      historyCount += 1;
    }
    if (task.invalid) {
      invalidCount += 1;
    }
    if (task.readOnly) {
      readonlyCount += 1;
    }
  });

  const scopeItems = [
    { key: 'user-agent', label: '当前用户 Agent', count: countByScope['user-agent'] || 0 },
    { key: 'all-agent', label: '全部用户 Agent', count: countByScope['all-agent'] || 0 },
    { key: 'system-agent', label: '系统 Agent', count: countByScope['system-agent'] || 0 },
    { key: 'daemon', label: '系统 Daemon', count: countByScope.daemon || 0 },
    { key: 'unknown', label: '未归类配置', count: countByScope.unknown || 0 },
  ].filter((item) => settings.showSystemTasks || !SYSTEM_SCOPE_KEYS.has(item.key));

  return [
    {
      key: 'workspace',
      title: '工作区',
      items: [
        { key: 'dashboard', label: '总览', count: tasks.length },
        { key: 'tasks', label: '任务', count: tasks.length },
        { key: 'configs', label: '配置', count: tasks.length },
        { key: 'logs', label: '日志', count: logCount },
        { key: 'history', label: '历史', count: historyCount },
      ],
    },
    {
      key: 'scope',
      title: '按作用域',
      items: scopeItems,
    },
    {
      key: 'smart',
      title: '智能视图',
      items: [
        { key: 'running', label: '正在运行', count: countByStatus.running || 0 },
        { key: 'loaded', label: '已加载未运行', count: countByStatus.loaded || 0 },
        { key: 'failed', label: '启动失败', count: countByStatus.failed || 0 },
        { key: 'invalid', label: '配置无效', count: invalidCount },
        { key: 'forbidden', label: '只读范围', count: readonlyCount },
        { key: 'nolog', label: '日志不可用', count: tasks.length - logCount },
      ],
    },
  ].map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      icon: buildNavigationIcon(item.key),
    })),
  }));
}

/**
 * 根据当前可见任务重建顶部概览卡片。
 */
function buildSummaryCards(tasks, settings) {
  let loaded = 0;
  let running = 0;
  let failed = 0;

  tasks.forEach((task) => {
    if (task.status === 'running') {
      running += 1;
    }

    // 运行中与失败任务都已被 launchd 实际加载。
    if (task.status === 'loaded' || task.status === 'running' || task.status === 'failed') {
      loaded += 1;
    }

    if (task.status === 'failed') {
      failed += 1;
    }
  });

  return [
    {
      label: '全部任务',
      value: tasks.length,
      suffix: '项',
      note: settings.showSystemTasks ? '扫描范围覆盖用户级、本地级与系统级目录' : '当前仅展示用户级与未归类任务',
    },
    { label: '已加载', value: loaded, suffix: '项', note: '基于 launchctl 域摘要合并得出' },
    { label: '运行中', value: running, suffix: '项', note: '当前域中存在活动进程的服务' },
    { label: '启动失败', value: failed, suffix: '项', note: '最近一次退出码非 0 的已加载服务' },
  ];
}

/**
 * 返回导航项对应的人类可读名称。
 */
function findNavigationLabel(groups, key) {
  for (const group of groups) {
    const item = group.items.find((entry) => entry.key === key);

    // 找到匹配项后立即返回，避免继续遍历整个树。
    if (item) {
      return item.label;
    }
  }

  return '全部';
}

/**
 * 返回任务排序权重，优先暴露异常与活跃任务。
 */
function getTaskSortWeight(task) {
  // 校验异常应先于运行态显示，方便首屏排障。
  if (task.invalid) {
    return TASK_STATUS_PRIORITY.invalid;
  }

  return TASK_STATUS_PRIORITY[task.status] ?? TASK_STATUS_PRIORITY.idle;
}

/**
 * 统一整理任务列表顺序。
 */
function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const weightDelta = getTaskSortWeight(left) - getTaskSortWeight(right);

    // 状态优先级不同则直接按风险等级排序。
    if (weightDelta !== 0) {
      return weightDelta;
    }

    const scopeDelta = left.scope.localeCompare(right.scope, 'zh-CN');
    if (scopeDelta !== 0) {
      return scopeDelta;
    }

    const labelDelta = left.label.localeCompare(right.label, 'zh-CN');
    if (labelDelta !== 0) {
      return labelDelta;
    }

    return left.path.localeCompare(right.path, 'zh-CN');
  });
}

/**
 * 根据导航键过滤任务。
 */
function matchNavigation(task, key) {
  switch (key) {
    case 'dashboard':
    case 'tasks':
    case 'configs':
      return true;
    case 'logs':
      return task.hasLogs;
    case 'history':
      return task.historyCount > 0;
    case 'running':
    case 'loaded':
    case 'failed':
    case 'invalid':
      return task.status === key || (key === 'invalid' && task.invalid);
    case 'forbidden':
      return task.readOnly;
    case 'nolog':
      return !task.hasLogs;
    case 'user-agent':
    case 'all-agent':
    case 'system-agent':
    case 'daemon':
    case 'unknown':
      return task.scopeKey === key;
    default:
      return true;
  }
}

/**
 * 返回最近刷新时间文案。
 */
function buildRefreshLabel(refreshedAt) {
  if (!refreshedAt) {
    return '尚未刷新';
  }

  return `最近刷新 ${new Date(refreshedAt).toLocaleTimeString()}`;
}

/**
 * 渲染应用主界面。
 */
function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(() => readAppSettings());
  const [systemThemeMode, setSystemThemeMode] = useState(() => getSystemThemeMode());
  const [isThemeModeHydrated, setIsThemeModeHydrated] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedNav, setSelectedNav] = useState('tasks');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [configTaskId, setConfigTaskId] = useState('');
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    task: null,
  });
  const isMacEnvironment = useMemo(() => isMacOS(), []);

  /**
   * 拉取工作区快照。
   */
  const loadWorkspace = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await GetWorkspaceSnapshot();
      setSnapshot(response);

      // 删除或过滤后若当前选中任务消失，需要主动清空引用。
      setSelectedTaskId((current) => {
        if (current && !response.tasks.some((task) => task.id === current)) {
          setIsDetailDrawerOpen(false);
          setIsLogsDrawerOpen(false);
          return '';
        }

        return current;
      });

      setSelectedRowKeys((current) => current.filter((id) => response.tasks.some((task) => task.id === id)));
    } catch (error) {
      message.error(error?.message || '加载任务列表失败');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * 关闭右键菜单，避免悬浮残留。
   */
  const closeContextMenu = useCallback(() => {
    setContextMenu((current) => ({
      ...current,
      open: false,
      task: null,
    }));
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    let cancelled = false;

    /**
     * 启动后用后端保存的主题模式对齐前端设置，保证与标题栏配置一致。
     */
    async function syncThemeMode() {
      try {
        const persistedThemeMode = normalizeThemeMode(await GetThemeMode());

        if (!cancelled) {
          setAppSettings((current) => {
            if (current.themeMode === persistedThemeMode) {
              return current;
            }

            return {
              ...current,
              themeMode: persistedThemeMode,
            };
          });
          setIsThemeModeHydrated(true);
        }
      } catch (error) {
        // 读取失败时保持前端本地设置，不阻断页面加载。
        if (!cancelled) {
          setIsThemeModeHydrated(true);
        }
      }
    }

    syncThemeMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    /**
     * 同步系统主题变化。
     */
    function handleSystemThemeChange(event) {
      setSystemThemeMode(event.matches ? 'dark' : 'light');
    }

    setSystemThemeMode(mediaQuery.matches ? 'dark' : 'light');

    // 新浏览器优先使用标准事件接口。
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }

    // 兼容旧版 WebKit 的监听能力。
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleSystemThemeChange);

      return () => {
        mediaQuery.removeListener(handleSystemThemeChange);
      };
    }

    return undefined;
  }, []);

  useEffect(() => {
    writeAppSettings(appSettings);
  }, [appSettings]);

  useEffect(() => {
    if (!isThemeModeHydrated) {
      return;
    }

    SaveThemeMode(appSettings.themeMode).catch(() => {
      // 后端持久化失败时不打断当前主题切换。
    });
  }, [appSettings.themeMode, isThemeModeHydrated]);

  useEffect(() => {
    // 菜单打开后监听全局点击与窗口变化，保证及时收起。
    if (!contextMenu.open) {
      return undefined;
    }

    /**
     * 关闭上下文菜单。
     */
    function handleDismiss() {
      closeContextMenu();
    }

    window.addEventListener('click', handleDismiss);
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('blur', handleDismiss);

    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('blur', handleDismiss);
    };
  }, [closeContextMenu, contextMenu.open]);

  /**
   * 同步搜索词，输入变化后立即刷新列表。
   */
  const handleSearchChange = useCallback((event) => {
    startTransition(() => {
      setSearchKeyword(event.target.value);
    });
  }, []);

  /**
   * 按屏幕边界修正右键菜单位置。
   */
  const getContextMenuPosition = useCallback((event) => {
    const maxX = Math.max(CONTEXT_MENU_OFFSET, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_OFFSET);
    const maxY = Math.max(CONTEXT_MENU_OFFSET, window.innerHeight - 220);

    return {
      x: Math.min(event.clientX, maxX),
      y: Math.min(event.clientY, maxY),
    };
  }, []);

  /**
   * 打开详情抽屉。
   */
  const handleSelectTask = useCallback((task) => {
    setSelectedTaskId(task.id);
    setIsDetailDrawerOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  /**
   * 打开新建配置抽屉。
   */
  const handleOpenCreateConfig = useCallback(() => {
    setConfigTaskId('');
    setIsConfigDrawerOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  /**
   * 打开任务详情抽屉。
   */
  const handleOpenDetail = useCallback((task) => {
    if (!task) {
      return;
    }

    setSelectedTaskId(task.id);
    setIsConfigDrawerOpen(false);
    setIsLogsDrawerOpen(false);
    setIsDetailDrawerOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  /**
   * 打开编辑配置抽屉。
   */
  const handleOpenEditConfig = useCallback((task) => {
    if (!task) {
      handleOpenCreateConfig();
      return;
    }

    setSelectedTaskId(task.id);
    setConfigTaskId(task.id);
    setIsDetailDrawerOpen(false);
    setIsLogsDrawerOpen(false);
    setIsConfigDrawerOpen(true);
    closeContextMenu();
  }, [closeContextMenu, handleOpenCreateConfig]);

  /**
   * 打开日志抽屉。
   */
  const handleOpenLogs = useCallback((task) => {
    if (!task) {
      return;
    }

    setSelectedTaskId(task.id);
    setIsDetailDrawerOpen(false);
    setIsConfigDrawerOpen(false);
    setIsLogsDrawerOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  /**
   * 打开表格项右键菜单。
   */
  const handleOpenContextMenu = useCallback((event, task) => {
    event.preventDefault();
    const position = getContextMenuPosition(event);

    setSelectedTaskId(task.id);
    setContextMenu({
      open: true,
      x: position.x,
      y: position.y,
      task,
    });
  }, [getContextMenuPosition]);

  /**
   * 响应右键菜单操作。
   */
  const handleContextMenuAction = useCallback((action) => {
    if (action === 'detail') {
      handleOpenDetail(contextMenu.task);
      return;
    }

    if (action === 'edit') {
      handleOpenEditConfig(contextMenu.task);
      return;
    }

    handleOpenLogs(contextMenu.task);
  }, [contextMenu.task, handleOpenDetail, handleOpenEditConfig, handleOpenLogs]);

  /**
   * 同步工作区快照并修正当前选中任务。
   */
  const handleWorkspaceChange = useCallback((nextSnapshot, nextTaskId = selectedTaskId) => {
    setSnapshot(nextSnapshot);
    setSelectedTaskId(nextTaskId);
    setSelectedRowKeys((current) => current.filter((id) => nextSnapshot.tasks.some((task) => task.id === id)));
  }, [selectedTaskId]);

  /**
   * 执行批量校验。
   */
  const handleBatchValidate = useCallback(async () => {
    try {
      const response = await BatchExecute({ ids: selectedRowKeys, action: 'validate' });
      handleWorkspaceChange(response.snapshot);
      const failedCount = response.results.filter((item) => !item.success).length;
      message.success(failedCount === 0 ? '批量校验通过' : `批量校验完成，${failedCount} 项存在问题`);
    } catch (error) {
      message.error(error?.message || '批量校验失败');
    }
  }, [handleWorkspaceChange, selectedRowKeys]);

  /**
   * 执行批量停用。
   */
  const handleBatchDisable = useCallback(async () => {
    try {
      const response = await BatchExecute({ ids: selectedRowKeys, action: 'disable' });
      handleWorkspaceChange(response.snapshot);
      message.success('批量停用完成');
    } catch (error) {
      message.error(error?.message || '批量停用失败');
    }
  }, [handleWorkspaceChange, selectedRowKeys]);

  const tasks = snapshot?.tasks || [];
  const visibleTasks = useMemo(
    () => filterVisibleTasks(tasks, appSettings),
    [appSettings, tasks]
  );
  const visibleTaskIds = useMemo(
    () => new Set(visibleTasks.map((task) => task.id)),
    [visibleTasks]
  );

  useEffect(() => {
    setSelectedTaskId((current) => {
      // 任务仍然可见时保持当前抽屉状态。
      if (!current || visibleTaskIds.has(current)) {
        return current;
      }

      setIsDetailDrawerOpen(false);
      setIsConfigDrawerOpen(false);
      setIsLogsDrawerOpen(false);
      return '';
    });

    setSelectedRowKeys((current) => current.filter((id) => visibleTaskIds.has(id)));
  }, [visibleTaskIds]);

  const navigationGroups = useMemo(
    () => buildNavigationGroups(visibleTasks, appSettings),
    [appSettings, visibleTasks]
  );
  const navigationKeys = useMemo(
    () => new Set(navigationGroups.flatMap((group) => group.items.map((item) => item.key))),
    [navigationGroups]
  );

  useEffect(() => {
    // 当前导航被设置过滤掉时回退到任务视图，避免出现空白选中态。
    if (navigationKeys.size > 0 && !navigationKeys.has(selectedNav)) {
      setSelectedNav('tasks');
    }
  }, [navigationKeys, selectedNav]);

  const summaryCards = useMemo(
    () => buildSummaryCards(visibleTasks, appSettings),
    [appSettings, visibleTasks]
  );
  const selectedNavLabel = useMemo(
    () => findNavigationLabel(navigationGroups, selectedNav),
    [navigationGroups, selectedNav]
  );
  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedTaskId) || null,
    [selectedTaskId, visibleTasks]
  );
  const selectedTasks = useMemo(
    () => visibleTasks.filter((task) => selectedRowKeys.includes(task.id)),
    [selectedRowKeys, visibleTasks]
  );
  const readonlyCount = visibleTasks.filter((task) => task.readOnly).length;
  const noLogCount = visibleTasks.filter((task) => !task.hasLogs).length;

  const batchDisableReason = useMemo(() => {
    if (selectedTasks.some((task) => task.readOnly)) {
      return '所选任务中包含只读范围项，无法批量停用。';
    }
    if (selectedTasks.some((task) => !task.capabilities.canDisable)) {
      return '所选任务中存在不可停用项，请调整选择。';
    }
    return '';
  }, [selectedTasks]);

  const filteredTasks = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    const matchedTasks = visibleTasks.filter((task) => {
      if (!matchNavigation(task, selectedNav)) {
        return false;
      }

      // 没有关键词时保留导航过滤后的结果。
      if (!keyword) {
        return true;
      }

      const searchableContent = [
        task.label,
        task.file,
        task.scope,
        task.command,
        task.args,
        task.schedule,
        task.result,
        task.path,
      ]
        .join(' ')
        .toLowerCase();

      return searchableContent.includes(keyword);
    });

    return sortTasks(matchedTasks);
  }, [searchKeyword, selectedNav, visibleTasks]);
  const deferredTasks = useDeferredValue(filteredTasks);
  const resolvedThemeMode = useMemo(
    () => resolveThemeMode(appSettings.themeMode, systemThemeMode),
    [appSettings.themeMode, systemThemeMode]
  );
  const themeConfig = useMemo(() => {
    const isDarkTheme = resolvedThemeMode === 'dark';

    return {
      algorithm: isDarkTheme ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        colorBgLayout: isDarkTheme ? '#0b1220' : '#f5f7fb',
        colorBgContainer: isDarkTheme ? '#111827' : '#ffffff',
        colorBorderSecondary: isDarkTheme ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb',
        colorText: isDarkTheme ? '#e5edf8' : '#0f172a',
        colorTextSecondary: isDarkTheme ? '#94a3b8' : '#667085',
        borderRadius: 14,
        fontSize: 13,
      },
      components: {
        Layout: {
          siderBg: isDarkTheme ? '#101827' : '#f7faff',
          headerBg: isDarkTheme ? '#0b1220' : '#f5f7fb',
          bodyBg: isDarkTheme ? '#0b1220' : '#f5f7fb',
        },
        Card: {
          bodyPadding: 18,
        },
        Menu: {
          itemBorderRadius: 10,
          itemMarginBlock: 4,
        },
      },
    };
  }, [resolvedThemeMode]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.theme = resolvedThemeMode;
    document.documentElement.style.colorScheme = resolvedThemeMode;
    document.body?.setAttribute('data-theme', resolvedThemeMode);
  }, [resolvedThemeMode]);

  /**
   * 更新应用设置，并在 macOS 上提示标题栏重启后生效。
   */
  const handleAppSettingsChange = useCallback((nextSettings) => {
    setAppSettings((current) => {
      const normalizedSettings = {
        ...nextSettings,
        themeMode: normalizeThemeMode(nextSettings.themeMode),
      };

      // macOS 原生标题栏只在启动阶段读取外观配置，需要提示用户重启。
      if (isMacEnvironment && current.themeMode !== normalizedSettings.themeMode) {
        message.info('macOS 窗口标题栏需重启应用后生效');
      }

      return normalizedSettings;
    });
  }, [isMacEnvironment]);

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout className="app-shell">
        <Sider width={264} trigger={null} className="app-sider">
          <div className="app-sider-panel">
            <div className="app-sider-brand">
              <SidebarBrand />
            </div>
            <ScrollArea className="app-sider-scroll" contentClassName="app-sider-scroll-body">
              <Navigation selectedKey={selectedNav} onSelect={setSelectedNav} groups={navigationGroups} />
            </ScrollArea>
          </div>
        </Sider>

        <Layout className="app-main-layout">
          <Header className="app-header">
            <Flex justify="space-between" align="center" gap={12} wrap className="app-toolbar">
              <Space size={12} wrap className="header-search-group">
                <div className="global-search-shell">
                  <Input
                    allowClear
                    className="global-search-input"
                    placeholder="搜索 Label、文件名、程序、参数、路径"
                    prefix={<SearchOutlined />}
                    value={searchKeyword}
                    onChange={handleSearchChange}
                  />
                </div>
              </Space>
              <Space wrap className="header-actions">
                <Tooltip title={buildRefreshLabel(snapshot?.refreshedAt)}>
                  <Button
                    className="toolbar-button toolbar-icon-button"
                    icon={<ReloadOutlined />}
                    aria-label={buildRefreshLabel(snapshot?.refreshedAt)}
                    onClick={() => loadWorkspace(false)}
                  />
                </Tooltip>
                <Tooltip title="应用设置">
                  <Button
                    className="toolbar-button toolbar-icon-button"
                    icon={<SettingOutlined />}
                    aria-label="应用设置"
                    onClick={() => setIsSettingsDrawerOpen(true)}
                  />
                </Tooltip>
                <Tooltip title="新建配置">
                  <Button
                    type="primary"
                    className="toolbar-primary-button toolbar-icon-button"
                    icon={<PlusOutlined />}
                    aria-label="新建配置"
                    onClick={handleOpenCreateConfig}
                  />
                </Tooltip>
              </Space>
            </Flex>
          </Header>

          <Content className="app-content">
            <ScrollArea className="app-content-scroll" contentClassName="app-content-scroll-body">
              {loading ? (
                <div className="page-loading-state">
                  <Spin />
                </div>
              ) : !snapshot ? (
                <Card bordered={false} className="surface-card">
                  <Empty description="工作区数据加载失败" />
                </Card>
              ) : (
                <Space direction="vertical" size={16} className="full-width">
                  <Card bordered={false} className="surface-card workspace-overview-card">
                    <div className="workspace-overview-bar">
                      <SummarySection cards={summaryCards} />
                      <Space wrap className="hero-tags">
                        {!appSettings.showSystemTasks ? <Tag color="processing">系统任务已隐藏</Tag> : null}
                        <Tag color="warning">只读范围 {readonlyCount} 项</Tag>
                        <Tag>日志不可用 {noLogCount} 项</Tag>
                      </Space>
                    </div>
                  </Card>

                  <TasksTable
                    tasks={deferredTasks}
                    onSelectTask={handleSelectTask}
                    onOpenDetail={handleOpenDetail}
                    onOpenEditConfig={handleOpenEditConfig}
                    onOpenLogs={handleOpenLogs}
                    onOpenContextMenu={handleOpenContextMenu}
                    selectedTaskKey={selectedTask?.id}
                    selectedRowKeys={selectedRowKeys}
                    onSelectionChange={setSelectedRowKeys}
                    onBatchValidate={handleBatchValidate}
                    onBatchDisable={handleBatchDisable}
                    batchDisableReason={batchDisableReason}
                    selectedNavLabel={selectedNavLabel}
                    searchKeyword={searchKeyword}
                  />
                </Space>
              )}
            </ScrollArea>
          </Content>
        </Layout>
      </Layout>

      <Drawer
        className="settings-drawer"
        width={420}
        placement="right"
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        title="应用设置"
      >
        <SettingsPanel
          settings={appSettings}
          resolvedThemeMode={resolvedThemeMode}
          onChange={handleAppSettingsChange}
        />
      </Drawer>

      <Drawer
        className="detail-drawer"
        width={560}
        placement="right"
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={selectedTask ? `任务详情 · ${selectedTask.label}` : '任务详情'}
      >
        <DetailPanel
          taskId={selectedTask?.id}
          taskSummary={selectedTask}
          onShowConfig={() => handleOpenEditConfig(selectedTask)}
          onShowLogs={() => handleOpenLogs(selectedTask)}
          onWorkspaceChange={handleWorkspaceChange}
        />
      </Drawer>

      <Drawer
        className="config-drawer"
        width="min(1080px, calc(100vw - 24px))"
        placement="right"
        open={isConfigDrawerOpen}
        onClose={() => setIsConfigDrawerOpen(false)}
        title={configTaskId ? `编辑配置 · ${selectedTask?.label || ''}` : '新建配置'}
      >
        <ConfigurationPanel
          taskId={configTaskId}
          resolvedThemeMode={resolvedThemeMode}
          onSaved={(response) => {
            handleWorkspaceChange(response.snapshot, response.serviceId);
            setConfigTaskId(response.serviceId);
            setSelectedTaskId(response.serviceId);
          }}
        />
      </Drawer>

      <Drawer
        className="logs-drawer"
        width={680}
        placement="right"
        open={isLogsDrawerOpen}
        onClose={() => setIsLogsDrawerOpen(false)}
        title={selectedTask ? `日志历史 · ${selectedTask.label}` : '日志历史'}
      >
        <LogHistoryPanel task={selectedTask} onClose={() => setIsLogsDrawerOpen(false)} />
      </Drawer>

      {contextMenu.open ? (
        <div
          className="task-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <Menu
            selectable={false}
            onClick={({ key }) => handleContextMenuAction(key)}
            items={[
              {
                key: 'detail',
                icon: <EyeOutlined />,
                label: '查看详情',
              },
              {
                key: 'edit',
                icon: <CodeOutlined />,
                label: '编辑配置',
                disabled: !contextMenu.task?.capabilities?.canEdit,
              },
              {
                key: 'logs',
                icon: <FileSearchOutlined />,
                label: '查看日志',
              },
            ]}
          />
        </div>
      ) : null}
    </ConfigProvider>
  );
}

export default App;
