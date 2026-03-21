import { Alert, Button, Card, Col, Flex, Row, Segmented, Space, Typography } from 'antd';
import { formSections } from './mockData.jsx';

const { Title, Text, Paragraph } = Typography;

/**
 * 渲染抽屉中的配置编辑内容。
 */
function ConfigurationPanel({ task }) {
  return (
    <Card
      bordered={false}
      className="surface-card editor-card"
      title={task ? `配置编辑 · ${task.label}` : '创建 / 编辑配置'}
      extra={<Segmented options={['表单模式', '原始 plist']} defaultValue="表单模式" />}
    >
      <Space direction="vertical" size={16} className="full-width">
        {formSections.map((section) => (
          <Card key={section.key} size="small" className="inner-card">
            <Title level={5}>{section.title}</Title>
            <Paragraph type="secondary">{section.description}</Paragraph>
            <Row gutter={[12, 12]}>
              {section.fields.map((field) => (
                <Col key={field.label} xs={24} md={12}>
                  <Card size="small" className="field-card">
                    <Text type="secondary">{field.label}</Text>
                    <div className="field-value">{field.value}</div>
                    <Paragraph type="secondary" className="field-helper">
                      {field.helper}
                    </Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        ))}

        <Flex justify="space-between" align="center" gap={12} wrap>
          <Alert
            className="validation-alert"
            type="info"
            showIcon
            message={
              task
                ? `当前正在编辑 ${task.label}，日志路径完整，KeepAlive 已关闭。`
                : '2 条建议 · 日志路径完整，KeepAlive 已关闭，适合一次性维护任务。'
            }
          />
          <Space wrap>
            <Button>保存草稿</Button>
            <Button>校验</Button>
            <Button type="primary">{task ? '保存并重新加载' : '保存并加载'}</Button>
          </Space>
        </Flex>
      </Space>
    </Card>
  );
}

export default ConfigurationPanel;
