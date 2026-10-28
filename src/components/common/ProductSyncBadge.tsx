import React, { useEffect, useState } from 'react';
import { CloudOff, CloudUpload, Cloud, AlertTriangle } from 'lucide-react';
import { PRODUCTS_SYNC_EVENT, PRODUCTS_DIRTY_EVENT, pendingCount, type SyncState } from '../../db/productSyncQueue';
import { syncProductsNow } from '../../db/productsCloud';

/** شارة صغيرة توضح حالة رفع المنتجات للداتا بيز (أوفلاين / بيرفع / متزامن) */
export const ProductSyncBadge: React.FC<{ workshopId: string }> = ({ workshopId }) => {
  const [pending, setPending] = useState(() => pendingCount(workshopId));
  const [state, setState] = useState<SyncState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'idle'
  );

  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.workshopId !== workshopId) return;
      setState(d.state);
      setPending(d.pending);
    };
    const refresh = () => setPending(pendingCount(workshopId));
    const onOffline = () => setState('offline');
    const onOnline = () => setState('idle');
    window.addEventListener(PRODUCTS_SYNC_EVENT, onStatus);
    window.addEventListener(PRODUCTS_DIRTY_EVENT, refresh);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(PRODUCTS_SYNC_EVENT, onStatus);
      window.removeEventListener(PRODUCTS_DIRTY_EVENT, refresh);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [workshopId]);

  if (!workshopId) return null;

  let cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let icon = <Cloud size={14} />;
  let label = 'منتجاتك متزامنة مع السحابة';
  if (state === 'offline') {
    cls = 'bg-amber-50 text-amber-800 border-amber-200';
    icon = <CloudOff size={14} />;
    label = pending > 0 ? `أوفلاين — ${pending} منتج محفوظ على جهازك وهيترفع أول ما النت يرجع` : 'أوفلاين — الحفظ شغال على جهازك';
  } else if (state === 'syncing') {
    cls = 'bg-sky-50 text-sky-700 border-sky-200';
    icon = <CloudUpload size={14} className="animate-pulse" />;
    label = pending > 0 ? `جاري مزامنة ${pending} منتج...` : 'جاري تحديث منتجاتك من السحابة...';
  } else if (pending > 0) {
    cls = state === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200';
    icon = state === 'error' ? <AlertTriangle size={14} /> : <CloudUpload size={14} />;
    label = state === 'error' ? `${pending} منتج لسه ما اترفعش — هنحاول تاني تلقائياً` : `${pending} منتج مستني يترفع`;
  }

  return (
    <div dir="rtl" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold ${cls}`}>
      {icon}
      <span>{label}</span>
      {pending > 0 && state !== 'syncing' && state !== 'offline' && (
        <button
          type="button"
          onClick={() => syncProductsNow(workshopId).catch(() => {})}
          className="underline underline-offset-2 hover:opacity-80"
        >
          زامن دلوقتي
        </button>
      )}
    </div>
  );
};

export default ProductSyncBadge;
