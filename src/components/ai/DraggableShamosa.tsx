import React, { useState, useRef, useEffect } from 'react';

interface DraggableShamosaProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const DraggableShamosa: React.FC<DraggableShamosaProps> = ({
  children,
  onClick,
  className = '',
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Default position: bottom-left
    if (typeof window !== 'undefined') {
      return { x: 24, y: window.innerHeight - 90 };
    }
    return { x: 24, y: 500 };
  });

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const elementStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Keep within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(0, window.innerWidth - 76);
        const maxY = Math.max(0, window.innerHeight - 76);
        return {
          x: Math.min(Math.max(12, prev.x), maxX),
          y: Math.min(Math.max(12, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    elementStartPosRef.current = { ...position };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const maxX = Math.max(0, window.innerWidth - 76);
    const maxY = Math.max(0, window.innerHeight - 76);

    const nextX = Math.min(Math.max(12, elementStartPosRef.current.x + dx), maxX);
    const nextY = Math.min(Math.max(12, elementStartPosRef.current.y + dy), maxY);

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (!hasMovedRef.current && onClick) {
      onClick();
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 55,
        touchAction: 'none',
        userSelect: 'none',
      }}
      className={`select-none cursor-grab active:cursor-grabbing transition-transform active:scale-95 ${className}`}
    >
      {children}
    </div>
  );
};

export default DraggableShamosa;
