/**
 * Al-Shams Craft Unified Slug & URL Generator
 * Handles clean ASCII & Arabic transliterated slugs for Artisan Stores.
 */

const ARABIC_TRANSLITERATION_MAP: Record<string, string> = {
  'الشمساوية': 'alshamsawiyah',
  'الشمساويه': 'alshamsawiyah',
  'شمس': 'shams',
  'الشمس': 'alshams',
  'كرافت': 'craft',
  'ورشة': 'workshop',
  'ورشه': 'workshop',
  'چوتارا': 'joutara',
  'جوتارا': 'joutara',
  'سبايدر': 'spider',
  'صقر': 'falcon',
  'مكرمية': 'macrame',
  'هاند ميد': 'handmade',
  'هاند': 'hand',
  'ميد': 'made',
  'أ': 'a',
  'ا': 'a',
  'إ': 'e',
  'آ': 'a',
  'ب': 'b',
  'ت': 't',
  'ث': 'th',
  'ج': 'j',
  'ح': 'h',
  'خ': 'kh',
  'د': 'd',
  'ذ': 'th',
  'ر': 'r',
  'ز': 'z',
  'س': 's',
  'ش': 'sh',
  'ص': 's',
  'ض': 'd',
  'ط': 't',
  'ظ': 'z',
  'ع': 'a',
  'غ': 'gh',
  'ف': 'f',
  'ق': 'q',
  'ك': 'k',
  'ل': 'l',
  'م': 'm',
  'ن': 'n',
  'ه': 'h',
  'و': 'w',
  'ي': 'y',
  'ى': 'a',
  'ئ': 'e',
  'ء': 'a',
  'ؤ': 'o',
  'ة': 'a',
  'چ': 'j',
  'پ': 'p',
  'ڤ': 'v',
  '&': '-and-',
  '+': '-and-',
};

/**
 * Generates a clean URL-friendly slug from any string
 */
export function generateCleanStoreSlug(rawName: string): string {
  if (!rawName) return 'artisan-store';

  let text = rawName.trim().toLowerCase();

  // Replace common Arabic whole words first
  Object.keys(ARABIC_TRANSLITERATION_MAP).forEach((word) => {
    if (word.length > 1 && text.includes(word)) {
      text = text.replace(new RegExp(word, 'g'), ARABIC_TRANSLITERATION_MAP[word]);
    }
  });

  // Replace individual characters
  let output = '';
  for (const char of text) {
    if (ARABIC_TRANSLITERATION_MAP[char]) {
      output += ARABIC_TRANSLITERATION_MAP[char];
    } else if (/[a-z0-9]/.test(char)) {
      output += char;
    } else if (/[\s\-_.]+/.test(char)) {
      output += '-';
    } else if (/[\u0621-\u064A]/.test(char)) {
      output += char;
    }
  }

  // Clean hyphens
  output = output
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return output || 'artisan-store';
}

export interface WorkshopSlugSource {
  store_slug?: string;
  storeSlug?: string;
  brand_name?: string;
  brandName?: string;
  artist_name?: string;
  artistName?: string;
  id?: string;
  workshopId?: string;
}

/**
 * Returns the definitive clean slug for a workshop
 */
export function getWorkshopCleanSlug(workshop: WorkshopSlugSource | null | undefined): string {
  if (!workshop) return 'artisan-store';

  const customSlug = workshop.store_slug || workshop.storeSlug;
  if (customSlug && typeof customSlug === 'string' && customSlug.trim()) {
    return customSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0621-\u064A-]/g, '');
  }

  const primaryName = workshop.brandName || workshop.brand_name || workshop.artistName || workshop.artist_name || workshop.id || 'artisan';
  return generateCleanStoreSlug(primaryName);
}

/**
 * Returns the public URL for the artisan's store
 */
export function getWorkshopStoreUrl(workshop: WorkshopSlugSource | null | undefined): string {
  const slug = getWorkshopCleanSlug(workshop);
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/#/store/${slug}`;
  }
  return `https://alshamsawiyah.ai.studio/#/store/${slug}`;
}

/**
 * Checks if a candidate slug matches a workshop record
 */
export function matchesWorkshopSlug(workshop: any, testSlug: string): boolean {
  if (!workshop || !testSlug) return false;
  const target = decodeURIComponent(testSlug).toLowerCase().trim().replace(/^@/, '');

  const explicitSlug = (workshop.store_slug || workshop.storeSlug || '').toLowerCase().trim();
  if (explicitSlug && (explicitSlug === target || explicitSlug.replace(/\s+/g, '-') === target)) {
    return true;
  }

  const generated = getWorkshopCleanSlug(workshop);
  if (generated === target) return true;

  const brand = (workshop.brand_name || workshop.brandName || '').toLowerCase().trim();
  const artist = (workshop.artist_name || workshop.artistName || '').toLowerCase().trim();
  const id = (workshop.id || workshop.workshopId || '').toLowerCase().trim();

  if (brand === target || brand.replace(/\s+/g, '-') === target) return true;
  if (artist === target || artist.replace(/\s+/g, '-') === target) return true;
  if (id === target) return true;

  return false;
}
