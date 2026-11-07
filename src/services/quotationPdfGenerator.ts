// Artisan Quotation PDF Generator (مولد عروض الأسعار الرسمية لورش الشمساوية)
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { UserProfile, SavedProductRecord, CalculationInput, CalculationOutput } from '../types';
import { playSuccessSound } from '../lib/sounds';

export interface QuotationData {
  productName: string;
  productCode?: string;
  craftName?: string;
  category?: string;
  retailPrice: number;
  clientName?: string;
  quotationNumber?: string;
  validDays?: number;
  estimatedProductionDays?: number;
  dimensions?: {
    widthCm?: number;
    totalLengthCm?: number;
    depthCm?: number;
    sideHeightCm?: number;
    diameterCm?: number;
    baseDiameterCm?: number;
  };
  specs?: {
    rawMaterialName?: string;
    cordThicknessMm?: number;
    hasSolidBase?: boolean;
    baseType?: string;
    totalWeightKg?: number;
    stitchesText?: string;
  };
  imageUrl?: string;
  notes?: string;
}

/**
 * تحويل بيانات منتج محفوظ أو مدخلات الحاسبة الحالية إلى بنية عرض السعر الموحدة
 */
export function extractQuotationDataFromRecord(
  record: SavedProductRecord,
  clientName?: string
): QuotationData {
  const input = record.input || ({} as CalculationInput);
  const output = record.output || ({} as CalculationOutput);

  // استخراج نصوص الغرز إن وجدت
  let stitchesText = '';
  if (Array.isArray(input.crochetStitchDistributions) && input.crochetStitchDistributions.length > 0) {
    const stitchNames: Record<string, string> = {
      sc: 'غرزة حشو',
      slst: 'غرزة منزلقة',
      hdc: 'نصف عمود',
      dc: 'عمود بلفة',
      tr: 'عمود بلفتين',
      puff: 'غرز منتفخة / باف',
    };
    stitchesText = input.crochetStitchDistributions
      .map((d) => `${stitchNames[d.stitchType] || d.stitchType} (${d.percentage}%)`)
      .join(' + ');
  }

  // تقدير أيام التنفيذ بحسب ساعات العمل
  const laborHours = Number((output as any)?.laborHours || (record.output as any)?.laborHours) || 8;
  const estimatedDays = Math.max(2, Math.ceil(laborHours / 5));

  return {
    productName: record.productName || 'مشغولة يدوية فاخرة',
    productCode: record.productCode || `PRD-${record.productSerialNumber || '001'}`,
    craftName: record.craftName || 'أشغال يدوية وتطريز',
    category: record.category || record.productType || 'مشغولات',
    retailPrice: record.retailPrice || output.finalSellingPrice || 0,
    clientName: clientName || 'عميلنا الكريم',
    quotationNumber: `QT-${Date.now().toString().slice(-6)}`,
    validDays: 15,
    estimatedProductionDays: estimatedDays,
    dimensions: {
      widthCm: Number(input.widthCm) || 0,
      totalLengthCm: Number(input.totalLengthCm) || 0,
      depthCm: Number(input.crochetDepthCm) || 0,
      sideHeightCm: Number(input.sideHeightCm) || 0,
      diameterCm: Number(input.diameterCm) || 0,
      baseDiameterCm: Number(input.baseDiameterCm) || 0,
    },
    specs: {
      rawMaterialName: input.cordTypeId || 'خيوط وحبال فاخرة منتقاة',
      cordThicknessMm: input.cordThicknessMm || 4,
      hasSolidBase: !!input.hasSolidBase,
      baseType: input.crochetBaseType === 'wooden' ? 'خشب زان ليزر' : input.crochetBaseType === 'leather' ? 'جلد طبيعي مثقوب' : 'نسيج متصل',
      totalWeightKg: output.totalWeightKg || 0,
      stitchesText,
    },
    imageUrl: record.imageUrl || input.productImageUrl,
    notes: input.personalNotes,
  };
}

/**
 * توليد وتحميل ملف PDF رسمي لعرض السعر
 */
export async function generateArtisanQuotationPDF(
  data: QuotationData,
  profile: UserProfile
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const workshopTitle = (profile as any).workshopName || profile.brandName || profile.artistName || 'ورشة الشمساوية للأشغال اليدوية';
  const currency = profile.currencySymbol || 'ج.م';
  const phone = profile.phoneNumber || '';
  const address = (profile as any).address || profile.country || 'جمهورية مصر العربية';
  const logo = profile.logoUrl || '/alshams_falcon_emblem.png';

  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const validUntilDate = new Date(Date.now() + (data.validDays || 15) * 86400000).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // تنسيق الأبعاد
  let dimensionsDisplay = '';
  if (data.dimensions) {
    const parts = [];
    if (data.dimensions.widthCm) parts.push(`العرض: ${data.dimensions.widthCm} سم`);
    if (data.dimensions.totalLengthCm) parts.push(`الطول: ${data.dimensions.totalLengthCm} سم`);
    if (data.dimensions.depthCm) parts.push(`العمق: ${data.dimensions.depthCm} سم`);
    if (data.dimensions.sideHeightCm) parts.push(`الارتفاع: ${data.dimensions.sideHeightCm} سم`);
    if (data.dimensions.diameterCm) parts.push(`القطر: ${data.dimensions.diameterCm} سم`);
    if (data.dimensions.baseDiameterCm) parts.push(`قطر القاعدة: ${data.dimensions.baseDiameterCm} سم`);
    dimensionsDisplay = parts.join(' × ') || 'حسب المواصفة القياسية للورشة';
  }

  // حساب العربون
  const depositAmount = Math.round(data.retailPrice * 0.5);
  const remainingAmount = data.retailPrice - depositAmount;

  // حاوية القالب للـ PDF
  const templateContainer = document.createElement('div');
  templateContainer.id = 'alshams-quotation-pdf-template';
  templateContainer.style.position = 'fixed';
  templateContainer.style.top = '-9999px';
  templateContainer.style.left = '0';
  templateContainer.style.width = '800px';
  templateContainer.style.backgroundColor = '#ffffff';
  templateContainer.style.color = '#1c1917';
  templateContainer.style.fontFamily = "'Cairo', 'Tajawal', sans-serif";
  templateContainer.style.padding = '36px 40px';
  templateContainer.style.direction = 'rtl';
  templateContainer.style.boxSizing = 'border-box';
  templateContainer.style.zIndex = '9999';

  templateContainer.innerHTML = `
    <div style="border: 2px solid #b45309; border-radius: 20px; padding: 28px; background: #fffdfa; position: relative;">
      
      <!-- الهيدر الرسمي وشعار الورشة -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #d97706; padding-bottom: 20px; margin-bottom: 20px;">
        <div style="text-align: right;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #78350f;">${workshopTitle}</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #b45309; font-weight: bold;">مشغولات يدوية أصيلة بأيدي فنانين مصريين</p>
          <div style="margin-top: 8px; font-size: 11px; color: #57534e;">
            ${phone ? `<span>📞 تليفون: <b>${phone}</b></span> &nbsp;|&nbsp; ` : ''}
            <span>📍 ${address}</span>
          </div>
        </div>

        <div style="text-align: center;">
          <img src="${logo}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 16px; border: 1px solid #fde68a;" alt="Logo" />
          <span style="display: block; font-size: 10px; font-weight: bold; color: #92400e; margin-top: 4px;">عيلة الشمساوية</span>
        </div>
      </div>

      <!-- بيانات العرض والعميل -->
      <div style="display: flex; justify-content: space-between; background: #fef3c7; border-radius: 12px; padding: 12px 18px; margin-bottom: 24px;">
        <div>
          <span style="font-size: 11px; color: #92400e; font-weight: bold;">مُوجَّه إلى العميل:</span>
          <h3 style="margin: 2px 0 0 0; font-size: 16px; font-weight: 900; color: #78350f;">${data.clientName || 'عميلنا العزيز'}</h3>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 12px; font-weight: bold; color: #78350f;">رقم العرض: <span style="font-family: monospace;">${data.quotationNumber}</span></div>
          <div style="font-size: 11px; color: #57534e; margin-top: 2px;">تاريخ الإصدار: ${today}</div>
          <div style="font-size: 11px; color: #b45309; font-weight: bold; margin-top: 2px;">ساري حتى: ${validUntilDate}</div>
        </div>
      </div>

      <!-- تفاصيل المشغولة والمواصفات الفنية -->
      <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 900; color: #1c1917; border-right: 4px solid #d97706; padding-right: 8px;">
          المواصفات الفنية للمشغولة الحرفية
        </h4>

        <div style="display: flex; gap: 20px; align-items: flex-start; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 14px; padding: 16px;">
          ${data.imageUrl ? `
            <img src="${data.imageUrl}" style="width: 130px; height: 130px; object-fit: cover; border-radius: 12px; border: 1px solid #d6d3d1; flex-shrink: 0;" alt="Product" />
          ` : `
            <div style="width: 130px; height: 130px; border-radius: 12px; background: #f5f5f4; display: flex; align-items: center; justify-content: center; font-size: 36px; flex-shrink: 0;">🧶</div>
          `}

          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #0c0a09;">${data.productName}</h2>
              <span style="font-size: 11px; font-weight: bold; background: #e7e5e4; padding: 2px 8px; border-radius: 6px; color: #44403c;">${data.craftName}</span>
            </div>

            <div style="margin-top: 12px; font-size: 12px; line-height: 1.8; color: #44403c;">
              <div>• <b>الأبعاد الهندسية:</b> ${dimensionsDisplay}</div>
              <div>• <b>الخامة الأساسية:</b> ${data.specs?.rawMaterialName || 'خيوط منتقاة عالية الجودة'} ${data.specs?.cordThicknessMm ? `(سُمك ${data.specs.cordThicknessMm} مم)` : ''}</div>
              ${data.specs?.stitchesText ? `<div>• <b>توزيع الغرز المعتمد:</b> ${data.specs.stitchesText}</div>` : ''}
              ${data.specs?.hasSolidBase ? `<div>• <b>نوع القاعدة:</b> قاعدة صلبة (${data.specs.baseType})</div>` : ''}
              ${data.specs?.totalWeightKg ? `<div>• <b>الوزن التقديري الصافي:</b> ${data.specs.totalWeightKg} كجم تقريباً</div>` : ''}
              <div>• <b>مدة التنفيذ المقدرة:</b> من ${data.estimatedProductionDays} إلى ${(data.estimatedProductionDays || 3) + 2} أيام عمل يدوي متقن</div>
            </div>
          </div>
        </div>
      </div>

      <!-- جدول التسعير والدفع -->
      <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 900; color: #1c1917; border-right: 4px solid #d97706; padding-right: 8px;">
          الاستثمار المالي وجدول السداد
        </h4>

        <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 12px;">
          <thead>
            <tr style="background: #f5f5f4; border-bottom: 2px solid #d6d3d1;">
              <th style="padding: 10px; font-weight: 900; color: #44403c;">البند والوصف</th>
              <th style="padding: 10px; font-weight: 900; color: #44403c; text-align: center;">الكمية</th>
              <th style="padding: 10px; font-weight: 900; color: #44403c; text-align: left;">القيمة المالية</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e7e5e4;">
              <td style="padding: 12px 10px;">
                <b>مشغولة ${data.productName}</b>
                <div style="font-size: 11px; color: #78716c;">شاملة الخامات والملحقات والإعداد والتنفيذ اليدوي الكامل والتغليف</div>
              </td>
              <td style="padding: 12px 10px; text-align: center; font-weight: bold;">1 قطعة</td>
              <td style="padding: 12px 10px; text-align: left; font-weight: 900; font-size: 15px; color: #78350f;">
                ${data.retailPrice.toLocaleString()} ${currency}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #fffbeb;">
              <td colspan="2" style="padding: 12px 10px; font-weight: 900; font-size: 14px; color: #92400e;">
                إجمالي الاستثمار النهائي المطلوب:
              </td>
              <td style="padding: 12px 10px; text-align: left; font-weight: 900; font-size: 18px; color: #b45309;">
                ${data.retailPrice.toLocaleString()} ${currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- شروط الحجز والتنفيذ -->
      <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
        <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 900; color: #44403c;">شروط الحجز والتنفيذ والتسليم:</h5>
        <div style="font-size: 11px; line-height: 1.8; color: #57534e;">
          <div>1. <b>العربون وتأكيد الطلب:</b> يتم سداد <b>50% (${depositAmount.toLocaleString()} ${currency})</b> كعربون لبدء شراء الخامات والتنفيذ.</div>
          <div>2. <b>المتبقي عند الاستلام:</b> يتم سداد <b>50% (${remainingAmount.toLocaleString()} ${currency})</b> عند المعاينة والاستلام أو مع مندوب الشحن.</div>
          <div>3. <b>الشحن والتوصيل:</b> متاح التوصيل المباشر لباب المنزل في كافة المحافظات مع التغليف الآمن المتقن.</div>
          <div>4. <b>التعديلات الخاصة:</b> أي تعديل على المقاسات أو الألوان متاح خلال أول 24 ساعة من تأكيد الحجز.</div>
        </div>
      </div>

      <!-- خاتمة وشكر راقٍ -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #d6d3d1; pt: 16px; margin-top: 16px;">
        <div>
          <p style="margin: 0; font-size: 12px; font-weight: bold; color: #78350f;">
            شكراً لثقتكم الغالية ودعمكم الدائم للفن الحرفي اليدوي المصري ✨
          </p>
          <span style="font-size: 10px; color: #a8a29e;">صادر إلكترونياً ومعتمد من منظومة الشمساوية لإدارة الورش الحرفية</span>
        </div>

        <div style="text-align: center; border-right: 1px solid #e7e5e4; padding-right: 16px;">
          <div style="font-size: 10px; font-weight: bold; color: #78716c; margin-bottom: 4px;">توقيع واعتماد الورشة</div>
          <div style="font-family: serif; font-size: 16px; font-weight: bold; color: #b45309;">${workshopTitle}</div>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(templateContainer);

  try {
    const canvas = await html2canvas(templateContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    document.body.removeChild(templateContainer);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    
    // اسم ملف نظيف بالعربية
    const sanitizedName = data.productName.replace(/[\\/:*?"<>|]/g, '_');
    pdf.save(`عرض_سعر_${sanitizedName}.pdf`);

    playSuccessSound();
    return true;
  } catch (err) {
    console.error('Failed to generate quotation PDF:', err);
    if (document.body.contains(templateContainer)) {
      document.body.removeChild(templateContainer);
    }
    return false;
  }
}
