import {
  Button,
  Card,
  ConfigProvider,
  Input,
  Layout,
  Row,
  Col,
  Space,
  Tag,
  Typography,
  Flex,
} from 'antd';
import { DesktopOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';
import ConfigurationPanel from './components/ConfigurationPanel';
import DetailPanel from './components/DetailPanel';
import LogHistoryPanel from './components/LogHistoryPanel';
import Navigation, { SidebarBrand } from './components/Navigation';
import ScrollArea from './components/ScrollArea';
import SummarySection from './components/SummarySection';
import TasksTable from './components/TasksTable';
import { tasks } from './components/mockData.jsx';

const { Header, Sider, Content } = Layout;
const { Title, Paragraph } = Typography;

/**
 * 渲染应用主界面。
 */
function App() {
  const [selectedTask, setSelectedTask] = useState(tasks[1]);
  const [selectedNav, setSelectedNav] = useState('tasks');

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorBgLayout: '#f5f7fb',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#e5e7eb',
          borderRadius: 14,
          fontSize: 13,
        },
        components: {
          Layout: {
            siderBg: '#f7faff',
            headerBg: '#f5f7fb',
            bodyBg: '#f5f7fb',
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
        <Sider width={264} trigger={null} className="app-sider">
          <div className="app-sider-panel">
            <div className="app-sider-brand">
              <SidebarBrand />
            </div>
            <ScrollArea className="app-sider-scroll" contentClassName="app-sider-scroll-body">
              <Navigation selectedKey={selectedNav} onSelect={setSelectedNav} />
            </ScrollArea>
          </div>
        </Sider>

        <Layout className="app-main-layout">
          <Header className="app-header">
            <Flex justify="space-between" align="center" gap={12} wrap className="app-toolbar">
              <Space size={12} wrap className="header-search-group">
                <div className="global-search-shell">
                  <Input
                    allowClear
                    className="global-search-input"
                    placeholder="搜索 Label、程序、参数、路径、环境变量"
                    prefix={<SearchOutlined />}
                  />
                  <Button type="primary" className="global-search-button" icon={<SearchOutlined />}>
                    <span className="search-button-text">搜索</span>
                  </Button>
                </div>
              </Space>
              <Space wrap className="header-actions">
                <Button className="toolbar-button toolbar-meta-button" icon={<DesktopOutlined />}>
                  <span className="toolbar-button-label">当前作用域：全部</span>
                </Button>
                <Button className="toolbar-button toolbar-meta-button" icon={<ReloadOutlined />}>
                  <span className="toolbar-button-label">最近刷新 12 秒前</span>
                </Button>
                <Button type="primary" className="toolbar-primary-button">新建配置</Button>
              </Space>
            </Flex>
          </Header>

          <Content className="app-content">
            <ScrollArea className="app-content-scroll" contentClassName="app-content-scroll-body">
              <Space direction="vertical" size={16} className="full-width">
                <Card bordered={false} className="surface-card workspace-overview-card">
                  <Flex justify="space-between" align="flex-start" gap={16} wrap className="workspace-overview-head">
                    <div className="workspace-overview-copy">
                      <Title level={4}>任务视图 · 全部任务</Title>
                      <Paragraph type="secondary">
                        首屏优先显示任务列表，统计信息压缩为概览，减少对主工作区的占用。
                      </Paragraph>
                    </div>
                    <Space wrap className="hero-tags">
                      <Tag color="warning">当前仅拥有系统级只读权限</Tag>
                      <Tag>未授予完全磁盘访问时，日志可能不可用</Tag>
                    </Space>
                  </Flex>
                  <SummarySection />
                </Card>

                <Row gutter={[16, 16]} align="start">
                  <Col xs={24} xl={17}>
                    <TasksTable onSelectTask={setSelectedTask} />
                  </Col>
                  <Col xs={24} xl={7}>
                    <div className="desktop-detail-panel">
                      <DetailPanel task={selectedTask} />
                    </div>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={14}>
                    <ConfigurationPanel />
                  </Col>
                  <Col xs={24} xl={10}>
                    <LogHistoryPanel />
                  </Col>
                </Row>
              </Space>
            </ScrollArea>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
