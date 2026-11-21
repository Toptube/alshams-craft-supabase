import { useEffect, useState } from 'react';

export interface VisualViewportState {
  height: number;
  offsetTop: number;
  isKeyboardOpen: boolean;
}

/**
 * يتابع أبعاد الشاشة المرئية الحقيقية (VisualViewport) على الموبايل والكمبيوتر
 * حتى يظل الهيدر العلوي ثابتاً تماماً عند فتح لوحة المفاتيح (الكيبورد)
 * وترتفع خانة الكتابة وحدها بسلاسة فوق الكيبورد مثل تطبيقات المحادثة الحديثة.
 */
export function useVisualViewportHeight(
  enabled: boolean,
  options?: { lockBodyScroll?: boolean }
): VisualViewportState {
  const lockBodyScroll = Boolean(options?.lockBodyScroll);

  const readViewport = (): VisualViewportState => {
    if (typeof window === 'undefined') {
      return { height: 0, offsetTop: 0, isKeyboardOpen: false };
    }
    const vv = window.visualViewport;
    if (vv) {
      const height = Math.round(vv.height);
      const offsetTop = Math.round(vv.offsetTop);
      const layoutHeight = window.innerHeight || height;
      const isKeyboardOpen = layoutHeight - height > 120;
      return { height, offsetTop, isKeyboardOpen };
    }
    return {
      height: window.innerHeight,
      offsetTop: 0,
      isKeyboardOpen: false,
    };
  };

  const [state, setState] = useState<VisualViewportState>(() => readViewport());

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const update = () => {
      const next = readViewport();
      setState((prev) =>
        prev.height === next.height &&
        prev.offsetTop === next.offsetTop &&
        prev.isKeyboardOpen === next.isKeyboardOpen
          ? prev
          : next
      );
    };

    update();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    let prevBodyOverflow = '';
    let prevHtmlOverscroll = '';
    if (lockBodyScroll && typeof document !== 'undefined') {
      prevBodyOverflow = document.body.style.overflow;
      prevHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehaviorY = 'none';
    }

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (lockBodyScroll && typeof document !== 'undefined') {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overscrollBehaviorY = prevHtmlOverscroll;
      }
    };
  }, [enabled, lockBodyScroll]);

  return state;
}
