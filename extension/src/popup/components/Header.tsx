import React from 'react';

export interface HeaderProps {
  onClose?: () => void;
  onDragStart?: (e: React.PointerEvent<HTMLElement>) => void;
  onDragMove?: (e: React.PointerEvent<HTMLElement>) => void;
  onDragEnd?: (e: React.PointerEvent<HTMLElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({ onClose, onDragStart, onDragMove, onDragEnd }) => {
  return (
    <header
      className="header"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      style={{
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <h1 className="header-title" style={{ userSelect: 'none', pointerEvents: 'none' }}>
        CodePilot
      </h1>
      <button
        className="close-header-btn"
        aria-label="Close CodePilot"
        title="Close"
        onClick={(e) => {
          e.stopPropagation();
          if (onClose) onClose();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '4px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </header>
  );
};
