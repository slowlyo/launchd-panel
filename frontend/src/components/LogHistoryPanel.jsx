import { DeleteOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Timeline,
  Typography,
  message,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ClearServiceLogs, ListServiceHistory, ReadServiceLogs } from '../../wailsjs/go/main/App';
import { getErrorMessage } from '../utils/errors';

const { Paragraph, Text } = Typography;
const LOG_LIMIT_OPTIONS = [
  { label: '100 条', value: 100 },
  { label: '200 条', value: 200 },
  { label: '500 条', value: 500 },
  { label: '1000 条', value: 1000 },
];
const AUTO_REFRESH_INTERVAL_OPTIONS = [
  { label: '3 秒', value: 3000 },
  { label: '5 秒', value: 5000 },
  { label: '10 秒', value: 10000 },
];

/**
 * 生成日志下载文件名。
 */
function buildDownloadFileName(task, stream) {
  const safeLabel = (task?.label || 'launchd-log').replace(/[^\w.-]+/g, '-');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `${safeLabel}.${stream}.${stamp}.log`;
}

/**
 * 生成导出的日志文本。
 */
function buildDownloadContent(task, logs) {
  const headerLines = [
    `任务: ${task?.label || '未命名任务'}`,
    `日志流: ${logs?.stream || 'stderr'}`,
    `导出时间: ${new Date().toLocaleString()}`,
  ];

  // 有真实日志路径时一并写入，方便回查来源文件。
  if (logs?.paths?.length) {
    headerLines.push(`日志路径: ${logs.paths.join(', ')}`);
  }

  const contentLines = (logs?.lines || []).map((line) => `[${line.source}] ${line.text}`);

  return [...headerLines, '', ...contentLines].join('\n');
}

/**
 * 渲染日志与历史区。
 */
function LogHistoryPanel({ task, onClose }) {
  const [stream, setStream] = useState('stderr');
  const [logs, setLogs] = useState(null);
  const [history, setHistory] = useState([]);
  const [lineLimit, setLineLimit] = useState(200);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isLiveTracking, setIsLiveTracking] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(3000);
  const [logsLoading, setLogsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [logsRefreshVersion, setLogsRefreshVersion] = useState(0);
  const [historyRefreshVersion, setHistoryRefreshVersion] = useState(0);
  const logViewerRef = useRef(null);

  useEffect(() => {
    // 没有选中任务时不触发任何读取。
    if (!task?.id) {
      setLogs(null);
      setHistory([]);
      return;
    }

    let cancelled = false;

    /**
     * 拉取日志数据。
     */
    async function loadLogs() {
      setLogsLoading(true);

      try {
        const logsResponse = await ReadServiceLogs({ id: task.id, stream, limit: lineLimit });

        if (cancelled) {
          return;
        }

        setLogs(logsResponse);
      } catch (error) {
        if (!cancelled) {
          message.error(getErrorMessage(error, '读取日志失败'));
        }
      } finally {
        if (!cancelled) {
          setLogsLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      cancelled = true;
    };
  }, [lineLimit, logsRefreshVersion, stream, task?.id]);

  useEffect(() => {
    // 没有选中任务时不触发任何读取。
    if (!task?.id) {
      setHistory([]);
      return;
    }

    let cancelled = false;

    /**
     * 拉取任务历史。
     */
    async function loadHistory() {
      setHistoryLoading(true);

      try {
        const historyResponse = await ListServiceHistory(task.id);

        if (cancelled) {
          return;
        }

        setHistory(historyResponse);
      } catch (error) {
        if (!cancelled) {
          message.error(getErrorMessage(error, '读取历史失败'));
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [historyRefreshVersion, task?.id]);

  useEffect(() => {
    // 关闭自动刷新时不建立轮询。
    if (!task?.id || !isAutoRefresh) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLogsRefreshVersion((value) => value + 1);
      setHistoryRefreshVersion((value) => value + 1);
    }, autoRefreshInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefreshInterval, isAutoRefresh, task?.id]);

  useEffect(() => {
    // 仅在实时跟踪时自动贴底，避免打断用户手动翻阅旧日志。
    if (!isLiveTracking || !logViewerRef.current) {
      return;
    }

    logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
  }, [isLiveTracking, logs]);

  /**
   * 刷新当前日志与历史。
   */
  function handleRefresh() {
    setLogsRefreshVersion((value) => value + 1);
    setHistoryRefreshVersion((value) => value + 1);
  }

  /**
   * 切换自动刷新，关闭时同步关闭实时跟踪。
   */
  function handleAutoRefreshChange(checked) {
    setIsAutoRefresh(checked);

    // 没有自动刷新时，实时跟踪无法产生增量效果。
    if (!checked) {
      setIsLiveTracking(false);
    }
  }

  /**
   * 切换实时跟踪，并确保自动刷新已开启。
   */
  function handleLiveTrackingChange(checked) {
    setIsLiveTracking(checked);

    // 实时跟踪依赖自动刷新，否则无法持续拉取新日志。
    if (checked) {
      setIsAutoRefresh(true);
    }
  }

  /**
   * 下载当前日志视图。
   */
  function handleDownload() {
    if (!logs?.lines?.length) {
      message.warning('当前没有可下载的日志内容');
      return;
    }

    const blob = new Blob([buildDownloadContent(task, logs)], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildDownloadFileName(task, stream);
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * 清空当前流对应的日志文件。
   */
  async function handleClearLogs() {
    if (!task?.id) {
      return;
    }

    try {
      await ClearServiceLogs({ id: task.id, stream });
      message.success('日志已清空');
      setLogs((currentLogs) => (currentLogs ? { ...currentLogs, lines: [] } : currentLogs));
      setLogsRefreshVersion((value) => value + 1);
    } catch (error) {
      message.error(getErrorMessage(error, '清空日志失败'));
    }
  }

  const isInitialLoading = !logs && logsLoading && history.length === 0;
  const logCount = logs?.lines?.length || 0;

  return (
    <Card
      bordered={false}
      className="surface-card logs-card"
      title={task ? `日志查看与运行历史 · ${task.label}` : '日志查看与运行历史'}
      extra={
        <div className="panel-extra-actions">
          <Button size="small" onClick={onClose}>
            收起
          </Button>
        </div>
      }
    >
      {!task ? (
        <Empty description="请选择一个任务查看日志" />
      ) : isInitialLoading ? (
        <div className="panel-loading-state">
          <Spin />
        </div>
      ) : (
        <div className="full-width app-section-stack">
          <div className="log-toolbar">
            <Space wrap size={[8, 8]}>
              <Segmented
                options={[
                  { label: 'stdout', value: 'stdout' },
                  { label: 'stderr', value: 'stderr' },
                  { label: '合并视图', value: 'combined' },
                ]}
                value={stream}
                onChange={setStream}
              />
              <Select
                size="small"
                value={lineLimit}
                options={LOG_LIMIT_OPTIONS}
                popupMatchSelectWidth={false}
                onChange={setLineLimit}
              />
              <Space size={6}>
                <Switch size="small" checked={isAutoRefresh} onChange={handleAutoRefreshChange} />
                <Text type="secondary">自动刷新</Text>
              </Space>
              <Select
                size="small"
                value={autoRefreshInterval}
                options={AUTO_REFRESH_INTERVAL_OPTIONS}
                popupMatchSelectWidth={false}
                disabled={!isAutoRefresh}
                onChange={setAutoRefreshInterval}
              />
              <Space size={6}>
                <Switch size="small" checked={isLiveTracking} disabled={!isAutoRefresh} onChange={handleLiveTrackingChange} />
                <Text type="secondary">实时跟踪</Text>
              </Space>
            </Space>
            <Space wrap size={[8, 8]}>
              <Button size="small" icon={<ReloadOutlined />} loading={logsLoading || historyLoading} onClick={handleRefresh}>
                刷新
              </Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload} disabled={logCount === 0}>
                下载
              </Button>
              <Popconfirm
                title="确认清空当前日志流吗？"
                description="该操作会直接截断日志文件，无法恢复。"
                okText="清空"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={handleClearLogs}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!logs?.paths?.length || !task?.capabilities?.canEdit}
                >
                  清空
                </Button>
              </Popconfirm>
            </Space>
          </div>
          {(logs?.warnings || []).map((warning) => (
            <Alert
              key={warning.message}
              type={warning.type === 'error' ? 'error' : 'warning'}
              showIcon
              message={warning.message}
            />
          ))}
          <div className="log-meta">
            <Text type="secondary">
              当前展示最近 {Math.min(logCount, lineLimit)} / {lineLimit} 条
              {isAutoRefresh ? `，每 ${autoRefreshInterval / 1000} 秒自动刷新` : ''}
              {isLiveTracking ? '，并自动滚动到底部' : ''}
            </Text>
            {logs?.paths?.length ? (
              <Paragraph className="log-paths" ellipsis={{ rows: 2, expandable: true, symbol: '展开路径' }}>
                {logs.paths.join(' · ')}
              </Paragraph>
            ) : null}
          </div>
          <div ref={logViewerRef} className="log-viewer">
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
            {historyLoading && history.length === 0 ? (
              <div className="panel-loading-state">
                <Spin size="small" />
              </div>
            ) : history.length === 0 ? (
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
