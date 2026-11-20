// ==============================================================================
// استوديو صور المنتجات لصقر الشمساوية — تحت الإنشاء (بدون أي APIs مدفوعة)
// تم إزالة كافة استدعاءات نماذج توليد الصور المدفوعة بناءً على سياسة المنظومة المجانية.
// ==============================================================================

export type FalconStudioMode = 'store' | 'workshop' | 'home';

export interface FalconStudioInput {
  mode: FalconStudioMode;
  imageBase64?: string;
  mimeType?: string;
  userPrompt?: string;
  workshopContext?: {
    selectedCrafts?: string[];
    category?: string;
    brandName?: string;
    artistName?: string;
    accountRole?: 'artisan' | 'supplier' | string;
    country?: string;
  };
}

export interface FalconStudioResult {
  underConstruction: true;
  mode: FalconStudioMode;
  message: string;
}

export const FALCON_STUDIO_UNDER_CONSTRUCTION_MESSAGE =
  '🚧 استوديو صقر لتجهيز صور المنتجات تحت الإنشاء حالياً — بنجهّزه بإصدار مجاني بالكامل لكل فناني وموردي الشمساوية قريباً بإذن الله.';

export async function generateFalconStudioImage(
  input: FalconStudioInput
): Promise<FalconStudioResult> {
  return {
    underConstruction: true,
    mode: input.mode,
    message: FALCON_STUDIO_UNDER_CONSTRUCTION_MESSAGE,
  };
}
