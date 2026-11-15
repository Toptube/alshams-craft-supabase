export interface WishlistItem {
  id: string;
  productName: string;
  imageUrl?: string;
  egpPrice: number;
  craftName?: string;
  workshopId?: string;
  brandName?: string;
  artistName?: string;
  storeSlug?: string;
  isFreeShipping?: boolean;
  addedAt: number;
}

const WISHLIST_STORAGE_KEY = 'alshams_customer_wishlist_v1';

export function getWishlistItems(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.id) : [];
  } catch {
    return [];
  }
}

export function getWishlistIds(): Set<string> {
  return new Set(getWishlistItems().map((i) => i.id));
}

export function isProductWishlisted(productId: string): boolean {
  return getWishlistIds().has(productId);
}

function saveWishlistItems(items: WishlistItem[]): WishlistItem[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('alshams_wishlist_updated', { detail: items }));
    } catch {}
  }
  return items;
}

export function toggleWishlistItem(item: Omit<WishlistItem, 'addedAt'>): {
  items: WishlistItem[];
  added: boolean;
} {
  const current = getWishlistItems();
  const exists = current.some((i) => i.id === item.id);
  if (exists) {
    const next = current.filter((i) => i.id !== item.id);
    saveWishlistItems(next);
    return { items: next, added: false };
  }
  const next = [{ ...item, addedAt: Date.now() }, ...current].slice(0, 60);
  saveWishlistItems(next);
  return { items: next, added: true };
}

export function removeWishlistItem(productId: string): WishlistItem[] {
  const next = getWishlistItems().filter((i) => i.id !== productId);
  return saveWishlistItems(next);
}

export function clearWishlist(): WishlistItem[] {
  return saveWishlistItems([]);
}
