import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Phone, MessageCircle, Globe, X } from 'lucide-react';
import { ArtisanSocialLinksConfig } from '../../types/artisanStoreBuilder';

export interface ActiveSocialChannel {
  key: 'phone' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'website';
  label: string;
  href: string;
  bgClass: string;
  isTel?: boolean;
}

function normalizeUrl(raw: string, baseDomain?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('@') && baseDomain) {
    return `https://${baseDomain}/${trimmed}`;
  }
  if (baseDomain && !trimmed.includes('.')) {
    return `https://${baseDomain}/${trimmed.replace(/^\/+/, '')}`;
  }
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

function formatWaHref(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  const intl = digits.startsWith('0') ? `2${digits}` : digits;
  return `https://wa.me/${intl}`;
}

export function resolveActiveSocialChannels(
  social?: ArtisanSocialLinksConfig | null,
  fallbackPhone?: string
): ActiveSocialChannel[] {
  if (!social) return [];
  const channels: ActiveSocialChannel[] = [];

  const effectivePhone = (social.phone || fallbackPhone || '').trim();
  if (social.showPhone !== false && effectivePhone) {
    channels.push({
      key: 'phone',
      label: 'اتصال هاتفي',
      href: `tel:${effectivePhone.replace(/\s+/g, '')}`,
      bgClass: 'bg-[#0C1427] hover:bg-[#1E293B] text-[#FBBF24]',
      isTel: true,
    });
  }

  const effectiveWa = (social.whatsapp || effectivePhone || '').trim();
  if (social.showWhatsapp !== false && effectiveWa) {
    const waUrl = formatWaHref(effectiveWa);
    if (waUrl) {
      channels.push({
        key: 'whatsapp',
        label: 'واتساب',
        href: waUrl,
        bgClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      });
    }
  }

  if (social.showFacebook !== false && social.facebook?.trim()) {
    channels.push({
      key: 'facebook',
      label: 'فيسبوك',
      href: normalizeUrl(social.facebook, 'facebook.com'),
      bgClass: 'bg-[#1877F2] hover:bg-[#166FE5] text-white',
    });
  }

  if (social.showInstagram !== false && social.instagram?.trim()) {
    channels.push({
      key: 'instagram',
      label: 'إنستجرام',
      href: normalizeUrl(social.instagram, 'instagram.com'),
      bgClass: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white',
    });
  }

  if (social.showTiktok !== false && social.tiktok?.trim()) {
    channels.push({
      key: 'tiktok',
      label: 'تيك توك',
      href: normalizeUrl(social.tiktok, 'tiktok.com'),
      bgClass: 'bg-[#111827] hover:bg-black text-white',
    });
  }

  if (social.showYoutube !== false && social.youtube?.trim()) {
    channels.push({
      key: 'youtube',
      label: 'يوتيوب',
      href: normalizeUrl(social.youtube, 'youtube.com'),
      bgClass: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
    });
  }

  if (social.showWebsite !== false && social.website?.trim()) {
    channels.push({
      key: 'website',
      label: 'الموقع / المعرض',
      href: normalizeUrl(social.website),
      bgClass: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    });
  }

  return channels;
}

const ChannelGlyph: React.FC<{ channelKey: ActiveSocialChannel['key']; className?: string }> = ({
  channelKey,
  className = 'w-4 h-4',
}) => {
  switch (channelKey) {
    case 'phone':
      return <Phone className={className} />;
    case 'whatsapp':
      return <MessageCircle className={className} />;
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.4v8h3.1z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M21.58 7.19a2.75 2.75 0 0 0-1.94-1.95C17.93 4.8 12 4.8 12 4.8s-5.93 0-7.64.44A2.75 2.75 0 0 0 2.42 7.2 28.6 28.6 0 0 0 2 12a28.6 28.6 0 0 0 .42 4.81 2.75 2.75 0 0 0 1.94 1.95c1.71.44 7.64.44 7.64.44s5.93 0 7.64-.44a2.75 2.75 0 0 0 1.94-1.95A28.6 28.6 0 0 0 22 12a28.6 28.6 0 0 0-.42-4.81zM10 15.1V8.9l5.3 3.1-5.3 3.1z" />
        </svg>
      );
    default:
      return <Globe className={className} />;
  }
};

interface ContactBubbleDockProps {
  social?: ArtisanSocialLinksConfig | null;
  fallbackPhone?: string;
  accentHex?: string;
}

export const ContactBubbleDock: React.FC<ContactBubbleDockProps> = ({
  social,
  fallbackPhone,
  accentHex = '#EA580C',
}) => {
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const channels = useMemo(
    () => resolveActiveSocialChannels(social, fallbackPhone),
    [social, fallbackPhone]
  );

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  if (channels.length === 0) return null;

  return (
    <div
      ref={dockRef}
      dir="rtl"
      className="fixed bottom-4 right-4 z-40 flex flex-col items-start gap-2.5 pointer-events-auto"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.78 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col items-start gap-2 pb-1"
          >
            {channels.map((ch, idx) => (
              <motion.a
                key={ch.key}
                href={ch.href}
                target={ch.isTel ? undefined : '_blank'}
                rel={ch.isTel ? undefined : 'noreferrer'}
                onClick={() => {
                  setOpen(false);
                }}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 20, scale: 0.4 }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: shouldReduceMotion
                    ? { duration: 0.1 }
                    : {
                        type: 'spring',
                        stiffness: 430,
                        damping: 22,
                        delay: (channels.length - 1 - idx) * 0.04,
                      },
                }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: 16,
                        scale: 0.35,
                        transition: { duration: 0.14, delay: idx * 0.025 },
                      }
                }
                whileHover={shouldReduceMotion ? undefined : { scale: 1.07 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border border-white/25 text-xs font-black transition-shadow cursor-pointer ${ch.bgClass}`}
                title={ch.label}
              >
                <ChannelGlyph channelKey={ch.key} className="w-4 h-4 shrink-0" />
                <span>{ch.label}</span>
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pouch / Basket Trigger Button ("تواصل معي") */}
      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
        style={{ backgroundColor: open ? '#0C1427' : accentHex }}
        className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-white font-black text-[11px] sm:text-xs shadow-lg border border-white/25 flex items-center gap-1.5 sm:gap-2 cursor-pointer"
        aria-expanded={open}
        aria-label={social?.bubbleLabel || 'تواصل معي'}
      >
        {open ? (
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FBBF24] shrink-0" />
        ) : (
          <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        )}
        <span>{open ? 'إغلاق' : social?.bubbleLabel || 'تواصل معي'}</span>
      </motion.button>
    </div>
  );
};

export const ArtisanFooterContacts: React.FC<{
  social?: ArtisanSocialLinksConfig | null;
  fallbackPhone?: string;
}> = ({ social, fallbackPhone }) => {
  const channels = useMemo(
    () => resolveActiveSocialChannels(social, fallbackPhone),
    [social, fallbackPhone]
  );

  if (channels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {channels.map((ch) => (
        <a
          key={ch.key}
          href={ch.href}
          target={ch.isTel ? undefined : '_blank'}
          rel={ch.isTel ? undefined : 'noreferrer'}
          title={ch.label}
          aria-label={ch.label}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xs transition active:scale-95 ${ch.bgClass}`}
        >
          <ChannelGlyph channelKey={ch.key} className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{ch.label}</span>
        </a>
      ))}
    </div>
  );
};
