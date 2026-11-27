import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Home,
  LayoutGrid,
  Menu,
  Monitor,
  MoveRight,
  Palette,
  PanelRight,
  Plus,
  Rocket,
  RotateCcw,
  Smartphone,
  Sparkles,
  Store,
  Sun,
  Trash2,
  User,
  Users,
  FileText,
  X,
  Link2,
  Copy,
  Globe,
  Search,
} from 'lucide-react';
import {
  ARTISAN_ACTION_CATALOG,
  DEFAULT_ARTISAN_UI_LAYOUT,
  DEFAULT_PLATFORM_UI_LAYOUT,
  DEFAULT_SUPPLIER_UI_LAYOUT,
  getStoredUiLayoutConfig,
  getUiColorPreset,
  getUiIcon,
  normalizeUiLayoutConfig,
  PlatformUiLayoutConfig,
  RoleUiLayoutConfig,
  SUPPLIER_ACTION_CATALOG,
  UI_COLOR_PRESETS,
  UI_ICON_OPTIONS,
  UiActionButtonConfig,
  UiCardShape,
  UiHomeCardConfig,
  UiIconShape,
  UiLayoutAudience,
  PageUiOverrideConfig,
} from '../../types/uiLayoutConfig';
import { APP_PAGE_ROUTES, buildPageUrl } from '../../lib/appRoutes';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';
import { AdminExperienceModePanel } from './AdminExperienceModePanel';
import { AdminAiAssistantsPanel } from './AdminAiAssistantsPanel';

interface AdminUiLayoutStudioPageProps {
  onBack: () => void;
  saving?: boolean;
  onPublishToCloud: (nextLayout: PlatformUiLayoutConfig) => Promise<void>;
}

type StudioSectionTab =
  | 'cards'
  | 'pages'
  | 'navbar'
  | 'sidebar'
  | 'global_elements'
  | 'experience_modes'
  | 'ai_assistants';

function reorderArray<T>(list: T[], fromIdx: number, toIdx: number): T[] {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) {
    return list;
  }
  const copy = [...list];
  const [item] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, item);
  return copy;
}

export const AdminUiLayoutStudioPage: React.FC<AdminUiLayoutStudioPageProps> = ({
  onBack,
  saving = false,
  onPublishToCloud,
}) => {
  const [draft, setDraft] = useState<PlatformUiLayoutConfig>(() =>
    normalizeUiLayoutConfig(getStoredUiLayoutConfig())
  );
  const [audience, setAudience] = useState<UiLayoutAudience>('artisan');
  const [studioTab, setStudioTab] = useState<StudioSectionTab>('cards');
  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => draft.artisan.home.cards[0]?.id || ''
  );
  const [selectedSidebarGroupId, setSelectedSidebarGroupId] = useState<string>(
    () => draft.artisan.sidebar.groups[0]?.id || ''
  );

  // Drag & Drop State
  const [draggedCardIdx, setDraggedCardIdx] = useState<number | null>(null);
  const [draggedBtn, setDraggedBtn] = useState<{ cardId: string; index: number } | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [draggedNavIdx, setDraggedNavIdx] = useState<number | null>(null);
  const [draggedGroupIdx, setDraggedGroupIdx] = useState<number | null>(null);
  const [draggedSidebarItemIdx, setDraggedSidebarItemIdx] = useState<number | null>(null);

  // Create New Custom Card Form
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState('');
  const [newCardSubtitle, setNewCardSubtitle] = useState('');
  const [newCardIcon, setNewCardIcon] = useState('Sparkles');
  const [newCardColor, setNewCardColor] = useState('orange_strong');
  const [newCardDirectAction, setNewCardDirectAction] = useState('');

  // Add Action Button to Selected Card
  const [actionToAdd, setActionToAdd] = useState('');

  // Confirm Reset Inline (never window.confirm)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Interactive Live Preview Mode
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewSubCardId, setPreviewSubCardId] = useState<string | null>(null);
  const [previewSidebarOpen, setPreviewSidebarOpen] = useState(false);
  const [previewOpenGroups, setPreviewOpenGroups] = useState<Record<string, boolean>>({ erp: true, hr: true });
  const [previewClickNotice, setPreviewClickNotice] = useState<string | null>(null);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [pagesSearch, setPagesSearch] = useState('');
  const [pagesFilter, setPagesFilter] = useState<'all' | 'artisan' | 'supplier' | 'shared'>('all');
  const [copiedRouteId, setCopiedRouteId] = useState<string | null>(null);

  const roleConfig: RoleUiLayoutConfig = draft[audience];
  const actionCatalog = audience === 'artisan' ? ARTISAN_ACTION_CATALOG : SUPPLIER_ACTION_CATALOG;

  const selectedCard = useMemo(
    () => roleConfig.home.cards.find((c) => c.id === selectedCardId) || roleConfig.home.cards[0] || null,
    [roleConfig.home.cards, selectedCardId]
  );

  const selectedSidebarGroup = useMemo(
    () =>
      roleConfig.sidebar.groups.find((g) => g.id === selectedSidebarGroupId) ||
      roleConfig.sidebar.groups[0] ||
      null,
    [roleConfig.sidebar.groups, selectedSidebarGroupId]
  );

  const switchAudience = (nextAud: UiLayoutAudience) => {
    playButtonClickSound();
    setAudience(nextAud);
    setSelectedCardId(draft[nextAud].home.cards[0]?.id || '');
    setSelectedSidebarGroupId(draft[nextAud].sidebar.groups[0]?.id || '');
    setPreviewSubCardId(null);
    setPreviewSidebarOpen(false);
    setActionToAdd('');
  };

  const updateRole = (updater: (prev: RoleUiLayoutConfig) => RoleUiLayoutConfig) => {
    setDraft((prev) => ({
      ...prev,
      [audience]: updater(prev[audience]),
    }));
  };

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3800);
  };

  // ================= CARD OPERATIONS =================
  const handleCardMove = (fromIdx: number, toIdx: number) => {
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: reorderArray(r.home.cards, fromIdx, toIdx),
      },
    }));
  };

  const handleUpdateCard = (cardId: string, patch: Partial<UiHomeCardConfig>) => {
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: r.home.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
      },
    }));
  };

  const handleCreateCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardLabel.trim()) return;
    const id = `custom_card_${Date.now()}`;
    const newCard: UiHomeCardConfig = {
      id,
      label: newCardLabel.trim(),
      subtitle: newCardSubtitle.trim() || 'بطاقة مخصصة من الإدارة',
      iconKey: newCardIcon,
      colorPreset: newCardColor,
      visible: true,
      isCustom: true,
      directActionKey: newCardDirectAction || undefined,
      items: [],
    };
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: [newCard, ...r.home.cards],
      },
    }));
    setSelectedCardId(id);
    setNewCardLabel('');
    setNewCardSubtitle('');
    setNewCardDirectAction('');
    setShowNewCardForm(false);
    playSuccessSound();
    flashNotice(`تم إنشاء بطاقة "${newCard.label}"! تقدر تنقل فيها أي أزرار من البطاقات التانية بالسحب أو النقل.`);
  };

  const handleDeleteCard = (cardId: string) => {
    updateRole((r) => {
      const nextCards = r.home.cards.filter((c) => c.id !== cardId);
      if (selectedCardId === cardId) {
        setSelectedCardId(nextCards[0]?.id || '');
      }
      return {
        ...r,
        home: {
          ...r.home,
          cards: nextCards,
        },
      };
    });
    flashNotice('تم حذف البطاقة المخصصة.');
  };

  // ================= INTERNAL BUTTONS OPERATIONS =================
  const handleButtonMoveOrder = (cardId: string, fromIdx: number, toIdx: number) => {
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: r.home.cards.map((c) =>
          c.id === cardId ? { ...c, items: reorderArray(c.items, fromIdx, toIdx) } : c
        ),
      },
    }));
  };

  const handleUpdateButton = (cardId: string, btnId: string, patch: Partial<UiActionButtonConfig>) => {
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: r.home.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                items: c.items.map((it) => (it.id === btnId ? { ...it, ...patch } : it)),
              }
            : c
        ),
      },
    }));
  };

  const handleMoveButtonToAnotherCard = (sourceCardId: string, btnId: string, targetCardId: string) => {
    if (!targetCardId || sourceCardId === targetCardId) return;
    updateRole((r) => {
      const srcCard = r.home.cards.find((c) => c.id === sourceCardId);
      const movingBtn = srcCard?.items.find((b) => b.id === btnId);
      if (!movingBtn) return r;
      return {
        ...r,
        home: {
          ...r.home,
          cards: r.home.cards.map((c) => {
            if (c.id === sourceCardId) {
              return { ...c, items: c.items.filter((b) => b.id !== btnId) };
            }
            if (c.id === targetCardId) {
              return { ...c, directActionKey: undefined, items: [...c.items, movingBtn] };
            }
            return c;
          }),
        },
      };
    });
    const destName = roleConfig.home.cards.find((c) => c.id === targetCardId)?.label || 'البطاقة الهدف';
    playSuccessSound();
    flashNotice(`تم نقل الزر بنجاح إلى "${destName}" ✅`);
  };

  const handleAddButtonFromCatalog = (cardId: string, actionKey: string) => {
    const entry = actionCatalog.find((a) => a.actionKey === actionKey);
    if (!entry) return;
    const newBtn: UiActionButtonConfig = {
      id: `btn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actionKey: entry.actionKey,
      label: entry.defaultLabel,
      iconKey: entry.defaultIcon,
      visible: true,
    };
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: r.home.cards.map((c) =>
          c.id === cardId ? { ...c, directActionKey: undefined, items: [...c.items, newBtn] } : c
        ),
      },
    }));
    setActionToAdd('');
    playSuccessSound();
    flashNotice(`تمت إضافة "${entry.defaultLabel}" للبطاقة.`);
  };

  const handleRemoveButton = (cardId: string, btnId: string) => {
    updateRole((r) => ({
      ...r,
      home: {
        ...r.home,
        cards: r.home.cards.map((c) =>
          c.id === cardId ? { ...c, items: c.items.filter((b) => b.id !== btnId) } : c
        ),
      },
    }));
  };

  // ================= NAVBAR OPERATIONS =================
  const handleNavbarMove = (fromIdx: number, toIdx: number) => {
    updateRole((r) => ({
      ...r,
      navbar: {
        ...r.navbar,
        items: reorderArray(r.navbar.items, fromIdx, toIdx),
      },
    }));
  };

  const handleNavbarItemPatch = (id: string, patch: { label?: string; visible?: boolean }) => {
    updateRole((r) => ({
      ...r,
      navbar: {
        ...r.navbar,
        items: r.navbar.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      },
    }));
  };

  // ================= SIDEBAR OPERATIONS =================
  const handleSidebarGroupMove = (fromIdx: number, toIdx: number) => {
    updateRole((r) => ({
      ...r,
      sidebar: {
        ...r.sidebar,
        groups: reorderArray(r.sidebar.groups, fromIdx, toIdx),
      },
    }));
  };

  const handleSidebarItemMoveOrder = (groupId: string, fromIdx: number, toIdx: number) => {
    updateRole((r) => ({
      ...r,
      sidebar: {
        ...r.sidebar,
        groups: r.sidebar.groups.map((g) =>
          g.id === groupId ? { ...g, items: reorderArray(g.items, fromIdx, toIdx) } : g
        ),
      },
    }));
  };

  const handleMoveSidebarItemToGroup = (sourceGroupId: string, itemId: string, targetGroupId: string) => {
    if (!targetGroupId || sourceGroupId === targetGroupId) return;
    updateRole((r) => {
      const src = r.sidebar.groups.find((g) => g.id === sourceGroupId);
      const item = src?.items.find((i) => i.id === itemId);
      if (!item) return r;
      return {
        ...r,
        sidebar: {
          ...r.sidebar,
          groups: r.sidebar.groups.map((g) => {
            if (g.id === sourceGroupId) return { ...g, items: g.items.filter((i) => i.id !== itemId) };
            if (g.id === targetGroupId) return { ...g, items: [...g.items, item] };
            return g;
          }),
        },
      };
    });
    playSuccessSound();
    flashNotice('تم نقل عنصر القائمة الجانبية للقسم الجديد.');
  };

  const handlePublish = async () => {
    const stamped: PlatformUiLayoutConfig = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    setDraft(stamped);
    await onPublishToCloud(stamped);
  };

  const handleResetAudience = () => {
    const def = audience === 'artisan' ? DEFAULT_ARTISAN_UI_LAYOUT : DEFAULT_SUPPLIER_UI_LAYOUT;
    const cloned: RoleUiLayoutConfig = JSON.parse(JSON.stringify(def));
    setDraft((prev) => ({
      ...prev,
      [audience]: cloned,
    }));
    setSelectedCardId(cloned.home.cards[0]?.id || '');
    setSelectedSidebarGroupId(cloned.sidebar.groups[0]?.id || '');
    setConfirmResetOpen(false);
    flashNotice(`تمت استعادة التخطيط الافتراضي لـ ${audience === 'artisan' ? 'الفنانين والورش' : 'الموردين والتجار'}. اضغط نشر لتعميمه.`);
  };

  // ================= LIVE INTERACTIVE PREVIEW VIEW =================
  if (previewMode) {
    const activePreviewCard = previewSubCardId
      ? roleConfig.home.cards.find((c) => c.id === previewSubCardId) || null
      : null;

    const visibleCards = roleConfig.home.cards.filter((c) => c.visible);
    const colsClass =
      previewDevice === 'mobile'
        ? roleConfig.home.columnsMobile === 2
          ? 'grid-cols-2'
          : 'grid-cols-3'
        : roleConfig.home.columnsDesktop === 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : roleConfig.home.columnsDesktop === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-3 sm:grid-cols-5';

    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4 text-right" dir="rtl">
        {/* Sticky Preview Control Bar with Back to Editing + Publish */}
        <div className="sticky top-14 z-30 rounded-2xl bg-[#0C1427] text-white border-2 border-[#EA580C] p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPreviewMode(false);
                setPreviewSubCardId(null);
                setPreviewSidebarOpen(false);
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1A2B54] hover:bg-[#22355E] border border-amber-400/50 text-amber-300 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع لاستكمال التعديلات ↩️</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-300" />
              <span>
                معاينة حية: {audience === 'artisan' ? 'شاشة الفنانين والورش' : 'شاشة الموردين والتجار'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#132040] rounded-xl p-1 border border-[#22355E]">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'desktop' ? 'bg-[#EA580C] text-white' : 'text-slate-300'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>كمبيوتر</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'mobile' ? 'bg-[#EA580C] text-white' : 'text-slate-300'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>موبايل</span>
              </button>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handlePublish}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#D97706] hover:from-[#C2410C] hover:to-[#EA580C] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-60"
            >
              <Rocket className="w-4 h-4" />
              <span>{saving ? 'جاري النشر...' : 'حفظ ونشر للجميع (Publish) 🚀'}</span>
            </button>
          </div>
        </div>

        {previewClickNotice && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 text-emerald-900 dark:text-emerald-200 px-4 py-2.5 text-xs font-black flex items-center justify-between">
            <span>{previewClickNotice}</span>
            <button type="button" onClick={() => setPreviewClickNotice(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Simulated Viewport Frame */}
        <div
          className={`mx-auto rounded-3xl border-4 border-[#0C1427] dark:border-[#2D4475] bg-[#F2ECE1] dark:bg-[#060B18] shadow-2xl overflow-hidden transition-all ${
            previewDevice === 'mobile' ? 'max-w-[390px]' : 'w-full'
          }`}
        >
          {/* Simulated Navbar */}
          <div
            className={`bg-[#F7F3EA] dark:bg-[#0D162E] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2 ${
              roleConfig.navbar.density === 'compact' ? 'px-2.5 py-1.5' : 'px-4 py-2.5'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EA580C]/15 border border-[#EA580C]/40 flex items-center justify-center text-xs font-black text-[#EA580C]">
                ☀️
              </div>
              <span className="text-xs font-black text-[#0C1427] dark:text-white hidden sm:inline">
                {audience === 'artisan' ? 'ورشة تجريبية' : 'متجر مورد تجريبي'}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {roleConfig.navbar.items
                .filter((ni) => ni.visible)
                .map((ni) => {
                  const IconComp =
                    ni.id === 'store'
                      ? Store
                      : ni.id === 'family'
                      ? Users
                      : ni.id === 'executive_brief'
                      ? FileText
                      : ni.id === 'personal_profile'
                      ? User
                      : ni.id === 'pwa'
                      ? Download
                      : ni.id === 'notifications'
                      ? Bell
                      : Sun;
                  return (
                    <button
                      key={ni.id}
                      type="button"
                      onClick={() => setPreviewClickNotice(`زر القائمة العلوية "${ni.label}" يعمل بنجاح.`)}
                      className={`${
                        roleConfig.navbar.density === 'compact' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
                      } rounded-xl border font-black flex items-center gap-1 cursor-pointer ${
                        ni.id === 'store'
                          ? 'bg-[#EA580C] text-white border-[#EA580C]'
                          : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{ni.label}</span>
                    </button>
                  );
                })}

              <button
                type="button"
                onClick={() => setPreviewSidebarOpen((p) => !p)}
                className="w-8 h-8 rounded-xl bg-[#0C1427] text-amber-300 flex items-center justify-center cursor-pointer"
                title="معاينة القائمة الجانبية"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preview Body + Simulated Drawer */}
          <div className="relative p-3 sm:p-5 min-h-[440px]">
            {previewSidebarOpen && (
              <div className="mb-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C] p-3.5 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-2">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <PanelRight className="w-4 h-4 text-[#EA580C]" />
                    معاينة القائمة الجانبية (بالترتيب والمسميات الجديدة)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewSidebarOpen(false)}
                    className="p-1 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-xl bg-[#0C1427] text-white text-xs font-black flex items-center justify-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-amber-300" />
                    <span>الرئيسية</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black flex items-center justify-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>صفحتي الشخصية</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {roleConfig.sidebar.groups
                    .filter((g) => g.visible)
                    .map((g) => {
                      const expanded = Boolean(previewOpenGroups[g.id]);
                      return (
                        <div key={g.id} className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewOpenGroups((p) => ({ ...p, [g.id]: !p[g.id] }))
                            }
                            className="w-full px-3 py-2 bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-between text-xs font-black cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-[#0C1427] text-amber-300 font-mono text-[10px]">
                                {g.code}
                              </span>
                              <span>{g.titleAr}</span>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                          {expanded && (
                            <div className="p-1.5 space-y-1 bg-[#F7F3EA] dark:bg-[#060B18]">
                              {g.items
                                .filter((i) => i.visible)
                                .map((it) => {
                                  const Icn = getUiIcon(it.iconKey);
                                  return (
                                    <button
                                      key={it.id}
                                      type="button"
                                      onClick={() =>
                                        setPreviewClickNotice(`تم الضغط على عنصر القائمة الجانبية: "${it.label}"`)
                                      }
                                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[#EFE9DC] dark:hover:bg-[#132040] flex items-center justify-between text-[11px] font-bold cursor-pointer"
                                    >
                                      <span className="flex items-center gap-2">
                                        <Icn className="w-3.5 h-3.5 text-[#EA580C]" />
                                        {it.label}
                                      </span>
                                      <ChevronLeft className="w-3 h-3 opacity-50" />
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Simulated Sub-Card vs Main Home Cards Grid */}
            {activePreviewCard ? (
              <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#D4CCBC] dark:border-[#22355E] space-y-4">
                <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-amber-950/60 text-[#EA580C] flex items-center justify-center">
                      {React.createElement(getUiIcon(activePreviewCard.iconKey), { className: 'w-4 h-4' })}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#475569] block">الأزرار داخل البطاقة</span>
                      <h3 className="text-sm font-black">{activePreviewCard.label}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewSubCardId(null)}
                    className="px-3 py-1.5 rounded-xl bg-[#FFEAD5] text-[#9A3412] text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>رجوع للبطاقات</span>
                  </button>
                </div>

                {activePreviewCard.items.filter((i) => i.visible).length === 0 ? (
                  <p className="text-xs text-[#475569] text-center py-6">
                    هذه البطاقة تفتح شاشة مباشرة بدون أزرار فرعية ({activePreviewCard.directActionKey || 'لم يُحدد إجراء بعد'}).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {activePreviewCard.items
                      .filter((i) => i.visible)
                      .map((sub) => {
                        const SubIcn = getUiIcon(sub.iconKey);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() =>
                              setPreviewClickNotice(`الزر "${sub.label}" يفتح (${sub.actionKey}) بنجاح.`)
                            }
                            className="p-3.5 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
                          >
                            <div
                              className={`w-8 h-8 ${
                                roleConfig.home.iconShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                              } bg-[#F7F3EA] dark:bg-[#0D162E] text-[#EA580C] flex items-center justify-center border border-[#D4CCBC]`}
                            >
                              <SubIcn className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-black leading-tight">{sub.label}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                  <span>اضغط على أي بطاقة لمعاينة الأزرار اللي جواها:</span>
                  <span className="font-mono">{visibleCards.length} بطاقة ظاهرة</span>
                </div>
                <div className={`grid ${colsClass} gap-2.5 sm:gap-3`}>
                  {visibleCards.map((card) => {
                    const Icon = getUiIcon(card.iconKey);
                    const preset = getUiColorPreset(card.colorPreset);
                    const shapeCls =
                      roleConfig.home.cardShape === 'wide'
                        ? 'p-4 rounded-2xl text-right flex-col items-start justify-between min-h-[118px]'
                        : roleConfig.home.cardShape === 'compact'
                        ? 'p-2 rounded-xl text-center flex-col items-center justify-center min-h-[72px]'
                        : 'p-3 sm:p-4 rounded-2xl sm:rounded-3xl text-center flex-col items-center justify-center min-h-[92px]';
                    const iconBoxShape =
                      roleConfig.home.iconShape === 'circle' ? 'rounded-full' : 'rounded-2xl';
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          if (card.items.filter((i) => i.visible).length > 0) {
                            setPreviewSubCardId(card.id);
                          } else {
                            setPreviewClickNotice(`البطاقة "${card.label}" تفتح مباشرة (${card.directActionKey || 'شاشة مخصصة'}).`);
                          }
                        }}
                        className={`${shapeCls} bg-gradient-to-b from-[#F7F3EA] to-[#EFE9DC] dark:from-[#0D162E] dark:to-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition flex gap-2 cursor-pointer`}
                      >
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 ${iconBoxShape} ${preset.bgColor} ${preset.color} border ${preset.borderColor} flex items-center justify-center shrink-0`}
                        >
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] block leading-tight">
                            {card.label}
                          </span>
                          {roleConfig.home.cardShape === 'wide' && card.subtitle && (
                            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] block leading-snug">
                              {card.subtitle}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================= MAIN STUDIO EDITOR =================
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-5 text-right" dir="rtl">
      {/* Studio Top Bar */}
      <div className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black flex items-center gap-2 text-[#0C1427] dark:text-[#F7F3EA]">
              <Palette className="w-5 h-5 text-[#EA580C]" />
              <span>هندسة الواجهات والقوائم الحية (UI Studio)</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              اسحب ورتّب البطاقات، انقل الأزرار بين البطاقات، أنشئ بطاقات جديدة، وتحكم في القائمة العلوية والجانبية، ثم عاين قبل النشر للجميع.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmResetOpen((p) => !p)}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#475569]" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreviewSubCardId(null);
              setPreviewSidebarOpen(false);
              setPreviewMode(true);
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1A2B54] text-amber-300 border border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>معاينة حية 👁️</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handlePublish}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-55"
          >
            <Rocket className="w-4 h-4" />
            <span>{saving ? 'جاري النشر...' : 'نشر للجميع (Publish) 🚀'}</span>
          </button>
        </div>
      </div>

      {/* Inline Reset Confirmation */}
      {confirmResetOpen && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-400 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span>
            هل تريد استعادة التخطيط الافتراضي لـ ({audience === 'artisan' ? 'الفنانين والورش' : 'الموردين والتجار'})؟
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAudience}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-black cursor-pointer"
            >
              تأكيد الاستعادة
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {statusNotice && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 text-emerald-900 dark:text-emerald-200 px-4 py-2.5 text-xs font-black">
          {statusNotice}
        </div>
      )}

      {/* Role Switcher (Artisans vs Suppliers) & Section Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex p-1.5 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] gap-1.5">
          <button
            type="button"
            onClick={() => switchAudience('artisan')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              audience === 'artisan'
                ? 'bg-[#EA580C] text-white shadow-sm'
                : 'text-[#0C1427] dark:text-[#CBD5E1] hover:bg-[#F7F3EA] dark:hover:bg-[#1A2B54]'
            }`}
          >
            🎨 شاشة الفنانين والورش
          </button>
          <button
            type="button"
            onClick={() => switchAudience('supplier')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              audience === 'supplier'
                ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white shadow-sm'
                : 'text-[#0C1427] dark:text-[#CBD5E1] hover:bg-[#F7F3EA] dark:hover:bg-[#1A2B54]'
            }`}
          >
            🏭 شاشة الموردين والتجار
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'cards', label: 'البطاقات والأزرار الداخلية', icon: LayoutGrid },
              { id: 'pages', label: 'الصفحات والروابط', icon: Link2 },
              { id: 'navbar', label: 'القائمة العلوية (Navbar)', icon: Menu },
              { id: 'sidebar', label: 'القائمة الجانبية (Sidebar)', icon: PanelRight },
              { id: 'experience_modes', label: 'مقارنة الوضع الحرفي والمحاسبي', icon: FileText },
              { id: 'ai_assistants', label: 'شموسة وصقر', icon: Sun },
              { id: 'global_elements', label: 'تعديلات كل الصفحات', icon: Sparkles },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStudioTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                  studioTab === t.id
                    ? 'bg-[#0C1427] text-amber-300 border-[#EA580C]'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= TAB 1: CARDS & INTERNAL BUTTONS ================= */}
      {studioTab === 'cards' && (
        <div className="space-y-4">
          {/* Global Grid & Shape Options Bar */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 font-black">
                <span>أعمدة الكمبيوتر:</span>
                <select
                  value={roleConfig.home.columnsDesktop}
                  onChange={(e) =>
                    updateRole((r) => ({
                      ...r,
                      home: { ...r.home, columnsDesktop: Number(e.target.value) as 3 | 4 | 5 },
                    }))
                  }
                  className="h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
                >
                  <option value={3}>3 أعمدة</option>
                  <option value={4}>4 أعمدة</option>
                  <option value={5}>5 أعمدة</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 font-black">
                <span>أعمدة الموبايل:</span>
                <select
                  value={roleConfig.home.columnsMobile}
                  onChange={(e) =>
                    updateRole((r) => ({
                      ...r,
                      home: { ...r.home, columnsMobile: Number(e.target.value) as 2 | 3 },
                    }))
                  }
                  className="h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
                >
                  <option value={2}>عمودين (2)</option>
                  <option value={3}>3 أعمدة</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 font-black">
                <span>شكل البطاقة:</span>
                <select
                  value={roleConfig.home.cardShape}
                  onChange={(e) =>
                    updateRole((r) => ({
                      ...r,
                      home: { ...r.home, cardShape: e.target.value as UiCardShape },
                    }))
                  }
                  className="h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-black"
                >
                  <option value="classic">كلاسيكي (أيقونة + عنوان)</option>
                  <option value="wide">بطاقة عريضة بوصف</option>
                  <option value="compact">مضغوط (صغير سريع)</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 font-black">
                <span>شكل الأيقونة:</span>
                <select
                  value={roleConfig.home.iconShape}
                  onChange={(e) =>
                    updateRole((r) => ({
                      ...r,
                      home: { ...r.home, iconShape: e.target.value as UiIconShape },
                    }))
                  }
                  className="h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-black"
                >
                  <option value="rounded">مربع بحواف ناعمة</option>
                  <option value="circle">دائري</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 font-black">
                <span>أقصى عدد صور للمنتج:</span>
                <select
                  value={roleConfig.maxProductImages || 3}
                  onChange={(e) =>
                    updateRole((r) => ({
                      ...r,
                      maxProductImages: Math.min(8, Math.max(1, Number(e.target.value) || 3)),
                    }))
                  }
                  className="h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'صورة' : 'صور'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowNewCardForm((p) => !p)}
              className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء بطاقة جديدة</span>
            </button>
          </div>

          {/* New Custom Card Creator */}
          {showNewCardForm && (
            <form
              onSubmit={handleCreateCustomCard}
              className="rounded-2xl bg-orange-50/70 dark:bg-[#0D162E] border-2 border-[#EA580C] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">إنشاء بطاقة جديدة في الشاشة الرئيسية</h3>
                <button type="button" onClick={() => setShowNewCardForm(false)} className="cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <input
                  type="text"
                  required
                  value={newCardLabel}
                  onChange={(e) => setNewCardLabel(e.target.value)}
                  placeholder="اسم البطاقة الجديدة (مثال: أساسياتي السريعة)"
                  className="h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] font-black"
                />
                <input
                  type="text"
                  value={newCardSubtitle}
                  onChange={(e) => setNewCardSubtitle(e.target.value)}
                  placeholder="وصف مختصر (اختياري)"
                  className="h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
                />
                <select
                  value={newCardIcon}
                  onChange={(e) => setNewCardIcon(e.target.value)}
                  className="h-9 px-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
                >
                  {UI_ICON_OPTIONS.map((ic) => (
                    <option key={ic.key} value={ic.key}>{ic.label}</option>
                  ))}
                </select>
                <select
                  value={newCardColor}
                  onChange={(e) => setNewCardColor(e.target.value)}
                  className="h-9 px-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
                >
                  {UI_COLOR_PRESETS.map((cp) => (
                    <option key={cp.key} value={cp.key}>{cp.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <select
                  value={newCardDirectAction}
                  onChange={(e) => setNewCardDirectAction(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] font-bold flex-1 max-w-md"
                >
                  <option value="">تحتوي على أزرار داخلية (تنقل لها أزرار أو تضيف أزرار)</option>
                  {actionCatalog.map((a) => (
                    <option key={a.actionKey} value={a.actionKey}>
                      فتح مباشر: {a.defaultLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer"
                >
                  إضافة البطاقة الآن
                </button>
              </div>
            </form>
          )}

          {/* Split Workspace: Left/Right = Cards Draggable List + Selected Card Buttons Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Cards Reorder Column */}
            <div className="lg:col-span-5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black">البطاقات الرئيسية ({roleConfig.home.cards.length})</h2>
                <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  اسحب للترتيب أو أفلت زراً هنا
                </span>
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pl-1">
                {roleConfig.home.cards.map((card, idx) => {
                  const Icon = getUiIcon(card.iconKey);
                  const preset = getUiColorPreset(card.colorPreset);
                  const isSelected = selectedCard?.id === card.id;
                  const isDropTarget = dragOverCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => {
                        setDraggedCardIdx(idx);
                        setDraggedBtn(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCardId(card.id);
                      }}
                      onDragLeave={() => setDragOverCardId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCardId(null);
                        if (draggedBtn) {
                          const targetBtn = selectedCard?.items[draggedBtn.index];
                          if (targetBtn && draggedBtn.cardId !== card.id) {
                            handleMoveButtonToAnotherCard(draggedBtn.cardId, targetBtn.id, card.id);
                          }
                          setDraggedBtn(null);
                          return;
                        }
                        if (draggedCardIdx !== null && draggedCardIdx !== idx) {
                          handleCardMove(draggedCardIdx, idx);
                        }
                        setDraggedCardIdx(null);
                      }}
                      onClick={() => setSelectedCardId(card.id)}
                      className={`rounded-xl p-2.5 border transition flex items-center justify-between gap-2 cursor-pointer ${
                        isDropTarget
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-400'
                          : isSelected
                          ? 'border-[#EA580C] bg-[#FFEAD5]/70 dark:bg-[#132040]'
                          : 'border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/65 dark:bg-[#132040]/60'
                      } ${!card.visible ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-4 h-4 text-[#64748B] shrink-0 cursor-grab" />
                        <div className={`w-8 h-8 rounded-xl ${preset.bgColor} ${preset.color} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">{card.label}</div>
                          <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                            {card.items.length > 0
                              ? `${card.items.filter((i) => i.visible).length} زر داخلي`
                              : card.directActionKey
                              ? 'فتح مباشر'
                              : 'بطاقة فارغة'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleCardMove(idx, idx - 1)}
                          aria-label="تحريك لأعلى"
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === roleConfig.home.cards.length - 1}
                          onClick={() => handleCardMove(idx, idx + 1)}
                          aria-label="تحريك لأسفل"
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateCard(card.id, { visible: !card.visible })}
                          aria-label={card.visible ? 'إخفاء البطاقة' : 'إظهار البطاقة'}
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] cursor-pointer"
                        >
                          {card.visible ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-rose-500" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Card Details + Internal Buttons Editor */}
            <div className="lg:col-span-7 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
              {!selectedCard ? (
                <p className="text-xs text-center py-10 text-[#475569]">اختر بطاقة من اليمين لتعديلها.</p>
              ) : (
                <>
                  {/* Card Properties Editor */}
                  <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black">تعديل بطاقة: {selectedCard.label}</h3>
                      {selectedCard.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(selectedCard.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/15 text-rose-600 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف البطاقة</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block font-bold mb-1">اسم البطاقة</label>
                        <input
                          type="text"
                          value={selectedCard.label}
                          onChange={(e) => handleUpdateCard(selectedCard.id, { label: e.target.value })}
                          className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-black"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">الوصف المختصر (يظهر في الشكل العريض)</label>
                        <input
                          type="text"
                          value={selectedCard.subtitle || ''}
                          onChange={(e) => handleUpdateCard(selectedCard.id, { subtitle: e.target.value })}
                          className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">الأيقونة</label>
                        <select
                          value={selectedCard.iconKey}
                          onChange={(e) => handleUpdateCard(selectedCard.id, { iconKey: e.target.value })}
                          className="w-full h-9 px-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-bold"
                        >
                          {UI_ICON_OPTIONS.map((ic) => (
                            <option key={ic.key} value={ic.key}>{ic.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold mb-1">اللون</label>
                        <select
                          value={selectedCard.colorPreset}
                          onChange={(e) => handleUpdateCard(selectedCard.id, { colorPreset: e.target.value })}
                          className="w-full h-9 px-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-bold"
                        >
                          {UI_COLOR_PRESETS.map((cp) => (
                            <option key={cp.key} value={cp.key}>{cp.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Internal Buttons List + Reorder + Rename + Move Across Cards */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-black">
                        الأزرار الداخلية داخل "{selectedCard.label}" ({selectedCard.items.length})
                      </h4>

                      <div className="flex items-center gap-1.5">
                        <select
                          value={actionToAdd}
                          onChange={(e) => setActionToAdd(e.target.value)}
                          className="h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] text-[11px] font-bold max-w-[200px]"
                        >
                          <option value="">+ إضافة زر من الكتالوج...</option>
                          {actionCatalog.map((a) => (
                            <option key={a.actionKey} value={a.actionKey}>
                              {a.defaultLabel}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!actionToAdd}
                          onClick={() => handleAddButtonFromCatalog(selectedCard.id, actionToAdd)}
                          className="h-8 px-3 rounded-lg bg-[#EA580C] text-white text-[11px] font-black cursor-pointer disabled:opacity-40"
                        >
                          إضافة
                        </button>
                      </div>
                    </div>

                    {selectedCard.items.length === 0 ? (
                      <div className="rounded-xl bg-[#EFE9DC]/65 dark:bg-[#132040]/60 border border-dashed border-[#D4CCBC] p-4 space-y-2 text-xs">
                        <p className="font-bold text-[#475569]">
                          هذه البطاقة تفتح شاشة مباشرة بدون قائمة أزرار فرعية. يمكنك تغيير الإجراء المباشر أو إضافة/نقل أزرار داخلها:
                        </p>
                        <select
                          value={selectedCard.directActionKey || ''}
                          onChange={(e) =>
                            handleUpdateCard(selectedCard.id, {
                              directActionKey: e.target.value || undefined,
                            })
                          }
                          className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-bold"
                        >
                          <option value="">اختر الإجراء المباشر...</option>
                          {actionCatalog.map((a) => (
                            <option key={a.actionKey} value={a.actionKey}>
                              {a.defaultLabel} — {a.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pl-1">
                        {selectedCard.items.map((btn, bIdx) => {
                          const BIcon = getUiIcon(btn.iconKey);
                          return (
                            <div
                              key={btn.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDraggedBtn({ cardId: selectedCard.id, index: bIdx });
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (draggedBtn && draggedBtn.cardId === selectedCard.id && draggedBtn.index !== bIdx) {
                                  handleButtonMoveOrder(selectedCard.id, draggedBtn.index, bIdx);
                                }
                                setDraggedBtn(null);
                              }}
                              className={`rounded-xl bg-[#EFE9DC]/85 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-2.5 space-y-2 ${
                                !btn.visible ? 'opacity-55' : ''
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <GripVertical className="w-4 h-4 text-[#64748B] shrink-0 cursor-grab" />
                                <div className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] text-[#EA580C] flex items-center justify-center shrink-0">
                                  <BIcon className="w-3.5 h-3.5" />
                                </div>
                                <input
                                  type="text"
                                  value={btn.label}
                                  onChange={(e) =>
                                    handleUpdateButton(selectedCard.id, btn.id, { label: e.target.value })
                                  }
                                  className="flex-1 min-w-[160px] h-8 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] text-xs font-black"
                                />

                                <select
                                  value={btn.iconKey}
                                  onChange={(e) =>
                                    handleUpdateButton(selectedCard.id, btn.id, { iconKey: e.target.value })
                                  }
                                  className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] text-[11px] font-bold"
                                >
                                  {UI_ICON_OPTIONS.map((ic) => (
                                    <option key={ic.key} value={ic.key}>{ic.label}</option>
                                  ))}
                                </select>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={bIdx === 0}
                                    onClick={() => handleButtonMoveOrder(selectedCard.id, bIdx, bIdx - 1)}
                                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={bIdx === selectedCard.items.length - 1}
                                    onClick={() => handleButtonMoveOrder(selectedCard.id, bIdx, bIdx + 1)}
                                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateButton(selectedCard.id, btn.id, { visible: !btn.visible })
                                    }
                                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] cursor-pointer"
                                  >
                                    {btn.visible ? (
                                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveButton(selectedCard.id, btn.id)}
                                    aria-label="إزالة الزر"
                                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Move Button to Another Card */}
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#D4CCBC]/60 dark:border-[#22355E]/60">
                                <span className="font-mono text-[#475569] dark:text-[#94A3B8]">
                                  الإجراء البرمجي: {btn.actionKey}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <MoveRight className="w-3.5 h-3.5 text-[#EA580C]" />
                                  <select
                                    value=""
                                    onChange={(e) =>
                                      handleMoveButtonToAnotherCard(selectedCard.id, btn.id, e.target.value)
                                    }
                                    className="h-7 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#EA580C]/40 text-[11px] font-black cursor-pointer"
                                  >
                                    <option value="">نقل هذا الزر إلى بطاقة أخرى...</option>
                                    {roleConfig.home.cards
                                      .filter((c) => c.id !== selectedCard.id)
                                      .map((c) => (
                                        <option key={c.id} value={c.id}>
                                          نقل إلى ← {c.label}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: TOP NAVBAR EDITOR ================= */}
      {studioTab === 'navbar' && (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">ترتيب وتسمية أزرار القائمة العلوية (Navbar)</h2>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                رتب أزرار الشريط العلوي بالسحب والإفلات، غيّر أسماءها، أو أظهر/أخفِ اختصارات مثل «هلخصهالك» و«صفحتي».
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-black">
              <span>حجم الشريط العلوي:</span>
              <select
                value={roleConfig.navbar.density}
                onChange={(e) =>
                  updateRole((r) => ({
                    ...r,
                    navbar: { ...r.navbar, density: e.target.value as 'comfortable' | 'compact' },
                  }))
                }
                className="h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-black"
              >
                <option value="comfortable">مريح (عادي)</option>
                <option value="compact">مضغوط (Compact)</option>
              </select>
            </label>
          </div>

          <div className="space-y-2 max-w-2xl">
            {roleConfig.navbar.items.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggedNavIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedNavIdx !== null && draggedNavIdx !== idx) {
                    handleNavbarMove(draggedNavIdx, idx);
                  }
                  setDraggedNavIdx(null);
                }}
                className={`rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3 flex flex-wrap items-center justify-between gap-2 ${
                  !item.visible ? 'opacity-55' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                  <GripVertical className="w-4 h-4 text-[#64748B] cursor-grab shrink-0" />
                  <span className="px-2 py-0.5 rounded bg-[#0C1427] text-amber-300 font-mono text-[10px] font-black">
                    {item.id}
                  </span>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleNavbarItemPatch(item.id, { label: e.target.value })}
                    className="flex-1 h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] text-xs font-black"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleNavbarMove(idx, idx - 1)}
                    className="p-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === roleConfig.navbar.items.length - 1}
                    onClick={() => handleNavbarMove(idx, idx + 1)}
                    className="p-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavbarItemPatch(item.id, { visible: !item.visible })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border cursor-pointer flex items-center gap-1 ${
                      item.visible
                        ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-600/15 border-rose-500/40 text-rose-600'
                    }`}
                  >
                    {item.visible ? <Check className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{item.visible ? 'ظاهر' : 'مخفي'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: SIDEBAR DRAWER EDITOR ================= */}
      {studioTab === 'sidebar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Sidebar Groups */}
          <div className="lg:col-span-5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
            <h2 className="text-sm font-black">أقسام القائمة الجانبية (اسحب للترتيب)</h2>
            <div className="space-y-2">
              {roleConfig.sidebar.groups.map((grp, gIdx) => {
                const isSel = selectedSidebarGroup?.id === grp.id;
                return (
                  <div
                    key={grp.id}
                    draggable
                    onDragStart={() => setDraggedGroupIdx(gIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedGroupIdx !== null && draggedGroupIdx !== gIdx) {
                        handleSidebarGroupMove(draggedGroupIdx, gIdx);
                      }
                      setDraggedGroupIdx(null);
                    }}
                    onClick={() => setSelectedSidebarGroupId(grp.id)}
                    className={`rounded-xl p-3 border cursor-pointer flex items-center justify-between gap-2 ${
                      isSel
                        ? 'border-[#EA580C] bg-[#FFEAD5]/70 dark:bg-[#132040]'
                        : 'border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/70 dark:bg-[#132040]/60'
                    } ${!grp.visible ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-[#64748B] cursor-grab shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-[#0C1427] text-amber-300 font-mono text-[10px] font-black shrink-0">
                        {grp.code}
                      </span>
                      <span className="text-xs font-black truncate">{grp.titleAr}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={gIdx === 0}
                        onClick={() => handleSidebarGroupMove(gIdx, gIdx - 1)}
                        className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={gIdx === roleConfig.sidebar.groups.length - 1}
                        onClick={() => handleSidebarGroupMove(gIdx, gIdx + 1)}
                        className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateRole((r) => ({
                            ...r,
                            sidebar: {
                              ...r.sidebar,
                              groups: r.sidebar.groups.map((g) =>
                                g.id === grp.id ? { ...g, visible: !g.visible } : g
                              ),
                            },
                          }))
                        }
                        className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] cursor-pointer"
                      >
                        {grp.visible ? (
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Sidebar Group Items Editor */}
          <div className="lg:col-span-7 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
            {selectedSidebarGroup && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-[#EFE9DC] dark:bg-[#132040] p-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                  <div className="sm:col-span-2">
                    <label className="block font-bold mb-1">اسم القسم الرئيسي</label>
                    <input
                      type="text"
                      value={selectedSidebarGroup.titleAr}
                      onChange={(e) =>
                        updateRole((r) => ({
                          ...r,
                          sidebar: {
                            ...r.sidebar,
                            groups: r.sidebar.groups.map((g) =>
                              g.id === selectedSidebarGroup.id ? { ...g, titleAr: e.target.value } : g
                            ),
                          },
                        }))
                      }
                      className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-black"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">الشارة (Code)</label>
                    <input
                      type="text"
                      value={selectedSidebarGroup.code}
                      onChange={(e) =>
                        updateRole((r) => ({
                          ...r,
                          sidebar: {
                            ...r.sidebar,
                            groups: r.sidebar.groups.map((g) =>
                              g.id === selectedSidebarGroup.id ? { ...g, code: e.target.value } : g
                            ),
                          },
                        }))
                      }
                      className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-mono font-black"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-black">العناصر داخل القسم ({selectedSidebarGroup.items.length})</h3>
                  {selectedSidebarGroup.items.map((it, iIdx) => (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={() => setDraggedSidebarItemIdx(iIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedSidebarItemIdx !== null && draggedSidebarItemIdx !== iIdx) {
                          handleSidebarItemMoveOrder(selectedSidebarGroup.id, draggedSidebarItemIdx, iIdx);
                        }
                        setDraggedSidebarItemIdx(null);
                      }}
                      className={`rounded-xl bg-[#EFE9DC]/85 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-2.5 flex flex-wrap items-center justify-between gap-2 ${
                        !it.visible ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                        <GripVertical className="w-4 h-4 text-[#64748B] cursor-grab shrink-0" />
                        <input
                          type="text"
                          value={it.label}
                          onChange={(e) =>
                            updateRole((r) => ({
                              ...r,
                              sidebar: {
                                ...r.sidebar,
                                groups: r.sidebar.groups.map((g) =>
                                  g.id === selectedSidebarGroup.id
                                    ? {
                                        ...g,
                                        items: g.items.map((x) =>
                                          x.id === it.id ? { ...x, label: e.target.value } : x
                                        ),
                                      }
                                    : g
                                ),
                              },
                            }))
                          }
                          className="flex-1 h-8 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] text-xs font-black"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value=""
                          onChange={(e) =>
                            handleMoveSidebarItemToGroup(selectedSidebarGroup.id, it.id, e.target.value)
                          }
                          className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#EA580C]/40 text-[11px] font-bold"
                        >
                          <option value="">نقل لقسم...</option>
                          {roleConfig.sidebar.groups
                            .filter((g) => g.id !== selectedSidebarGroup.id)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.titleAr}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          disabled={iIdx === 0}
                          onClick={() =>
                            handleSidebarItemMoveOrder(selectedSidebarGroup.id, iIdx, iIdx - 1)
                          }
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={iIdx === selectedSidebarGroup.items.length - 1}
                          onClick={() =>
                            handleSidebarItemMoveOrder(selectedSidebarGroup.id, iIdx, iIdx + 1)
                          }
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateRole((r) => ({
                              ...r,
                              sidebar: {
                                ...r.sidebar,
                                groups: r.sidebar.groups.map((g) =>
                                  g.id === selectedSidebarGroup.id
                                    ? {
                                        ...g,
                                        items: g.items.map((x) =>
                                          x.id === it.id ? { ...x, visible: !x.visible } : x
                                        ),
                                      }
                                    : g
                                ),
                              },
                            }))
                          }
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] cursor-pointer"
                        >
                          {it.visible ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: GLOBAL ALL-PAGES BUTTON & CARD OVERRIDES ================= */}
      {studioTab === 'global_elements' && (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black">تعديلات الأسماء والإخفاء المباشر على مستوى جميع الصفحات</h3>
              <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1">
                يمكنك تفعيل وضع «تخصيص الأزرار والبطاقات» في أي وقت من داخل **شموسة (للسوبر أدمن)** أو بالضغط على الزر المباشر هنا لتعديل اسم أي بطاقة أو زر أو إخفائه فوراً.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('alshams_open_ui_customizer'))}
                className="px-3 py-2 rounded-xl bg-[#0C1427] hover:bg-[#132040] text-[#F7F3EA] border border-[#EA580C]/70 text-xs font-black cursor-pointer"
              >
                🎨 تشغيل وضع تخصيص الأزرار والبطاقات الآن
              </button>
              {Object.keys(draft.globalElementOverrides || {}).length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      globalElementOverrides: {},
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  className="px-3 py-2 rounded-xl border border-rose-300 text-rose-600 text-xs font-black hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  مسح كل التعديلات المباشرة
                </button>
              )}
            </div>
          </div>

          {Object.keys(draft.globalElementOverrides || {}).length === 0 ? (
            <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center text-xs text-[#475569] dark:text-[#CBD5E1]">
              لا توجد تعديلات مباشرة محفوظة حالياً. افتح شموسة واضغط «تخصيص الأزرار والبطاقات» (أو اكتب لشموسة «تخصيص الأزرار») لتعديل أو إخفاء أي زر أو بطاقة في أي صفحة.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.values(draft.globalElementOverrides || {}).map((ov) => (
                <div
                  key={ov.key}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#475569] dark:text-[#CBD5E1]">
                      {ov.elementType === 'button' ? 'زر تفاعلي' : 'عنوان بطاقة'}
                      {ov.pageHint ? ` · ${ov.pageHint}` : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => {
                            const next = { ...(prev.globalElementOverrides || {}) };
                            next[ov.key] = {
                              ...ov,
                              hidden: !ov.hidden,
                              updatedAt: new Date().toISOString(),
                            };
                            return { ...prev, globalElementOverrides: next };
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          ov.hidden
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {ov.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{ov.hidden ? 'مخفي' : 'ظاهر'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => {
                            const next = { ...(prev.globalElementOverrides || {}) };
                            delete next[ov.key];
                            return { ...prev, globalElementOverrides: next };
                          })
                        }
                        title="استعادة الافتراضي"
                        className="p-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#475569] dark:text-slate-400">
                    الاسم الأصلي: {ov.originalText}
                  </div>

                  <input
                    type="text"
                    value={ov.customLabel || ''}
                    placeholder={ov.originalText}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const next = { ...(prev.globalElementOverrides || {}) };
                        next[ov.key] = {
                          ...ov,
                          customLabel: e.target.value,
                          updatedAt: new Date().toISOString(),
                        };
                        return { ...prev, globalElementOverrides: next };
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: CRAFT MODE VS ACCOUNTING MODE COMPARISON ================= */}
      {studioTab === 'experience_modes' && (
        <AdminExperienceModePanel
          value={draft.experienceModeConfig}
          onChange={(nextExpCfg) =>
            setDraft((prev) => ({
              ...prev,
              experienceModeConfig: nextExpCfg,
              updatedAt: new Date().toISOString(),
            }))
          }
        />
      )}

      {/* ================= TAB 6: SHAMOUSA & FALCON AI ASSISTANTS LABELS ================= */}
      {studioTab === 'ai_assistants' && (
        <AdminAiAssistantsPanel
          value={draft.aiAssistantsConfig}
          onChange={(nextAiCfg) =>
            setDraft((prev) => ({
              ...prev,
              aiAssistantsConfig: nextAiCfg,
              updatedAt: new Date().toISOString(),
            }))
          }
        />
      )}

      {/* ================= TAB 7: PAGES & CLEAN LINKS CUSTOMIZER ================= */}
      {studioTab === 'pages' && (
        <div className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2 text-[#0C1427] dark:text-[#F7F3EA]">
                <Globe className="w-5 h-5 text-[#EA580C]" />
                <span>إدارة صفحات المنظومة والروابط المباشرة</span>
              </h2>
              <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8] mt-1">
                كل صفحة لها رابط نظيف ومستقل. تقدر تغيّر عنوان أي صفحة، تعدل أو تخفي الهيدلاين والديباجة بضغطة واحدة، وتخصص مسمى الزر الرئيسي.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'artisan', label: 'صفحات الفنانين' },
                  { id: 'supplier', label: 'صفحات الموردين' },
                  { id: 'shared', label: 'المشتركة' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPagesFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                    pagesFilter === f.id
                      ? 'bg-[#EA580C] text-white border-[#EA580C]'
                      : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={pagesSearch}
              onChange={(e) => setPagesSearch(e.target.value)}
              placeholder="ابحث باسم الصفحة أو الرابط (مثل: الخزائن، الخامات، /treasuries)..."
              className="w-full h-10 pr-10 pl-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {APP_PAGE_ROUTES.filter((r) => {
              if (pagesFilter !== 'all' && r.audience !== pagesFilter) return false;
              if (!pagesSearch.trim()) return true;
              const q = pagesSearch.trim().toLowerCase();
              return (
                r.defaultTitle.toLowerCase().includes(q) ||
                r.path.toLowerCase().includes(q) ||
                r.viewId.toLowerCase().includes(q)
              );
            }).map((route) => {
              const ov: PageUiOverrideConfig = draft.pageOverrides?.[route.viewId] || {};
              const updatePageOverride = (patch: Partial<PageUiOverrideConfig>) => {
                setDraft((prev) => {
                  const nextMap = { ...(prev.pageOverrides || {}) };
                  const merged: PageUiOverrideConfig = {
                    ...(nextMap[route.viewId] || {}),
                    ...patch,
                  };
                  if (
                    !merged.title?.trim() &&
                    !merged.subtitle?.trim() &&
                    !merged.hideSubtitle &&
                    !merged.primaryButtonLabel?.trim()
                  ) {
                    delete nextMap[route.viewId];
                  } else {
                    nextMap[route.viewId] = merged;
                  }
                  return {
                    ...prev,
                    pageOverrides: nextMap,
                    updatedAt: new Date().toISOString(),
                  };
                });
              };

              const fullUrl = buildPageUrl(route.viewId);

              return (
                <div
                  key={route.viewId}
                  className="rounded-2xl bg-white dark:bg-[#101B36] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {ov.title || route.defaultTitle}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#475569] dark:text-[#CBD5E1]">
                          {route.audience === 'artisan'
                            ? 'فنانين'
                            : route.audience === 'supplier'
                              ? 'موردين'
                              : route.audience === 'admin'
                                ? 'إدارة'
                                : 'مشتركة'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1" dir="ltr">
                        <code className="text-[11px] font-mono font-bold text-[#EA580C] dark:text-[#FBBF24] bg-[#EA580C]/10 px-2 py-0.5 rounded-md">
                          {route.path}
                        </code>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(fullUrl);
                            setCopiedRouteId(route.viewId);
                            setTimeout(() => setCopiedRouteId(null), 1800);
                          } catch {}
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] hover:border-[#EA580C] border border-transparent text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedRouteId === route.viewId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedRouteId === route.viewId ? 'تم النسخ' : 'نسخ الرابط'}</span>
                      </button>

                      {(ov.title || ov.subtitle || ov.hideSubtitle || ov.primaryButtonLabel) && (
                        <button
                          type="button"
                          title="استعادة افتراضي الصفحة"
                          onClick={() =>
                            updatePageOverride({
                              title: '',
                              subtitle: '',
                              hideSubtitle: false,
                              primaryButtonLabel: '',
                            })
                          }
                          className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                        عنوان الصفحة
                      </label>
                      <input
                        type="text"
                        value={ov.title || ''}
                        placeholder={route.defaultTitle}
                        onChange={(e) => updatePageOverride({ title: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                        تسمية الزر الرئيسي (اختياري)
                      </label>
                      <input
                        type="text"
                        value={ov.primaryButtonLabel || ''}
                        placeholder="مثل: إضافة جديد / تسجيل حركة"
                        onChange={(e) => updatePageOverride({ primaryButtonLabel: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                        الوصف / الهيدلاين تحت العنوان
                      </label>
                      <button
                        type="button"
                        onClick={() => updatePageOverride({ hideSubtitle: !ov.hideSubtitle })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 cursor-pointer border ${
                          ov.hideSubtitle
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E]'
                        }`}
                      >
                        {ov.hideSubtitle ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{ov.hideSubtitle ? 'مخفي (بدون ديباجة)' : 'إخفاء الهيدلاين والديباجة'}</span>
                      </button>
                    </div>
                    {!ov.hideSubtitle && (
                      <input
                        type="text"
                        value={ov.subtitle || ''}
                        placeholder={route.defaultSubtitle || 'وصف مختصر للصفحة...'}
                        onChange={(e) => updatePageOverride({ subtitle: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
