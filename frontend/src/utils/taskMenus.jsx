import {
  CheckCircleOutlined,
  CodeOutlined,
  EyeOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';

/**
 * 为任务选择列表层最值得前置的快捷动作。
 */
function buildQuickAction(task) {
  const capabilities = task?.capabilities;

  // 已停用任务优先暴露启用，方便恢复调度。
  if (capabilities?.canEnable) {
    return {
      key: 'enable',
      icon: <CheckCircleOutlined />,
      label: '启用任务',
    };
  }

  // 已加载或运行中的任务优先给出停止入口，避免用户再进详情抽屉。
  if (capabilities?.canStop) {
    return {
      key: 'stop',
      icon: <StopOutlined />,
      label: '停止任务',
      danger: true,
    };
  }

  // 仍可直接拉起的任务，在列表层提供快速启动更符合高频排障路径。
  if (capabilities?.canStart) {
    return {
      key: 'start',
      icon: <PlayCircleOutlined />,
      label: '启动任务',
    };
  }

  // 无法启停时，最后再暴露停用作为配置层控制。
  if (capabilities?.canDisable) {
    return {
      key: 'disable',
      icon: <StopOutlined />,
      label: '停用任务',
      danger: true,
    };
  }

  return null;
}

/**
 * 根据动作执行态修正菜单项展示。
 */
function decorateActionItem(item, pendingAction) {
  if (!item) {
    return item;
  }

  // 当前动作执行中时，使用旋转图标强化反馈。
  if (pendingAction === item.key) {
    return {
      ...item,
      icon: <LoadingOutlined spin />,
      label: `${item.label}中...`,
      disabled: true,
    };
  }

  // 同一任务已有其他动作执行时，避免用户重复触发。
  if (pendingAction) {
    return {
      ...item,
      disabled: true,
    };
  }

  return item;
}

/**
 * 统一生成任务列表与右键菜单项。
 */
export function buildTaskMenuItems(task, options = {}) {
  const pendingAction = options.pendingAction || '';
  const items = [
    {
      key: 'detail',
      icon: <EyeOutlined />,
      label: '查看详情',
      disabled: Boolean(pendingAction),
    },
    {
      key: 'edit',
      icon: <CodeOutlined />,
      label: '编辑配置',
      disabled: Boolean(pendingAction) || !task?.capabilities?.canEdit,
    },
    {
      key: 'logs',
      icon: <FileSearchOutlined />,
      label: '查看日志',
      disabled: Boolean(pendingAction) || !task?.capabilities?.canReadLogs,
    },
  ];

  const quickAction = decorateActionItem(buildQuickAction(task), pendingAction);
  const actionItems = [
    decorateActionItem({
      key: 'validate',
      icon: <SafetyCertificateOutlined />,
      label: '校验配置',
    }, pendingAction),
    quickAction,
    task?.capabilities?.canReload
      ? decorateActionItem({
          key: 'reload',
          icon: <ReloadOutlined />,
          label: '重载任务',
        }, pendingAction)
      : null,
  ].filter(Boolean);

  // 只有存在快捷动作时才补分隔，保持菜单紧凑。
  if (actionItems.length > 0) {
    items.push({ type: 'divider' }, ...actionItems);
  }

  return items;
}
