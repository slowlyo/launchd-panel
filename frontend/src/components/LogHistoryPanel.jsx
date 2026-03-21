import { Alert, Button, Card, Segmented, Timeline, Typography } from 'antd';
import { historyEvents, logLines } from './mockData.jsx';

const { Text } = Typography;

/**
 * 渲染日志与历史区。
 */
function LogHistoryPanel({ task, onClose }) {
  return (
    <Card
      bordered={false}
      className="surface-card logs-card"
      title={task ? `日志查看与运行历史 · ${task.label}` : '日志查看与运行历史'}
      extra={
        <div className="panel-extra-actions">
          <Segmented options={['stdout', 'stderr', '合并视图']} defaultValue="stderr" />
          <Button size="small" onClick={onClose}>
            收起
          </Button>
        </div>
      }
    >
      <div className="full-width app-section-stack">
        <Alert
          type="warning"
          showIcon
          message={
            task
              ? `${task.label} 的日志读取受权限影响，未授予完全磁盘访问时可能缺失。`
              : '未授予完全磁盘访问权限时，部分日志可能不可读取。'
          }
        />
        <div className="log-viewer">
          {logLines.map((line) => (
            <div key={line} className={line.includes('[ERROR]') ? 'log-line is-error' : 'log-line'}>
              {line}
            </div>
          ))}
        </div>
        <Card size="small" className="inner-card" title="最近执行历史">
          <Timeline items={historyEvents} />
          <Text type="secondary">保留最近 50 条执行结果，支持导出审计摘要。</Text>
        </Card>
      </div>
    </Card>
  );
}

export default LogHistoryPanel;
