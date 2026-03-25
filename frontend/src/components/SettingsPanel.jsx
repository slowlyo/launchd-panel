import {
  Button,
  Card,
  Flex,
  Progress,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  CloudDownloadOutlined,
  LinkOutlined,
  ReloadOutlined,
  RocketOutlined,
} from '@ant-design/icons';

const { Paragraph, Text, Title } = Typography;

/**
 * 返回当前主题模式的人类可读名称。
 */
function getThemeModeLabel(themeMode) {
  switch (themeMode) {
    case 'light':
      return '明亮';
    case 'dark':
      return '暗色';
    default:
      return '跟随系统';
  }
}

/**
 * 格式化更新时间显示文本。
 */
function formatUpdateTime(value) {
  if (!value) {
    return '未记录';
  }

  return new Date(value).toLocaleString('zh-CN');
}

/**
 * 返回更新提示文案的视觉状态。
 */
function getUpdateProgressStatus(stage) {
  switch (stage) {
    case 'error':
      return 'exception';
    case 'ready':
    case 'up-to-date':
      return 'success';
    default:
      return 'active';
  }
}

/**
 * 判断当前阶段是否需要展示进度条。
 */
function shouldShowUpdateProgress(stage) {
  return ['checking', 'downloading', 'verifying', 'extracting', 'installing', 'error'].includes(stage);
}

/**
 * 渲染应用设置面板。
 */
function SettingsPanel({
  settings,
  resolvedThemeMode,
  updateStatus,
  updateProgress,
  isCheckingUpdate,
  isPreparingUpdate,
  isInstallingUpdate,
  onChange,
  onCheckForUpdates,
  onPrepareUpdate,
  onInstallUpdate,
  onOpenReleasePage,
}) {
  /**
   * 更新系统任务展示开关。
   */
  function handleShowSystemTasksChange(checked) {
    onChange({
      ...settings,
      showSystemTasks: checked,
    });
  }

  /**
   * 更新主题模式。
   */
  function handleThemeModeChange(themeMode) {
    onChange({
      ...settings,
      themeMode,
    });
  }

  /**
   * 更新启动时检查新版本开关。
   */
  function handleAutoCheckUpdatesChange(checked) {
    onChange({
      ...settings,
      autoCheckUpdates: checked,
    });
  }

  /**
   * 更新自动预下载开关。
   */
  function handleAutoDownloadUpdatesChange(checked) {
    onChange({
      ...settings,
      autoDownloadUpdates: checked,
    });
  }

  return (
    <Card bordered={false} className="surface-card settings-card">
      <Flex vertical gap={20} className="full-width">
        <div className="settings-panel-header">
          <Text className="settings-section-caption">工作台偏好</Text>
          <Title level={4} className="settings-panel-title">外观与展示</Title>
          <Paragraph className="settings-panel-description">
            设置会保存在当前设备，用于调整首页默认展示内容。
          </Paragraph>
        </div>

        <div className="settings-item">
          <div className="settings-item-copy">
            <Text strong className="settings-item-title">界面主题</Text>
            <Paragraph className="settings-item-description">
              支持明亮、暗色与跟随系统，默认跟随系统。
            </Paragraph>
            <Tag bordered={false} className="settings-inline-tag">
              当前生效：{getThemeModeLabel(resolvedThemeMode)}
            </Tag>
          </div>
          <Segmented
            className="settings-item-control"
            value={settings.themeMode}
            onChange={handleThemeModeChange}
            options={[
              { label: '明亮', value: 'light' },
              { label: '暗色', value: 'dark' },
              { label: '跟随系统', value: 'system' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div className="settings-item-copy">
            <Text strong className="settings-item-title">展示系统任务</Text>
            <Paragraph className="settings-item-description">
              关闭后隐藏“全部用户 Agent”“系统 Agent”“系统 Daemon”，默认仅关注当前用户任务。
            </Paragraph>
          </div>
          <Switch
            checked={settings.showSystemTasks}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            onChange={handleShowSystemTasksChange}
          />
        </div>

        <div className="settings-panel-header">
          <Text className="settings-section-caption">应用更新</Text>
          <Title level={4} className="settings-panel-title">版本检测与升级</Title>
          <Paragraph className="settings-panel-description">
            基于 GitHub Releases 检查最新版，下载完成后通过重启完成替换安装。
          </Paragraph>
        </div>

        <div className="settings-item settings-item-stacked">
          <div className="settings-item-copy">
            <Text strong className="settings-item-title">当前版本</Text>
            <Paragraph className="settings-item-description">
              运行版本 {updateStatus.currentVersionLabel}
              {updateStatus.latestVersion ? `，最新版本 ${updateStatus.latestVersionLabel}` : '，尚未查询远端版本'}
            </Paragraph>
            <div className="settings-tag-row">
              <Tag bordered={false} className="settings-inline-tag">
                当前 {updateStatus.currentVersionLabel}
              </Tag>
              {updateStatus.latestVersion ? (
                <Tag bordered={false} className="settings-inline-tag">
                  最新 {updateStatus.latestVersionLabel}
                </Tag>
              ) : null}
              {updateStatus.lastCheckedAt ? (
                <Tag bordered={false} className="settings-inline-tag">
                  上次检查 {formatUpdateTime(updateStatus.lastCheckedAt)}
                </Tag>
              ) : null}
            </div>
            <Paragraph className="settings-item-description settings-update-note">
              {updateStatus.message}
            </Paragraph>
            {updateStatus.publishedAt ? (
              <Paragraph className="settings-item-description settings-update-meta">
                发布时间：{formatUpdateTime(updateStatus.publishedAt)}
              </Paragraph>
            ) : null}
            {updateStatus.downloadedAt ? (
              <Paragraph className="settings-item-description settings-update-meta">
                更新包准备完成：{formatUpdateTime(updateStatus.downloadedAt)}
              </Paragraph>
            ) : null}
            {shouldShowUpdateProgress(updateProgress.stage) ? (
              <div className="settings-progress-block">
                <Text className="settings-progress-copy">
                  {updateProgress.message || '正在处理更新任务'}
                </Text>
                <Progress
                  percent={Math.max(0, Math.min(100, Math.round(updateProgress.percent || 0)))}
                  size="small"
                  status={getUpdateProgressStatus(updateProgress.stage)}
                  showInfo={updateProgress.total > 0 || updateProgress.percent > 0}
                />
              </div>
            ) : null}
          </div>

          <div className="settings-actions">
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                loading={isCheckingUpdate}
                disabled={isPreparingUpdate || isInstallingUpdate}
                onClick={onCheckForUpdates}
              >
                检查更新
              </Button>
              {updateStatus.hasUpdate && !updateStatus.readyToInstall ? (
                <Button
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  loading={isPreparingUpdate}
                  disabled={isCheckingUpdate || isInstallingUpdate}
                  onClick={onPrepareUpdate}
                >
                  下载更新
                </Button>
              ) : null}
              {updateStatus.readyToInstall ? (
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={isInstallingUpdate}
                  disabled={isCheckingUpdate || isPreparingUpdate}
                  onClick={onInstallUpdate}
                >
                  重启安装
                </Button>
              ) : null}
              {updateStatus.releaseUrl ? (
                <Button
                  icon={<LinkOutlined />}
                  disabled={isInstallingUpdate}
                  onClick={onOpenReleasePage}
                >
                  查看发布页
                </Button>
              ) : null}
            </Space>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-copy">
            <Text strong className="settings-item-title">启动时检查更新</Text>
            <Paragraph className="settings-item-description">
              应用启动后静默查询 GitHub 最新正式版，发现新版本时在界面内提醒。
            </Paragraph>
          </div>
          <Switch
            checked={settings.autoCheckUpdates}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            onChange={handleAutoCheckUpdatesChange}
          />
        </div>

        <div className="settings-item">
          <div className="settings-item-copy">
            <Text strong className="settings-item-title">自动下载更新包</Text>
            <Paragraph className="settings-item-description">
              仅在检测到新版本后后台预下载，不会强制退出；安装仍需你主动确认。
            </Paragraph>
          </div>
          <Switch
            checked={settings.autoDownloadUpdates}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            onChange={handleAutoDownloadUpdatesChange}
          />
        </div>
      </Flex>
    </Card>
  );
}

export default SettingsPanel;
