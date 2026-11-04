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
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('shamousa_fab_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            const maxX = Math.max(8, window.innerWidth - 75);
            const maxY = Math.max(8, window.innerHeight - 95);
            return {
              x: Math.min(Math.max(8, parsed.x), maxX),
              y: Math.min(Math.max(8, parsed.y), maxY),
            };
          }
        }
      } catch {}
      return { x: 20, y: Math.max(20, window.innerHeight - 110) };
    }
    return { x: 20, y: 500 };
  });

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const elementStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Keep within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(8, window.innerWidth - 75);
        const maxY = Math.max(8, window.innerHeight - 95);
        return {
          x: Math.min(Math.max(8, prev.x), maxX),
          y: Math.min(Math.max(8, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary button
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    elementStartPosRef.current = { ...position };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      hasMovedRef.current = true;
    }

    const maxX = Math.max(8, window.innerWidth - 75);
    const maxY = Math.max(8, window.innerHeight - 95);

    const nextX = Math.min(Math.max(8, elementStartPosRef.current.x + dx), maxX);
    const nextY = Math.min(Math.max(8, elementStartPosRef.current.y + dy), maxY);

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Save artisan preferred placement
    if (hasMovedRef.current) {
      try {
        localStorage.setItem('shamousa_fab_pos', JSON.stringify(position));
      } catch {}
    } else if (onClick) {
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
