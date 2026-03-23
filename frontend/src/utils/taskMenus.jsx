import {
  CheckCircleOutlined,
  CodeOutlined,
  EyeOutlined,
  FileSearchOutlined,
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
 * 统一生成任务列表与右键菜单项。
 */
export function buildTaskMenuItems(task) {
  const items = [
    {
      key: 'detail',
      icon: <EyeOutlined />,
      label: '查看详情',
    },
    {
      key: 'edit',
      icon: <CodeOutlined />,
      label: '编辑配置',
      disabled: !task?.capabilities?.canEdit,
    },
    {
      key: 'logs',
      icon: <FileSearchOutlined />,
      label: '查看日志',
      disabled: !task?.capabilities?.canReadLogs,
    },
  ];

  const quickAction = buildQuickAction(task);
  const actionItems = [
    {
      key: 'validate',
      icon: <SafetyCertificateOutlined />,
      label: '校验配置',
    },
    quickAction,
    task?.capabilities?.canReload
      ? {
          key: 'reload',
          icon: <ReloadOutlined />,
          label: '重载任务',
        }
      : null,
  ].filter(Boolean);

  // 只有存在快捷动作时才补分隔，保持菜单紧凑。
  if (actionItems.length > 0) {
    items.push({ type: 'divider' }, ...actionItems);
  }

  return items;
}
