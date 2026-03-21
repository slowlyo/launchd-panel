import {
  Alert,
  Button,
  Card,
  Descriptions,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  CodeOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { detailGroups, historyEvents, logLines } from './mockData.jsx';
import StatusTag from './StatusTag';

const { Title, Text } = Typography;

/**
 * 渲染抽屉中的任务详情内容。
 */
function DetailPanel({ task, onShowConfig, onShowLogs }) {
  const currentTask = task || {
    status: 'failed',
    statusText: '启动失败',
    statusDetail: '退出码 78',
    label: 'com.ops.backup.daily',
    scope: '系统 Daemon',
    result: '退出码 78 · 8 分钟前',
  };

  return (
    <Space direction="vertical" size={16} className="full-width">
      <Card
        bordered={false}
        className="surface-card detail-card"
        extra={
          <Space size={8} wrap>
            <StatusTag
              status={currentTask.status}
              text={currentTask.statusText}
              detail={currentTask.statusDetail}
            />
          </Space>
        }
      >
        <Space direction="vertical" size={16} className="full-width">
          <div>
            <Title level={4} className="detail-title">
              {currentTask.label}
            </Title>
            <Text type="secondary">{currentTask.scope} · 已加载 · {currentTask.result}</Text>
          </div>

          <Space wrap>
            <Button icon={<PlayCircleOutlined />}>启动</Button>
            <Button danger icon={<StopOutlined />}>停止</Button>
            <Button icon={<SafetyCertificateOutlined />}>校验</Button>
            <Button icon={<EyeOutlined />} onClick={onShowLogs}>
              查看日志
            </Button>
            <Button type="primary" icon={<CodeOutlined />} onClick={onShowConfig}>
              编辑
            </Button>
          </Space>

          <Alert
            type="error"
            showIcon
            message="启动失败：目标卷无写权限，建议先检查 StandardErrorPath 与备份路径。"
          />
          <Alert
            type="warning"
            showIcon
            message="这是系统级任务，修改、停用或卸载前需要管理员授权与二次确认。"
          />

          <Tabs
            defaultActiveKey="overview"
            items={[
              {
                key: 'overview',
                label: '概览',
                children: (
                  <Space direction="vertical" size={16} className="full-width">
                    {detailGroups.map((group) => (
                      <Card key={group.key} size="small" className="inner-card">
                        <Title level={5}>{group.title}</Title>
                        <Descriptions column={1} size="small" className="detail-descriptions">
                          {group.items.map(([label, value]) => (
                            <Descriptions.Item key={label} label={label}>
                              {value}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      </Card>
                    ))}
                  </Space>
                ),
              },
              {
                key: 'logs',
                label: '日志',
                children: (
                  <Space direction="vertical" size={12} className="full-width">
                    <Space wrap>
                      <Tag color="error">stderr</Tag>
                      <Tag>路径：/var/log/backup-job.error.log</Tag>
                    </Space>
                    <div className="log-viewer">
                      {logLines.map((line) => (
                        <div key={line} className={line.includes('[ERROR]') ? 'log-line is-error' : 'log-line'}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </Space>
                ),
              },
              {
                key: 'history',
                label: '历史',
                children: <Timeline items={historyEvents} />,
              },
            ]}
          />
        </Space>
      </Card>

      <Card bordered={false} className="surface-card danger-card" title="危险操作确认">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="操作">卸载系统级任务</Descriptions.Item>
          <Descriptions.Item label="影响">备份服务将不再由 launchd 托管</Descriptions.Item>
          <Descriptions.Item label="二次确认">输入 UNLOAD 后可继续</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}

export default DetailPanel;
