import { supabase } from '../lib/supabase';
import { SavedProductRecord, UserProfile } from '../types';
import { enqueueOfflineMutation } from './offlineMutationQueue';
import { matchesWorkshopSlug } from '../utils/slugify';

import {
  ArtisanStoreConfig,
  ProductDiscountConfig,
  ProductSizeVariant,
  normalizeArtisanStoreConfig,
} from '../types/artisanStoreBuilder';
import { toEgpAmount } from '../lib/currency';

export interface CloudMarketplaceProduct {
  id: string;
  workshop_id: string;
  workshopId?: string;
  brand_name: string;
  brandName?: string;
  artist_name: string;
  artistName?: string;
  phone_number?: string;
  phoneNumber?: string;
  product_name: string;
  productName?: string;
  category: string;
  craft_name?: string;
  craftName?: string;
  decor_category?: string;
  decorCategory?: string;
  store_price: number;
  storePrice?: number;
  retail_price: number;
  retailPrice?: number;
  wholesale_price?: number;
  wholesalePrice?: number;
  cost_price?: number;
  costPrice?: number;
  current_stock: number;
  currentStock?: number;
  image_url: string;
  imageUrl?: string;
  gallery_urls?: string[];
  galleryUrls?: string[];
  store_description?: string;
  storeDescription?: string;
  available_colors?: string[];
  availableColors?: string[];
  available_sizes?: string[];
  availableSizes?: string[];
  size_variants?: ProductSizeVariant[];
  sizeVariants?: ProductSizeVariant[];
  source_currency?: string;
  sourceCurrency?: string;
  product_discount?: ProductDiscountConfig;
  productDiscount?: ProductDiscountConfig;
  is_custom_order_available?: boolean;
  isCustomOrderAvailable?: boolean;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    diameter?: number;
    __artisanExt?: any;
  };
  materials_summary?: string;
  logo_url?: string | null;
  logoUrl?: string | null;
  store_slug?: string;
  storeSlug?: string;
  workshop_rating_stars?: number;
  workshop_medal?: string | null;
  status: 'pending_approval' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  rejectionReason?: string | null;
  created_at?: string | number;
  updated_at?: string | number;
}

export interface PublicWorkshopStoreData {
  workshop: {
    id: string;
    brandName: string;
    artistName: string;
    phoneNumber?: string;
    email?: string;
    country?: string;
    currencySymbol?: string;
    logoUrl?: string;
    storeSlug?: string;
    selectedCrafts?: string[];
    ratingStars?: number;
    medal?: string;
    status?: string;
    suspended?: boolean;
    suspensionReason?: string | null;
    storeLayoutCols?: 1 | 2 | 3;
    storeProductOrder?: string[];
    storeConfig?: ArtisanStoreConfig;
  };
  products: CloudMarketplaceProduct[];
}

async function getOptionalAuthHeaders(
  userEmail?: string,
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  if (userEmail) headers['x-user-email'] = userEmail;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  return headers;
}

/**
 * Normalizes a raw cloud row into a clean typed object
 */
export function normalizeCloudProduct(row: any): CloudMarketplaceProduct {
  const wid = row.workshop_id || row.workshopId || '';
  const dims = row.dimensions && typeof row.dimensions === 'object' ? row.dimensions : {};
  const ext = dims.__artisanExt && typeof dims.__artisanExt === 'object' ? dims.__artisanExt : {};

  const galleryRaw = row.gallery_urls ?? row.galleryUrls ?? ext.gallery_urls ?? ext.galleryUrls;
  const galleryUrls: string[] = Array.isArray(galleryRaw)
    ? galleryRaw.filter((u: any) => typeof u === 'string' && u.trim())
    : [];

  const variantsRaw = row.size_variants ?? row.sizeVariants ?? ext.size_variants ?? ext.sizeVariants;
  const sizeVariants: ProductSizeVariant[] = Array.isArray(variantsRaw)
    ? variantsRaw.filter((v: any) => v && typeof v.label === 'string' && v.label.trim())
    : [];

  const sourceCurrency: string =
    row.source_currency || row.sourceCurrency || ext.source_currency || ext.sourceCurrency || 'EGP';

  const discountRaw = row.product_discount ?? row.productDiscount ?? ext.product_discount ?? ext.productDiscount;
  const productDiscount: ProductDiscountConfig | undefined =
    discountRaw && typeof discountRaw === 'object' ? discountRaw : undefined;

  const isCustomOrderAvailable = Boolean(
    row.is_custom_order_available ??
      row.isCustomOrderAvailable ??
      ext.is_custom_order_available ??
      ext.isCustomOrderAvailable
  );

  const availSizesRaw = Array.isArray(row.available_sizes)
    ? row.available_sizes
    : Array.isArray(row.availableSizes)
    ? row.availableSizes
    : [];
  const mergedSizes =
    sizeVariants.length > 0
      ? sizeVariants.map((v) => v.label)
      : availSizesRaw;

  return {
    id: row.id || `prod_${Date.now()}`,
    workshop_id: wid,
    workshopId: wid,
    brand_name: row.brand_name || row.brandName || 'ورشة الشمساوية',
    brandName: row.brand_name || row.brandName || 'ورشة الشمساوية',
    artist_name: row.artist_name || row.artistName || 'فنان الشمساوية',
    artistName: row.artist_name || row.artistName || 'فنان الشمساوية',
    phone_number: row.phone_number || row.phoneNumber || '',
    phoneNumber: row.phone_number || row.phoneNumber || '',
    logo_url: row.logo_url || row.logoUrl || null,
    logoUrl: row.logo_url || row.logoUrl || null,
    store_slug: row.store_slug || row.storeSlug || wid,
    storeSlug: row.store_slug || row.storeSlug || wid,
    workshop_rating_stars: row.workshop_rating_stars ?? row.workshopRatingStars ?? undefined,
    workshop_medal: row.workshop_medal ?? row.workshopMedal ?? null,
    product_name: row.product_name || row.productName || 'مشغولة يدوية فاخرة',
    productName: row.product_name || row.productName || 'مشغولة يدوية فاخرة',
    category: row.category || 'macrame',
    craft_name: row.craft_name || row.craftName || 'المكرمية والنسيج',
    craftName: row.craft_name || row.craftName || 'المكرمية والنسيج',
    decor_category: row.decor_category || row.decorCategory || 'all',
    decorCategory: row.decor_category || row.decorCategory || 'all',
    store_price: Number(row.store_price ?? row.storePrice ?? row.retail_price ?? row.retailPrice ?? 0),
    storePrice: Number(row.store_price ?? row.storePrice ?? row.retail_price ?? row.retailPrice ?? 0),
    retail_price: Number(row.retail_price ?? row.retailPrice ?? row.store_price ?? 0),
    retailPrice: Number(row.retail_price ?? row.retailPrice ?? row.store_price ?? 0),
    wholesale_price: Number(row.wholesale_price ?? row.wholesalePrice ?? 0),
    wholesalePrice: Number(row.wholesale_price ?? row.wholesalePrice ?? 0),
    cost_price: Number(row.cost_price ?? row.costPrice ?? 0),
    costPrice: Number(row.cost_price ?? row.costPrice ?? 0),
    current_stock: Number(row.current_stock ?? row.currentStock ?? 1),
    currentStock: Number(row.current_stock ?? row.currentStock ?? 1),
    image_url: row.image_url || row.imageUrl || '/alshams_falcon_emblem.png',
    imageUrl: row.image_url || row.imageUrl || '/alshams_falcon_emblem.png',
    gallery_urls: galleryUrls,
    galleryUrls: galleryUrls,
    store_description: row.store_description || row.storeDescription || '',
    storeDescription: row.store_description || row.storeDescription || '',
    available_colors: Array.isArray(row.available_colors) ? row.available_colors : Array.isArray(row.availableColors) ? row.availableColors : [],
    availableColors: Array.isArray(row.available_colors) ? row.available_colors : Array.isArray(row.availableColors) ? row.availableColors : [],
    available_sizes: mergedSizes,
    availableSizes: mergedSizes,
    size_variants: sizeVariants,
    sizeVariants: sizeVariants,
    source_currency: sourceCurrency,
    sourceCurrency: sourceCurrency,
    product_discount: productDiscount,
    productDiscount: productDiscount,
    is_custom_order_available: isCustomOrderAvailable,
    isCustomOrderAvailable: isCustomOrderAvailable,
    dimensions: dims,
    materials_summary: row.materials_summary || row.materialsSummary || '',
    status: row.status || 'pending_approval',
    rejection_reason: row.rejection_reason || row.rejectionReason || null,
    rejectionReason: row.rejection_reason || row.rejectionReason || null,
    created_at: row.created_at || row.createdAt || Date.now(),
    updated_at: row.updated_at || row.updatedAt || Date.now(),
  };
}

/**
 * Publishes a product to the cloud marketplace table (defaults to 'pending_approval')
 * Automatically normalizes workshop currency -> EGP for سوق الشمساوية while preserving size variants & extensions inside dimensions.__artisanExt.
 */
export async function publishProductToMarketplace(
  product: SavedProductRecord,
  profile: UserProfile
): Promise<{
  success: boolean;
  cloudSynced: boolean;
  status: 'pending_approval' | 'approved' | 'rejected';
  error?: string;
}> {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const initialStatus: 'pending_approval' | 'approved' | 'rejected' = product.isMarketplaceApproved
    ? 'approved'
    : 'pending_approval';

  const sourceCurr = product.sourceCurrency || profile.currency || 'EGP';
  const rawStorePrice = Number(product.storePrice || product.retailPrice || 0);
  const rawRetailPrice = Number(product.retailPrice || product.storePrice || 0);

  const normalizedSizeVariants: ProductSizeVariant[] = Array.isArray(product.sizeVariants)
    ? product.sizeVariants
        .filter((v) => v && v.label?.trim())
        .map((v, i) => ({
          id: v.id || `sz_${i}_${Date.now()}`,
          label: v.label.trim(),
          price: Number(v.price) || rawStorePrice,
          egpPrice: toEgpAmount(Number(v.price) || rawStorePrice, sourceCurr),
        }))
    : [];

  const primaryEgpStorePrice = toEgpAmount(rawStorePrice, sourceCurr);
  const primaryEgpRetailPrice = toEgpAmount(rawRetailPrice, sourceCurr);

  const artisanExt = {
    gallery_urls: Array.isArray(product.galleryUrls) ? product.galleryUrls.slice(0, 8) : [],
    size_variants: normalizedSizeVariants,
    source_currency: sourceCurr,
    product_discount: product.productDiscount || undefined,
    is_custom_order_available: Boolean(product.isCustomOrderAvailable),
    hiddenInStore: product.inStore === false || product.isPublishedInStore === false,
  };

  const safeCloudRow: Partial<CloudMarketplaceProduct> = {
    id: product.id,
    workshop_id: workshopId,
    brand_name: profile.brandName || 'ورشة الشمساوية',
    artist_name: profile.artistName || 'فنان الشمساوية',
    phone_number: profile.phoneNumber || '',
    product_name: product.productName,
    category: String(product.category || 'macrame'),
    craft_name: product.craftName || String(product.category || 'المكرمية'),
    decor_category: product.decorCategory || 'all',
    store_price: primaryEgpStorePrice,
    retail_price: primaryEgpRetailPrice,
    wholesale_price: toEgpAmount(Number(product.wholesalePrice || 0), sourceCurr),
    cost_price: toEgpAmount(Number(product.costPrice || 0), sourceCurr),
    current_stock: Number(product.currentStock ?? 1),
    image_url: product.imageUrl || '/alshams_falcon_emblem.png',
    store_description: product.storeDescription || (product as any).marketingDescription || (product as any).notes || '',
    available_colors: Array.isArray(product.availableColors) ? product.availableColors : [],
    available_sizes:
      normalizedSizeVariants.length > 0
        ? normalizedSizeVariants.map((v) => v.label)
        : Array.isArray(product.availableSizes)
        ? product.availableSizes
        : [],
    dimensions: {
      length: (product.input as any)?.dimensions?.length,
      width: (product.input as any)?.dimensions?.width ?? product.input?.widthCm,
      height: (product.input as any)?.dimensions?.height ?? product.input?.totalLengthCm,
      diameter: (product.input as any)?.dimensions?.diameter ?? product.input?.diameterCm,
      __artisanExt: artisanExt,
    },
    materials_summary: (product as any).materialsDescription || '',
    status: initialStatus,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  };

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineMutation({
        workshopId: workshopId || 'default',
        type: 'marketplace_publish',
        payload: safeCloudRow,
      });
      return { success: true, cloudSynced: false, status: initialStatus };
    }

    let resolvedStatus: 'pending_approval' | 'approved' | 'rejected' = initialStatus;
    let serverCloudSynced = false;
    let lastError: string | undefined;

    // 1. Attempt server API first (passes auth headers so server can authenticate Supabase write + notify Super Admin)
    try {
      const headers = await getOptionalAuthHeaders(profile.email, { 'Content-Type': 'application/json' });
      const res = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...safeCloudRow,
          logo_url: (profile as any).logo_url || profile.logoUrl || undefined,
          store_slug: profile.store_slug || profile.storeSlug || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.product?.status) {
          resolvedStatus = data.product.status;
        }
        serverCloudSynced = Boolean(data?.cloudSynced);
        if (serverCloudSynced) {
          return { success: true, cloudSynced: true, status: resolvedStatus };
        }
        if (data?.cloudError) lastError = data.cloudError;
      } else {
        lastError = `HTTP ${res.status}`;
      }
    } catch (e: any) {
      lastError = e?.message;
    }

    // 2. Direct authenticated Supabase upsert fallback (if server used anon or could not pass RLS)
    try {
      const { data: existingRemote } = await supabase
        .from('marketplace_products')
        .select('id, status')
        .eq('id', product.id)
        .maybeSingle();

      if (existingRemote?.status === 'approved') {
        resolvedStatus = 'approved';
      }

      const directRow = { ...safeCloudRow, status: resolvedStatus };
      const { error } = await supabase
        .from('marketplace_products')
        .upsert(directRow, { onConflict: 'id' });
      if (!error) {
        return { success: true, cloudSynced: true, status: resolvedStatus };
      }
      lastError = error.message;
    } catch (e: any) {
      lastError = e?.message || lastError;
    }

    // 3. Queue for automatic retry when connection/session stabilizes
    enqueueOfflineMutation({
      workshopId: workshopId || 'default',
      type: 'marketplace_publish',
      payload: { ...safeCloudRow, status: resolvedStatus },
    });

    return { success: true, cloudSynced: false, status: resolvedStatus, error: lastError };
  } catch (err: any) {
    console.warn('[Marketplace Cloud Sync Warning]:', err);
    enqueueOfflineMutation({
      workshopId: workshopId || 'default',
      type: 'marketplace_publish',
      payload: safeCloudRow,
    });
    return { success: true, cloudSynced: false, status: initialStatus, error: err?.message };
  }
}

/**
 * Fetches all marketplace_products rows belonging to a specific workshop
 */
export async function fetchWorkshopMarketplaceProducts(workshopId: string): Promise<CloudMarketplaceProduct[]> {
  if (!workshopId) return [];
  const map = new Map<string, CloudMarketplaceProduct>();

  try {
    const res = await fetch(`/api/store/${encodeURIComponent(workshopId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.products)) {
        data.products.forEach((p: any) => {
          const norm = normalizeCloudProduct(p);
          map.set(norm.id, norm);
        });
      }
    }
  } catch {}

  try {
    const { data, error } = await supabase
      .from('marketplace_products')
      .select('*')
      .eq('workshop_id', workshopId);
    if (!error && Array.isArray(data)) {
      data.forEach((p: any) => {
        const norm = normalizeCloudProduct(p);
        map.set(norm.id, norm);
      });
    }
  } catch {}

  return Array.from(map.values());
}

/**
 * Fetches marketplace products strictly APPROVED & from ACTIVE workshops only
 */
export async function fetchApprovedMarketplaceProducts(): Promise<CloudMarketplaceProduct[]> {
  try {
    const res = await fetch('/api/marketplace/products');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products)) {
        return data.products.map(normalizeCloudProduct);
      }
    }
  } catch {}

  try {
    const [{ data, error }, { data: wsRows }] = await Promise.all([
      supabase
        .from('marketplace_products')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      supabase.from('workshops').select('*'),
    ]);

    const wsMap = new Map<string, any>();
    if (Array.isArray(wsRows)) {
      wsRows.forEach((w: any) => {
        if (w.id) wsMap.set(w.id, w);
        if (w.workshop_id) wsMap.set(w.workshop_id, w);
      });
    }

    if (!error && Array.isArray(data)) {
      return data
        .filter((row: any) => {
          const ws = wsMap.get(row.workshop_id);
          if (!ws) return true;
          const st = ws.status || (ws.is_frozen ? 'suspended' : 'active');
          return !ws.is_frozen && st !== 'banned' && st !== 'suspended';
        })
        .map((row: any) => {
          const ws = wsMap.get(row.workshop_id);
          return normalizeCloudProduct({
            ...row,
            brand_name: ws?.brand_name || row.brand_name || 'ورشة الشمساوية',
            artist_name: ws?.artist_name || row.artist_name || 'فنان الشمساوية',
            phone_number: ws?.phone_number || ws?.phone || row.phone_number || '',
            logo_url: ws?.logo_data || ws?.logo_url || null,
            store_slug: ws?.store_slug || ws?.id || row.workshop_id,
            workshop_rating_stars: ws?.rating_stars ?? 5,
            workshop_medal: ws?.medal ?? null,
          });
        });
    }
  } catch {}

  return [];
}

/**
 * Fetches pending products for Super Admin review
 */
export async function fetchPendingMarketplaceProducts(userEmail?: string): Promise<CloudMarketplaceProduct[]> {
  try {
    const headers = await getOptionalAuthHeaders(userEmail);
    const res = await fetch('/api/admin/marketplace/products?status=pending_approval', {
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products)) {
        return data.products.map(normalizeCloudProduct);
      }
    }
  } catch {}

  try {
    const { data, error } = await supabase
      .from('marketplace_products')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map(normalizeCloudProduct);
    }
  } catch {}

  return [];
}

/**
 * Super Admin review action (Approve or Reject with reason, optional rating & product upsert payload)
 */
export async function reviewMarketplaceProduct(
  productId: string,
  decision: 'approved' | 'rejected' | 'pending_approval',
  rejectionReason?: string,
  userEmail?: string,
  options?: { ratingStars?: number; productPayload?: any }
): Promise<{ success: boolean; message?: string; cloudSynced?: boolean; error?: string }> {
  let serverError: string | undefined;

  try {
    const headers = await getOptionalAuthHeaders(userEmail, { 'Content-Type': 'application/json' });
    const res = await fetch('/api/admin/marketplace/review', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId,
        status: decision,
        rejectionReason: rejectionReason || undefined,
        ratingStars: options?.ratingStars,
        productPayload: options?.productPayload,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        cloudSynced: data.cloudSynced,
        message: data.message,
      };
    } else {
      const errJson = await res.json().catch(() => ({}));
      serverError = errJson.error || `HTTP ${res.status}`;
    }
  } catch (e: any) {
    serverError = e?.message;
  }

  try {
    const { error } = await supabase
      .from('marketplace_products')
      .update({
        status: decision,
        rejection_reason: decision === 'rejected' ? (rejectionReason || 'لم يستوفِ شروط العرض') : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (!error) {
      return { success: true, cloudSynced: true };
    }
    return { success: false, error: serverError || error.message };
  } catch (e: any) {
    return { success: false, error: serverError || e?.message || 'تعذر تنفيذ المراجعة سحابياً' };
  }
}

/**
 * Fetches public workshop storefront info and products by workshop slug or ID
 */
export async function fetchPublicStorefrontBySlug(slug: string): Promise<PublicWorkshopStoreData | null> {
  const cleanSlug = decodeURIComponent(slug).toLowerCase().trim().replace(/^@/, '');

  try {
    const res = await fetch(`/api/store/${encodeURIComponent(cleanSlug)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.workshop) {
        return {
          workshop: {
            ...data.workshop,
            storeConfig: data.workshop.storeConfig
              ? normalizeArtisanStoreConfig(data.workshop.storeConfig)
              : undefined,
          },
          products: (data.products || []).map(normalizeCloudProduct),
        };
      }
    }
  } catch {}

  try {
    const { data: wsData } = await supabase
      .from('workshops')
      .select('*');

    if (wsData && Array.isArray(wsData)) {
      const found = wsData.find((w: any) => matchesWorkshopSlug(w, cleanSlug));

      if (found) {
        const wid = found.id || found.workshop_id;
        const wsStatus = found.status || (found.is_frozen ? 'suspended' : 'active');
        const isSuspended = Boolean(found.is_frozen || wsStatus === 'banned' || wsStatus === 'suspended');

        const logo = found.logo_data || found.logo_url || found.logoUrl || null;
        const phone = found.phone_number || found.phone || found.phoneNumber || '';
        const storeSlug = found.store_slug || found.storeSlug || wid;

        if (isSuspended) {
          return {
            workshop: {
              id: wid,
              brandName: found.brand_name || found.brandName || 'ورشة الشمساوية',
              artistName: found.artist_name || found.artistName || 'فنان الشمساوية',
              phoneNumber: phone,
              email: found.email || '',
              country: found.country || 'مصر',
              currencySymbol: found.currency_symbol || found.currencySymbol || 'ج.م',
              logoUrl: logo,
              storeSlug,
              ratingStars: found.rating_stars || found.ratingStars || 5,
              medal: found.medal || 'gold',
              status: wsStatus,
              suspended: true,
              suspensionReason: found.suspension_reason || found.suspended_reason || null,
              selectedCrafts: Array.isArray(found.selected_crafts) ? found.selected_crafts : ['macrame'],
            },
            products: [],
          };
        }

        const prodsMap = new Map<string, any>();
        const rejectedIds = new Set<string>();

        try {
          const { data: pData } = await supabase
            .from('marketplace_products')
            .select('*')
            .eq('workshop_id', wid);
          if (Array.isArray(pData)) {
            pData.forEach((p: any) => {
              if (p.status === 'rejected') {
                rejectedIds.add(p.id);
              } else {
                prodsMap.set(p.id, p);
              }
            });
          }
        } catch {}

        try {
          const { data: catData } = await supabase
            .from('products')
            .select('*')
            .eq('workshop_id', wid);
          if (Array.isArray(catData)) {
            catData.forEach((p: any) => {
              if (p.is_active === false || rejectedIds.has(p.id)) return;
              const lr = p.local_record || {};
              if (lr.inStore === false || lr.isPublishedInStore === false) return;
              if (!prodsMap.has(p.id)) {
                prodsMap.set(p.id, {
                  id: p.id,
                  workshop_id: p.workshop_id,
                  brand_name: found.brand_name || 'ورشة الشمساوية',
                  artist_name: found.artist_name || 'فنان الشمساوية',
                  phone_number: found.phone_number || found.phone || '',
                  logo_url: logo,
                  store_slug: storeSlug,
                  product_name: p.product_name || lr.productName,
                  category: p.category || lr.category || 'أعمال يدوية',
                  craft_name: p.craft_name || lr.craftName || p.category || 'أعمال يدوية',
                  store_price: lr.storePrice || p.retail_price || 0,
                  retail_price: p.retail_price || lr.retailPrice || 0,
                  wholesale_price: p.wholesale_price || lr.wholesalePrice || 0,
                  cost_price: p.cost_price || lr.costPrice || 0,
                  current_stock: lr.currentStock ?? 1,
                  image_url: p.image_url || lr.imageUrl || null,
                  store_description: lr.storeDescription || p.specs?.marketingDescription || p.specs?.materialsDescription || p.product_name,
                  available_colors: lr.availableColors || [],
                  available_sizes: lr.availableSizes || [],
                  status: lr.isMarketplaceApproved ? 'approved' : 'pending_approval',
                  created_at: p.created_at,
                });
              }
            });
          }
        } catch {}

        const prodsData = Array.from(prodsMap.values());
        const rawCols = Number(found.store_layout_cols ?? found.storeLayoutCols ?? 2);
        const storeLayoutCols: 1 | 2 | 3 = rawCols === 1 ? 1 : rawCols === 3 ? 3 : 2;
        const storeProductOrder: string[] = Array.isArray(found.store_product_order)
          ? found.store_product_order
          : Array.isArray(found.storeProductOrder)
          ? found.storeProductOrder
          : [];
        const orderRankMap = new Map(storeProductOrder.map((id, idx) => [id, idx]));

        return {
          workshop: {
            id: wid,
            brandName: found.brand_name || found.brandName || 'ورشة الشمساوية',
            artistName: found.artist_name || found.artistName || 'فنان الشمساوية',
            phoneNumber: phone,
            email: found.email || '',
            country: found.country || 'مصر',
            currencySymbol: found.currency_symbol || found.currencySymbol || 'ج.م',
            logoUrl: logo,
            storeSlug,
            ratingStars: found.rating_stars || found.ratingStars || 5,
            medal: found.medal || 'gold',
            status: wsStatus,
            suspended: false,
            selectedCrafts: Array.isArray(found.selected_crafts) ? found.selected_crafts : ['macrame'],
            storeLayoutCols,
            storeProductOrder,
          },
          products: (prodsData || [])
            .filter((p: any) => p.status !== 'rejected' && (p.workshop_id === wid || p.workshopId === wid))
            .map((p: any) =>
              normalizeCloudProduct({
                ...p,
                brand_name: found.brand_name || found.brandName,
                artist_name: found.artist_name || found.artistName,
                phone_number: p.phone_number || phone,
                logo_url: p.logo_url || logo,
                store_slug: storeSlug,
              })
            )
            .sort((a: any, b: any) => {
              const ra = orderRankMap.has(a.id) ? orderRankMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
              const rb = orderRankMap.has(b.id) ? orderRankMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
              if (ra !== rb) return ra - rb;
              return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            }),
        };
      }
    }
  } catch (err) {
    console.warn('Direct Supabase storefront fetch notice:', err);
  }

  return null;
}

export async function fetchPlatformSettingsCloud(): Promise<any | null> {
  try {
    const res = await fetch('/api/platform-settings');
    if (res.ok) {
      const data = await res.json();
      return data.settings || null;
    }
  } catch {}
  return null;
}

export async function savePlatformSettingsCloud(
  settings: any,
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean; settings?: any; error?: string }> {
  try {
    const headers = await getOptionalAuthHeaders(userEmail, { 'Content-Type': 'application/json' });
    const res = await fetch('/api/platform-settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || `HTTP ${res.status}` };
    return { success: true, cloudSynced: data.cloudSynced, settings: data.settings };
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر حفظ الإعدادات سحابياً' };
  }
}

export async function fetchCloudMarketplaceOrders(userEmail?: string): Promise<any[]> {
  try {
    const headers = await getOptionalAuthHeaders(userEmail);
    const res = await fetch('/api/admin/marketplace/orders', { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders)) return data.orders;
    }
  } catch {}

  try {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) return data;
  } catch {}

  return [];
}

export async function updateCloudMarketplaceOrder(
  orderId: string,
  updates: any,
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean; error?: string }> {
  try {
    const headers = await getOptionalAuthHeaders(userEmail, { 'Content-Type': 'application/json' });
    const res = await fetch(`/api/admin/marketplace/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { success: true, cloudSynced: data.cloudSynced };
    return { success: false, error: data.error || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}

export interface StoredWorkshopStoreLayout {
  layoutCols: 1 | 2 | 3;
  productOrder: string[];
  updatedAt?: number;
}

export function getLocalWorkshopStoreLayout(workshopId?: string): StoredWorkshopStoreLayout {
  if (!workshopId || typeof window === 'undefined') {
    return { layoutCols: 2, productOrder: [] };
  }
  try {
    const raw = localStorage.getItem(`alshams_store_layout_${workshopId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawCols = Number(parsed?.layoutCols);
      const layoutCols: 1 | 2 | 3 = rawCols === 1 ? 1 : rawCols === 3 ? 3 : 2;
      const productOrder = Array.isArray(parsed?.productOrder) ? parsed.productOrder : [];
      return { layoutCols, productOrder, updatedAt: parsed?.updatedAt };
    }
    const fallbackOrderRaw = localStorage.getItem(`alshams_catalog_prod_order_${workshopId}`);
    if (fallbackOrderRaw) {
      const fallbackOrder = JSON.parse(fallbackOrderRaw);
      if (Array.isArray(fallbackOrder)) {
        return { layoutCols: 2, productOrder: fallbackOrder };
      }
    }
  } catch {}
  return { layoutCols: 2, productOrder: [] };
}

export async function saveWorkshopStoreLayout(
  workshopId: string,
  layoutCols: 1 | 2 | 3,
  productOrder: string[],
  userEmail?: string
): Promise<{ success: boolean; cloudSynced?: boolean; layoutCols: 1 | 2 | 3; productOrder: string[] }> {
  const safeCols: 1 | 2 | 3 = layoutCols === 1 ? 1 : layoutCols === 3 ? 3 : 2;
  const safeOrder = Array.from(new Set(productOrder.filter((id) => typeof id === 'string' && id.trim())));

  if (typeof window !== 'undefined' && workshopId) {
    try {
      localStorage.setItem(
        `alshams_store_layout_${workshopId}`,
        JSON.stringify({ layoutCols: safeCols, productOrder: safeOrder, updatedAt: Date.now() })
      );
      if (safeOrder.length > 0) {
        localStorage.setItem(`alshams_catalog_prod_order_${workshopId}`, JSON.stringify(safeOrder));
      }
      window.dispatchEvent(
        new CustomEvent('alshams_store_layout_updated', {
          detail: { workshopId, layoutCols: safeCols, productOrder: safeOrder },
        })
      );
    } catch {}
  }

  try {
    const headers = await getOptionalAuthHeaders(userEmail, { 'Content-Type': 'application/json' });
    const res = await fetch('/api/store/layout', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workshopId,
        layoutCols: safeCols,
        productOrder: safeOrder,
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        cloudSynced: Boolean(data.cloudSynced),
        layoutCols: safeCols,
        productOrder: safeOrder,
      };
    }
  } catch {}

  return { success: true, cloudSynced: false, layoutCols: safeCols, productOrder: safeOrder };
}
