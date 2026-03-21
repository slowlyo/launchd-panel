import { Button, Card, Dropdown, Space, Table, Tag, Typography } from 'antd';
import { CodeOutlined, EyeOutlined, FileSearchOutlined, MoreOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import StatusTag from './StatusTag';
import { filterChips } from './mockData.jsx';

const { Text } = Typography;

/**
 * 渲染任务表格。
 */
function TasksTable({
  tasks,
  onSelectTask,
  onOpenDetail,
  onOpenEditConfig,
  onOpenLogs,
  onOpenContextMenu,
  selectedTaskKey,
}) {
  const columns = useMemo(
    () => [
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 148,
        render: (_, record) => (
          <StatusTag status={record.status} text={record.statusText} detail={record.statusDetail} />
        ),
      },
      {
        title: 'Label',
        dataIndex: 'label',
        key: 'label',
        width: 220,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text strong>{record.label}</Text>
            <Text type="secondary">{record.file}</Text>
          </Space>
        ),
      },
      {
        title: '作用域',
        dataIndex: 'scope',
        key: 'scope',
        width: 160,
      },
      {
        title: '主命令',
        dataIndex: 'command',
        key: 'command',
        width: 240,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text>{record.command}</Text>
            <Text type="secondary">{record.args}</Text>
          </Space>
        ),
      },
      {
        title: '调度方式',
        dataIndex: 'schedule',
        key: 'schedule',
        width: 160,
      },
      {
        title: '最近结果',
        dataIndex: 'result',
        key: 'result',
        width: 170,
      },
      {
        title: '配置路径',
        dataIndex: 'path',
        key: 'path',
        ellipsis: true,
      },
      {
        title: '操作',
        key: 'actions',
        width: 72,
        render: (_, record) => (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'detail',
                  icon: <EyeOutlined />,
                  label: '查看详情',
                },
                {
                  key: 'edit',
                  icon: <CodeOutlined />,
                  label: '编辑配置',
                },
                {
                  key: 'logs',
                  icon: <FileSearchOutlined />,
                  label: '查看日志',
                },
              ],
              onClick: ({ key, domEvent }) => {
                // 下拉菜单点击不能冒泡到整行详情打开。
                domEvent.stopPropagation();

                if (key === 'detail') {
                  onOpenDetail(record);
                  return;
                }

                if (key === 'edit') {
                  onOpenEditConfig(record);
                  return;
                }

                onOpenLogs(record);
              },
            }}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              aria-label="更多操作"
              onClick={(event) => {
                // 按钮点击只打开菜单，不触发行点击。
                event.stopPropagation();
              }}
            />
          </Dropdown>
        ),
      },
    ],
    [onOpenDetail, onOpenEditConfig, onOpenLogs]
  );

  return (
    <Card
      bordered={false}
      className="surface-card table-card"
      title="任务列表"
      extra={
        <Space wrap>
          <Button>批量校验</Button>
          <Button danger>批量停用</Button>
        </Space>
      }
    >
      <Space size={[8, 8]} wrap className="chip-row">
        {filterChips.map((chip) => (
          <Tag key={chip}>{chip}</Tag>
        ))}
        <Button type="link">清空筛选</Button>
      </Space>
      <Table
        rowKey="key"
        className="tasks-table"
        columns={columns}
        dataSource={tasks}
        pagination={false}
        scroll={{ x: 1280 }}
        rowClassName={(record) => (record.key === selectedTaskKey ? 'is-selected' : '')}
        onRow={(record) => ({
          onClick: () => onSelectTask(record),
          onContextMenu: (event) => onOpenContextMenu(event, record),
        })}
      />
    </Card>
  );
}

export default TasksTable;
