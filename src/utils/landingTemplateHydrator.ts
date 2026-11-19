import { DEFAULT_LANDING_MEDIA, LandingCmsConfig } from '../types/landingCms';

export interface LandingTokenInfo {
  token: string;
  label: string;
  category: 'brand' | 'hero' | 'sections' | 'lists' | 'actions';
}

export const LANDING_TEMPLATE_TOKENS: LandingTokenInfo[] = [
  // Brand & Media
  { token: '{{brand.logo}}', label: 'رابط شعار المنظومة (نهاري/ليلي)', category: 'brand' },
  { token: '{{brand.icon}}', label: 'رابط أيقونة المنظومة', category: 'brand' },
  { token: '{{brand.falcon}}', label: 'رابط صورة صقر AI', category: 'brand' },
  { token: '{{brand.shamousa}}', label: 'رابط صورة شموسة', category: 'brand' },
  { token: '{{media.heroImage}}', label: 'صورة الهيرو التحريرية', category: 'brand' },
  { token: '{{media.materialsImage}}', label: 'صورة منظومة الخامات', category: 'brand' },
  { token: '{{media.supplierImage}}', label: 'صورة معرض الموردين', category: 'brand' },
  // Hero & Header
  { token: '{{header.ctaButtonText}}', label: 'نص زر الدخول العلوي', category: 'hero' },
  { token: '{{hero.headlineLine1}}', label: 'العنوان الرئيسي — سطر 1', category: 'hero' },
  { token: '{{hero.headlineHighlight}}', label: 'العنوان الرئيسي — المميز', category: 'hero' },
  { token: '{{hero.description}}', label: 'الوصف الرئيسي للهيرو', category: 'hero' },
  { token: '{{hero.primaryCtaText}}', label: 'زر التسجيل الرئيسي', category: 'hero' },
  { token: '{{hero.secondaryCtaText}}', label: 'زر التسجيل الثانوي (الموردين)', category: 'hero' },
  // Key Sections
  { token: '{{sections.unifiedEngine.title}}', label: 'عنوان الخامات والورش الـ 14', category: 'sections' },
  { token: '{{sections.unifiedEngine.subtitle}}', label: 'وصف الخامات والورش الـ 14', category: 'sections' },
  { token: '{{sections.safeAccounts.title}}', label: 'عنوان المالية وهلخصهالك', category: 'sections' },
  { token: '{{sections.safeAccounts.subtitle}}', label: 'وصف المالية وهلخصهالك', category: 'sections' },
  { token: '{{sections.aiPartners.title}}', label: 'عنوان صقر وشموسة', category: 'sections' },
  { token: '{{sections.aiPartners.falconDescription}}', label: 'وصف صقر الهندسي', category: 'sections' },
  { token: '{{sections.aiPartners.shamousaDescription}}', label: 'وصف شموسة العملياتي', category: 'sections' },
  { token: '{{sections.craftStore.titleLine1}}', label: 'عنوان المتجر وسوق الشمساوية', category: 'sections' },
  { token: '{{sections.craftStore.description}}', label: 'وصف المتجر والسوق', category: 'sections' },
  { token: '{{sections.suppliersPromo.titleLine1}}', label: 'عنوان بوابة الموردين B2B', category: 'sections' },
  { token: '{{sections.suppliersPromo.description}}', label: 'وصف بوابة الموردين', category: 'sections' },
  { token: '{{sections.finalCta.title}}', label: 'عنوان البانر الختامي', category: 'sections' },
  { token: '{{sections.footer.copyrightText}}', label: 'حقوق النشر بالتذييل', category: 'sections' },
  // Auto-rendered HTML Lists
  { token: '{{lists.navLinks}}', label: 'روابط الشريط العلوي (HTML جاهز)', category: 'lists' },
  { token: '{{lists.heroMetrics}}', label: 'مؤشرات الهيرو الـ 4 (HTML جاهز)', category: 'lists' },
  { token: '{{lists.unifiedEngineCards}}', label: 'بطاقات الخامات والورش (HTML جاهز)', category: 'lists' },
  { token: '{{lists.pipelineSteps}}', label: 'مسار الإنتاج الـ 6 خطوات (HTML جاهز)', category: 'lists' },
  { token: '{{lists.safeAccountsCards}}', label: 'بطاقات المالية وهلخصهالك (HTML جاهز)', category: 'lists' },
  { token: '{{lists.craftLifecycleSteps}}', label: 'خطوات دورة حياة المشغولة (HTML جاهز)', category: 'lists' },
  { token: '{{lists.suppliersBullets}}', label: 'مميزات بوابة الموردين (HTML جاهز)', category: 'lists' },
  { token: '{{lists.reviews}}', label: 'شهادات وحكايات الورش (HTML جاهز)', category: 'lists' },
  { token: '{{lists.whatsNew}}', label: 'تحديثات V 5.0 (HTML جاهز)', category: 'lists' },
  { token: '{{lists.faq}}', label: 'الأسئلة الشائعة التفاعلية (HTML جاهز)', category: 'lists' },
  // Action attributes
  { token: 'data-action="register"', label: 'ربط الزر بفتح تسجيل فنان', category: 'actions' },
  { token: 'data-action="register-supplier"', label: 'ربط الزر بفتح تسجيل مورد', category: 'actions' },
  { token: 'data-action="login"', label: 'ربط الزر بفتح تسجيل الدخول', category: 'actions' },
  { token: 'data-action="toggle-theme"', label: 'ربط الزر بتبديل النهاري/الليلي', category: 'actions' },
];

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNestedValue(obj: Record<string, any>, path: string): unknown {
  return path.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
}

export function buildAutoHydratedMap(cms: LandingCmsConfig, isDarkMode: boolean): Record<string, string> {
  const variant = isDarkMode ? 'dark' : 'light';
  const logo = cms.brandAssets.platformLogo[variant] || cms.brandAssets.platformLogo.light;
  const icon = cms.brandAssets.brandIcon[variant] || cms.brandAssets.brandIcon.light;
  const falcon = cms.brandAssets.falconMascot[variant] || cms.brandAssets.falconMascot.light;
  const shamousa = cms.brandAssets.shamousaMascot[variant] || cms.brandAssets.shamousaMascot.light;

  const heroImage = cms.designConfig?.heroImageUrl || DEFAULT_LANDING_MEDIA.heroImageUrl;
  const materialsImage = cms.designConfig?.materialsImageUrl || DEFAULT_LANDING_MEDIA.materialsImageUrl;
  const supplierImage = cms.designConfig?.supplierImageUrl || DEFAULT_LANDING_MEDIA.supplierImageUrl;

  const navLinksHtml = (cms.header.navLinks || [])
    .map((l) => `<a href="${escapeHtml(l.href)}" class="shams-nav-link">${escapeHtml(l.label)}</a>`)
    .join('\n');

  const heroMetricsHtml = (cms.hero.metrics || [])
    .map(
      (m) => `
      <div class="shams-metric">
        <div class="shams-metric-val">${escapeHtml(m.value)}</div>
        <div class="shams-metric-label">${escapeHtml(m.label)}</div>
        <div class="shams-metric-detail">${escapeHtml(m.detail)}</div>
      </div>`
    )
    .join('\n');

  const unifiedCardsHtml = (cms.sections.unifiedEngine?.cards || [])
    .map(
      (c, i) => `
      <article class="shams-card">
        <div class="shams-kicker">0${i + 1}</div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
      </article>`
    )
    .join('\n');

  const pipelineHtml = (cms.sections.unifiedEngine?.pipelineSteps || [])
    .map(
      (s, i) => `<div class="shams-step"><span>0${i + 1}</span><strong>${escapeHtml(s)}</strong></div>`
    )
    .join('\n');

  const safeAccountsHtml = (cms.sections.safeAccounts.cards || [])
    .map(
      (c, i) => `
      <article class="shams-card">
        <div class="shams-kicker">0${i + 1}</div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
      </article>`
    )
    .join('\n');

  const lifecycleHtml = (cms.sections.craftLifecycle.steps || [])
    .map(
      (s) => `
      <article class="shams-card">
        <div class="shams-kicker">${escapeHtml(s.stepNumber)}</div>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.description)}</p>
      </article>`
    )
    .join('\n');

  const suppliersBulletsHtml = (cms.sections.suppliersPromo.bullets || [])
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('\n');

  const craftStoreBulletsHtml = (cms.sections.craftStore.bullets || [])
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('\n');

  const reviewsHtml = (cms.sections.reviews.items || [])
    .map(
      (r) => `
      <blockquote class="shams-review">
        <p>"${escapeHtml(r.quote)}"</p>
        <footer><strong>${escapeHtml(r.author)}</strong> · <span>${escapeHtml(r.workshop)}</span></footer>
      </blockquote>`
    )
    .join('\n');

  const whatsNewHtml = (cms.sections.whatsNew.items || [])
    .map(
      (u) => `
      <article class="shams-card">
        <div class="shams-kicker">${escapeHtml(u.tag)} · ${escapeHtml(u.version)}</div>
        <h3>${escapeHtml(u.title)}</h3>
        <p>${escapeHtml(u.description)}</p>
      </article>`
    )
    .join('\n');

  const faqHtml = (cms.sections.faq.items || [])
    .map(
      (f) => `
      <details class="shams-faq-item">
        <summary>${escapeHtml(f.q)}</summary>
        <p>${escapeHtml(f.a)}</p>
      </details>`
    )
    .join('\n');

  return {
    'brand.logo': logo,
    'brand.icon': icon,
    'brand.falcon': falcon,
    'brand.shamousa': shamousa,
    'media.heroImage': heroImage,
    'media.materialsImage': materialsImage,
    'media.supplierImage': supplierImage,
    'lists.navLinks': navLinksHtml,
    'lists.heroMetrics': heroMetricsHtml,
    'lists.unifiedEngineCards': unifiedCardsHtml,
    'lists.pipelineSteps': pipelineHtml,
    'lists.safeAccountsCards': safeAccountsHtml,
    'lists.craftLifecycleSteps': lifecycleHtml,
    'lists.suppliersBullets': suppliersBulletsHtml,
    'lists.craftStoreBullets': craftStoreBulletsHtml,
    'lists.reviews': reviewsHtml,
    'lists.whatsNew': whatsNewHtml,
    'lists.faq': faqHtml,
  };
}

export function hydrateInjectedLandingDocument(
  rawHtml: string,
  rawCss: string,
  cms: LandingCmsConfig,
  isDarkMode: boolean
): string {
  const autoMap = buildAutoHydratedMap(cms, isDarkMode);
  const autoHydrateEnabled = cms.designConfig?.injectedTemplate?.autoHydrate !== false;

  const replaceToken = (_match: string, keyRaw: string): string => {
    const key = String(keyRaw || '').trim();
    if (key in autoMap) {
      return autoMap[key];
    }
    const nested = getNestedValue(cms as any, key);
    if (typeof nested === 'string' || typeof nested === 'number') {
      return escapeHtml(nested);
    }
    return '';
  };

  let hydratedBody = String(rawHtml || '');
  let hydratedCss = String(rawCss || '');

  if (autoHydrateEnabled) {
    hydratedBody = hydratedBody.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, replaceToken);
    hydratedCss = hydratedCss.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, replaceToken);
  }

  // Strip raw <script> tags supplied inside custom HTML for safety; our controlled bridge script handles actions & hydration
  const safeBody = hydratedBody.replace(/<script[\s\S]*?<\/script>/gi, '');

  const serializedSlotData = JSON.stringify({
    'hero.headlineLine1': cms.hero.headlineLine1,
    'hero.headlineHighlight': cms.hero.headlineHighlight,
    'hero.description': cms.hero.description,
    'hero.primaryCtaText': cms.hero.primaryCtaText,
    'hero.secondaryCtaText': cms.hero.secondaryCtaText,
    'header.ctaButtonText': cms.header.ctaButtonText,
    'sections.unifiedEngine.title': cms.sections.unifiedEngine?.title || '',
    'sections.unifiedEngine.subtitle': cms.sections.unifiedEngine?.subtitle || '',
    'sections.safeAccounts.title': cms.sections.safeAccounts.title,
    'sections.safeAccounts.subtitle': cms.sections.safeAccounts.subtitle,
    'sections.aiPartners.title': cms.sections.aiPartners.title,
    'sections.aiPartners.falconDescription': cms.sections.aiPartners.falconDescription,
    'sections.aiPartners.shamousaDescription': cms.sections.aiPartners.shamousaDescription,
    'sections.suppliersPromo.titleLine1': cms.sections.suppliersPromo.titleLine1,
    'sections.suppliersPromo.description': cms.sections.suppliersPromo.description,
    'sections.finalCta.title': cms.sections.finalCta.title,
    'sections.footer.copyrightText': cms.sections.footer.copyrightText,
  }).replace(/</g, '\\u003c');

  const isFullDoc = /<html[\s>]/i.test(safeBody);

  const bridgeScript = `
<script>
(function(){
  var slotData = ${serializedSlotData};
  if (${autoHydrateEnabled ? 'true' : 'false'}) {
    document.querySelectorAll('[data-slot]').forEach(function(el){
      var key = el.getAttribute('data-slot');
      if (key && slotData[key]) {
        el.textContent = slotData[key];
      }
    });
  }
  function sendAction(action) {
    try { window.parent.postMessage({ type: 'alshams_injected_action', action: action }, '*'); } catch(e){}
  }
  document.addEventListener('click', function(e){
    var target = e.target && e.target.closest ? e.target.closest('[data-action], button, a') : null;
    if (!target) return;
    var explicit = target.getAttribute('data-action');
    if (explicit) {
      e.preventDefault();
      sendAction(explicit);
      return;
    }
    var href = target.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    if (target.tagName === 'BUTTON' || href === '' || href === '/register' || href === '/login') {
      var txt = (target.textContent || '').trim();
      if (/مورد|تاجر|b2b/i.test(txt)) { e.preventDefault(); sendAction('register-supplier'); }
      else if (/دخول|تسجيل الدخول/i.test(txt)) { e.preventDefault(); sendAction('login'); }
      else if (/سجل|افتح|ابدأ|انضم|جرّب/i.test(txt)) { e.preventDefault(); sendAction('register'); }
    }
  });
  function reportHeight(){
    try {
      var h = Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0, 720);
      window.parent.postMessage({ type: 'alshams_injected_height', height: h }, '*');
    } catch(e){}
  }
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);
  setTimeout(reportHeight, 250);
  setTimeout(reportHeight, 900);
})();
</script>`;

  const baseHead = `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; overflow-x: clip; }
    img { max-width: 100%; height: auto; }
    ${hydratedCss}
  </style>`;

  if (isFullDoc) {
    return safeBody
      .replace(/<\/head>/i, `${baseHead}</head>`)
      .replace(/<\/body>/i, `${bridgeScript}</body>`);
  }

  return `<!doctype html>
<html lang="ar" dir="rtl" class="${isDarkMode ? 'dark' : ''}">
<head>${baseHead}</head>
<body>
${safeBody}
${bridgeScript}
</body>
</html>`;
}

export const STARTER_INJECTED_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  html: string;
  css: string;
}> = [
  {
    id: 'starter_editorial_atelier',
    name: 'القالب التحريري المعماري المربوط ببياناتك',
    description: 'تصميم عربي RTL فاخر يستورد تلقائياً شعاراتك، نصوص الهيرو، مؤشرات الأرقام، الورش، الموردين، الشهادات، والأسئلة الشائعة دون إعادة كتابة حرف واحد.',
    html: `<header class="topbar">
  <div class="container topbar-inner">
    <a href="#" class="brand"><img src="{{brand.logo}}" alt="الشمساوية" /></a>
    <nav class="nav">{{lists.navLinks}}</nav>
    <div class="actions">
      <button type="button" class="btn-ghost" data-action="login">دخول</button>
      <button type="button" class="btn-primary" data-action="register">{{header.ctaButtonText}}</button>
    </div>
  </div>
</header>

<section class="hero">
  <div class="container hero-grid">
    <div class="hero-copy">
      <p class="kicker">منظومة الشمساوية · الإصدار الخامس</p>
      <h1>{{hero.headlineLine1}}<br /><span class="accent">{{hero.headlineHighlight}}</span></h1>
      <p class="lead">{{hero.description}}</p>
      <div class="hero-cta">
        <button type="button" class="btn-primary btn-lg" data-action="register">{{hero.primaryCtaText}}</button>
        <button type="button" class="btn-outline btn-lg" data-action="register-supplier">{{hero.secondaryCtaText}}</button>
      </div>
    </div>
    <div class="hero-media">
      <img src="{{media.heroImage}}" alt="ورشة الشمساوية" />
    </div>
  </div>
  <div class="container metrics-strip">{{lists.heroMetrics}}</div>
</section>

<section id="unified-engine" class="section">
  <div class="container">
    <p class="kicker">01 · الخامات الموحدة والورش الـ 14</p>
    <h2>{{sections.unifiedEngine.title}}</h2>
    <p class="sub">{{sections.unifiedEngine.subtitle}}</p>
    <div class="grid-2">{{lists.unifiedEngineCards}}</div>
    <div class="pipeline">{{lists.pipelineSteps}}</div>
  </div>
</section>

<section id="safe-accounts" class="section alt">
  <div class="container">
    <p class="kicker">02 · المالية وبطاقة هلخصهالك</p>
    <h2>{{sections.safeAccounts.title}}</h2>
    <p class="sub">{{sections.safeAccounts.subtitle}}</p>
    <div class="grid-4">{{lists.safeAccountsCards}}</div>
  </div>
</section>

<section id="ai-partners" class="section">
  <div class="container">
    <p class="kicker">03 · صقر وشموسة</p>
    <h2>{{sections.aiPartners.title}}</h2>
    <div class="grid-2">
      <div class="ai-box">
        <img src="{{brand.falcon}}" alt="صقر" />
        <div><h3>صقر الشمساوية</h3><p>{{sections.aiPartners.falconDescription}}</p></div>
      </div>
      <div class="ai-box">
        <img src="{{brand.shamousa}}" alt="شموسة" />
        <div><h3>شموسة</h3><p>{{sections.aiPartners.shamousaDescription}}</p></div>
      </div>
    </div>
  </div>
</section>

<section id="suppliers-promo" class="section alt">
  <div class="container hero-grid">
    <div>
      <p class="kicker">04 · بوابة الموردين B2B</p>
      <h2>{{sections.suppliersPromo.titleLine1}}</h2>
      <p class="sub">{{sections.suppliersPromo.description}}</p>
      <ul class="bullet-list">{{lists.suppliersBullets}}</ul>
      <button type="button" class="btn-primary" data-action="register-supplier">سجل كمورد خامات الآن</button>
    </div>
    <div class="hero-media"><img src="{{media.supplierImage}}" alt="معرض الموردين" /></div>
  </div>
</section>

<section id="reviews" class="section">
  <div class="container">
    <h2>حكايات نجاح من قلب ورش ومخازن الشمساوية</h2>
    <div class="grid-2">{{lists.reviews}}</div>
  </div>
</section>

<section id="faq-section" class="section alt">
  <div class="container narrow">
    <h2>الأسئلة الشائعة</h2>
    <div class="faq-list">{{lists.faq}}</div>
  </div>
</section>

<section class="final-cta">
  <div class="container center">
    <h2>{{sections.finalCta.title}}</h2>
    <button type="button" class="btn-primary btn-lg" data-action="register">{{hero.primaryCtaText}}</button>
  </div>
</section>

<footer class="footer">
  <div class="container footer-inner">
    <span>{{sections.footer.copyrightText}}</span>
  </div>
</footer>`,
    css: `:root { --bg: #F6F2EA; --surface: #FFFFFF; --ink: #0C1427; --muted: #475569; --border: #DDD4C3; --accent: #EA580C; }
html.dark { --bg: #070C1A; --surface: #0F172A; --ink: #F7F3EA; --muted: #CBD5E1; --border: #1E293B; --accent: #F59E0B; }
body { background: var(--bg); color: var(--ink); line-height: 1.7; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.narrow { max-width: 820px; }
.topbar { position: sticky; top: 0; z-index: 20; background: var(--bg); border-bottom: 1px solid var(--border); }
.topbar-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; height: 74px; }
.brand img { height: 42px; object-fit: contain; }
.nav { display: flex; gap: 22px; }
.shams-nav-link { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 700; white-space: nowrap; }
.shams-nav-link:hover { color: var(--accent); }
.actions { display: flex; gap: 10px; }
.btn-primary { background: var(--accent); color: #fff; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; font-family: inherit; }
.btn-ghost { background: transparent; color: var(--ink); border: 1px solid var(--border); padding: 10px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; font-family: inherit; }
.btn-outline { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); padding: 12px 22px; border-radius: 10px; font-weight: 800; cursor: pointer; font-family: inherit; }
.btn-lg { padding: 13px 26px; font-size: 15px; }
.hero { padding: 64px 0 48px; border-bottom: 1px solid var(--border); }
.hero-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; }
.kicker { font-size: 13px; font-weight: 800; color: var(--accent); margin: 0 0 10px; }
h1 { font-size: clamp(2rem, 3.8vw, 3.25rem); line-height: 1.2; margin: 0 0 16px; font-weight: 900; }
.accent { color: var(--accent); }
.lead, .sub { color: var(--muted); font-size: 16px; max-width: 62ch; margin: 0 0 24px; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; }
.hero-media img { width: 100%; border-radius: 18px; border: 1px solid var(--border); display: block; object-fit: cover; aspect-ratio: 16/10; }
.metrics-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--border); }
.shams-metric-val { font-size: 28px; font-weight: 900; color: var(--accent); }
.shams-metric-label { font-size: 14px; font-weight: 800; }
.shams-metric-detail { font-size: 12px; color: var(--muted); }
.section { padding: 72px 0; border-bottom: 1px solid var(--border); }
.section.alt { background: var(--surface); }
h2 { font-size: clamp(1.5rem, 2.6vw, 2.3rem); margin: 0 0 12px; font-weight: 900; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.shams-card, .shams-review, .ai-box { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
.section.alt .shams-card { background: var(--bg); }
.shams-kicker { font-size: 12px; font-weight: 800; color: var(--accent); margin-bottom: 8px; }
.shams-card h3 { margin: 0 0 8px; font-size: 17px; }
.shams-card p { margin: 0; font-size: 14px; color: var(--muted); }
.pipeline { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 28px; }
.shams-step { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: var(--surface); font-size: 13px; }
.shams-step span { display: block; font-size: 11px; color: var(--accent); font-weight: 800; }
.ai-box { display: flex; gap: 18px; align-items: center; }
.ai-box img { width: 92px; height: 92px; object-fit: contain; flex-shrink: 0; }
.bullet-list { padding-right: 18px; margin: 0 0 22px; color: var(--ink); font-weight: 600; font-size: 14px; }
.bullet-list li { margin-bottom: 8px; }
.shams-review { margin: 0; }
.shams-review footer { margin-top: 14px; font-size: 13px; color: var(--muted); }
.faq-list { display: flex; flex-direction: column; gap: 12px; }
.shams-faq-item { border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; background: var(--bg); }
.shams-faq-item summary { font-weight: 800; cursor: pointer; }
.shams-faq-item p { margin: 10px 0 0; color: var(--muted); font-size: 14px; }
.final-cta { padding: 72px 0; background: #0C1427; color: #F7F3EA; text-align: center; }
.final-cta h2 { margin-bottom: 24px; }
.footer { padding: 28px 0; text-align: center; font-size: 13px; color: var(--muted); }
@media (max-width: 900px) {
  .nav { display: none; }
  .hero-grid, .grid-2, .grid-4, .metrics-strip, .pipeline { grid-template-columns: 1fr; }
}`,
  },
  {
    id: 'starter_dual_conversion',
    name: 'قالب المسارين السريع (فنانون × موردون)',
    description: 'واجهة مركّزة عالية التحويل تفصل منذ أول شاشة بين مسار الورش والفنانين ومسار الموردين وأصحاب الفروع، مع سحب تلقائي لكل بياناتك.',
    html: `<header class="bar">
  <div class="wrap bar-flex">
    <img src="{{brand.logo}}" alt="الشمساوية" class="logo" />
    <div class="bar-links">{{lists.navLinks}}</div>
    <button type="button" class="cta" data-action="login">{{header.ctaButtonText}}</button>
  </div>
</header>
<main class="wrap">
  <section class="hero-center">
    <p class="eyebrow">منظومة الشمساوية · V 5.0</p>
    <h1>{{hero.headlineLine1}} <span>{{hero.headlineHighlight}}</span></h1>
    <p class="desc">{{hero.description}}</p>
    <div class="dual-cards">
      <div class="track-card">
        <h3>مسار الورش والفنانين الحرفيين</h3>
        <p>{{sections.unifiedEngine.subtitle}}</p>
        <button type="button" class="cta full" data-action="register">{{hero.primaryCtaText}}</button>
      </div>
      <div class="track-card dark-card">
        <h3>مسار الموردين والفروع والكاشير (B2B)</h3>
        <p>{{sections.suppliersPromo.description}}</p>
        <button type="button" class="cta-light full" data-action="register-supplier">{{hero.secondaryCtaText}}</button>
      </div>
    </div>
  </section>
  <section class="metrics">{{lists.heroMetrics}}</section>
  <section class="block">
    <h2>{{sections.safeAccounts.title}}</h2>
    <div class="cards-2">{{lists.safeAccountsCards}}</div>
  </section>
  <section class="block">
    <h2>تحديثات المنظومة</h2>
    <div class="cards-3">{{lists.whatsNew}}</div>
  </section>
  <section class="block">
    <h2>الأسئلة الشائعة</h2>
    <div class="faq">{{lists.faq}}</div>
  </section>
</main>
<footer class="foot">{{sections.footer.copyrightText}}</footer>`,
    css: `body { background: #0A0F1F; color: #F7F3EA; line-height: 1.7; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 22px; }
.bar { border-bottom: 1px solid #1E293B; background: rgba(10,15,31,0.95); position: sticky; top: 0; }
.bar-flex { display: flex; align-items: center; justify-content: space-between; height: 72px; gap: 20px; }
.logo { height: 40px; }
.bar-links { display: flex; gap: 18px; }
.shams-nav-link { color: #CBD5E1; text-decoration: none; font-size: 13px; font-weight: 700; }
.cta { background: #EA580C; color: #fff; border: 0; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; font-family: inherit; }
.cta-light { background: #F7F3EA; color: #0C1427; border: 0; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; font-family: inherit; }
.full { width: 100%; padding: 13px; }
.hero-center { padding: 64px 0 36px; text-align: center; }
.eyebrow { color: #FBBF24; font-weight: 800; font-size: 13px; margin: 0 0 10px; }
h1 { font-size: clamp(2rem, 4vw, 3.2rem); margin: 0 0 14px; font-weight: 900; }
h1 span { color: #FBBF24; }
.desc { color: #CBD5E1; max-width: 68ch; margin: 0 auto 36px; }
.dual-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: right; }
.track-card { background: #111A33; border: 1px solid #22355E; border-radius: 18px; padding: 26px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }
.dark-card { background: #19132E; border-color: #EA580C; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 28px 0; border-y: 1px solid #1E293B; }
.shams-metric-val { font-size: 26px; font-weight: 900; color: #FBBF24; }
.shams-metric-label { font-size: 14px; font-weight: 800; }
.shams-metric-detail { font-size: 12px; color: #94A3B8; }
.block { padding: 56px 0; border-bottom: 1px solid #1E293B; }
h2 { font-size: 26px; margin: 0 0 22px; font-weight: 900; }
.cards-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.cards-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.shams-card { background: #111A33; border: 1px solid #22355E; border-radius: 14px; padding: 20px; }
.shams-kicker { font-size: 12px; color: #FBBF24; font-weight: 800; margin-bottom: 6px; }
.shams-card p { color: #CBD5E1; font-size: 14px; margin: 6px 0 0; }
.faq { display: flex; flex-direction: column; gap: 10px; }
.shams-faq-item { background: #111A33; border: 1px solid #22355E; border-radius: 12px; padding: 14px 18px; }
.shams-faq-item summary { font-weight: 800; cursor: pointer; }
.shams-faq-item p { color: #CBD5E1; font-size: 14px; margin: 8px 0 0; }
.foot { text-align: center; padding: 28px; color: #94A3B8; font-size: 13px; }
@media (max-width: 820px) { .bar-links { display: none; } .dual-cards, .metrics, .cards-2, .cards-3 { grid-template-columns: 1fr; } }`,
  },
];
