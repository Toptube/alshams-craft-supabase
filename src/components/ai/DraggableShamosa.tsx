import React, { useRef, useState } from 'react';

const STORAGE_KEY = 'shamosa-position';
const SIZE = 64;
const EDGE = 16;

function loadPos() {
  if (typeof window === 'undefined') return { x: EDGE, y: EDGE };

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { x: EDGE, y: EDGE };
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return { x: EDGE, y: EDGE };
    }
    return parsed;
  } catch {
    return { x: EDGE, y: EDGE };
  }
}

export function DraggableShamosa({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>(loadPos);
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    moved.current = false;
    offset.current = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    moved.current = true;
    const maxX = Math.max(0, window.innerWidth - SIZE);
    const maxY = Math.max(0, window.innerHeight - SIZE);

    const nextX = Math.max(0, Math.min(maxX, event.clientX - offset.current.x));
    const nextY = Math.max(0, Math.min(maxY, event.clientY - offset.current.y));

    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = () => {
    if (!dragging.current) return;

    dragging.current = false;

    const snapX = pos.x + SIZE / 2 < window.innerWidth / 2 ? EDGE : window.innerWidth - SIZE - EDGE;
    const next = { x: snapX, y: Math.max(0, Math.min(window.innerHeight - SIZE, pos.y)) };

    setPos(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failure
    }

    if (!moved.current) {
      onClick?.();
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: SIZE,
        height: SIZE,
        touchAction: 'none',
        cursor: 'grab',
        zIndex: 9999,
      }}
    >
      {children}
    </div>
  );
}

export default DraggableShamosa;
