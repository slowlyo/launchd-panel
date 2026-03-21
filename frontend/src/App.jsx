import {
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Input,
  Layout,
  Row,
  Col,
  Space,
  Tag,
  Typography,
  Flex,
} from 'antd';
import { BarsOutlined, DesktopOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import ConfigurationPanel from './components/ConfigurationPanel';
import DetailPanel from './components/DetailPanel';
import LogHistoryPanel from './components/LogHistoryPanel';
import Navigation from './components/Navigation';
import SummarySection from './components/SummarySection';
import TasksTable from './components/TasksTable';
import { tasks } from './components/mockData.jsx';

const { Header, Sider, Content } = Layout;
const { Search } = Input;
const { Title, Paragraph } = Typography;

/**
 * 渲染应用主界面。
 */
function App() {
  const [selectedTask, setSelectedTask] = useState(tasks[1]);
  const [selectedNav, setSelectedNav] = useState('tasks');
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1f1f1f',
          colorBgLayout: '#f5f5f5',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#f0f0f0',
          borderRadius: 14,
          fontSize: 13,
        },
        components: {
          Layout: {
            siderBg: '#fafafa',
            headerBg: '#f5f5f5',
            bodyBg: '#f5f5f5',
          },
          Card: {
            bodyPadding: 18,
          },
          Menu: {
            itemBorderRadius: 10,
            itemMarginBlock: 4,
          },
        },
      }}
    >
      <Layout className="app-shell">
        <Sider width={264} className="app-sider">
          <Navigation selectedKey={selectedNav} onSelect={setSelectedNav} />
        </Sider>

        <Layout>
          <Header className="app-header">
            <Flex justify="space-between" align="center" gap={12} wrap>
              <Space size={12} wrap>
                <Button className="mobile-menu-button" icon={<BarsOutlined />} onClick={() => setDrawerOpen(true)} />
                <Search className="global-search" placeholder="搜索 Label、程序、参数、路径、环境变量" />
              </Space>
              <Space wrap>
                <Button icon={<DesktopOutlined />}>当前作用域：全部</Button>
                <Button icon={<ReloadOutlined />}>最近刷新 12 秒前</Button>
                <Button type="primary">新建配置</Button>
              </Space>
            </Flex>
          </Header>

          <Content className="app-content">
            <Space direction="vertical" size={16} className="full-width">
              <Card bordered={false} className="surface-card hero-card">
                <Flex justify="space-between" align="flex-start" gap={16} wrap>
                  <div>
                    <Title level={3}>任务视图 · 全部任务</Title>
                    <Paragraph type="secondary">
                      聚合显示配置存在、已加载、运行中、失败、权限与日志状态。
                    </Paragraph>
                  </div>
                  <Space wrap>
                    <Tag color="warning">当前仅拥有系统级只读权限</Tag>
                    <Tag>未授予完全磁盘访问时，日志可能不可用</Tag>
                  </Space>
                </Flex>
              </Card>

              <SummarySection />

              <Row gutter={[16, 16]}>
                <Col xs={24} xl={16}>
                  <Space direction="vertical" size={16} className="full-width">
                    <TasksTable onSelectTask={setSelectedTask} />
                    <ConfigurationPanel />
                    <LogHistoryPanel />
                  </Space>
                </Col>
                <Col xs={24} xl={8}>
                  <div className="desktop-detail-panel">
                    <DetailPanel task={selectedTask} />
                  </div>
                </Col>
              </Row>
            </Space>
          </Content>
        </Layout>
      </Layout>

      <Drawer
        title="导航"
        placement="left"
        width={320}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="mobile-drawer"
      >
        <Navigation selectedKey={selectedNav} onSelect={setSelectedNav} />
      </Drawer>
    </ConfigProvider>
  );
}

export default App;
