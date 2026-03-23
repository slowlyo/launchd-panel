import { Card, Flex, Segmented, Switch, Tag, Typography } from 'antd';

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
 * 渲染应用设置面板。
 */
function SettingsPanel({ settings, resolvedThemeMode, onChange }) {
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
      </Flex>
    </Card>
  );
}

export default SettingsPanel;
