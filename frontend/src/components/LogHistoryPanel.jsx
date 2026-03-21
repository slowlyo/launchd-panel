import { Alert, Card, Segmented, Timeline, Typography } from 'antd';
import { historyEvents, logLines } from './mockData.jsx';

const { Text } = Typography;

/**
 * 渲染日志与历史区。
 */
function LogHistoryPanel() {
  return (
    <Card
      bordered={false}
      className="surface-card"
      title="日志查看与运行历史"
      extra={<Segmented options={['stdout', 'stderr', '合并视图']} defaultValue="stderr" />}
    >
      <div className="full-width app-section-stack">
        <Alert type="warning" showIcon message="未授予完全磁盘访问权限时，部分日志可能不可读取。" />
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
