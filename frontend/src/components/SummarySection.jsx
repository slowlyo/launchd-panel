import { Card, Col, Row, Statistic, Typography } from 'antd';
import { summaryCards } from './mockData.jsx';

const { Paragraph } = Typography;

/**
 * 渲染概览统计区。
 */
function SummarySection() {
  return (
    <Row gutter={[16, 16]}>
      {summaryCards.map((card) => (
        <Col key={card.label} xs={24} sm={12} xl={6}>
          <Card bordered={false} className="surface-card summary-card">
            <Statistic title={card.label} value={card.value} suffix={card.suffix} />
            <Paragraph type="secondary" className="summary-note">
              {card.note}
            </Paragraph>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

export default SummarySection;
