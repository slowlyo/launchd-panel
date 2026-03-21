import { Alert, Button, Card, Col, Flex, Row, Segmented, Space, Typography } from 'antd';
import { formSections } from './mockData.jsx';

const { Title, Text, Paragraph } = Typography;

/**
 * 渲染配置编辑区。
 */
function ConfigurationPanel() {
  return (
    <Card
      bordered={false}
      className="surface-card"
      title="创建 / 编辑配置"
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
            message="2 条建议 · 日志路径完整，KeepAlive 已关闭，适合一次性维护任务。"
          />
          <Space wrap>
            <Button>保存草稿</Button>
            <Button>校验</Button>
            <Button type="primary">保存并加载</Button>
          </Space>
        </Flex>
      </Space>
    </Card>
  );
}

export default ConfigurationPanel;
