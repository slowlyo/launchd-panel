import { Badge, Space, Typography } from 'antd';

const { Text } = Typography;

/**
 * 返回任务状态对应的徽标配置。
 */
function getStatusMeta(status) {
  const mapping = {
    running: { badge: 'success' },
    failed: { badge: 'error' },
    loaded: { badge: 'processing' },
    warning: { badge: 'warning' },
    invalid: { badge: 'error' },
    disabled: { badge: 'default' },
    idle: { badge: 'default' },
  };

  return mapping[status] || mapping.idle;
}

/**
 * 渲染任务状态标签。
 */
function StatusTag({ status, text, detail }) {
  const meta = getStatusMeta(status);

  return (
    <Space direction="vertical" size={0}>
      <Badge status={meta.badge} text={<Text strong>{text}</Text>} />
      <Text type="secondary" className="status-detail">
        {detail}
      </Text>
    </Space>
  );
}

export default StatusTag;
