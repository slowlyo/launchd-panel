import { Flex, Menu, Tag, Typography } from 'antd';
import { navigationGroups } from './mockData.jsx';

const { Text, Title } = Typography;

/**
 * 按需渲染菜单数量标签，避免无意义占位。
 */
function renderMenuCount(count) {
  // 只有存在有效数量时才展示标签，避免侧边栏信息噪声。
  if (typeof count !== 'number') {
    return null;
  }

  return <Tag className="menu-count-tag">{count}</Tag>;
}

/**
 * 渲染侧边栏品牌区域。
 */
export function SidebarBrand() {
  return (
    <div className="brand-header">
      <Title level={4} className="brand-title">Launchd Panel</Title>
    </div>
  );
}

/**
 * 渲染侧边导航分组。
 */
function Navigation({ selectedKey, onSelect }) {
  return (
    <div className="nav-groups full-width">
      {navigationGroups.map((group) => (
        <div key={group.key} className="nav-group">
          <Text className="menu-group-title">{group.title}</Text>
          <Menu
            className="nav-menu"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={group.items.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: (
                <Flex justify="space-between" align="center" className="menu-item-label">
                  <span>{item.label}</span>
                  {renderMenuCount(item.count)}
                </Flex>
              ),
            }))}
            onClick={({ key }) => onSelect(key)}
          />
        </div>
      ))}
    </div>
  );
}

export default Navigation;
