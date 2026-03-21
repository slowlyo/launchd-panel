import { Flex, Menu, Space, Tag, Typography } from 'antd';
import { navigationGroups } from './mockData.jsx';

const { Title, Text, Paragraph } = Typography;

/**
 * 渲染侧边导航。
 */
function Navigation({ selectedKey, onSelect }) {
  return (
    <Space direction="vertical" size={20} className="full-width">
      <div className="brand-block">
        <Text type="secondary">launchd-panel</Text>
        <Title level={3}>macOS 任务工作台</Title>
        <Paragraph type="secondary">统一管理 LaunchAgents、LaunchDaemons 与 plist 配置。</Paragraph>
      </div>

      {navigationGroups.map((group) => (
        <div key={group.key}>
          <Text className="menu-group-title">{group.title}</Text>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={group.items.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: (
                <Flex justify="space-between" align="center" className="menu-item-label">
                  <span>{item.label}</span>
                  {typeof item.count === 'number' ? <Tag>{item.count}</Tag> : null}
                </Flex>
              ),
            }))}
            onClick={({ key }) => onSelect(key)}
          />
        </div>
      ))}
    </Space>
  );
}

export default Navigation;
