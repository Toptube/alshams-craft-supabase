import {
  resolveAgentGeminiKey,
  createGeminiClientForAgent,
  getCandidateGeminiImageModels,
  isGeminiKeyCircuitOpen,
  tripGeminiKeyCircuit,
  formatAiErrorReason,
} from './googleSearchService.js';

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
  imageDataUrl: string;
  mimeType: string;
  mode: FalconStudioMode;
  modelUsed: string;
  captionAr: string;
  applyBrandFooter: boolean;
}

const CRAFT_WORKSHOP_SCENES: Record<string, string> = {
  macrame:
    'an authentic sunlit Egyptian macramé craft studio with a solid natural oak workbench, neat spools of braided cotton macramé cord in cream and earth tones, wooden dowels, brass craft shears, and a warm wooden pegboard softly blurred in the background',
  crochet:
    'a cozy sunlit handmade crochet and yarn atelier with a warm wooden table, neatly stacked cotton and t-shirt yarn skeins, bamboo and brass crochet hooks, measuring tape, and soft natural window daylight',
  zigzag:
    'a sunlit Egyptian textile rope-coil sewing studio with coiled cotton cord baskets, heavy-duty stitching machine softly blurred in the background, warm wood worktable, and natural cream thread spools',
  kilim:
    'an authentic Egyptian handwoven kilim studio with a rustic wooden weaving loom softly out of focus behind the product, dyed natural wool bundles in warm terracotta and indigo, and soft daylight streaming across a textured stone wall',
  punch_needle:
    'a bright artisanal punch-needle embroidery studio with wooden embroidery hoops, tufted yarn cones, punch needle tools, and natural linen canvas resting on a sunlit oak table',
  tufting_gun:
    'a modern artisanal rug-tufting studio with a wooden tufting frame softly blurred in the background, colorful wool yarn cones on peg shelves, and warm sunlit workbench',
  embroidery:
    'a refined hand-embroidery studio with wooden hoops, silk and cotton embroidery floss skeins, vintage brass stork scissors, and natural linen cloth on a sunlit craft desk',
  sirma_embroidery:
    'a heritage Egyptian metallic-thread embroidery workshop with golden and silver threads, velvet swatches, wooden frame, and warm directional atelier lighting',
  beadwork:
    'a neat handcrafted beadwork atelier with glass seed-bead organizer trays, delicate beading needles, fine jewelry pliers, and soft diffused studio window light on a warm linen-draped table',
  jewelry:
    'an artisan handmade jewelry workshop with a jeweler wooden bench, brass pliers, raw semi-precious stones, fine chains, and soft golden natural window light',
  wire_wrapping:
    'a sunlit wire-wrapping jewelry studio with copper and silver wire spools, round-nose pliers, natural gemstones, and warm wooden workbench texture',
  resin:
    'a clean modern epoxy resin craft studio with clear mixing cups, subtle mica pigment jars, silicone molds neatly arranged out of focus on a warm sunlit concrete-and-wood workbench',
  uv_resin:
    'a tidy miniature UV resin craft studio with delicate dried botanicals, crystal-clear bezels, UV lamp softly blurred in background, and bright natural window light',
  polyester_resin:
    'a well-lit artisanal casting workshop with smooth finished molds, sanding blocks, and warm natural daylight over a clean craft workbench',
  concrete:
    'a minimalist architectural concrete and terrazzo craft studio with smooth plaster casting bowls, natural pigment jars, stone surface workbench, and soft morning window shadows',
  gypsum:
    'a bright minimalist gypsum and jesmonite casting studio with matte ceramic-like sculptural pieces, natural pigment bottles, and sunlit travertine-toned workbench',
  jesmonite:
    'a contemporary jesmonite homeware studio with pastel terrazzo chips, clean silicone molds, and bright soft daylight on a warm wooden desk',
  polymer_clay:
    'a colorful sunlit polymer clay atelier with smooth ceramic work tile, brass clay cutters, wooden roller, and soft pastel clay blocks neatly out of focus behind the hero piece',
  pottery:
    'an authentic sunlit Egyptian pottery and ceramics studio with a potter wheel softly blurred in the background, raw terracotta vessels drying on rustic wooden shelves, and warm natural daylight',
  candles:
    'a warm artisanal candle-making studio with natural beeswax and soy wax flakes, amber glass fragrance oil bottles, cotton wicks, pouring pitcher softly blurred in the background, and golden afternoon light',
  cold_process_soap:
    'a natural botanical handmade soap atelier with wooden soap molds, dried lavender and chamomile herbs, olive oil amber bottles, and sunlit warm linen workbench',
  melt_pour_soap:
    'a clean botanical glycerin soap workshop with natural essential oil droppers, dried rose petals, silicone molds softly blurred, and bright daylight',
  leathercraft:
    'an authentic heritage Egyptian leathercraft workshop with vegetable-tanned leather hides rolled in the background, brass rivets, stitching awls, waxed linen thread, and a rich aged wooden workbench in warm sunlit lighting',
  carpentry:
    'an authentic sunlit woodworking and artisanal carpentry workshop with warm oak and beech wood planks, fine hand planes, chisels, subtle wood shavings on a solid workbench, and warm window light',
  scroll_saw:
    'a precision wooden fretwork and scroll-saw craft studio with fine plywood sheets, hand files, and warm wooden workbench in soft natural light',
  arabesque:
    'a traditional Egyptian arabesque mashrabiya woodcraft atelier with geometric turned wood motifs softly blurred in the background and warm sunlit wooden table',
  pyrography:
    'a sunlit wood-burning art studio with raw natural wood slices, pyrography pen resting safely in the blurred background, and warm artisan desk lighting',
  decoupage:
    'a bright decorative decoupage studio with fine art brushes, vintage botanical prints, matte varnish jars softly out of focus, and sunlit wooden worktable',
  bamboo:
    'an authentic natural bamboo, wicker, and rattan weaving workshop with dried natural reed bundles, woven baskets softly blurred, and warm Egyptian daylight',
  wicker:
    'an authentic natural wicker and palm-leaf weaving studio with natural reed bundles, sunlit stone walls, and warm wooden worktable',
  rattan:
    'a sunlit natural rattan craft workshop with coiled rattan cane, artisanal weaving tools, and warm earthy textures',
  laser_cnc:
    'a sleek modern maker and laser-craft design studio with neatly cut birch wood and acrylic prototypes on a clean sunlit oak workbench',
  '3d_printing':
    'a clean modern maker studio with neatly finished sculptural prototypes on a minimalist oak desk and warm natural window lighting',
  metalwork_forging:
    'an authentic artisanal copper and metalcraft workshop with hand-hammered brass tools, warm wooden anvil bench, and dramatic warm daylight',
  copper_silver_shaping:
    'a refined Egyptian copper and silver smithing atelier with delicate chasing hammers, polished brass accents, and warm natural window light',
  lighting_craft:
    'a warm atmospheric artisanal lamp and lighting studio with natural woven shades and brass fittings softly glowing in golden late-afternoon light',
  handmade_flowers:
    'a sunlit botanical floral-craft atelier with delicate silk and dried botanicals, floral shears, linen ribbons, and soft airy natural light',
  sewing_garments:
    'a refined sunlit boutique sewing and tailoring atelier with natural linen fabric bolts, vintage tailor shears, measuring tape, and warm wooden cutting table',
  cushions_upholstery:
    'a sunlit textile and home-cushion craft studio with natural woven upholstery fabrics, cotton piping, and warm daylight on a clean worktable',
  mosaic_art:
    'an authentic artisanal mosaic studio with colorful glazed ceramic and glass tesserae neatly sorted in wooden trays, tile nippers, and bright sunlit workbench',
  stained_glass:
    'a sunlit stained-glass studio with jewel-toned glass sheets catching warm window rays softly blurred behind a clean craft table',
  paper_cards:
    'a refined handmade paper and stationery studio with deckle-edge cotton paper, brass wax seal, calligraphy nibs, and warm natural daylight',
  bookbinding:
    'an artisanal bookbinding workshop with linen bookcloth rolls, bone folder, waxed linen thread, and warm sunlit oak workbench',
  packaging_boxes_bags:
    'a boutique craft packaging studio with textured kraft and linen gift boxes, satin and cotton ribbons, and crisp sunlit desk lighting',
  sublimation:
    'a clean modern custom-print craft studio with neatly finished bespoke mugs, totes, and textiles on a bright minimalist oak table',
};

function resolveWorkshopScene(ctx?: FalconStudioInput['workshopContext']): string {
  if (ctx?.accountRole === 'supplier') {
    return 'a refined, spotless boutique craft-materials showroom and atelier supply studio with neatly organized natural shelves of raw craft supplies softly blurred in the background, warm oak display counter, and bright natural window daylight';
  }
  const crafts = Array.isArray(ctx?.selectedCrafts) ? ctx.selectedCrafts : [];
  for (const raw of crafts) {
    const key = String(raw || '').trim().toLowerCase();
    if (CRAFT_WORKSHOP_SCENES[key]) {
      return CRAFT_WORKSHOP_SCENES[key];
    }
  }
  const cat = String(ctx?.category || '').toLowerCase();
  if (/مكرم|macrame/.test(cat)) return CRAFT_WORKSHOP_SCENES.macrame;
  if (/كروش|crochet/.test(cat)) return CRAFT_WORKSHOP_SCENES.crochet;
  if (/ريزن|resin/.test(cat)) return CRAFT_WORKSHOP_SCENES.resin;
  if (/شمع|candle/.test(cat)) return CRAFT_WORKSHOP_SCENES.candles;
  if (/صابون|soap/.test(cat)) return CRAFT_WORKSHOP_SCENES.cold_process_soap;
  if (/جلد|leather/.test(cat)) return CRAFT_WORKSHOP_SCENES.leathercraft;
  if (/خزف|فخار|pottery|ceramic/.test(cat)) return CRAFT_WORKSHOP_SCENES.pottery;
  if (/خشب|نجار|wood|carpentry/.test(cat)) return CRAFT_WORKSHOP_SCENES.carpentry;
  if (/خرز|اكسسوار|حلي|jewelry|bead/.test(cat)) return CRAFT_WORKSHOP_SCENES.jewelry;
  if (/جبس|كونكريت|خرسان|concrete|gypsum/.test(cat)) return CRAFT_WORKSHOP_SCENES.concrete;

  return 'an authentic sunlit Egyptian handmade craft workshop with a warm solid oak artisan workbench, neat natural craft tools and raw textures softly blurred in the background, and soft golden natural window light';
}

function buildAdaptiveStagingGuidance(mode: FalconStudioMode): string {
  if (mode === 'store') {
    return `PRODUCT-ADAPTIVE E-COMMERCE STAGING:
- Inspect the product carefully and pose it at its most flattering, natural commercial angle:
  * Bags / handbags / clutches / backpacks: upright, structured, straps arranged cleanly and symmetrically.
  * Wall hangings / mirrors / frames: flat front-facing studio view, perfectly straight and centered.
  * Candles / ceramics / trays / jars / soaps / sculptures / boxes: classic 3/4 editorial studio angle showing both depth and craftsmanship.
  * Jewelry / accessories: neatly positioned with crisp macro texture clarity.
  * Raw materials (cord spools, resin bottles, beads): neatly arranged crisp commercial packshot.
- Keep the product filling ~72% of the frame with generous clean white breathing margins.`;
  }

  return `PRODUCT-ADAPTIVE REAL-LIFE STAGING (CRITICAL):
- Automatically inspect the exact type and scale of the product and adapt how it is presented naturally:
  * If the product is a HANDBAG, TOTE BAG, CLUTCH, CROSSBODY BAG, WALLET, BRACELET, RING, WATCH, OR SMALL WEARABLE ACCESSORY: feature an elegant, natural, photorealistic hand/forearm model (cropped tastefully from wrist/mid-arm or neutral linen-clad side torso — NO distracting full face, keeping 100% visual focus on the product) gracefully holding, carrying, or presenting the item so its true scale, drape, and craftsmanship shine.
  * If the product is a WALL HANGING, MACRAMÉ TAPESTRY, MIRROR, CLOCK, OR FRAMED ARTWORK: hang it naturally and straight on a textured wall at authentic interior scale.
  * If the product is a CANDLE, CERAMIC/POTTERY PIECE, RESIN TRAY, COASTER, SOAP BAR, PLANTER, WOODEN BOX, OR TABLETOP DECOR: place it naturally at realistic scale on a styled surface (workbench, linen runner, travertine/wood table) with minimal complementary props that never steal attention.
  * If the product is a LAMP OR LIGHTING FIXTURE: showcase it softly illuminated with warm inviting ambient glow.
  * If the product is a CUSHION, THROW, OR RUG/KILIM: drape or place it organically on a linen sofa, woven armchair, or warm floor.
  * If the product is RAW CRAFT MATERIALS (spools, cords, jars, beads, leather rolls): arrange them tastefully and neatly as an inviting artisanal display.`;
}

function buildInvisibleStudioPrompt(input: FalconStudioInput): string {
  const { mode, imageBase64, userPrompt, workshopContext } = input;
  const hasSourceImage = Boolean(imageBase64);
  const cleanUserNote = String(userPrompt || '').trim();
  const craftScene = resolveWorkshopScene(workshopContext);
  const stagingGuide = buildAdaptiveStagingGuidance(mode);

  const fidelityClause = hasSourceImage
    ? `STRICT PRODUCT FIDELITY:
- Keep the EXACT handmade product from the attached source photo 100% faithful in shape, silhouette, pattern, weave, stitches, colors, materials, textures, and proportions.
- Do NOT alter, simplify, redraw, or replace the product's design details. Only isolate it cleanly and integrate it with physically accurate lighting, color bounce, and realistic shadows into the new environment.`
    : `PRODUCT CREATION:
- Create an ultra-photorealistic artisanal handcrafted product matching this request: "${cleanUserNote || 'handmade Egyptian artisanal craft piece'}" (craft specialty: ${(workshopContext?.selectedCrafts || [workshopContext?.category || 'handmade craft']).join(', ')}).`;

  const noTextClause = `CRITICAL OUTPUT RULES:
- Output a pure, photorealistic editorial photograph (shot on full-frame 50mm f/2.0 lens, crisp focus on product details, natural color science).
- NEVER render any text, Arabic/English letters, watermarks, logos, price tags, or borders inside the image.
- Leave clean, uncluttered visual breathing room in the bottom 14% of the frame.`;

  if (mode === 'store') {
    return `You are a world-class global e-commerce commercial product photographer.
TASK: Isolate the product cleanly and place it on a pure seamless studio white background (#FFFFFF) worthy of an international luxury storefront.

${fidelityClause}

STUDIO LIGHTING & SHADOW:
- Background: pure, uniform, seamless studio white (#FFFFFF) with zero gray smudges, zero room clutter, and zero distractions.
- Shadows: render a subtle, ultra-realistic soft grounded contact shadow directly beneath and slightly around the base of the product so it feels physically real and grounded — never floating artificially.
- Lighting: balanced, diffused commercial softbox lighting highlighting every weave, grain, gloss, and artisanal texture accurately with true-to-life colors.

${stagingGuide}
${cleanUserNote && hasSourceImage ? `\nADDITIONAL ARTIST NOTE: ${cleanUserNote}` : ''}
${noTextClause}`;
  }

  if (mode === 'workshop') {
    return `You are an editorial craft-lifestyle photographer shooting an authentic feature story inside a master artisan's real workshop.
TASK: Place this exact product naturally inside a real-life, sunlit workshop specifically matching the artisan's craft.

${fidelityClause}

WORKSHOP ENVIRONMENT (TAILORED TO THIS WORKSHOP):
- Setting: ${craftScene}.
- Atmosphere: warm, authentic, lived-in yet tidy and aspirational; soft natural daylight pouring from a side window, gentle golden rim light on the product, creamy shallow depth-of-field bokeh blurring the workshop tools and background shelves so the product stands out unmistakably as the hero.
- Color harmony: natural earthy warmth (sand, linen, warm oak, terracotta, soft cream) complementing the product without overpowering its colors.

${stagingGuide}
${cleanUserNote && hasSourceImage ? `\nADDITIONAL ARTIST NOTE: ${cleanUserNote}` : ''}
${noTextClause}`;
  }

  // mode === 'home'
  return `You are an Architectural Digest editorial interior & lifestyle photographer shooting inside a refined modern Egyptian Bohemian (Boho-Chic) home.
TASK: Place this exact product naturally inside an elegant, sunlit modern Egyptian bohemian home interior.

${fidelityClause}

EGYPTIAN BOHEMIAN HOME ENVIRONMENT:
- Setting: an elegant, airy modern Egyptian bohemian living space — warm textured limewash or sand-colored plaster walls, handwoven neutral linen and cotton throws, warm natural oak and rattan accents, subtle terracotta planter with olive or ficus leaves, soft Cairo golden-hour sunlight streaming through sheer linen curtains casting delicate organic leaf shadows.
- Atmosphere: effortlessly upscale, warm, authentic Egyptian contemporary boho-chic (refined, uncluttered, serene — never kitschy or crowded). Shallow depth-of-field so the product is razor-sharp and commands full attention.

${stagingGuide}
${cleanUserNote && hasSourceImage ? `\nADDITIONAL ARTIST NOTE: ${cleanUserNote}` : ''}
${noTextClause}`;
}

export function getStudioModeCaptionAr(mode: FalconStudioMode): string {
  if (mode === 'store') {
    return '✨ تم فصل المنتج وتجهيزه بخلفية بيضاء نقية وظل استوديو ناعم جاهز للمتاجر العالمية.';
  }
  if (mode === 'workshop') {
    return '✨ تم تجهيز صورة المنتج داخل أجواء ورشتك الحرفية الطبيعية بتذييل اللوجو وبيانات الورشة.';
  }
  return '✨ تم تجهيز صورة المنتج داخل ديكور منزل مصري بوهيمي أنيق متكيف مع طبيعة القطعة بتذييل الورشة.';
}

export async function generateFalconStudioImage(input: FalconStudioInput): Promise<FalconStudioResult> {
  const apiKey = resolveAgentGeminiKey('falcon_image');
  if (!apiKey || isGeminiKeyCircuitOpen(apiKey)) {
    const err: any = new Error(
      'استوديو إنشاء وتعديل صور المنتجات يحتاج لتفعيل مفتاح Gemini مُفعّل عليه الفوترة في الإعدادات (GEMINI_API_KEY_FALCON_IMAGE أو GEMINI_API_KEY داخل Settings > Secrets).'
    );
    err.status = 503;
    err.kind = 'bad_key';
    throw err;
  }

  const ai = createGeminiClientForAgent('falcon_image');
  const candidateModels = getCandidateGeminiImageModels();
  const promptText = buildInvisibleStudioPrompt(input);

  const parts: any[] = [];
  if (input.imageBase64) {
    let cleanData = input.imageBase64;
    let resolvedMime = input.mimeType || 'image/jpeg';
    const match = input.imageBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      resolvedMime = match[1].trim();
      cleanData = match[2].trim();
    } else {
      cleanData = cleanData.replace(/^data:[^,]+,/, '').trim();
    }
    cleanData = cleanData.replace(/\s+/g, '');

    parts.push({
      inlineData: {
        data: cleanData,
        mimeType: resolvedMime,
      },
    });
  }
  parts.push({ text: promptText });

  let lastErr: any = null;

  for (const model of candidateModels) {
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const tErr: any = new Error('استغرق استوديو الصور وقتاً أطول من المعتاد، أعد المحاولة الآن.');
        tErr.status = 504;
        reject(tErr);
      }, 55_000);
    });

    try {
      const response: any = await Promise.race([
        ai.models
          .generateContent({
            model,
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: input.mode === 'store' ? '1:1' : '4:3',
              },
            },
          })
          .finally(() => clearTimeout(timeoutId)),
        timeoutPromise,
      ]);

      const outParts = response?.candidates?.[0]?.content?.parts ?? [];
      for (const part of outParts) {
        if (part?.inlineData?.data) {
          const outMime = part.inlineData.mimeType || 'image/png';
          const dataUrl = `data:${outMime};base64,${part.inlineData.data}`;
          return {
            imageDataUrl: dataUrl,
            mimeType: outMime,
            mode: input.mode,
            modelUsed: model,
            captionAr: getStudioModeCaptionAr(input.mode),
            applyBrandFooter: input.mode === 'workshop' || input.mode === 'home',
          };
        }
      }

      lastErr = new Error('لم يرجع النموذج صورة مكتملة، يرجى المحاولة بصورة أوضح أو وصف أدق.');
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastErr = err;
      const msg = String(err?.message || err || '');
      const status = Number(err?.status || err?.code || 0);
      if (tripGeminiKeyCircuit(apiKey, err)) {
        const keyErr: any = new Error(
          'مفتاح استوديو الصور غير صالح أو منتهي الصلاحية. يرجى تحديث GEMINI_API_KEY_FALCON_IMAGE أو GEMINI_API_KEY في Settings > Secrets.'
        );
        keyErr.status = 503;
        keyErr.kind = 'bad_key';
        throw keyErr;
      }
      if (status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
        const quotaErr: any = new Error(
          'نموذج إنشاء الصور يتطلب مفتاح Gemini مرتبط بحساب فوترة مفعّل أو تم بلوغ الحصة اللحظية. يرجى مراجعة المفتاح في Settings > Secrets.'
        );
        quotaErr.status = 429;
        quotaErr.kind = 'quota';
        throw quotaErr;
      }
      console.warn(`[Falcon Studio] Model "${model}" skipped (${status || 'err'}): ${formatAiErrorReason(msg)}`);
    }
  }

  const finalErr: any = new Error(
    `تعذر توليد صورة الاستوديو حالياً: ${formatAiErrorReason(String(lastErr?.message || ''))}`
  );
  finalErr.status = Number(lastErr?.status) || 502;
  throw finalErr;
}
