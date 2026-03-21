import {
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Input,
  Layout,
  Menu,
  Space,
  Tag,
  Typography,
  Flex,
} from 'antd';
import {
  CodeOutlined,
  DesktopOutlined,
  EyeOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
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
const CONTEXT_MENU_WIDTH = 152;
const CONTEXT_MENU_OFFSET = 12;

/**
 * 渲染应用主界面。
 */
function App() {
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedNav, setSelectedNav] = useState('tasks');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);
  const [configMode, setConfigMode] = useState('create');
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    task: null,
  });

  /**
   * 关闭右键菜单，避免悬浮残留。
   */
  function closeContextMenu() {
    setContextMenu((current) => ({
      ...current,
      open: false,
      task: null,
    }));
  }

  /**
   * 同步搜索词，输入变化后立即刷新列表。
   */
  function handleSearchChange(event) {
    setSearchKeyword(event.target.value);
  }

  useEffect(() => {
    // 菜单打开后监听全局点击与窗口变化，保证及时收起。
    if (!contextMenu.open) {
      return undefined;
    }

    function handleDismiss() {
      closeContextMenu();
    }

    window.addEventListener('click', handleDismiss);
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('blur', handleDismiss);

    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('blur', handleDismiss);
    };
  }, [contextMenu.open]);

  /**
   * 按屏幕边界修正右键菜单位置。
   */
  function getContextMenuPosition(event) {
    const maxX = Math.max(CONTEXT_MENU_OFFSET, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_OFFSET);
    const maxY = Math.max(CONTEXT_MENU_OFFSET, window.innerHeight - 220);

    return {
      x: Math.min(event.clientX, maxX),
      y: Math.min(event.clientY, maxY),
    };
  }

  /**
   * 打开详情抽屉，默认由表格单击触发。
   */
  function handleSelectTask(task) {
    setSelectedTask(task);
    setIsDetailDrawerOpen(true);
    closeContextMenu();
  }

  /**
   * 打开新建配置抽屉。
   */
  function handleOpenCreateConfig() {
    setConfigMode('create');
    setIsConfigDrawerOpen(true);
    closeContextMenu();
  }

  /**
   * 打开任务详情抽屉。
   */
  function handleOpenDetail(task = selectedTask) {
    // 没有任务时不展示空详情。
    if (!task) {
      return;
    }

    setSelectedTask(task);
    setIsConfigDrawerOpen(false);
    setIsLogsDrawerOpen(false);
    setIsDetailDrawerOpen(true);
    closeContextMenu();
  }

  /**
   * 打开编辑配置抽屉。
   */
  function handleOpenEditConfig(task = selectedTask) {
    // 没有任务时退化为新建配置。
    if (!task) {
      handleOpenCreateConfig();
      return;
    }

    setSelectedTask(task);
    setConfigMode('edit');
    setIsDetailDrawerOpen(false);
    setIsLogsDrawerOpen(false);
    setIsConfigDrawerOpen(true);
    closeContextMenu();
  }

  /**
   * 打开日志抽屉。
   */
  function handleOpenLogs(task = selectedTask) {
    // 没有任务时不允许查看日志。
    if (!task) {
      return;
    }

    setSelectedTask(task);
    setIsDetailDrawerOpen(false);
    setIsConfigDrawerOpen(false);
    setIsLogsDrawerOpen(true);
    closeContextMenu();
  }

  /**
   * 打开表格项右键菜单。
   */
  function handleOpenContextMenu(event, task) {
    event.preventDefault();
    const position = getContextMenuPosition(event);

    setSelectedTask(task);
    setContextMenu({
      open: true,
      x: position.x,
      y: position.y,
      task,
    });
  }

  /**
   * 响应右键菜单操作。
   */
  function handleContextMenuAction(action) {
    // 菜单项根据动作分发到对应抽屉。
    if (action === 'detail') {
      handleOpenDetail(contextMenu.task);
      return;
    }

    // 编辑动作统一复用配置抽屉。
    if (action === 'edit') {
      handleOpenEditConfig(contextMenu.task);
      return;
    }

    handleOpenLogs(contextMenu.task);
  }

  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
  const filteredTasks = tasks.filter((task) => {
    // 没有关键词时保留原始列表。
    if (!normalizedSearchKeyword) {
      return true;
    }

    const searchableContent = [
      task.label,
      task.file,
      task.scope,
      task.command,
      task.args,
      task.schedule,
      task.result,
      task.path,
    ]
      .join(' ')
      .toLowerCase();

    return searchableContent.includes(normalizedSearchKeyword);
  });

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
                    value={searchKeyword}
                    onChange={handleSearchChange}
                  />
                </div>
              </Space>
              <Space wrap className="header-actions">
                <Button className="toolbar-button toolbar-meta-button" icon={<DesktopOutlined />}>
                  <span className="toolbar-button-label">当前作用域：全部</span>
                </Button>
                <Button className="toolbar-button toolbar-meta-button" icon={<ReloadOutlined />}>
                  <span className="toolbar-button-label">最近刷新 12 秒前</span>
                </Button>
                <Button type="primary" className="toolbar-primary-button" onClick={handleOpenCreateConfig}>
                  新建配置
                </Button>
              </Space>
            </Flex>
          </Header>

          <Content className="app-content">
            <ScrollArea className="app-content-scroll" contentClassName="app-content-scroll-body">
              <Space direction="vertical" size={16} className="full-width">
                <Card bordered={false} className="surface-card workspace-overview-card">
                  <div className="workspace-overview-bar">
                    <SummarySection />
                    <Space wrap className="hero-tags">
                      <Tag color="warning">当前仅拥有系统级只读权限</Tag>
                      <Tag>未授予完全磁盘访问时，日志可能不可用</Tag>
                    </Space>
                  </div>
                </Card>

                <TasksTable
                  tasks={filteredTasks}
                  onSelectTask={handleSelectTask}
                  onOpenDetail={handleOpenDetail}
                  onOpenEditConfig={handleOpenEditConfig}
                  onOpenLogs={handleOpenLogs}
                  onOpenContextMenu={handleOpenContextMenu}
                  selectedTaskKey={selectedTask?.key}
                />
              </Space>
            </ScrollArea>
          </Content>
        </Layout>
      </Layout>

      {/* 任务详情抽屉内提供继续转到编辑和日志的动作。 */}
      <Drawer
        className="detail-drawer"
        width={560}
        placement="right"
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={selectedTask ? `任务详情 · ${selectedTask.label}` : '任务详情'}
      >
        <DetailPanel task={selectedTask} onShowConfig={handleOpenEditConfig} onShowLogs={handleOpenLogs} />
      </Drawer>

      {/* 新增和编辑继续共用同一个配置抽屉。 */}
      <Drawer
        className="config-drawer"
        width={680}
        placement="right"
        open={isConfigDrawerOpen}
        onClose={() => setIsConfigDrawerOpen(false)}
        title={configMode === 'edit' && selectedTask ? `编辑配置 · ${selectedTask.label}` : '新建配置'}
      >
        <ConfigurationPanel task={configMode === 'edit' ? selectedTask : null} />
      </Drawer>

      {/* 日志也通过抽屉承载，保持主工作区稳定。 */}
      <Drawer
        className="logs-drawer"
        width={640}
        placement="right"
        open={isLogsDrawerOpen}
        onClose={() => setIsLogsDrawerOpen(false)}
        title={selectedTask ? `日志历史 · ${selectedTask.label}` : '日志历史'}
      >
        <LogHistoryPanel task={selectedTask} onClose={() => setIsLogsDrawerOpen(false)} />
      </Drawer>

      {/* 右键菜单使用固定定位，避免受表格滚动容器影响。 */}
      {contextMenu.open ? (
        <div
          className="task-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <Menu
            selectable={false}
            onClick={({ key }) => handleContextMenuAction(key)}
            items={[
              {
                key: 'detail',
                icon: <EyeOutlined />,
                label: '查看详情',
              },
              {
                key: 'edit',
                icon: <CodeOutlined />,
                label: '编辑配置',
              },
              {
                key: 'logs',
                icon: <FileSearchOutlined />,
                label: '查看日志',
              },
            ]}
          />
        </div>
      ) : null}
    </ConfigProvider>
  );
}

export default App;
