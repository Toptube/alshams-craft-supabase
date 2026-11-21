import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  ListFilter,
  Pencil,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isUserAdmin } from '../../types';
import {
  buildGlobalOverrideKey,
  getStoredUiLayoutConfig,
  normalizeOverrideText,
  saveStoredUiLayoutConfig,
  UiGlobalElementOverride,
  useUiLayoutConfig,
} from '../../types/uiLayoutConfig';
import {
  fetchPlatformSettingsCloud,
  savePlatformSettingsCloud,
} from '../../db/marketplaceCloud';
import { getShippingConfig, getClientPrivacyActive } from '../../services/marketplaceCartService';
import { getStoredMarketBuilderConfig } from '../../types/marketplaceBuilder';
import { getStoredSuppliersMarketBuilderConfig } from '../../types/suppliersMarketBuilder';
import { getStoredLandingCmsConfig } from '../../types/landingCms';
import { getStoredFeatureFlags } from '../../types/featureFlags';

const EDITABLE_SELECTOR =
  'button, [role="button"], a, h1, h2, h3, h4, [data-card-title]';

function isInsideCustomizer(node: Element | null): boolean {
  if (!node) return false;
  return Boolean(node.closest('[data-sa-customizer="true"]'));
}

function classifyElement(el: HTMLElement): 'button' | 'card' {
  const tag = el.tagName.toUpperCase();
  if (tag === 'BUTTON' || el.getAttribute('role') === 'button' || tag === 'A') {
    return 'button';
  }
  return 'card';
}

/**
 * Finds the best single visible leaf Text node inside an element so we can safely rename
 * text WITHOUT destroying React child elements or SVG icons.
 */
function findPrimaryTextNode(root: HTMLElement): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const pTag = parent.tagName.toUpperCase();
      if (pTag === 'SCRIPT' || pTag === 'STYLE' || pTag === 'SVG' || parent.closest('svg')) {
        return NodeFilter.FILTER_REJECT;
      }
      const txt = normalizeOverrideText(node.nodeValue || '');
      if (!txt || txt.length < 2) return NodeFilter.FILTER_REJECT;
      // Skip pure numeric badges / currency counters (e.g. "12", "0", "99+")
      if (/^[\d.,+%$£€\s-]+$/.test(txt)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let best: Text | null = null;
  let bestLen = 0;
  let current = walker.nextNode();
  while (current) {
    const t = current as Text;
    const cleaned = normalizeOverrideText(t.nodeValue || '');
    // Prefer the longest meaningful text fragment (usually the main button/card label)
    if (cleaned.length > bestLen) {
      best = t;
      bestLen = cleaned.length;
    }
    current = walker.nextNode();
  }
  return best;
}

function getElementOriginalText(el: HTMLElement): string {
  if (el.dataset.saOrigText) {
    return el.dataset.saOrigText;
  }
  const primary = findPrimaryTextNode(el);
  if (!primary) return '';
  const cleaned = normalizeOverrideText(primary.nodeValue || '');
  if (!cleaned || cleaned.length > 140) return '';
  return cleaned;
}

function applyOverridesToDom(overrides: Record<string, UiGlobalElementOverride>) {
  if (typeof document === 'undefined') return;
  const elements = document.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR);

  elements.forEach((el) => {
    if (isInsideCustomizer(el)) return;
    if (el.closest('svg')) return;

    const elType = classifyElement(el);
    const origText = getElementOriginalText(el);
    if (!origText) return;

    const key = buildGlobalOverrideKey(elType, origText);
    const ov = overrides[key];

    if (ov) {
      if (!el.dataset.saOrigText) {
        el.dataset.saOrigText = origText;
      }
      el.dataset.saElemType = elType;

      // Apply custom label safely on the primary leaf Text node
      const primary = findPrimaryTextNode(el);
      if (ov.customLabel && primary) {
        if (normalizeOverrideText(primary.nodeValue || '') !== ov.customLabel) {
          primary.nodeValue = ov.customLabel;
        }
        el.dataset.saAppliedLabel = ov.customLabel;
      } else if (!ov.customLabel && el.dataset.saAppliedLabel && primary) {
        primary.nodeValue = el.dataset.saOrigText;
        delete el.dataset.saAppliedLabel;
      }

      // Apply visibility hide/show
      if (ov.hidden) {
        el.setAttribute('data-sa-hidden', 'true');
      } else {
        el.removeAttribute('data-sa-hidden');
      }
    } else {
      // Restore previously overridden element if override was deleted
      if (el.dataset.saAppliedLabel && el.dataset.saOrigText) {
        const primary = findPrimaryTextNode(el);
        if (primary && normalizeOverrideText(primary.nodeValue || '') === el.dataset.saAppliedLabel) {
          primary.nodeValue = el.dataset.saOrigText;
        }
        delete el.dataset.saAppliedLabel;
      }
      if (el.hasAttribute('data-sa-hidden')) {
        el.removeAttribute('data-sa-hidden');
      }
    }
  });
}

function resolveClickTarget(rawTarget: EventTarget | null): HTMLElement | null {
  if (!(rawTarget instanceof Element)) return null;
  if (isInsideCustomizer(rawTarget)) return null;

  // 1. Direct button / interactive link / heading
  const direct = rawTarget.closest<HTMLElement>(EDITABLE_SELECTOR);
  if (direct && !isInsideCustomizer(direct)) {
    const txt = getElementOriginalText(direct);
    if (txt) return direct;
  }

  // 2. If user clicked inside a card box, automatically pick the card's title heading
  const cardBox = rawTarget.closest<HTMLElement>(
    'section, article, [class*="rounded-2xl"], [class*="rounded-3xl"], [class*="rounded-xl"]'
  );
  if (cardBox && !isInsideCustomizer(cardBox)) {
    const heading = cardBox.querySelector<HTMLElement>('h1, h2, h3, h4, [data-card-title]');
    if (heading && !isInsideCustomizer(heading) && getElementOriginalText(heading)) {
      return heading;
    }
  }

  return null;
}

function inferCurrentPageHint(): string {
  if (typeof window === 'undefined') return 'المنظومة';
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  if (hash) return hash.slice(0, 60);
  const path = window.location.pathname.replace(/^\/+/, '').trim();
  return path ? path.slice(0, 60) : 'الرئيسية';
}

export const SuperAdminUiCustomizer: React.FC = () => {
  const uiLayout = useUiLayoutConfig();
  const overrides = useMemo(
    () => uiLayout.globalElementOverrides || {},
    [uiLayout.globalElementOverrides]
  );
  const overridesList = useMemo(
    () =>
      Object.values(overrides).sort((a, b) =>
        String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
      ),
    [overrides]
  );

  // Detect verified Super Admin session independently so customizer works on EVERY route
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showHiddenPreview, setShowHiddenPreview] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');

  // Currently selected element for instant modal edit
  const [editingTarget, setEditingTarget] = useState<{
    key: string;
    elementType: 'button' | 'card';
    originalText: string;
    customLabel: string;
    hidden: boolean;
    pageHint: string;
  } | null>(null);

  const [savingCloud, setSavingCloud] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3400);
  }, []);

  // Verify Super Admin session from Supabase Auth
  useEffect(() => {
    let mounted = true;
    const checkAdmin = (email?: string | null) => {
      if (!mounted) return;
      if (email && isUserAdmin({ email } as any)) {
        setAdminEmail(email);
      } else {
        setAdminEmail(null);
        setEditMode(false);
        setShowHiddenPreview(false);
        setManagerOpen(false);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => checkAdmin(data?.session?.user?.email))
      .catch(() => checkAdmin(null));

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      checkAdmin(session?.user?.email);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Toggle HTML classes for CSS hover highlights & showing hidden elements
  useEffect(() => {
    const html = document.documentElement;
    if (editMode && adminEmail) {
      html.classList.add('sa-edit-mode-active');
    } else {
      html.classList.remove('sa-edit-mode-active');
    }
    if ((showHiddenPreview || editMode) && adminEmail) {
      if (showHiddenPreview) html.classList.add('sa-show-hidden-elements');
      else html.classList.remove('sa-show-hidden-elements');
    } else {
      html.classList.remove('sa-show-hidden-elements');
    }
    return () => {
      html.classList.remove('sa-edit-mode-active');
      html.classList.remove('sa-show-hidden-elements');
    };
  }, [editMode, showHiddenPreview, adminEmail]);

  // Global DOM Override Applier (active for ALL users across all pages)
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let rafId: number | null = null;
    const scheduleApply = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyOverridesToDom(overridesRef.current);
      });
    };

    // Apply immediately when overrides change
    applyOverridesToDom(overrides);

    const hasAnyOverrides = Object.keys(overrides).length > 0;
    if (!hasAnyOverrides) return;

    const observer = new MutationObserver((mutations) => {
      // Ignore mutations inside our own customizer overlay
      const relevant = mutations.some((m) => {
        const t = m.target instanceof Element ? m.target : m.target.parentElement;
        return !isInsideCustomizer(t);
      });
      if (relevant) scheduleApply();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [overrides]);

  // Capture-phase click interceptor when Super Admin Edit Mode is ON
  useEffect(() => {
    if (!editMode || !adminEmail) return;

    const handleCaptureClick = (event: MouseEvent) => {
      const targetEl = resolveClickTarget(event.target);
      if (!targetEl) return;

      event.preventDefault();
      event.stopPropagation();

      const elementType = (targetEl.dataset.saElemType as 'button' | 'card') || classifyElement(targetEl);
      const originalText = getElementOriginalText(targetEl);
      if (!originalText) return;

      const key = buildGlobalOverrideKey(elementType, originalText);
      const existing = overridesRef.current[key];

      setEditingTarget({
        key,
        elementType,
        originalText,
        customLabel: existing?.customLabel || originalText,
        hidden: Boolean(existing?.hidden),
        pageHint: existing?.pageHint || inferCurrentPageHint(),
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingTarget) setEditingTarget(null);
        else setEditMode(false);
      }
    };

    window.addEventListener('click', handleCaptureClick, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleCaptureClick, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editMode, adminEmail, editingTarget]);

  const persistOverridesToCloud = useCallback(
    async (nextOverrides: Record<string, UiGlobalElementOverride>, successMsg: string) => {
      if (!adminEmail) return;
      setSavingCloud(true);
      try {
        const currentLayout = getStoredUiLayoutConfig();
        const nextLayout = saveStoredUiLayoutConfig({
          ...currentLayout,
          globalElementOverrides: nextOverrides,
          updatedAt: new Date().toISOString(),
        });

        // Apply immediately on DOM even before network finishes
        applyOverridesToDom(nextLayout.globalElementOverrides || {});

        // Fetch existing cloud platform_settings first so we never clobber other admin settings
        const existingCloud = (await fetchPlatformSettingsCloud()) || {};
        const mergedPayload = {
          ...getShippingConfig(),
          ...existingCloud,
          centralShippingPrivacy:
            typeof existingCloud.centralShippingPrivacy === 'boolean'
              ? existingCloud.centralShippingPrivacy
              : getClientPrivacyActive(),
          marketBuilder: existingCloud.marketBuilder || getStoredMarketBuilderConfig(),
          suppliersMarketBuilder:
            existingCloud.suppliersMarketBuilder || getStoredSuppliersMarketBuilderConfig(),
          landingCms: existingCloud.landingCms || getStoredLandingCmsConfig(),
          featureFlags: existingCloud.featureFlags || getStoredFeatureFlags(),
          uiLayoutConfig: nextLayout,
        };

        const res = await savePlatformSettingsCloud(mergedPayload, adminEmail);
        if (!res.success) {
          showToast('err', res.error || 'تم الحفظ محلياً وتعذر النشر للسحابة.');
          return;
        }
        showToast('ok', successMsg);
      } catch (err: any) {
        showToast('err', err?.message || 'حدث خطأ أثناء الحفظ السحابي.');
      } finally {
        setSavingCloud(false);
      }
    },
    [adminEmail, showToast]
  );

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;

    const trimmedNew = normalizeOverrideText(editingTarget.customLabel);
    const labelChanged = Boolean(trimmedNew && trimmedNew !== editingTarget.originalText);
    const nextOverrides = { ...overrides };

    if (!labelChanged && !editingTarget.hidden) {
      delete nextOverrides[editingTarget.key];
    } else {
      nextOverrides[editingTarget.key] = {
        key: editingTarget.key,
        elementType: editingTarget.elementType,
        originalText: editingTarget.originalText,
        ...(labelChanged ? { customLabel: trimmedNew } : {}),
        ...(editingTarget.hidden ? { hidden: true } : {}),
        pageHint: editingTarget.pageHint,
        updatedAt: new Date().toISOString(),
      };
    }

    setEditingTarget(null);
    await persistOverridesToCloud(
      nextOverrides,
      'تم حفظ وتعميم التعديل فوراً على جميع المستخدمين'
    );
  };

  const handleRestoreOne = async (key: string) => {
    const nextOverrides = { ...overrides };
    delete nextOverrides[key];
    if (editingTarget?.key === key) setEditingTarget(null);
    await persistOverridesToCloud(nextOverrides, 'تمت استعادة الاسم والظهور الافتراضي');
  };

  const handleToggleHiddenInManager = async (ov: UiGlobalElementOverride) => {
    const nextHidden = !ov.hidden;
    const nextOverrides = { ...overrides };
    if (!nextHidden && !ov.customLabel) {
      delete nextOverrides[ov.key];
    } else {
      nextOverrides[ov.key] = {
        ...ov,
        hidden: nextHidden || undefined,
        updatedAt: new Date().toISOString(),
      };
    }
    await persistOverridesToCloud(
      nextOverrides,
      nextHidden ? 'تم إخفاء العنصر لجميع المستخدمين' : 'تم إظهار العنصر لجميع المستخدمين'
    );
  };

  const filteredManagerList = useMemo(() => {
    const q = normalizeOverrideText(managerSearch).toLowerCase();
    if (!q) return overridesList;
    return overridesList.filter(
      (ov) =>
        ov.originalText.toLowerCase().includes(q) ||
        (ov.customLabel || '').toLowerCase().includes(q) ||
        (ov.pageHint || '').toLowerCase().includes(q)
    );
  }, [overridesList, managerSearch]);

  // Non-super-admins never see any editor UI — only receive the applied overrides silently!
  if (!adminEmail) return null;

  return (
    <div data-sa-customizer="true" dir="rtl" className="font-sans">
      {/* Compact Bottom-Left Floating Trigger / Active Bar */}
      <div
        data-sa-customizer="true"
        className="fixed bottom-4 left-4 z-[9990] flex flex-wrap items-center gap-2 max-w-[calc(100vw-2rem)]"
      >
        {!editMode ? (
          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              setShowHiddenPreview(true);
            }}
            className="h-10 px-3.5 rounded-xl bg-[#0C1427] hover:bg-[#132040] text-[#F7F3EA] border border-[#EA580C]/70 shadow-lg flex items-center gap-2 text-xs font-bold whitespace-nowrap cursor-pointer transition-transform active:scale-95"
            title="تعديل اسم أي بطاقة أو زر أو إخفاء أي زر في الصفحة الحالية"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
            <span>تخصيص الأزرار والبطاقات</span>
            {overridesList.length > 0 && (
              <span className="text-[11px] font-mono text-[#FBBF24]">
                ({overridesList.length})
              </span>
            )}
          </button>
        ) : (
          <div className="rounded-2xl bg-[#0C1427] text-[#F7F3EA] border-2 border-[#EA580C] shadow-2xl px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#FBBF24] flex items-center gap-1.5 whitespace-nowrap">
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              <span>اضغط على أي بطاقة أو زر لتعديله</span>
            </span>

            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              |
            </span>

            <button
              type="button"
              onClick={() => setShowHiddenPreview((p) => !p)}
              className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                showHiddenPreview
                  ? 'bg-[#EA580C] text-white'
                  : 'bg-[#132040] text-slate-200 hover:bg-[#1A2B54]'
              }`}
            >
              {showHiddenPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showHiddenPreview ? 'المخفي ظاهر للمعاينة' : 'إظهار المخفي'}</span>
            </button>

            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="h-8 px-2.5 rounded-lg bg-[#132040] hover:bg-[#1A2B54] text-slate-100 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>التعديلات ({overridesList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setShowHiddenPreview(false);
              }}
              className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إنهاء</span>
            </button>
          </div>
        )}
      </div>

      {/* Feedback Toast */}
      {toast && (
        <div
          data-sa-customizer="true"
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9998] px-4 py-2.5 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-[#0C1427] text-emerald-300 border-emerald-500/60'
              : 'bg-rose-950 text-rose-200 border-rose-500/60'
          }`}
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Click-to-Edit Element Modal */}
      {editingTarget && (
        <div
          data-sa-customizer="true"
          className="fixed inset-0 z-[9995] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setEditingTarget(null)}
        >
          <form
            onSubmit={handleSaveModal}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden text-[#0C1427] dark:text-[#F7F3EA]"
          >
            <div className="px-5 py-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {editingTarget.elementType === 'button'
                    ? 'تخصيص الزر'
                    : 'تخصيص عنوان البطاقة'}
                </h3>
                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-0.5">
                  الاسم الأصلي: {editingTarget.originalText}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="p-1.5 rounded-lg hover:bg-[#E9E2D4] dark:hover:bg-[#132040] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  الاسم المعروض لجميع المستخدمين
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editingTarget.customLabel}
                  onChange={(e) =>
                    setEditingTarget((prev) =>
                      prev ? { ...prev, customLabel: e.target.value } : null
                    )
                  }
                  placeholder={editingTarget.originalText}
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-semibold focus:outline-none focus:border-[#EA580C]"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                <div>
                  <div className="text-xs font-bold">
                    {editingTarget.hidden ? 'مخفي عن المستخدمين' : 'ظاهر للمستخدمين'}
                  </div>
                  <div className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-0.5">
                    {editingTarget.elementType === 'button'
                      ? 'يمكنك إخفاء هذا الزر أو إظهاره في جميع الحسابات'
                      : 'يمكنك إخفاء هذا العنوان أو إبقاءه ظاهراً'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingTarget((prev) =>
                      prev ? { ...prev, hidden: !prev.hidden } : null
                    )
                  }
                  className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    editingTarget.hidden
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {editingTarget.hidden ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>مخفي</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>ظاهر</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2 bg-[#EFE9DC]/60 dark:bg-[#0B1224]">
              <button
                type="button"
                disabled={savingCloud || !overrides[editingTarget.key]}
                onClick={() => handleRestoreOne(editingTarget.key)}
                className="h-9 px-3 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold flex items-center gap-1.5 hover:bg-[#E9E2D4] dark:hover:bg-[#132040] disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الأصلي</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="h-9 px-3.5 rounded-lg text-xs font-bold text-[#475569] dark:text-[#CBD5E1] hover:bg-[#E9E2D4] dark:hover:bg-[#132040] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingCloud}
                  className="h-9 px-4 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingCloud ? 'جاري النشر...' : 'حفظ ونشر للجميع'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* All Overrides Manager Drawer */}
      {managerOpen && (
        <div
          data-sa-customizer="true"
          className="fixed inset-0 z-[9994] bg-black/45 flex justify-end"
          onClick={() => setManagerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full bg-[#F7F3EA] dark:bg-[#0D162E] border-r border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col text-[#0C1427] dark:text-[#F7F3EA]"
          >
            <div className="px-5 py-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">سجل تعديلات البطاقات والأزرار</h3>
                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-0.5">
                  إجمالي التعديلات النشطة على المنظومة: {overridesList.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#E9E2D4] dark:hover:bg-[#132040] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  placeholder="ابحث بالاسم الأصلي أو الجديد..."
                  className="w-full h-9 pr-9 pl-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-semibold focus:outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredManagerList.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#475569] dark:text-[#CBD5E1] space-y-2">
                  <p className="font-bold">لا توجد تعديلات مسجلة بعد</p>
                  <p>اضغط على أي زر أو بطاقة في أي صفحة لتعديل اسمها أو إخفائها.</p>
                </div>
              ) : (
                filteredManagerList.map((ov) => (
                  <div
                    key={ov.key}
                    className="p-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-[#475569] dark:text-[#CBD5E1]">
                          {ov.elementType === 'button' ? 'زر' : 'بطاقة'}
                          {ov.pageHint ? ` · ${ov.pageHint}` : ''}
                        </div>
                        <div className="text-sm font-bold truncate mt-0.5">
                          {ov.customLabel || ov.originalText}
                        </div>
                        {ov.customLabel && (
                          <div className="text-[11px] text-[#475569] dark:text-slate-400 truncate">
                            الأصل: {ov.originalText}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={savingCloud}
                          onClick={() => handleToggleHiddenInManager(ov)}
                          title={ov.hidden ? 'إظهار العنصر' : 'إخفاء العنصر'}
                          className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                            ov.hidden
                              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-600'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-700'
                          }`}
                        >
                          {ov.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setManagerOpen(false);
                            setEditingTarget({
                              key: ov.key,
                              elementType: ov.elementType,
                              originalText: ov.originalText,
                              customLabel: ov.customLabel || ov.originalText,
                              hidden: Boolean(ov.hidden),
                              pageHint: ov.pageHint || '',
                            });
                          }}
                          title="تعديل الاسم"
                          className="p-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] hover:bg-[#EFE9DC] dark:hover:bg-[#1A2B54] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={savingCloud}
                          onClick={() => handleRestoreOne(ov.key)}
                          title="حذف التعديل واستعادة الأصلي"
                          className="p-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
