import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Hammer,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import { PlatformFeatureFlags } from '../../types/featureFlags';
import {
  DiscoveryRoleId,
  LandingExperienceCopy,
  SupplierBusinessTypeId,
  SupplierSuiteTabId,
} from './landingExperienceData';

interface AccentClasses {
  primaryBtn: string;
  primaryText: string;
  primaryBorder: string;
  softSurface: string;
  activeTab: string;
}

interface GuidedDiscoverySectionProps {
  copy: LandingExperienceCopy['discovery'];
  isRTL: boolean;
  isObsidianPreset: boolean;
  surfaceCardClass: string;
  mutedTextClass: string;
  dividerBorderClass: string;
  accent: AccentClasses;
  flags: PlatformFeatureFlags;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenRegisterSupplier?: () => void;
  onOpenMarketplace: () => void;
  onOpenSuppliersMarket: () => void;
  onStartBeginner: () => void;
  onExploreExpertInFamily: () => void;
  onExploreFamily: () => void;
}

const ROLE_ICON_MAP: Record<DiscoveryRoleId, React.ComponentType<{ className?: string }>> = {
  artisan: Hammer,
  supplier: Truck,
  customer: ShoppingBag,
  beginner: Sparkles,
  expert: GraduationCap,
};

export const GuidedDiscoverySection: React.FC<GuidedDiscoverySectionProps> = ({
  copy,
  isRTL,
  isObsidianPreset,
  surfaceCardClass,
  mutedTextClass,
  dividerBorderClass,
  accent,
  flags,
  onOpenLogin,
  onOpenRegister,
  onOpenRegisterSupplier,
  onOpenMarketplace,
  onOpenSuppliersMarket,
  onStartBeginner,
  onExploreExpertInFamily,
  onExploreFamily,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const DirectionalArrow = isRTL ? ArrowLeft : ArrowRight;

  // Filter roles cleanly so disabled features aren't promoted falsely
  const visibleRoles = copy.roles.filter((r) => {
    if (r.id === 'supplier' && !flags.supplierLandingPromoEnabled && !flags.supplierRegistrationEnabled) {
      return false;
    }
    if (r.id === 'customer' && !flags.artisanMarketplaceEnabled && !flags.suppliersMarketplaceEnabled) {
      return false;
    }
    return true;
  });

  const [selectedRole, setSelectedRole] = useState<DiscoveryRoleId | null>(null);

  // Per-role interactive progressive sub-choices
  const [artisanFocusId, setArtisanFocusId] = useState<string>(copy.artisan.subOptions[0].id);
  const [supplierBizType, setSupplierBizType] = useState<SupplierBusinessTypeId>('branch_chain');
  const [supplierSuiteTab, setSupplierSuiteTab] = useState<SupplierSuiteTabId>('branches');
  const [customerFocusId, setCustomerFocusId] = useState<string>(copy.customer.subOptions[0].id);
  const [beginnerFocusId, setBeginnerFocusId] = useState<string>(copy.beginner.subOptions[0].id);
  const [expertFocusId, setExpertFocusId] = useState<string>(copy.expert.subOptions[0].id);

  const subtleBoxClass = isObsidianPreset
    ? 'bg-[#091124] border-[#21335C]'
    : 'bg-[#EFE9DC]/70 dark:bg-[#091124] border-[#D4CCBC] dark:border-[#22355E]';

  const activeArtisanOption =
    copy.artisan.subOptions.find((o) => o.id === artisanFocusId) || copy.artisan.subOptions[0];
  const activeSupplierBiz =
    copy.supplier.businessTypes.find((b) => b.id === supplierBizType) || copy.supplier.businessTypes[1];
  const activeSupplierSuite =
    copy.supplier.suites.find((s) => s.id === supplierSuiteTab) || copy.supplier.suites[0];
  const activeCustomerOption =
    copy.customer.subOptions.find((o) => o.id === customerFocusId) || copy.customer.subOptions[0];
  const activeBeginnerOption =
    copy.beginner.subOptions.find((o) => o.id === beginnerFocusId) || copy.beginner.subOptions[0];
  const activeExpertOption =
    copy.expert.subOptions.find((o) => o.id === expertFocusId) || copy.expert.subOptions[0];

  return (
    <section id="guided-discovery" className={`py-16 sm:py-24 border-b ${dividerBorderClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Section Header + Step Indicator */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-3xl space-y-3">
            <p className={`text-xs sm:text-sm font-extrabold ${accent.primaryText}`}>{copy.eyebrow}</p>
            <h2 className="text-2xl sm:text-4xl font-black leading-tight [text-wrap:balance]">
              {copy.questionTitle}
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${mutedTextClass}`}>
              {copy.questionSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                !selectedRole ? `${accent.activeTab} border-transparent` : surfaceCardClass
              }`}
            >
              {copy.step1Label}
            </span>
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                selectedRole ? `${accent.activeTab} border-transparent` : `${surfaceCardClass} opacity-65`
              }`}
            >
              {copy.step2Label}
            </span>
          </div>
        </div>

        {/* Step 1: 5 Interactive Role Selectors (Always accessible to switch quickly) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {visibleRoles.map((role, idx) => {
            const RoleIcon = ROLE_ICON_MAP[role.id];
            const isSelected = selectedRole === role.id;
            return (
              <motion.button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                className={`text-start rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0C1427] text-[#F7F3EA] border-[#EA580C] shadow-xl ring-2 ring-[#EA580C]/25'
                    : `${surfaceCardClass} hover:border-[#EA580C]/70 hover:shadow-md`
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#EA580C] text-white' : `${accent.softSurface} ${accent.primaryText}`
                    }`}
                  >
                    <RoleIcon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[11px] font-mono font-black tabular-nums ${
                      isSelected ? 'text-[#FBBF24]' : 'opacity-40'
                    }`}
                  >
                    0{idx + 1}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span
                    className={`block text-[11px] font-extrabold ${
                      isSelected ? 'text-[#FBBF24]' : accent.primaryText
                    }`}
                  >
                    {role.badge}
                  </span>
                  <h3 className="text-sm sm:text-[15px] font-black leading-snug">{role.title}</h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      isSelected ? 'text-[#CBD5E1]' : mutedTextClass
                    }`}
                  >
                    {role.shortDesc}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Step 2: Dynamic Progressive Journey Panel */}
        <AnimatePresence mode="wait">
          {selectedRole ? (
            <motion.div
              key={selectedRole}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className={`rounded-3xl border p-5 sm:p-8 shadow-lg space-y-7 ${surfaceCardClass} ${accent.primaryBorder}`}
            >
              {/* Top Role Bar + Back / Change Choice Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D4CCBC]/70 dark:border-[#22355E]">
                <div className="flex items-center gap-2.5">
                  {(() => {
                    const ActiveIcon = ROLE_ICON_MAP[selectedRole];
                    const activeMeta = visibleRoles.find((r) => r.id === selectedRole);
                    return (
                      <>
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent.activeTab}`}
                        >
                          <ActiveIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className={`text-[11px] font-extrabold block ${accent.primaryText}`}>
                            {activeMeta?.badge}
                          </span>
                          <span className="text-sm sm:text-base font-black">{activeMeta?.title}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="px-3.5 py-2 rounded-xl border border-[#C9BFA9] dark:border-[#2A3F6E] text-xs font-black inline-flex items-center gap-1.5 hover:border-[#EA580C] transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{copy.changeRoleBtn}</span>
                </button>
              </div>

              {/* ==================== PATH 1: ARTISAN & WORKSHOP ==================== */}
              {selectedRole === 'artisan' && (
                <div className="space-y-7">
                  <div className="space-y-2 max-w-4xl">
                    <h3 className="text-xl sm:text-2xl font-black leading-snug">
                      {copy.artisan.headline}
                    </h3>
                    <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{copy.artisan.intro}</p>
                  </div>

                  {/* End-to-End Cycle Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {copy.artisan.cycleStrip.map((step, i) => (
                      <div key={step} className={`rounded-xl border p-3 space-y-1 ${subtleBoxClass}`}>
                        <span className={`text-[11px] font-mono font-black ${accent.primaryText}`}>
                          0{i + 1}
                        </span>
                        <span className="block text-xs font-black leading-snug">{step}</span>
                      </div>
                    ))}
                  </div>

                  {/* Progressive Sub-Question */}
                  <div className="space-y-3">
                    <p className="text-sm font-black">{copy.artisan.subQuestion}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {copy.artisan.subOptions.map((opt) => {
                        const active = opt.id === activeArtisanOption.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setArtisanFocusId(opt.id)}
                            className={`rounded-2xl border p-3.5 text-start transition cursor-pointer ${
                              active
                                ? `${accent.activeTab} border-transparent shadow-sm`
                                : `${subtleBoxClass} hover:border-[#EA580C]`
                            }`}
                          >
                            <span className="block text-xs sm:text-sm font-black">{opt.label}</span>
                            <span
                              className={`block text-[11px] mt-1 ${
                                active ? 'text-white/90' : mutedTextClass
                              }`}
                            >
                              {opt.shortHint}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`rounded-2xl border p-5 space-y-3 ${subtleBoxClass}`}>
                      <p className="text-sm font-bold leading-relaxed">
                        {activeArtisanOption.recommendedSummary}
                      </p>
                      <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {activeArtisanOption.highlightedBullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-xs font-bold leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Full 16-Item Capability Map */}
                  <div className="space-y-3">
                    <h4 className="text-xs sm:text-sm font-black">{copy.artisan.allCapabilitiesTitle}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {copy.artisan.allCapabilities.map((cap) => (
                        <div
                          key={cap}
                          className={`rounded-xl border px-3 py-2.5 text-xs font-bold flex items-center gap-2 ${subtleBoxClass}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                    <p className={`text-xs leading-relaxed max-w-2xl ${mutedTextClass}`}>
                      {copy.artisan.storeNote}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={onOpenRegister}
                        className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                      >
                        <span>{copy.artisan.primaryCta}</span>
                        <DirectionalArrow className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="px-4 py-3.5 rounded-xl text-xs sm:text-sm font-black border border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C] transition cursor-pointer"
                      >
                        {copy.artisan.secondaryCta}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== PATH 2: SUPPLIER, MERCHANT & FACTORY (FULL ERP/POS DEPTH) ==================== */}
              {selectedRole === 'supplier' && (
                <div className="space-y-7">
                  <div className="space-y-2 max-w-4xl">
                    <h3 className="text-xl sm:text-2xl font-black leading-snug">
                      {copy.supplier.headline}
                    </h3>
                    <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{copy.supplier.intro}</p>
                  </div>

                  {/* Step 2A: Business Nature Selector (5 Exact Types) */}
                  <div className="space-y-3">
                    <p className="text-sm font-black flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${accent.primaryText}`} />
                      <span>{copy.supplier.businessTypeQuestion}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {copy.supplier.businessTypes.map((bt) => {
                        const active = bt.id === activeSupplierBiz.id;
                        return (
                          <button
                            key={bt.id}
                            type="button"
                            onClick={() => setSupplierBizType(bt.id)}
                            className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-black transition cursor-pointer ${
                              active
                                ? `${accent.activeTab} border-transparent shadow-xs`
                                : `${subtleBoxClass} hover:border-[#EA580C]`
                            }`}
                          >
                            {bt.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className={`rounded-2xl border p-4 text-xs sm:text-sm font-bold leading-relaxed ${subtleBoxClass}`}>
                      <span className={`${accent.primaryText} font-black`}>
                        {activeSupplierBiz.label}:{' '}
                      </span>
                      {activeSupplierBiz.tailoredNote}
                    </div>
                  </div>

                  {/* Step 2B: Interactive 4-Suite Deep Explorer */}
                  <div className="space-y-4">
                    <p className="text-sm font-black">{copy.supplier.suitePrompt}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {copy.supplier.suites.map((suite) => {
                        const active = suite.id === activeSupplierSuite.id;
                        return (
                          <button
                            key={suite.id}
                            type="button"
                            onClick={() => setSupplierSuiteTab(suite.id)}
                            className={`px-4 py-3 rounded-2xl border text-start text-xs sm:text-[13px] font-black transition cursor-pointer ${
                              active
                                ? 'bg-[#0C1427] text-white border-[#EA580C] shadow-sm'
                                : `${subtleBoxClass} hover:border-[#EA580C]`
                            }`}
                          >
                            {suite.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${subtleBoxClass}`}>
                      <div className="space-y-1">
                        <h4 className="text-base sm:text-lg font-black">{activeSupplierSuite.title}</h4>
                        <p className={`text-xs sm:text-sm ${mutedTextClass}`}>
                          {activeSupplierSuite.summary}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activeSupplierSuite.items.map((item) => (
                          <div
                            key={item}
                            className="flex items-start gap-2 text-xs sm:text-[13px] font-bold leading-relaxed"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      {/* POS Financial Custody Chain Visual (shown prominently when POS tab is active) */}
                      {activeSupplierSuite.id === 'pos' && (
                        <div className="pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E] space-y-2.5">
                          <p className={`text-xs font-black ${accent.primaryText}`}>
                            {copy.supplier.posCustodyTitle}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                            {copy.supplier.posCustodySteps.map((st, idx) => (
                              <div
                                key={st}
                                className="rounded-xl bg-[#0C1427] text-[#F7F3EA] border border-[#243763] p-3 space-y-1"
                              >
                                <span className="text-[11px] font-mono font-black text-[#FBBF24]">
                                  0{idx + 1}
                                </span>
                                <span className="block text-[11px] font-bold leading-snug">{st}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3 Supplier Customer Segments */}
                      {activeSupplierSuite.id === 'customers_store' && (
                        <div className="pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E] space-y-2.5">
                          <p className={`text-xs font-black ${accent.primaryText}`}>
                            {copy.supplier.customerTypesTitle}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {copy.supplier.customerTypes.map((ct) => (
                              <div
                                key={ct.title}
                                className={`rounded-xl border p-3.5 space-y-1 ${surfaceCardClass}`}
                              >
                                <span className="block text-xs font-black">{ct.title}</span>
                                <span className={`block text-[11px] leading-relaxed ${mutedTextClass}`}>
                                  {ct.desc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                    <p className={`text-xs leading-relaxed max-w-2xl ${mutedTextClass}`}>
                      {copy.supplier.storeRelationNote}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {flags.supplierRegistrationEnabled && (
                        <button
                          type="button"
                          onClick={onOpenRegisterSupplier || onOpenRegister}
                          className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                        >
                          <Truck className="w-4 h-4" />
                          <span>{copy.supplier.primaryCta}</span>
                          <DirectionalArrow className="w-4 h-4" />
                        </button>
                      )}
                      {flags.suppliersMarketplaceEnabled && (
                        <button
                          type="button"
                          onClick={onOpenSuppliersMarket}
                          className="px-4 py-3.5 rounded-xl text-xs sm:text-sm font-black border border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C] transition cursor-pointer"
                        >
                          {copy.supplier.secondaryMarketCta}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== PATH 3: CUSTOMER ==================== */}
              {selectedRole === 'customer' && (
                <div className="space-y-6">
                  <div className="space-y-2 max-w-3xl">
                    <h3 className="text-xl sm:text-2xl font-black leading-snug">
                      {copy.customer.headline}
                    </h3>
                    <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{copy.customer.intro}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-black">{copy.customer.subQuestion}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {copy.customer.subOptions
                        .filter((opt) =>
                          opt.id === 'raw_materials' ? flags.suppliersMarketplaceEnabled : true
                        )
                        .map((opt) => {
                          const active = opt.id === activeCustomerOption.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setCustomerFocusId(opt.id)}
                              className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
                                active
                                  ? `${accent.activeTab} border-transparent shadow-sm`
                                  : `${subtleBoxClass} hover:border-[#EA580C]`
                              }`}
                            >
                              <span className="block text-xs sm:text-sm font-black">{opt.label}</span>
                              <span
                                className={`block text-[11px] mt-1 ${
                                  active ? 'text-white/90' : mutedTextClass
                                }`}
                              >
                                {opt.shortHint}
                              </span>
                            </button>
                          );
                        })}
                    </div>

                    <div className={`rounded-2xl border p-5 space-y-3 ${subtleBoxClass}`}>
                      <p className="text-sm font-bold leading-relaxed">
                        {activeCustomerOption.recommendedSummary}
                      </p>
                      <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {activeCustomerOption.highlightedBullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-xs font-bold leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {flags.artisanMarketplaceEnabled && (
                      <button
                        type="button"
                        onClick={onOpenMarketplace}
                        className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                      >
                        <Store className="w-4 h-4" />
                        <span>{copy.customer.primaryMarketCta}</span>
                        <DirectionalArrow className="w-4 h-4" />
                      </button>
                    )}
                    {flags.suppliersMarketplaceEnabled && (
                      <button
                        type="button"
                        onClick={onOpenSuppliersMarket}
                        className="px-5 py-3.5 rounded-xl text-xs sm:text-sm font-black border border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C] inline-flex items-center gap-2 transition cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>{copy.customer.secondarySuppliersCta}</span>
                      </button>
                    )}
                    {!flags.artisanMarketplaceEnabled && !flags.suppliersMarketplaceEnabled && (
                      <p className={`text-xs font-bold ${mutedTextClass}`}>
                        {copy.customer.marketDisabledNote}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== PATH 4: BEGINNER & TALENT ==================== */}
              {selectedRole === 'beginner' && (
                <div className="space-y-6">
                  <div className="space-y-2 max-w-3xl">
                    <h3 className="text-xl sm:text-2xl font-black leading-snug">
                      {copy.beginner.headline}
                    </h3>
                    <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{copy.beginner.intro}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-black">{copy.beginner.subQuestion}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {copy.beginner.subOptions.map((opt) => {
                        const active = opt.id === activeBeginnerOption.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setBeginnerFocusId(opt.id)}
                            className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
                              active
                                ? `${accent.activeTab} border-transparent shadow-sm`
                                : `${subtleBoxClass} hover:border-[#EA580C]`
                            }`}
                          >
                            <span className="block text-xs sm:text-sm font-black">{opt.label}</span>
                            <span
                              className={`block text-[11px] mt-1 ${
                                active ? 'text-white/90' : mutedTextClass
                              }`}
                            >
                              {opt.shortHint}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`rounded-2xl border p-5 space-y-3 ${subtleBoxClass}`}>
                      <p className="text-sm font-bold leading-relaxed">
                        {activeBeginnerOption.recommendedSummary}
                      </p>
                      <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {activeBeginnerOption.highlightedBullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-xs font-bold leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onStartBeginner}
                      className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{copy.beginner.primaryCta}</span>
                      <DirectionalArrow className="w-4 h-4" />
                    </button>
                    {flags.familyCommunityEnabled && (
                      <button
                        type="button"
                        onClick={onExploreFamily}
                        className="px-5 py-3.5 rounded-xl text-xs sm:text-sm font-black border border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C] inline-flex items-center gap-2 transition cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        <span>{copy.beginner.secondaryCta}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== PATH 5: EXPERT & TRAINER ==================== */}
              {selectedRole === 'expert' && (
                <div className="space-y-6">
                  <div className="space-y-2 max-w-3xl">
                    <h3 className="text-xl sm:text-2xl font-black leading-snug">
                      {copy.expert.headline}
                    </h3>
                    <p className={`text-sm leading-relaxed ${mutedTextClass}`}>{copy.expert.intro}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-black">{copy.expert.subQuestion}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {copy.expert.subOptions.map((opt) => {
                        const active = opt.id === activeExpertOption.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setExpertFocusId(opt.id)}
                            className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
                              active
                                ? `${accent.activeTab} border-transparent shadow-sm`
                                : `${subtleBoxClass} hover:border-[#EA580C]`
                            }`}
                          >
                            <span className="block text-xs sm:text-sm font-black">{opt.label}</span>
                            <span
                              className={`block text-[11px] mt-1 ${
                                active ? 'text-white/90' : mutedTextClass
                              }`}
                            >
                              {opt.shortHint}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`rounded-2xl border p-5 space-y-3 ${subtleBoxClass}`}>
                      <p className="text-sm font-bold leading-relaxed">
                        {activeExpertOption.recommendedSummary}
                      </p>
                      <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {activeExpertOption.highlightedBullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-xs font-bold leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem('alshams_pending_skill_level', 'expert_trainer');
                        } catch {}
                        onOpenRegister();
                      }}
                      className={`px-6 py-3.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition cursor-pointer shadow-xs ${accent.primaryBtn}`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>{copy.expert.primaryCta}</span>
                      <DirectionalArrow className="w-4 h-4" />
                    </button>
                    {flags.familyCommunityEnabled && (
                      <button
                        type="button"
                        onClick={onExploreExpertInFamily}
                        className="px-5 py-3.5 rounded-xl text-xs sm:text-sm font-black border border-[#C9BFA9] dark:border-[#2A3F6E] hover:border-[#EA580C] inline-flex items-center gap-2 transition cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        <span>{copy.expert.secondaryCta}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="discovery-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`rounded-2xl border border-dashed p-5 sm:p-6 text-center ${subtleBoxClass}`}
            >
              <p className={`text-xs sm:text-sm font-bold ${mutedTextClass}`}>
                {isRTL
                  ? 'اضغط على أي بطاقة من الأعلى (فنان / مورد / عميل / مبتدئ / خبير) لتفتح لك رحلتك التفاعلية المخصصة فوراً.'
                  : 'Click any of the 5 role cards above (Artisan / Supplier / Customer / Beginner / Expert) to launch your tailored interactive journey.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
