import { Typography } from 'antd';
import { summaryCards } from './mockData.jsx';

const { Paragraph, Text } = Typography;

/**
 * 渲染概览统计区。
 */
function SummarySection() {
  return (
    <div className="summary-strip">
      {summaryCards.map((card) => (
        <div key={card.label} className="summary-strip-item">
          <Text className="summary-strip-label">{card.label}</Text>
          <div className="summary-strip-value">
            {card.value}
            <span>{card.suffix}</span>
          </div>
          <Paragraph type="secondary" className="summary-strip-note">
            {card.note}
          </Paragraph>
        </div>
      ))}
    </div>
  );
}

export default SummarySection;
