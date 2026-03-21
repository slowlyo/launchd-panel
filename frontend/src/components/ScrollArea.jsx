import SimpleBar from 'simplebar-react';

/**
 * 提供统一的滚动容器，减少各区域滚动行为差异。
 */
function ScrollArea({ children, className = '', contentClassName = '' }) {
  return (
    <SimpleBar
      autoHide
      className={className}
      scrollableNodeProps={{
        className: 'scroll-area-viewport',
      }}
    >
      <div className={contentClassName}>
        {children}
      </div>
    </SimpleBar>
  );
}

export default ScrollArea;
