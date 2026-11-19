import React, { useEffect, useMemo, useState } from 'react';
import { LandingCmsConfig } from '../../types/landingCms';
import { hydrateInjectedLandingDocument } from '../../utils/landingTemplateHydrator';

interface InjectedLandingRendererProps {
  cms: LandingCmsConfig;
  isDarkMode?: boolean;
  isPreview?: boolean;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenRegisterSupplier?: () => void;
  onToggleTheme?: () => void;
  onOpenWelcomeGate?: () => void;
}

export const InjectedLandingRenderer: React.FC<InjectedLandingRendererProps> = ({
  cms,
  isDarkMode = false,
  isPreview = false,
  onOpenLogin,
  onOpenRegister,
  onOpenRegisterSupplier,
  onToggleTheme,
  onOpenWelcomeGate,
}) => {
  const [frameHeight, setFrameHeight] = useState<number>(isPreview ? 900 : 1400);

  const srcDoc = useMemo(() => {
    const html = cms.designConfig?.injectedTemplate?.html || '';
    const css = cms.designConfig?.injectedTemplate?.css || '';
    return hydrateInjectedLandingDocument(html, css, cms, isDarkMode);
  }, [cms, isDarkMode]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'alshams_injected_height' && typeof data.height === 'number') {
        setFrameHeight(Math.max(680, Math.min(12000, Math.ceil(data.height) + 16)));
        return;
      }
      if (data.type === 'alshams_injected_action' && !isPreview) {
        switch (data.action) {
          case 'login':
            onOpenLogin();
            break;
          case 'register':
            onOpenRegister();
            break;
          case 'register-supplier':
            (onOpenRegisterSupplier || onOpenRegister)();
            break;
          case 'toggle-theme':
            onToggleTheme?.();
            break;
          case 'welcome-gate':
            onOpenWelcomeGate?.();
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isPreview, onOpenLogin, onOpenRegister, onOpenRegisterSupplier, onToggleTheme, onOpenWelcomeGate]);

  return (
    <div className="w-full min-h-screen bg-[#F2ECE1] dark:bg-[#060B18]" dir="rtl">
      <iframe
        title={cms.designConfig?.injectedTemplate?.name || 'صفحة الهبوط المخصصة'}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        className="w-full border-0 block bg-transparent"
        style={{ height: `${frameHeight}px`, minHeight: isPreview ? '70vh' : '100vh' }}
      />
    </div>
  );
};
