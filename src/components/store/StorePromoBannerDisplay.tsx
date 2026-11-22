import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Copy, Check, Megaphone, Sparkles, Tag } from 'lucide-react';
import { ArtisanStorePromoBanner } from '../../types/artisanStoreBuilder';
import { MarketCouponConfig } from '../../types/marketplaceBuilder';

interface StorePromoBannerDisplayProps {
  banner?: ArtisanStorePromoBanner | null;
  currencySymbol?: string;
  coupons?: Array<
    Pick<MarketCouponConfig, 'code' | 'type' | 'value' | 'active' | 'showInBanner' | 'buyQty' | 'freeQty' | 'description'>
  >;
  compactPreview?: boolean;
  onSelectCouponCode?: (code: string) => void;
}

export const StorePromoBannerDisplay: React.FC<StorePromoBannerDisplayProps> = ({
  banner,
  currencySymbol = 'ج.م',
  coupons = [],
  compactPreview = false,
  onSelectCouponCode,
}) => {
  const [remainingMs, setRemainingMs] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const messages = useMemo(() => {
    if (!banner) return [];
    const list: string[] = [];
    if (banner.text?.trim()) list.push(banner.text.trim());
    if (Array.isArray(banner.extraMessages)) {
      banner.extraMessages.forEach((m) => {
        if (m && m.trim()) list.push(m.trim());
      });
    }
    return list;
  }, [banner]);

  const activeBannerCoupons = useMemo(() => {
    if (!banner?.showActiveCouponsInBanner) return [];
    return coupons.filter((c) => c.active && c.showInBanner !== false && c.code?.trim());
  }, [banner?.showActiveCouponsInBanner, coupons]);

  useEffect(() => {
    if (!banner?.enabled || banner.triggerType !== 'limited_time' || !banner.endsAt) {
      setRemainingMs(0);
      return;
    }
    const calc = () => {
      const target = new Date(banner.endsAt!).getTime();
      if (!Number.isFinite(target)) {
        setRemainingMs(0);
        return;
      }
      setRemainingMs(Math.max(0, target - Date.now()));
    };
    calc();
    const timer = window.setInterval(calc, 1000);
    return () => window.clearInterval(timer);
  }, [banner?.enabled, banner?.triggerType, banner?.endsAt]);

  const motionMode = banner?.motionMode || 'marquee';
  const orientation = banner?.orientation || 'horizontal';
  const direction = banner?.direction || (orientation === 'vertical' ? 'up' : 'rtl');
  const speed = banner?.speed || 'normal';

  const durationSec = speed === 'fast' ? 14 : speed === 'slow' ? 36 : 24;
  const slideIntervalMs = speed === 'fast' ? 2800 : speed === 'slow' ? 6000 : 4200;

  useEffect(() => {
    if (!banner?.enabled) return;
    if (motionMode !== 'slide' && motionMode !== 'vertical_ticker') return;
    if (messages.length <= 1) return;
    const t = window.setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % messages.length);
    }, slideIntervalMs);
    return () => window.clearInterval(t);
  }, [banner?.enabled, motionMode, messages.length, slideIntervalMs]);

  if (!banner?.enabled || messages.length === 0) return null;

  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
    } catch {}
    setCopiedCode(code);
    onSelectCouponCode?.(code);
    window.setTimeout(() => setCopiedCode(null), 1800);
  };

  const formatCouponBadge = (
    c: Pick<MarketCouponConfig, 'code' | 'type' | 'value' | 'buyQty' | 'freeQty'>
  ) => {
    if (c.type === 'free_shipping') return `${c.code} · شحن مجاني`;
    if (c.type === 'bogo') return `${c.code} · اشتري ${c.buyQty || 2} + ${c.freeQty || 1} مجاناً`;
    if (c.type === 'fixed') return `${c.code} · خصم ${c.value} ${currencySymbol}`;
    return `${c.code} · خصم ${c.value}%`;
  };

  const countdownNode =
    banner.triggerType === 'limited_time' && remainingMs > 0 ? (
      <div
        className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[11px] font-black bg-black/30 px-2.5 py-1 rounded-lg shrink-0"
        dir="ltr"
      >
        <Clock className="w-3.5 h-3.5" />
        <span>
          {String(Math.floor(remainingMs / 86400000)).padStart(2, '0')}d :{' '}
          {String(Math.floor((remainingMs % 86400000) / 3600000)).padStart(2, '0')}h :{' '}
          {String(Math.floor((remainingMs % 3600000) / 60000)).padStart(2, '0')}m :{' '}
          {String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}s
        </span>
      </div>
    ) : banner.triggerType === 'min_order' && Number(banner.minOrderAmount) > 0 ? (
      <span className="px-2.5 py-1 rounded-lg bg-black/30 text-[11px] font-black shrink-0 tabular-nums">
        للطلبات فوق {Number(banner.minOrderAmount).toLocaleString('ar-EG')} {currencySymbol}
      </span>
    ) : null;

  const couponsRowNode =
    activeBannerCoupons.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {activeBannerCoupons.slice(0, 4).map((cpn) => (
          <button
            key={cpn.code}
            type="button"
            onClick={() => handleCopyCode(cpn.code)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/18 hover:bg-white/28 border border-white/25 text-[10px] font-black cursor-pointer transition active:scale-95"
            title="اضغط لنسخ كود الخصم"
          >
            <Tag className="w-3 h-3 shrink-0" />
            <span className="font-mono">{formatCouponBadge(cpn)}</span>
            {copiedCode === cpn.code ? (
              <Check className="w-3 h-3 text-emerald-300" />
            ) : (
              <Copy className="w-2.5 h-2.5 opacity-80" />
            )}
          </button>
        ))}
      </div>
    ) : null;

  // VERTICAL CARD / VERTICAL TICKER ORIENTATION
  if (orientation === 'vertical' || motionMode === 'vertical_ticker') {
    const verticalTrackClass =
      direction === 'down' ? 'alshams-marquee-track-down' : 'alshams-marquee-track-up';
    const isAnimatedVertical = motionMode !== 'static';

    return (
      <div className={compactPreview ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 pt-3'}>
        <div
          style={{ backgroundColor: banner.bgColor || '#C2410C' }}
          className="text-white rounded-2xl border border-black/15 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-black/25 flex items-center justify-center shrink-0">
                  <Megaphone className="w-3.5 h-3.5" />
                </span>
                {banner.showDiscountLabel && banner.discountLabel && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-black/30 font-black text-[11px]">
                    {banner.discountLabel}
                  </span>
                )}
              </div>
              {countdownNode}
            </div>

            {isAnimatedVertical && motionMode === 'marquee' ? (
              <div className="alshams-marquee-viewport h-16 flex items-center">
                <div
                  className={verticalTrackClass}
                  style={{ ['--marquee-duration' as any]: `${Math.max(10, Math.round(durationSec * 0.75))}s` }}
                >
                  {[...messages, ...messages].map((msg, idx) => (
                    <div key={idx} className="text-xs sm:text-sm font-black leading-relaxed">
                      ✨ {msg}
                    </div>
                  ))}
                </div>
              </div>
            ) : isAnimatedVertical && motionMode === 'vertical_ticker' ? (
              <div className="min-h-[42px] flex flex-col justify-center transition-all duration-500">
                <p
                  key={slideIdx}
                  className="text-xs sm:text-sm font-black leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {messages[slideIdx % messages.length]}
                </p>
                {banner.showSubText && banner.subText && (
                  <p className="text-[11px] opacity-90 mt-0.5">{banner.subText}</p>
                )}
                {messages.length > 1 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    {messages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSlideIdx(idx)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === slideIdx % messages.length ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                        }`}
                        aria-label={`عرض ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, idx) => (
                  <p key={idx} className="text-xs sm:text-sm font-black leading-relaxed">
                    {messages.length > 1 ? `• ${msg}` : msg}
                  </p>
                ))}
                {banner.showSubText && banner.subText && (
                  <p className="text-[11px] opacity-90">{banner.subText}</p>
                )}
              </div>
            )}

            {couponsRowNode}
          </div>
        </div>
      </div>
    );
  }

  // HORIZONTAL MARQUEE (SMOOTH CONTINUOUS SCROLL — NEVER TRUNCATES LONG TEXT!)
  if (motionMode === 'marquee') {
    const marqueeClass =
      direction === 'ltr' ? 'alshams-marquee-track alshams-marquee-track-ltr' : 'alshams-marquee-track';

    const tickerUnit = (
      <div className="inline-flex items-center gap-4">
        {banner.showDiscountLabel && banner.discountLabel && (
          <span className="px-2 py-0.5 rounded-md bg-black/30 font-black text-[11px] shrink-0">
            {banner.discountLabel}
          </span>
        )}
        {messages.map((msg, idx) => (
          <span key={idx} className="inline-flex items-center gap-2 font-black text-xs">
            <Sparkles className="w-3.5 h-3.5 opacity-90 shrink-0" />
            <span>{msg}</span>
          </span>
        ))}
        {banner.showSubText && banner.subText && (
          <span className="opacity-90 text-[11px] font-bold">· {banner.subText}</span>
        )}
      </div>
    );

    return (
      <div
        style={{ backgroundColor: banner.bgColor || '#C2410C' }}
        className={`text-white border-b border-black/15 ${compactPreview ? 'rounded-2xl overflow-hidden' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div className="alshams-marquee-viewport flex-1 min-w-0 py-0.5">
              <div
                className={marqueeClass}
                style={{ ['--marquee-duration' as any]: `${durationSec}s` }}
              >
                {tickerUnit}
                <span className="opacity-50">✦</span>
                {tickerUnit}
              </div>
            </div>
            {countdownNode}
          </div>
          {couponsRowNode && <div className="flex justify-center sm:justify-start">{couponsRowNode}</div>}
        </div>
      </div>
    );
  }

  // HORIZONTAL SLIDE CAROUSEL (CYCLING OFFERS FROM LEFT OR RIGHT)
  if (motionMode === 'slide') {
    const slideAnimClass =
      direction === 'ltr'
        ? 'animate-in fade-in slide-in-from-left-4 duration-300'
        : 'animate-in fade-in slide-in-from-right-4 duration-300';

    return (
      <div
        style={{ backgroundColor: banner.bgColor || '#C2410C' }}
        className={`text-white border-b border-black/15 px-4 py-2.5 ${compactPreview ? 'rounded-2xl overflow-hidden' : ''}`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            {banner.showDiscountLabel && banner.discountLabel && (
              <span className="px-2 py-0.5 rounded-md bg-black/25 font-black text-[11px] shrink-0">
                {banner.discountLabel}
              </span>
            )}
            <span key={slideIdx} className={`font-black leading-relaxed ${slideAnimClass}`}>
              {messages[slideIdx % messages.length]}
            </span>
            {banner.showSubText && banner.subText && (
              <span className="opacity-90 text-[11px]">· {banner.subText}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {couponsRowNode}
            {countdownNode}
            {messages.length > 1 && (
              <div className="flex items-center gap-1">
                {messages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSlideIdx(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === slideIdx % messages.length ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                    aria-label={`رسالة ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // STATIC HORIZONTAL BANNER (WRAPS CLEANLY SO LONG TEXT IS NEVER CUT OFF!)
  return (
    <div
      style={{ backgroundColor: banner.bgColor || '#C2410C' }}
      className={`text-white border-b border-black/15 px-4 py-2.5 ${compactPreview ? 'rounded-2xl overflow-hidden' : ''}`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {banner.showDiscountLabel && banner.discountLabel && (
            <span className="px-2 py-0.5 rounded-md bg-black/25 font-black text-[11px] shrink-0">
              {banner.discountLabel}
            </span>
          )}
          <span className="font-black leading-relaxed whitespace-normal break-words">
            {messages.join('  ·  ')}
          </span>
          {banner.showSubText && banner.subText && (
            <span className="opacity-90 text-[11px] whitespace-normal">· {banner.subText}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {couponsRowNode}
          {countdownNode}
        </div>
      </div>
    </div>
  );
};
