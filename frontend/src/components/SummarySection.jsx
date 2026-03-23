import { Tooltip, Typography } from 'antd';

const { Text } = Typography;

/**
 * 渲染概览统计区。
 */
function SummarySection({ cards }) {
  return (
    <div className="summary-strip">
      {cards.map((card) => (
        <Tooltip key={card.label} title={card.note} placement="top">
          <div className="summary-strip-item" tabIndex={0}>
            <div className="summary-strip-value">
              {card.value}
              <span>{card.suffix}</span>
            </div>
            <span className="summary-strip-divider" />
            <div className="summary-strip-meta">
              <Text className="summary-strip-label">{card.label}</Text>
            </div>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

export default SummarySection;
