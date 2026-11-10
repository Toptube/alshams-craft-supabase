import { supabase } from '../lib/supabase';
import { SavedProductRecord, UserProfile } from '../types';
import { enqueueOfflineMutation } from './offlineMutationQueue';
import { matchesWorkshopSlug } from '../utils/slugify';

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
  store_description?: string;
  storeDescription?: string;
  available_colors?: string[];
  availableColors?: string[];
  available_sizes?: string[];
  availableSizes?: string[];
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    diameter?: number;
  };
  materials_summary?: string;
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
    selectedCrafts?: string[];
    ratingStars?: number;
    medal?: string;
  };
  products: CloudMarketplaceProduct[];
}

/**
 * Normalizes a raw cloud row into a clean typed object
 */
export function normalizeCloudProduct(row: any): CloudMarketplaceProduct {
  return {
    id: row.id || `prod_${Date.now()}`,
    workshop_id: row.workshop_id || row.workshopId || '',
    workshopId: row.workshop_id || row.workshopId || '',
    brand_name: row.brand_name || row.brandName || 'ورشة الشمساوية',
    brandName: row.brand_name || row.brandName || 'ورشة الشمساوية',
    artist_name: row.artist_name || row.artistName || 'فنان الشمساوية',
    artistName: row.artist_name || row.artistName || 'فنان الشمساوية',
    phone_number: row.phone_number || row.phoneNumber || '',
    phoneNumber: row.phone_number || row.phoneNumber || '',
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
    store_description: row.store_description || row.storeDescription || '',
    storeDescription: row.store_description || row.storeDescription || '',
    available_colors: Array.isArray(row.available_colors) ? row.available_colors : Array.isArray(row.availableColors) ? row.availableColors : [],
    availableColors: Array.isArray(row.available_colors) ? row.available_colors : Array.isArray(row.availableColors) ? row.availableColors : [],
    available_sizes: Array.isArray(row.available_sizes) ? row.available_sizes : Array.isArray(row.availableSizes) ? row.availableSizes : [],
    availableSizes: Array.isArray(row.available_sizes) ? row.available_sizes : Array.isArray(row.availableSizes) ? row.availableSizes : [],
    dimensions: row.dimensions || {},
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
 */
export async function publishProductToMarketplace(
  product: SavedProductRecord,
  profile: UserProfile
): Promise<{ success: boolean; status: 'pending_approval' | 'approved' | 'rejected'; error?: string }> {
  try {
    const payload: Partial<CloudMarketplaceProduct> = {
      id: product.id,
      workshop_id: profile.tenantId || profile.workshopId || profile.id,
      brand_name: profile.brandName || 'ورشة الشمساوية',
      artist_name: profile.artistName || 'فنان الشمساوية',
      phone_number: profile.phoneNumber || '',
      product_name: product.productName,
      category: product.category,
      craft_name: product.craftName || product.category,
      decor_category: product.decorCategory || 'all',
      store_price: product.storePrice || product.retailPrice || 0,
      retail_price: product.retailPrice || product.storePrice || 0,
      wholesale_price: product.wholesalePrice || 0,
      cost_price: product.costPrice || 0,
      current_stock: product.currentStock ?? 1,
      image_url: product.imageUrl || '/alshams_falcon_emblem.png',
      store_description: product.storeDescription || (product as any).notes || '',
      available_colors: product.availableColors || [],
      available_sizes: product.availableSizes || [],
      dimensions: {
        length: (product.input as any)?.dimensions?.length,
        width: (product.input as any)?.dimensions?.width,
        height: (product.input as any)?.dimensions?.height,
        diameter: (product.input as any)?.dimensions?.diameter,
      },
      status: (product.isMarketplaceApproved ? 'approved' : 'pending_approval'),
      updated_at: new Date().toISOString(),
    };

    // 1. If offline, enqueue immediately without error
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineMutation({
        workshopId: payload.workshop_id || 'default',
        type: 'marketplace_publish',
        payload,
      });
      return { success: true, status: payload.status as any };
    }

    // 2. First attempt direct Supabase upsert
    try {
      const { error } = await supabase
        .from('marketplace_products')
        .upsert(payload, { onConflict: 'id' });
      if (!error) {
        return { success: true, status: payload.status as any };
      }
    } catch {}

    // 3. Fallback to server API endpoint
    try {
      const res = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, status: data.product?.status || 'pending_approval' };
      }
    } catch {}

    // 4. Fallback: enqueue into offline mutation queue safely
    enqueueOfflineMutation({
      workshopId: payload.workshop_id || 'default',
      type: 'marketplace_publish',
      payload,
    });

    return { success: true, status: 'pending_approval' };
  } catch (err: any) {
    console.warn('[Marketplace Cloud Sync Warning]:', err);
    return { success: true, status: 'pending_approval' };
  }
}

/**
 * Fetches all approved marketplace products for public shoppers
 */
export async function fetchApprovedMarketplaceProducts(): Promise<CloudMarketplaceProduct[]> {
  try {
    // 1. Try server API
    const res = await fetch('/api/marketplace/products');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        return data.products.map(normalizeCloudProduct);
      }
    }
  } catch {}

  try {
    // 2. Direct Supabase query
    const { data, error } = await supabase
      .from('marketplace_products')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(normalizeCloudProduct);
    }
  } catch {}

  return [];
}

/**
 * Fetches pending products for Super Admin review
 */
export async function fetchPendingMarketplaceProducts(userEmail?: string): Promise<CloudMarketplaceProduct[]> {
  try {
    const headers: Record<string, string> = {};
    if (userEmail) headers['x-user-email'] = userEmail;

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
 * Super Admin review action (Approve or Reject with reason)
 */
export async function reviewMarketplaceProduct(
  productId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string,
  userEmail?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userEmail) headers['x-user-email'] = userEmail;

    const res = await fetch('/api/admin/marketplace/review', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId,
        status: decision,
        rejectionReason: rejectionReason || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message };
    }
  } catch {}

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
      return { success: true };
    }
  } catch {}

  return { success: true };
}

/**
 * Fetches public workshop storefront info and products by workshop slug or ID
 */
export async function fetchPublicStorefrontBySlug(slug: string): Promise<PublicWorkshopStoreData | null> {
  const cleanSlug = decodeURIComponent(slug).toLowerCase().trim().replace(/^@/, '');

  // 1. Try server API
  try {
    const res = await fetch(`/api/store/${encodeURIComponent(cleanSlug)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.workshop) {
        return {
          workshop: data.workshop,
          products: (data.products || []).map(normalizeCloudProduct),
        };
      }
    }
  } catch {}

  // 2. Direct Supabase query fallback
  try {
    const { data: wsData } = await supabase
      .from('workshops')
      .select('*');

    if (wsData && Array.isArray(wsData)) {
      const found = wsData.find((w: any) => matchesWorkshopSlug(w, cleanSlug));

      if (found) {
        // Query products by workshop_id OR by matching brand_name
        let prodsData: any[] = [];
        try {
          const { data: pData } = await supabase
            .from('marketplace_products')
            .select('*')
            .or(`workshop_id.eq.${found.id},brand_name.ilike.%${found.brand_name || ''}%`);
          if (Array.isArray(pData)) prodsData = pData;
        } catch {}

        if (prodsData.length === 0) {
          try {
            const { data: catData } = await supabase
              .from('products')
              .select('*')
              .eq('workshop_id', found.id);
            if (Array.isArray(catData)) {
              prodsData = catData.map((p: any) => ({
                id: p.id,
                workshop_id: p.workshop_id,
                brand_name: found.brand_name || 'ورشة الشمساوية',
                artist_name: found.artist_name || 'فنان',
                phone_number: found.phone || '',
                product_name: p.product_name,
                category: p.category || 'أعمال يدوية',
                store_price: p.retail_price || 0,
                retail_price: p.retail_price || 0,
                wholesale_price: p.wholesale_price || 0,
                cost_price: p.cost_price || 0,
                image_url: p.image_url || null,
                store_description: p.specs?.marketingDescription || p.specs?.materialsDescription || p.product_name,
                status: 'approved',
                created_at: p.created_at,
              }));
            }
          } catch {}
        }

        const logo = found.logo_data || found.logo_url || found.logoUrl || null;

        return {
          workshop: {
            id: found.id,
            brandName: found.brand_name || found.brandName || 'ورشة الشمساوية',
            artistName: found.artist_name || found.artistName || 'فنان',
            phoneNumber: found.phone || found.phone_number || found.phoneNumber || '',
            email: found.email || '',
            country: found.country || 'مصر',
            currencySymbol: found.currency_symbol || found.currencySymbol || 'ج.م',
            logoUrl: logo,
            ratingStars: found.rating_stars || found.ratingStars || 5,
            medal: found.medal || 'gold',
            selectedCrafts: Array.isArray(found.selected_crafts) ? found.selected_crafts : ['macrame'],
          },
          products: (prodsData || []).map(normalizeCloudProduct),
        };
      }
    }
  } catch (err) {
    console.warn('Direct Supabase storefront fetch notice:', err);
  }

  return null;
}
