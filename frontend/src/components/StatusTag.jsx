import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  PauseCircleFilled,
  PlayCircleFilled,
  WarningFilled,
} from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * 返回任务状态对应的徽标配置。
 */
function getStatusMeta(status) {
  const mapping = {
    running: { tone: 'running', icon: PlayCircleFilled },
    failed: { tone: 'failed', icon: CloseCircleFilled },
    loaded: { tone: 'loaded', icon: CheckCircleFilled },
    warning: { tone: 'warning', icon: WarningFilled },
    invalid: { tone: 'invalid', icon: ExclamationCircleFilled },
    disabled: { tone: 'disabled', icon: PauseCircleFilled },
    idle: { tone: 'idle', icon: ClockCircleFilled },
  };

  return mapping[status] || mapping.idle;
}

/**
 * 渲染任务状态标签。
 */
function StatusTag({ status, text, detail }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <div className={`status-tag status-tag--${meta.tone}`}>
      <div className="status-tag-main">
        <span className="status-tag-icon-shell" aria-hidden="true">
          <Icon className="status-tag-icon" />
        </span>
        <Text strong className="status-tag-text">
          {text}
        </Text>
      </div>
      {detail ? (
        <Text type="secondary" className="status-tag-detail">
          {detail}
        </Text>
      ) : null}
    </div>
  );
}

export default StatusTag;
