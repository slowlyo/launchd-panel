import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Space,
  Spin,
  Tabs,
  Timeline,
  Typography,
  message,
  Modal,
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

const { Title, Text } = Typography;

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

  return (
    <Space direction="vertical" size={16} className="full-width">
      <Card
        bordered={false}
        className="surface-card detail-card"
        extra={
          <StatusTag
            status={detail.status}
            text={detail.statusText}
            detail={detail.statusDetail}
          />
        }
      >
        <Space direction="vertical" size={16} className="full-width">
          <div>
            <Title level={4} className="detail-title">
              {detail.label}
            </Title>
            <Text type="secondary">
              {detail.scope} · {detail.result} · {detail.path}
            </Text>
          </div>

          <Space wrap>
            <Button
              icon={<PlayCircleOutlined />}
              disabled={!detail.capabilities.canStart}
              loading={actionLoading === 'start'}
              onClick={() => handleAction('start')}
            >
              启动
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              disabled={!detail.capabilities.canStop}
              loading={actionLoading === 'stop'}
              onClick={() => handleAction('stop')}
            >
              停止
            </Button>
            <Button
              icon={<SafetyCertificateOutlined />}
              loading={actionLoading === 'validate'}
              onClick={() => handleAction('validate')}
            >
              校验
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              disabled={!detail.capabilities.canEnable}
              loading={actionLoading === 'enable'}
              onClick={() => handleAction('enable')}
            >
              启用
            </Button>
            <Button
              icon={<StopOutlined />}
              disabled={!detail.capabilities.canDisable}
              loading={actionLoading === 'disable'}
              onClick={() => handleAction('disable')}
            >
              停用
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!detail.capabilities.canReload}
              loading={actionLoading === 'reload'}
              onClick={() => handleAction('reload')}
            >
              重载
            </Button>
            <Button icon={<EyeOutlined />} onClick={onShowLogs}>
              查看日志
            </Button>
            <Button
              type="primary"
              icon={<CodeOutlined />}
              disabled={!detail.capabilities.canEdit}
              onClick={onShowConfig}
            >
              编辑
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!detail.capabilities.canDelete}
              loading={actionLoading === 'delete'}
              onClick={handleDelete}
            >
              删除
            </Button>
          </Space>

          {detail.alerts.map((alert) => (
            <Alert
              key={`${alert.type}-${alert.message}`}
              type={normalizeAlertType(alert.type)}
              showIcon
              message={alert.message}
            />
          ))}

          <Tabs
            defaultActiveKey="overview"
            items={[
              {
                key: 'overview',
                label: '概览',
                children: (
                  <Space direction="vertical" size={16} className="full-width">
                    {detail.groups.map((group) => (
                      <Card key={group.key} size="small" className="inner-card">
                        <Title level={5}>{group.title}</Title>
                        <Descriptions column={1} size="small" className="detail-descriptions">
                          {group.items.map((item) => (
                            <Descriptions.Item key={`${group.key}-${item.label}`} label={item.label}>
                              {item.value || '未设置'}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      </Card>
                    ))}
                  </Space>
                ),
              },
              {
                key: 'validation',
                label: '校验',
                children: detail.validation.length === 0 ? (
                  <Alert type="success" showIcon message="当前配置未发现额外问题。" />
                ) : (
                  <Space direction="vertical" size={12} className="full-width">
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
                  <div className="log-viewer">
                    {detail.runtimeDump.split('\n').map((line, index) => (
                      <div key={`${line}-${index}`} className="log-line">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert type="info" showIcon message="当前没有可展示的 launchctl 运行态信息。" />
                ),
              },
            ]}
          />
        </Space>
      </Card>

      <Card bordered={false} className="surface-card danger-card" title="最近操作历史">
        {history.length === 0 ? (
          <Text type="secondary">当前没有应用内操作历史。</Text>
        ) : (
          <Timeline
            items={history.map((item) => ({
              color: item.success ? 'green' : 'red',
              children: `${new Date(item.createdAt).toLocaleString()} · ${item.action} · ${item.message}`,
            }))}
          />
        )}
      </Card>
    </Space>
  );
}

export default DetailPanel;
