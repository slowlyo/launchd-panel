import { Button, Card, Dropdown, Space, Table, Tag, Tooltip, Typography } from 'antd';
import {
  CodeOutlined,
  EyeOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { memo, useMemo } from 'react';
import StatusTag from './StatusTag';

const { Text } = Typography;

/**
 * 返回任务筛选标签配置。
 */
function buildChipItems(selectedNavLabel, searchKeyword, selectedCount) {
  const chips = [];

  // 非默认视图时需要明确告诉用户当前列表来自哪个筛选。
  if (selectedNavLabel && selectedNavLabel !== '任务') {
    chips.push({ key: `view:${selectedNavLabel}`, label: `视图：${selectedNavLabel}` });
  }

  // 搜索词存在时直接暴露过滤条件，避免误判为空列表。
  if (searchKeyword.trim()) {
    chips.push({ key: `search:${searchKeyword.trim()}`, label: `搜索：${searchKeyword.trim()}` });
  }

  // 批量选择会影响顶部动作可用性，需要实时反馈。
  if (selectedCount > 0) {
    chips.push({ key: `selected:${selectedCount}`, label: `已选：${selectedCount} 项` });
  }

  return chips;
}

/**
 * 返回任务元信息标签。
 */
function buildMetaTags(record) {
  const tags = [{ key: `scope:${record.scopeKey}`, color: 'default', label: record.scope }];

  // 配置存在错误时优先显示风险，便于列表快速扫读。
  if (record.invalid) {
    tags.push({ key: 'invalid', color: 'error', label: '配置异常', icon: <WarningOutlined /> });
  }

  // 只读和停用都会直接影响操作能力，需要在列表层可见。
  if (record.readOnly) {
    tags.push({ key: 'readonly', color: 'warning', label: '只读' });
  }
  if (record.disabled) {
    tags.push({ key: 'disabled', color: 'default', label: '已停用' });
  }

  // 日志和历史决定排障路径，缺失时也应该明确展示。
  if (!record.hasLogs) {
    tags.push({ key: 'nolog', color: 'default', label: '无日志', icon: <InfoCircleOutlined /> });
  }
  if (record.historyCount > 0) {
    tags.push({
      key: 'history',
      color: 'processing',
      label: `历史 ${record.historyCount}`,
      icon: <HistoryOutlined />,
    });
  }

  return tags;
}

/**
 * 返回任务列表标题。
 */
function buildTableTitle(taskCount) {
  return `任务列表 · ${taskCount} 项`;
}

/**
 * 渲染支持悬浮查看完整内容的省略文本。
 */
function renderEllipsisText(value, type = undefined) {
  const content = value || '未设置';

  return (
    <Tooltip title={content}>
      <Text className="table-ellipsis-text" type={type}>
        {content}
      </Text>
    </Tooltip>
  );
}

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
  selectedRowKeys,
  onSelectionChange,
  onBatchValidate,
  onBatchDisable,
  batchDisableReason,
  selectedNavLabel,
  searchKeyword,
}) {
  const chips = useMemo(() => buildChipItems(selectedNavLabel, searchKeyword, selectedRowKeys.length), [
    searchKeyword,
    selectedNavLabel,
    selectedRowKeys.length,
  ]);

  const columns = useMemo(
    () => [
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 172,
        render: (_, record) => (
          <StatusTag status={record.status} text={record.statusText} detail={record.statusDetail} />
        ),
      },
      {
        title: 'Label',
        dataIndex: 'label',
        key: 'label',
        width: 320,
        render: (_, record) => (
          <Space direction="vertical" size={6} className="task-label-cell">
            <Space wrap size={[6, 6]}>
              <Text strong ellipsis={{ tooltip: record.label }} className="task-label-text">
                {record.label}
              </Text>
              {buildMetaTags(record).map((tag) => (
                <Tag key={tag.key} color={tag.color} icon={tag.icon}>
                  {tag.label}
                </Tag>
              ))}
            </Space>
            <Text type="secondary" ellipsis={{ tooltip: record.file }} className="task-file-text">
              {record.file}
            </Text>
          </Space>
        ),
      },
      {
        title: '主命令',
        dataIndex: 'command',
        key: 'command',
        width: 360,
        render: (_, record) => (
          <Space direction="vertical" size={4} className="task-command-cell">
            {renderEllipsisText(record.command || '未设置')}
            {renderEllipsisText(record.args || '无参数', 'secondary')}
          </Space>
        ),
      },
      {
        title: '调度方式',
        dataIndex: 'schedule',
        key: 'schedule',
        width: 190,
      },
      {
        title: '最近结果',
        dataIndex: 'result',
        key: 'result',
        width: 170,
        render: (value) => renderEllipsisText(value || '暂无结果'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 72,
        fixed: 'right',
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
                  disabled: !record.capabilities.canEdit,
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
                // 操作按钮只打开菜单，不触发行点击。
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
      title={buildTableTitle(tasks.length)}
      extra={
        <Space wrap>
          <Button disabled={selectedRowKeys.length === 0} onClick={onBatchValidate}>
            批量校验
          </Button>
          <Tooltip title={batchDisableReason}>
            <Button
              danger
              icon={<StopOutlined />}
              disabled={selectedRowKeys.length === 0 || Boolean(batchDisableReason)}
              onClick={onBatchDisable}
            >
              批量停用
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <Space size={[8, 8]} wrap className="chip-row">
        {chips.map((chip) => (
          <Tag key={chip.key}>{chip.label}</Tag>
        ))}
        {chips.length === 0 ? <Text type="secondary">当前未应用额外筛选</Text> : null}
      </Space>
      <Table
        rowKey="id"
        className="tasks-table"
        columns={columns}
        dataSource={tasks}
        pagination={false}
        virtual
        scroll={{ x: 1160, y: 640 }}
        locale={{ emptyText: '当前筛选下没有任务' }}
        rowSelection={{
          selectedRowKeys,
          onChange: onSelectionChange,
          columnWidth: 40,
          preserveSelectedRowKeys: true,
        }}
        rowClassName={(record) => (record.id === selectedTaskKey ? 'is-selected' : '')}
        onRow={(record) => ({
          onClick: () => onSelectTask(record),
          onContextMenu: (event) => onOpenContextMenu(event, record),
        })}
      />
    </Card>
  );
}

export default memo(TasksTable);
