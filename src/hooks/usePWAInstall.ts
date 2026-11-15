import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __alshamsDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
    __alshamsPwaInstalled?: boolean;
  }
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const mqStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const iosStandalone = (window.navigator as any)?.standalone === true;
    const androidTwa = document.referrer?.includes('android-app://');
    return Boolean(mqStandalone || iosStandalone || androidTwa || window.__alshamsPwaInstalled);
  } catch {
    return false;
  }
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iphone|ipad|ipod/i.test(ua);
    const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleMobile || isIpadOS;
  } catch {
    return false;
  }
}

function checkIsInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function checkIsSetupParam(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('pwa-setup') === '1';
  } catch {
    return false;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__alshamsDeferredInstallPrompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(checkIsStandalone);
  const [isIOS] = useState<boolean>(checkIsIOS);
  const [isInIframe] = useState<boolean>(checkIsInIframe);
  const [isSetupRedirect] = useState<boolean>(checkIsSetupParam);
  const [installing, setInstalling] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Pick up prompt captured synchronously before React mounted
    if (window.__alshamsDeferredInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__alshamsDeferredInstallPrompt);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__alshamsDeferredInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handlePromptReady = () => {
      setDeferredPrompt(window.__alshamsDeferredInstallPrompt || null);
    };

    const handleAppInstalled = () => {
      window.__alshamsDeferredInstallPrompt = null;
      window.__alshamsPwaInstalled = true;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        handleAppInstalled();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('alshams-pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('alshams-pwa-installed', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('alshams-pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('alshams-pwa-installed', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, [deferredPrompt]);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? window.__alshamsDeferredInstallPrompt : null);
    if (!activePrompt) return 'unavailable';
    setInstalling(true);
    try {
      await activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        if (typeof window !== 'undefined') {
          window.__alshamsDeferredInstallPrompt = null;
          window.__alshamsPwaInstalled = true;
          window.dispatchEvent(new CustomEvent('alshams-pwa-installed'));
        }
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return outcome;
    } catch {
      return 'dismissed';
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt]);

  return {
    isInstalled,
    isIOS,
    isInIframe,
    isSetupRedirect,
    canNativeInstall: Boolean(deferredPrompt),
    installing,
    install,
  };
}
