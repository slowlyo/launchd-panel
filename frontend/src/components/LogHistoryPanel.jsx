import { Alert, Button, Card, Empty, Segmented, Spin, Timeline, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { ListServiceHistory, ReadServiceLogs } from '../../wailsjs/go/main/App';

const { Text } = Typography;

/**
 * 渲染日志与历史区。
 */
function LogHistoryPanel({ task, onClose }) {
  const [stream, setStream] = useState('stderr');
  const [logs, setLogs] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 没有选中任务时不触发任何读取。
    if (!task?.id) {
      setLogs(null);
      setHistory([]);
      return;
    }

    let cancelled = false;

    /**
     * 拉取日志与历史数据。
     */
    async function loadLogs() {
      setLoading(true);

      try {
        const [logsResponse, historyResponse] = await Promise.all([
          ReadServiceLogs({ id: task.id, stream, limit: 200 }),
          ListServiceHistory(task.id),
        ]);

        if (cancelled) {
          return;
        }

        setLogs(logsResponse);
        setHistory(historyResponse);
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || '读取日志失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      cancelled = true;
    };
  }, [stream, task?.id]);

  return (
    <Card
      bordered={false}
      className="surface-card logs-card"
      title={task ? `日志查看与运行历史 · ${task.label}` : '日志查看与运行历史'}
      extra={
        <div className="panel-extra-actions">
          <Segmented
            options={[
              { label: 'stdout', value: 'stdout' },
              { label: 'stderr', value: 'stderr' },
              { label: '合并视图', value: 'combined' },
            ]}
            value={stream}
            onChange={setStream}
          />
          <Button size="small" onClick={onClose}>
            收起
          </Button>
        </div>
      }
    >
      {!task ? (
        <Empty description="请选择一个任务查看日志" />
      ) : loading ? (
        <div className="panel-loading-state">
          <Spin />
        </div>
      ) : (
        <div className="full-width app-section-stack">
          {(logs?.warnings || []).map((warning) => (
            <Alert
              key={warning.message}
              type={warning.type === 'error' ? 'error' : 'warning'}
              showIcon
              message={warning.message}
            />
          ))}
          <div className="log-viewer">
            {logs?.lines?.length ? (
              logs.lines.map((line, index) => (
                <div
                  key={`${line.source}-${line.text}-${index}`}
                  className={line.text.includes('ERROR') ? 'log-line is-error' : 'log-line'}
                >
                  [{line.source}] {line.text}
                </div>
              ))
            ) : (
              <div className="log-line">当前没有可显示的日志内容。</div>
            )}
          </div>
          <Card size="small" className="inner-card" title="最近执行历史">
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
            <Text type="secondary">默认保留最近 50 条与当前任务相关的应用内操作记录。</Text>
          </Card>
        </div>
      )}
    </Card>
  );
}

export default LogHistoryPanel;
