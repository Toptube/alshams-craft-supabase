import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export type PublicLocaleCode = 'ar' | 'en' | 'fr' | 'de' | 'es' | 'it' | 'tr' | 'nl';

export interface PublicLanguageMeta {
  code: PublicLocaleCode;
  nameAr: string;
  nativeName: string;
  shortCode: string;
  flag: string;
  dir: 'rtl' | 'ltr';
}

export const PUBLIC_LANGUAGES: PublicLanguageMeta[] = [
  { code: 'ar', nameAr: 'العربية', nativeName: 'العربية', shortCode: 'AR', flag: '🇪🇬', dir: 'rtl' },
  { code: 'en', nameAr: 'الإنجليزية', nativeName: 'English', shortCode: 'EN', flag: '🇬🇧', dir: 'ltr' },
  { code: 'fr', nameAr: 'الفرنسية', nativeName: 'Français', shortCode: 'FR', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', nameAr: 'الألمانية', nativeName: 'Deutsch', shortCode: 'DE', flag: '🇩🇪', dir: 'ltr' },
  { code: 'es', nameAr: 'الإسبانية', nativeName: 'Español', shortCode: 'ES', flag: '🇪🇸', dir: 'ltr' },
  { code: 'it', nameAr: 'الإيطالية', nativeName: 'Italiano', shortCode: 'IT', flag: '🇮🇹', dir: 'ltr' },
  { code: 'tr', nameAr: 'التركية', nativeName: 'Türkçe', shortCode: 'TR', flag: '🇹🇷', dir: 'ltr' },
  { code: 'nl', nameAr: 'الهولندية', nativeName: 'Nederlands', shortCode: 'NL', flag: '🇳🇱', dir: 'ltr' },
];

export const PUBLIC_LOCALE_STORAGE_KEY = 'alshams_public_locale_v1';
export const PUBLIC_LOCALE_EVENT = 'alshams_public_locale_changed';

export function isValidPublicLocale(val?: string | null): val is PublicLocaleCode {
  if (!val) return false;
  return PUBLIC_LANGUAGES.some((l) => l.code === val);
}

export function getPublicLanguageMeta(code?: string | null): PublicLanguageMeta {
  return PUBLIC_LANGUAGES.find((l) => l.code === code) || PUBLIC_LANGUAGES[0];
}

export function getStoredPublicLocale(fallback: PublicLocaleCode = 'ar'): PublicLocaleCode {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PUBLIC_LOCALE_STORAGE_KEY);
    if (isValidPublicLocale(raw)) return raw;
  } catch {}
  return fallback;
}

export function setStoredPublicLocale(lang: PublicLocaleCode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PUBLIC_LOCALE_STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent(PUBLIC_LOCALE_EVENT, { detail: { lang } }));
  } catch {}
}

export function usePublicLocale(
  allowedLanguages?: PublicLocaleCode[],
  defaultLanguage: PublicLocaleCode = 'ar'
) {
  const resolveInitial = useCallback((): PublicLocaleCode => {
    const stored = getStoredPublicLocale(defaultLanguage);
    if (allowedLanguages && allowedLanguages.length > 0 && !allowedLanguages.includes(stored)) {
      return allowedLanguages.includes(defaultLanguage) ? defaultLanguage : allowedLanguages[0];
    }
    return stored;
  }, [allowedLanguages?.join(','), defaultLanguage]);

  const [locale, setLocaleState] = useState<PublicLocaleCode>(resolveInitial);

  useEffect(() => {
    setLocaleState(resolveInitial());
  }, [resolveInitial]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const next = (e as CustomEvent)?.detail?.lang || getStoredPublicLocale(defaultLanguage);
      if (isValidPublicLocale(next)) {
        if (!allowedLanguages || allowedLanguages.length === 0 || allowedLanguages.includes(next)) {
          setLocaleState(next);
        }
      }
    };
    window.addEventListener(PUBLIC_LOCALE_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(PUBLIC_LOCALE_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [allowedLanguages?.join(','), defaultLanguage]);

  const setLocale = useCallback((next: PublicLocaleCode) => {
    setLocaleState(next);
    setStoredPublicLocale(next);
  }, []);

  const meta = getPublicLanguageMeta(locale);

  return {
    locale,
    setLocale,
    dir: meta.dir,
    isRtl: meta.dir === 'rtl',
    meta,
    t: (key: PublicDictKey) => getPublicText(locale, key),
  };
}

/**
 * Picks the best localized text for the current public locale.
 * Falls back cleanly: exact locale -> English (for LTR visitors) -> Arabic base text.
 */
export function pickLocalizedText(
  defaultAr: string | undefined | null,
  translations: Partial<Record<PublicLocaleCode, string | undefined>> | undefined | null,
  locale: PublicLocaleCode
): string {
  const base = (defaultAr || '').trim();
  if (!translations) return base;
  const direct = translations[locale];
  if (direct && direct.trim()) return direct.trim();
  if (locale !== 'ar') {
    const enFallback = translations.en;
    if (enFallback && enFallback.trim()) return enFallback.trim();
  }
  return base;
}

/**
 * Resolves the appropriate logo URL depending on active locale (Arabic vs English/International).
 */
export function resolveBilingualLogo(
  defaultLogo: string | undefined | null,
  logoArUrl: string | undefined | null,
  logoEnUrl: string | undefined | null,
  locale: PublicLocaleCode
): string {
  const fallback = (defaultLogo || '/alshams_falcon_emblem.png').trim() || '/alshams_falcon_emblem.png';
  if (locale === 'ar') {
    return (logoArUrl && logoArUrl.trim()) || fallback;
  }
  return (logoEnUrl && logoEnUrl.trim()) || (logoArUrl && logoArUrl.trim()) || fallback;
}

/**
 * Calls server-side Gemini translation endpoint to translate multiple fields at once.
 */
export async function translateFieldsWithAI(
  fields: Record<string, string>,
  targetLang: PublicLocaleCode,
  sourceLang: PublicLocaleCode = 'ar'
): Promise<{ success: boolean; translations?: Record<string, string>; error?: string }> {
  const nonEmpty: Record<string, string> = {};
  Object.entries(fields).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) {
      nonEmpty[k] = v.trim();
    }
  });
  if (Object.keys(nonEmpty).length === 0) {
    return { success: false, error: 'لا توجد نصوص للترجمة' };
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
      if (data?.session?.user?.email) {
        headers['x-user-email'] = data.session.user.email;
      }
    } catch {}

    const res = await fetch('/api/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields: nonEmpty, targetLang, sourceLang }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.translations) {
      return { success: true, translations: json.translations };
    }
    return { success: false, error: json?.error || 'تعذرت الترجمة التلقائية الآن' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال بخدمة الترجمة' };
  }
}

export type PublicDictKey =
  | 'search_products'
  | 'search_supplies'
  | 'all_categories'
  | 'add_to_cart'
  | 'order_now'
  | 'view_details'
  | 'cart'
  | 'wishlist'
  | 'currency'
  | 'language'
  | 'share'
  | 'copied'
  | 'back_to_market'
  | 'back_to_app'
  | 'central_market_title'
  | 'central_market_sub'
  | 'suppliers_market_title'
  | 'suppliers_market_sub'
  | 'verified_artisan'
  | 'verified_supplier'
  | 'custom_orders_available'
  | 'working_hours'
  | 'turnaround'
  | 'contact_us'
  | 'portfolio_gallery'
  | 'no_products'
  | 'retail_price'
  | 'wholesale_price'
  | 'min_wholesale_qty'
  | 'in_stock'
  | 'out_of_stock'
  | 'personal_profile'
  | 'about_story'
  | 'crafts_specialties'
  | 'showcase_works'
  | 'training_lessons'
  | 'visit_store'
  | 'open_store'
  | 'special_offer'
  | 'free_shipping'
  | 'best_seller'
  | 'all_crafts'
  | 'featured_stores'
  | 'products_count'
  | 'stores_count';

const AR_DICT: Record<PublicDictKey, string> = {
  search_products: 'ابحث في المنتجات والهدايا...',
  search_supplies: 'ابحث في الخامات ومستلزمات الإنتاج...',
  all_categories: 'كل الأقسام',
  add_to_cart: 'أضف للسلة',
  order_now: 'اطلب الآن',
  view_details: 'التفاصيل',
  cart: 'السلة',
  wishlist: 'المفضلة',
  currency: 'العملة',
  language: 'اللغة',
  share: 'مشاركة',
  copied: 'تم النسخ',
  back_to_market: 'سوق الشمساوية',
  back_to_app: 'لوحة الورشة',
  central_market_title: 'سوق الشمساوية المركزي',
  central_market_sub: 'مشغولات يدوية أصلية مباشرة من أمهر الحرفيين والورش العربية',
  suppliers_market_title: 'سوق موردين الشمساوية للخامات',
  suppliers_market_sub: 'خامات ومستلزمات تصنيع بالجملة والقطاعي من أفضل الموردين المعتمدين',
  verified_artisan: 'حرفي معتمد',
  verified_supplier: 'مورد خامات معتمد',
  custom_orders_available: 'متاح التنفيذ الخاص حسب الطلب',
  working_hours: 'مواعيد العمل',
  turnaround: 'مدة التنفيذ',
  contact_us: 'تواصل معنا',
  portfolio_gallery: 'معرض الأعمال السابقة',
  no_products: 'لا توجد منتجات مطابقة للبحث حالياً',
  retail_price: 'قطاعي',
  wholesale_price: 'جملة',
  min_wholesale_qty: 'أقل كمية للجملة',
  in_stock: 'متوفر',
  out_of_stock: 'غير متوفر حالياً',
  personal_profile: 'الصفحة الشخصية',
  about_story: 'نبذة وقصة الإبداع',
  crafts_specialties: 'الحرف والتخصصات',
  showcase_works: 'معرض الأعمال',
  training_lessons: 'شروحات ونصائح تدريبية',
  visit_store: 'زيارة المتجر',
  open_store: 'افتح المتجر',
  special_offer: 'عرض خاص',
  free_shipping: 'شحن مجاني',
  best_seller: 'الأكثر مبيعاً',
  all_crafts: 'كل الحرف',
  featured_stores: 'متاجر مميزة',
  products_count: 'منتج',
  stores_count: 'متجر',
};

const EN_DICT: Record<PublicDictKey, string> = {
  search_products: 'Search handmade products & gifts...',
  search_supplies: 'Search raw materials & craft supplies...',
  all_categories: 'All Categories',
  add_to_cart: 'Add to Cart',
  order_now: 'Order Now',
  view_details: 'Details',
  cart: 'Cart',
  wishlist: 'Wishlist',
  currency: 'Currency',
  language: 'Language',
  share: 'Share',
  copied: 'Copied',
  back_to_market: 'Marketplace',
  back_to_app: 'Dashboard',
  central_market_title: 'Al-Shamsawya Central Marketplace',
  central_market_sub: 'Authentic handcrafted creations directly from verified artisans and workshops',
  suppliers_market_title: 'Al-Shamsawya Craft Supplies Market',
  suppliers_market_sub: 'Wholesale & retail craft raw materials from verified suppliers',
  verified_artisan: 'Verified Artisan',
  verified_supplier: 'Verified Supplier',
  custom_orders_available: 'Custom orders available',
  working_hours: 'Working Hours',
  turnaround: 'Turnaround',
  contact_us: 'Contact Us',
  portfolio_gallery: 'Portfolio Gallery',
  no_products: 'No matching products found',
  retail_price: 'Retail',
  wholesale_price: 'Wholesale',
  min_wholesale_qty: 'Min. Wholesale Qty',
  in_stock: 'In Stock',
  out_of_stock: 'Out of Stock',
  personal_profile: 'Personal Profile',
  about_story: 'About & Story',
  crafts_specialties: 'Crafts & Specialties',
  showcase_works: 'Portfolio Showcase',
  training_lessons: 'Workshops & Tutorials',
  visit_store: 'Visit Store',
  open_store: 'Open Store',
  special_offer: 'Special Offer',
  free_shipping: 'Free Shipping',
  best_seller: 'Best Seller',
  all_crafts: 'All Crafts',
  featured_stores: 'Featured Stores',
  products_count: 'Products',
  stores_count: 'Stores',
};

const FR_DICT: Record<PublicDictKey, string> = {
  ...EN_DICT,
  search_products: 'Rechercher des produits artisanaux...',
  search_supplies: 'Rechercher des matériaux et fournitures...',
  all_categories: 'Toutes les catégories',
  add_to_cart: 'Ajouter au panier',
  order_now: 'Commander',
  view_details: 'Détails',
  cart: 'Panier',
  wishlist: 'Favoris',
  currency: 'Devise',
  language: 'Langue',
  share: 'Partager',
  copied: 'Copié',
  back_to_market: 'Marché',
  back_to_app: 'Tableau de bord',
  central_market_title: 'Marché Central Al-Shamsawya',
  central_market_sub: 'Créations artisanales authentiques directement des ateliers vérifiés',
  suppliers_market_title: 'Marché des Fournisseurs Al-Shamsawya',
  suppliers_market_sub: 'Matériaux artisanaux en gros et au détail par des fournisseurs certifiés',
  verified_artisan: 'Artisan vérifié',
  verified_supplier: 'Fournisseur vérifié',
  custom_orders_available: 'Commandes sur mesure disponibles',
  working_hours: 'Horaires',
  turnaround: 'Délai',
  contact_us: 'Contactez-nous',
  portfolio_gallery: 'Galerie de réalisations',
  no_products: 'Aucun produit trouvé',
  retail_price: 'Détail',
  wholesale_price: 'Gros',
  min_wholesale_qty: 'Qté min. gros',
  in_stock: 'En stock',
  out_of_stock: 'Épuisé',
  personal_profile: 'Profil personnel',
  about_story: 'À propos',
  crafts_specialties: 'Métiers & Spécialités',
  showcase_works: 'Galerie',
  training_lessons: 'Tutoriels & Conseils',
  visit_store: 'Visiter la boutique',
  open_store: 'Ouvrir la boutique',
  special_offer: 'Offre spéciale',
  free_shipping: 'Livraison gratuite',
  best_seller: 'Meilleures ventes',
  all_crafts: 'Tous les métiers',
  featured_stores: 'Boutiques vedettes',
  products_count: 'Produits',
  stores_count: 'Boutiques',
};

const DE_DICT: Record<PublicDictKey, string> = {
  ...EN_DICT,
  search_products: 'Handgefertigte Produkte suchen...',
  search_supplies: 'Rohstoffe & Bastelbedarf suchen...',
  all_categories: 'Alle Kategorien',
  add_to_cart: 'In den Warenkorb',
  order_now: 'Jetzt bestellen',
  view_details: 'Details',
  cart: 'Warenkorb',
  wishlist: 'Wunschliste',
  currency: 'Währung',
  language: 'Sprache',
  share: 'Teilen',
  copied: 'Kopiert',
  back_to_market: 'Marktplatz',
  central_market_title: 'Al-Shamsawya Zentralmarkt',
  central_market_sub: 'Authentische Handwerkskunst direkt von verifizierten Werkstätten',
  suppliers_market_title: 'Al-Shamsawya Lieferantenmarkt',
  suppliers_market_sub: 'Rohstoffe für Handwerker im Groß- und Einzelhandel',
  verified_artisan: 'Verifizierter Kunsthandwerker',
  verified_supplier: 'Verifizierter Lieferant',
  contact_us: 'Kontakt',
  personal_profile: 'Persönliches Profil',
  visit_store: 'Shop besuchen',
  open_store: 'Shop öffnen',
  free_shipping: 'Kostenloser Versand',
};

const ES_DICT: Record<PublicDictKey, string> = {
  ...EN_DICT,
  search_products: 'Buscar productos artesanales...',
  search_supplies: 'Buscar materiales e insumos...',
  all_categories: 'Todas las categorías',
  add_to_cart: 'Añadir al carrito',
  order_now: 'Pedir ahora',
  cart: 'Carrito',
  wishlist: 'Favoritos',
  currency: 'Moneda',
  language: 'Idioma',
  share: 'Compartir',
  copied: 'Copiado',
  back_to_market: 'Mercado',
  central_market_title: 'Mercado Central Al-Shamsawya',
  central_market_sub: 'Artesanía auténtica directamente de talleres verificados',
  suppliers_market_title: 'Mercado de Proveedores Al-Shamsawya',
  suppliers_market_sub: 'Materiales al por mayor y menor de proveedores verificados',
  contact_us: 'Contáctanos',
  personal_profile: 'Perfil personal',
  visit_store: 'Visitar tienda',
  open_store: 'Abrir tienda',
  free_shipping: 'Envío gratis',
};

const IT_DICT: Record<PublicDictKey, string> = {
  ...EN_DICT,
  search_products: 'Cerca prodotti artigianali...',
  search_supplies: 'Cerca materiali e forniture...',
  all_categories: 'Tutte le categorie',
  add_to_cart: 'Aggiungi al carrello',
  order_now: 'Ordina ora',
  cart: 'Carrello',
  wishlist: 'Preferiti',
  currency: 'Valuta',
  language: 'Lingua',
  share: 'Condividi',
  copied: 'Copiato',
  back_to_market: 'Mercato',
  central_market_title: 'Mercato Centrale Al-Shamsawya',
  suppliers_market_title: 'Mercato Fornitori Al-Shamsawya',
  contact_us: 'Contattaci',
  personal_profile: 'Profilo personale',
  visit_store: 'Visita il negozio',
  open_store: 'Apri negozio',
};

const TR_DICT: Record<PublicDictKey, string> = {
  ...EN_DICT,
  search_products: 'El yapımı ürünleri ara...',
  search_supplies: 'Hammadde ve malzeme ara...',
  all_categories: 'Tüm Kategoriler',
  add_to_cart: 'Sepete Ekle',
  order_now: 'Şimdi Sipariş Ver',
  cart: 'Sepet',
  wishlist: 'Favoriler',
  currency: 'Para Birimi',
  language: 'Dil',
  share: 'Paylaş',
  copied: 'Kopyalandı',
  back_to_market: 'Pazaryeri',
  central_market_title: 'Al-Shamsawya Merkez Pazaryeri',
  suppliers_market_title: 'Al-Shamsawya Tedarikçi Pazarı',
  contact_us: 'İletişim',
  personal_profile: 'Kişisel Profil',
  visit_store: 'Mağazayı Ziyaret Et',
  open_store: 'Mağazayı Aç',
  free_shipping: 'Ücretsiz Kargo',
};

const NL_DICT: Record<PublicDictKey, string> = {
  ...EN_DICT,
  search_products: 'Zoek handgemaakte producten...',
  search_supplies: 'Zoek grondstoffen en materialen...',
  all_categories: 'Alle categorieën',
  add_to_cart: 'In winkelwagen',
  order_now: 'Bestel nu',
  cart: 'Winkelwagen',
  wishlist: 'Favorieten',
  currency: 'Valuta',
  language: 'Taal',
  share: 'Delen',
  copied: 'Gekopieerd',
  back_to_market: 'Marktplaats',
  central_market_title: 'Al-Shamsawya Centrale Marktplaats',
  suppliers_market_title: 'Al-Shamsawya Leveranciersmarkt',
  contact_us: 'Contact',
  personal_profile: 'Persoonlijk Profiel',
  visit_store: 'Bezoek winkel',
  open_store: 'Open winkel',
};

const DICTIONARIES: Record<PublicLocaleCode, Record<PublicDictKey, string>> = {
  ar: AR_DICT,
  en: EN_DICT,
  fr: FR_DICT,
  de: DE_DICT,
  es: ES_DICT,
  it: IT_DICT,
  tr: TR_DICT,
  nl: NL_DICT,
};

export function getPublicText(locale: PublicLocaleCode, key: PublicDictKey): string {
  return DICTIONARIES[locale]?.[key] || EN_DICT[key] || AR_DICT[key];
}
