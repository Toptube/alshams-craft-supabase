import React, { useState, useRef, useEffect } from 'react';

interface DraggableShamosaProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  orbitTriggerNonce?: number;
  onOrbitComplete?: () => void;
  isGlowingAlert?: boolean;
}

// Module-level guard so unmounting/remounting DraggableShamosa can NEVER replay an old orbit nonce
let lastHandledOrbitNonce = 0;

export const DraggableShamosa: React.FC<DraggableShamosaProps> = ({
  children,
  onClick,
  className = '',
  orbitTriggerNonce = 0,
  onOrbitComplete,
  isGlowingAlert = false,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('shamousa_fab_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            const maxX = Math.max(8, window.innerWidth - 68);
            const maxY = Math.max(8, window.innerHeight - 84);
            return {
              x: Math.min(Math.max(8, parsed.x), maxX),
              y: Math.min(Math.max(8, parsed.y), maxY),
            };
          }
        }
      } catch {}
      return { x: 16, y: Math.max(20, window.innerHeight - 96) };
    }
    return { x: 16, y: 500 };
  });

  const [isOrbiting, setIsOrbiting] = useState(false);
  const [orbitScale, setOrbitScale] = useState(1);
  const [orbitBlink, setOrbitBlink] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const elementStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const restPosRef = useRef(position);
  const onOrbitCompleteRef = useRef(onOrbitComplete);
  onOrbitCompleteRef.current = onOrbitComplete;

  useEffect(() => {
    if (!isOrbiting) {
      restPosRef.current = position;
    }
  }, [position, isOrbiting]);

  // Keep within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isOrbiting) return;
      setPosition((prev) => {
        const maxX = Math.max(8, window.innerWidth - 68);
        const maxY = Math.max(8, window.innerHeight - 84);
        return {
          x: Math.min(Math.max(8, prev.x), maxX),
          y: Math.min(Math.max(8, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOrbiting]);

  // Full smooth circular orbit around the page + glow/blink + open-close pulse (STRICTLY ONCE per nonce)
  useEffect(() => {
    if (!orbitTriggerNonce || orbitTriggerNonce <= lastHandledOrbitNonce) return;
    lastHandledOrbitNonce = orbitTriggerNonce;

    if (typeof window === 'undefined') return;
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setOrbitBlink(true);
      const t = window.setTimeout(() => {
        setOrbitBlink(false);
        onOrbitCompleteRef.current?.();
      }, 650);
      return () => window.clearTimeout(t);
    }

    const startPos = { ...restPosRef.current };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2 - 28;
    const cy = vh / 2 - 36;
    const rx = Math.max(80, Math.min(vw * 0.36, 260));
    const ry = Math.max(90, Math.min(vh * 0.34, 240));
    const startAngle = Math.atan2((startPos.y - cy) / ry, (startPos.x - cx) / rx);

    const totalMs = 2600;
    const pulsePhaseMs = 520;
    const orbitPhaseMs = 1900;
    const startedAt = performance.now();
    let rafId = 0;

    setIsOrbiting(true);

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const blinkState = Math.floor(elapsed / 190) % 2 === 0;
      setOrbitBlink(blinkState);

      if (elapsed < pulsePhaseMs) {
        // Open & close playful scale pulse before orbit
        const p = elapsed / pulsePhaseMs;
        const scale =
          p < 0.45
            ? 1 + 0.38 * Math.sin((p / 0.45) * Math.PI)
            : p < 0.78
            ? 1 - 0.18 * Math.sin(((p - 0.45) / 0.33) * Math.PI)
            : 1 + 0.12 * ((p - 0.78) / 0.22);
        setOrbitScale(scale);
        setPosition(startPos);
      } else if (elapsed < pulsePhaseMs + orbitPhaseMs) {
        // Smooth full 360-degree circular orbit around viewport
        const t = (elapsed - pulsePhaseMs) / orbitPhaseMs;
        // Ease in-out for graceful launch and landing
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const angle = startAngle + eased * Math.PI * 2;
        const circleX = cx + rx * Math.cos(angle);
        const circleY = cy + ry * Math.sin(angle);
        // Smoothly blend out from startPos and back into startPos
        const envelope = Math.sin(t * Math.PI);
        const blend = Math.min(1, envelope * 2.2);
        const x = startPos.x + (circleX - startPos.x) * blend;
        const y = startPos.y + (circleY - startPos.y) * blend;
        setPosition({
          x: Math.min(Math.max(8, x), vw - 64),
          y: Math.min(Math.max(8, y), vh - 76),
        });
        setOrbitScale(1.12 + 0.08 * Math.sin(t * Math.PI * 4));
      } else if (elapsed < totalMs) {
        // Settle softly back to exact resting spot
        const p = (elapsed - (pulsePhaseMs + orbitPhaseMs)) / (totalMs - (pulsePhaseMs + orbitPhaseMs));
        setPosition(startPos);
        setOrbitScale(1.12 - 0.12 * p);
      } else {
        setPosition(startPos);
        setOrbitScale(1);
        setOrbitBlink(false);
        setIsOrbiting(false);
        onOrbitCompleteRef.current?.();
        return;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      setIsOrbiting(false);
      setOrbitScale(1);
      setOrbitBlink(false);
    };
  }, [orbitTriggerNonce]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isOrbiting) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    elementStartPosRef.current = { ...position };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || isOrbiting) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      hasMovedRef.current = true;
    }

    const maxX = Math.max(8, window.innerWidth - 68);
    const maxY = Math.max(8, window.innerHeight - 84);

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
        zIndex: isOrbiting ? 80 : 55,
        touchAction: 'none',
        userSelect: 'none',
        transform: `scale(${orbitScale})`,
        filter:
          orbitBlink || isGlowingAlert
            ? 'drop-shadow(0 0 18px rgba(251, 191, 36, 0.95)) drop-shadow(0 0 30px rgba(226, 232, 240, 0.8))'
            : undefined,
      }}
      className={`select-none cursor-grab active:cursor-grabbing ${
        isOrbiting ? '' : 'transition-transform active:scale-95'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default DraggableShamosa;
