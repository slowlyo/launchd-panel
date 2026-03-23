import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Modal,
  Space,
  Spin,
  Tag,
  Tabs,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { ExecuteServiceAction, GetServiceDetail, ListServiceHistory } from '../../wailsjs/go/main/App';
import StatusTag from './StatusTag';
import { getErrorMessage } from '../utils/errors';

const { Paragraph, Title, Text } = Typography;

/**
 * 返回告警对应的 antd 类型。
 */
function normalizeAlertType(type) {
  switch (type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * 统计校验结果，便于顶部摘要展示。
 */
function summarizeValidation(validation = []) {
  return validation.reduce(
    (summary, issue) => {
      if (issue.level === 'error') {
        summary.errorCount += 1;
      } else if (issue.level === 'warning') {
        summary.warningCount += 1;
      } else {
        summary.infoCount += 1;
      }

      return summary;
    },
    {
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    }
  );
}

/**
 * 返回详情头部的摘要标签。
 */
function buildDetailBadges(detail) {
  return [
    { key: 'scope', label: detail.scope },
    { key: 'type', label: detail.type },
    { key: 'mode', label: detail.readOnly ? '只读范围' : '可编辑' },
    { key: 'logs', label: detail.hasLogs ? '日志可用' : '无日志输出' },
    { key: 'history', label: `历史 ${detail.historyCount || 0} 条` },
  ].filter((item) => item.label);
}

/**
 * 返回详情头部的核心摘要卡片。
 */
function buildDetailHighlights(detail, history) {
  const lastAction = detail.lastAction || history[0];

  return [
    {
      key: 'schedule',
      label: '调度策略',
      value: detail.schedule || '按需启动',
      helper: detail.scope || '当前范围未知',
    },
    {
      key: 'result',
      label: '最近结果',
      value: detail.result || detail.statusText || '暂无记录',
      helper: detail.statusDetail || '暂无额外状态说明',
    },
    {
      key: 'command',
      label: '执行命令',
      value: detail.command || '未设置',
      helper: detail.args || '没有附加参数',
      tone: 'command',
    },
    {
      key: 'action',
      label: '最近动作',
      value: lastAction ? lastAction.action : '暂无操作',
      helper: lastAction ? `${new Date(lastAction.createdAt).toLocaleString()} · ${lastAction.message}` : '应用内尚未记录动作',
    },
  ];
}

/**
 * 返回详情操作按钮清单。
 */
function buildActionItems(detail, actionLoading, onAction, onShowLogs, onShowConfig, onDelete) {
  const items = [
    {
      key: 'start',
      label: '启动',
      icon: <PlayCircleOutlined />,
      disabled: !detail.capabilities.canStart,
      loading: actionLoading === 'start',
      onClick: () => onAction('start'),
    },
    {
      key: 'stop',
      label: '停止',
      icon: <StopOutlined />,
      danger: true,
      disabled: !detail.capabilities.canStop,
      loading: actionLoading === 'stop',
      onClick: () => onAction('stop'),
    },
    {
      key: 'validate',
      label: '校验',
      icon: <SafetyCertificateOutlined />,
      loading: actionLoading === 'validate',
      onClick: () => onAction('validate'),
    },
    {
      key: 'reload',
      label: '重载',
      icon: <ReloadOutlined />,
      disabled: !detail.capabilities.canReload,
      loading: actionLoading === 'reload',
      onClick: () => onAction('reload'),
    },
    {
      key: 'logs',
      label: '查看日志',
      icon: <EyeOutlined />,
      onClick: onShowLogs,
    },
    {
      key: 'edit',
      label: '编辑配置',
      icon: <CodeOutlined />,
      type: 'primary',
      disabled: !detail.capabilities.canEdit,
      onClick: onShowConfig,
    },
    {
      key: 'delete',
      label: '删除任务',
      icon: <DeleteOutlined />,
      danger: true,
      disabled: !detail.capabilities.canDelete,
      loading: actionLoading === 'delete',
      onClick: onDelete,
    },
  ];

  // 启用和停用是同一维度的互斥动作，同时只展示一个入口。
  if (detail.capabilities.canEnable) {
    items.splice(3, 0, {
      key: 'enable',
      label: '启用',
      icon: <CheckCircleOutlined />,
      loading: actionLoading === 'enable',
      onClick: () => onAction('enable'),
    });
  } else if (detail.capabilities.canDisable) {
    items.splice(3, 0, {
      key: 'disable',
      label: '停用',
      icon: <StopOutlined />,
      loading: actionLoading === 'disable',
      onClick: () => onAction('disable'),
    });
  }

  return items;
}

/**
 * 按意图对操作分组，减少视觉噪音。
 */
function buildActionGroups(actionItems) {
  const actionMap = Object.fromEntries(actionItems.map((item) => [item.key, item]));

  return [
    {
      key: 'runtime',
      title: '运行控制',
      description: '控制任务进程生命周期',
      items: [actionMap.start, actionMap.stop, actionMap.reload].filter(Boolean),
    },
    {
      key: 'config',
      title: '配置与状态',
      description: '校验配置并切换启停状态',
      items: [actionMap.validate, actionMap.enable, actionMap.disable, actionMap.edit].filter(Boolean),
    },
    {
      key: 'observe',
      title: '诊断与观察',
      description: '查看日志与最近结果',
      items: [actionMap.logs].filter(Boolean),
    },
    {
      key: 'danger',
      title: '危险操作',
      description: '删除前请确认任务已不再使用',
      items: [actionMap.delete].filter(Boolean),
    },
  ].filter((group) => group.items.length > 0);
}

/**
 * 渲染抽屉中的任务详情内容。
 */
function DetailPanel({ taskId, taskSummary, onShowConfig, onShowLogs, onWorkspaceChange }) {
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    // 没有选中任务时直接清空详情，避免保留旧内容。
    if (!taskId) {
      setDetail(null);
      setHistory([]);
      return;
    }

    let cancelled = false;

    /**
     * 拉取详情与最近历史。
     */
    async function loadDetail() {
      setLoading(true);

      try {
        const [detailResponse, historyResponse] = await Promise.all([
          GetServiceDetail(taskId),
          ListServiceHistory(taskId),
        ]);

        // 组件卸载后不再写入状态，避免异步竞争。
        if (cancelled) {
          return;
        }

        setDetail(detailResponse);
        setHistory(historyResponse);
      } catch (error) {
        if (!cancelled) {
          message.error(getErrorMessage(error, '加载任务详情失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  /**
   * 执行详情动作并同步工作区状态。
   */
  async function handleAction(action) {
    if (!taskId) {
      return;
    }

    setActionLoading(action);

    try {
      const response = await ExecuteServiceAction({ id: taskId, action });
      setDetail(response.detail);
      onWorkspaceChange(response.snapshot, action === 'delete' ? '' : response.detail.id || taskId);
      message.success(response.message || '操作完成');

      // 删除后详情应立即清空，避免继续展示失效对象。
      if (action === 'delete') {
        setDetail(null);
        setHistory([]);
        return;
      }

      const historyResponse = await ListServiceHistory(taskId);
      setHistory(historyResponse);
    } catch (error) {
      message.error(getErrorMessage(error, '操作失败'));
    } finally {
      setActionLoading('');
    }
  }

  /**
   * 触发删除确认框。
   */
  function handleDelete() {
    Modal.confirm({
      title: '确认删除当前任务？',
      content: '删除后对应 plist 文件会被移除，当前用户目录中的任务可恢复只能靠重新创建。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleAction('delete'),
    });
  }

  if (!taskId) {
    return (
      <Card bordered={false} className="surface-card detail-card">
        <Empty description="请选择一个任务查看详情" />
      </Card>
    );
  }

  if (loading || !detail) {
    return (
      <Card bordered={false} className="surface-card detail-card">
        <Flex justify="center" align="center" className="detail-loading-state">
          <Spin />
        </Flex>
      </Card>
    );
  }

  const validationSummary = summarizeValidation(detail.validation);
  const detailBadges = buildDetailBadges(detail);
  const detailHighlights = buildDetailHighlights(detail, history);
  const actionItems = buildActionItems(detail, actionLoading, handleAction, onShowLogs, onShowConfig, handleDelete);
  const actionGroups = buildActionGroups(actionItems);

  return (
    <Space direction="vertical" size={16} className="full-width">
      <Card bordered={false} className="surface-card detail-card">
        <Space direction="vertical" size={16} className="full-width">
          <div className="detail-hero-shell">
            <div className="detail-hero-header">
              <div className="detail-hero-copy">
                <Text className="detail-kicker">launchd task profile</Text>
                <Title level={4} className="detail-title">
                  {detail.label}
                </Title>
              </div>
              <StatusTag
                compact
                status={detail.status}
                text={detail.statusText}
                detail={detail.statusDetail}
              />
            </div>
            <Space wrap size={[8, 8]} className="detail-badge-row">
              {detailBadges.map((badge) => (
                <Tag key={badge.key} className="detail-chip">
                  {badge.label}
                </Tag>
              ))}
            </Space>
            <Paragraph className="detail-path" copyable={{ text: detail.path }} ellipsis={{ rows: 2, expandable: true, symbol: '展开路径' }}>
              {detail.path}
            </Paragraph>
          </div>

          <div className="detail-highlight-grid">
            {detailHighlights.map((item) => (
              <div key={item.key} className={`detail-highlight-card ${item.tone ? `detail-highlight-card--${item.tone}` : ''}`}>
                <Text className="detail-highlight-label">{item.label}</Text>
                <Text strong className="detail-highlight-value">
                  {item.value}
                </Text>
                <Text type="secondary" className="detail-highlight-helper">
                  {item.helper}
                </Text>
              </div>
            ))}
          </div>

          <Card size="small" className="inner-card detail-action-card" title="操作面板">
            <div className="detail-action-group-grid">
              {actionGroups.map((group) => (
                <div key={group.key} className={`detail-action-group detail-action-group--${group.key}`}>
                  <div className="detail-action-group-head">
                    <div>
                      <Text strong className="detail-action-group-title">
                        {group.title}
                      </Text>
                      <Text type="secondary" className="detail-action-group-description">
                        {group.description}
                      </Text>
                    </div>
                  </div>
                  <div className="detail-actions-grid">
                    {group.items.map((item) => (
                      <Button
                        key={item.key}
                        type={item.type}
                        danger={item.danger}
                        icon={item.icon}
                        disabled={item.disabled}
                        loading={item.loading}
                        onClick={item.onClick}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {detail.alerts.length > 0 ? (
            <Card
              size="small"
              className="inner-card detail-alert-card"
              title="风险与提示"
              extra={<Text type="secondary">{detail.alerts.length} 条</Text>}
            >
              <div className="detail-validation-summary detail-validation-summary--compact">
                <div className="detail-validation-stat">
                  <Text className="detail-validation-label">错误</Text>
                  <Text strong className="detail-validation-value detail-validation-value--error">
                    {validationSummary.errorCount}
                  </Text>
                </div>
                <div className="detail-validation-stat">
                  <Text className="detail-validation-label">警告</Text>
                  <Text strong className="detail-validation-value detail-validation-value--warning">
                    {validationSummary.warningCount}
                  </Text>
                </div>
                <div className="detail-validation-stat">
                  <Text className="detail-validation-label">提示</Text>
                  <Text strong className="detail-validation-value">
                    {validationSummary.infoCount}
                  </Text>
                </div>
              </div>
              <Space direction="vertical" size={12} className="full-width">
                {detail.alerts.slice(0, 3).map((alert) => (
                  <Alert
                    key={`${alert.type}-${alert.message}`}
                    type={normalizeAlertType(alert.type)}
                    showIcon
                    message={alert.message}
                  />
                ))}
                {detail.alerts.length > 3 ? (
                  <Text type="secondary" className="detail-alert-more">
                    还有 {detail.alerts.length - 3} 条提示，可在下方校验区继续查看。
                  </Text>
                ) : null}
              </Space>
            </Card>
          ) : null}

          <Tabs
            defaultActiveKey="overview"
            className="detail-tabs"
            items={[
              {
                key: 'overview',
                label: '概览',
                children: (
                  <Space direction="vertical" size={16} className="full-width">
                    <Card size="small" className="inner-card detail-overview-card" title="核心画像">
                      <Descriptions column={2} size="small" className="detail-descriptions detail-descriptions--compact">
                        <Descriptions.Item label="配置文件">{detail.file || '未设置'}</Descriptions.Item>
                        <Descriptions.Item label="所属范围">{detail.scope || '未设置'}</Descriptions.Item>
                        <Descriptions.Item label="任务类型">{detail.type || '未设置'}</Descriptions.Item>
                        <Descriptions.Item label="日志能力">{detail.hasLogs ? '支持查看' : '当前不可用'}</Descriptions.Item>
                        <Descriptions.Item label="命令">{detail.command || '未设置'}</Descriptions.Item>
                        <Descriptions.Item label="参数">{detail.args || '无'}</Descriptions.Item>
                      </Descriptions>
                    </Card>

                    <div className="detail-group-grid">
                      {detail.groups.map((group) => (
                        <Card key={group.key} size="small" className="inner-card detail-group-card">
                          <div className="detail-group-head">
                            <div>
                              <Text className="detail-group-eyebrow">{group.key}</Text>
                              <Title level={5} className="detail-group-title">
                                {group.title}
                              </Title>
                            </div>
                            <Text type="secondary">{group.items.length} 项</Text>
                          </div>
                          <Descriptions column={1} size="small" className="detail-descriptions">
                            {group.items.map((item) => (
                              <Descriptions.Item key={`${group.key}-${item.label}`} label={item.label}>
                                {item.value || '未设置'}
                              </Descriptions.Item>
                            ))}
                          </Descriptions>
                        </Card>
                      ))}
                    </div>
                  </Space>
                ),
              },
              {
                key: 'validation',
                label: detail.validation.length > 0 ? `校验 ${detail.validation.length}` : '校验',
                children: detail.validation.length === 0 ? (
                  <Alert type="success" showIcon message="当前配置未发现额外问题。" />
                ) : (
                  <Space direction="vertical" size={12} className="full-width">
                    <div className="detail-validation-summary">
                      <div className="detail-validation-stat">
                        <Text className="detail-validation-label">错误</Text>
                        <Text strong className="detail-validation-value detail-validation-value--error">
                          {validationSummary.errorCount}
                        </Text>
                      </div>
                      <div className="detail-validation-stat">
                        <Text className="detail-validation-label">警告</Text>
                        <Text strong className="detail-validation-value detail-validation-value--warning">
                          {validationSummary.warningCount}
                        </Text>
                      </div>
                      <div className="detail-validation-stat">
                        <Text className="detail-validation-label">提示</Text>
                        <Text strong className="detail-validation-value">
                          {validationSummary.infoCount}
                        </Text>
                      </div>
                    </div>
                    {detail.validation.map((issue) => (
                      <Alert
                        key={`${issue.field}-${issue.message}`}
                        type={normalizeAlertType(issue.level)}
                        showIcon
                        message={`${issue.field || '配置'}：${issue.message}`}
                      />
                    ))}
                  </Space>
                ),
              },
              {
                key: 'runtime',
                label: '运行态',
                children: detail.runtimeDump ? (
                  <Card size="small" className="inner-card detail-runtime-card">
                    <Text type="secondary" className="detail-runtime-hint">
                      这里展示 `launchctl print` 返回的原始运行态，用于排查加载状态、退出码与环境差异。
                    </Text>
                    <div className="log-viewer">
                      {detail.runtimeDump.split('\n').map((line, index) => (
                        <div key={`${line}-${index}`} className="log-line">
                          {line}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <Alert type="info" showIcon message="当前没有可展示的 launchctl 运行态信息。" />
                ),
              },
            ]}
          />
        </Space>
      </Card>

      <Card
        bordered={false}
        className="surface-card danger-card detail-history-card"
        title="最近操作历史"
        extra={
          detail.lastAction ? (
            <Text type="secondary">最近一次：{new Date(detail.lastAction.createdAt).toLocaleString()}</Text>
          ) : null
        }
      >
        {history.length === 0 ? (
          <Text type="secondary">当前没有应用内操作历史。</Text>
        ) : (
          <Timeline
            items={history.map((item) => ({
              color: item.success ? 'green' : 'red',
              children: (
                <div className="detail-history-item">
                  <Text strong>{item.action}</Text>
                  <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
                  <Text>{item.message}</Text>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </Space>
  );
}

export default DetailPanel;
