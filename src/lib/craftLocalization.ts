import type { PublicLocaleCode } from './publicLocale';

function normalizeArKey(val: string): string {
  return String(val || '')
    .replace(/★/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SECTION_TRANSLATIONS_EN: Record<string, string> = {
  ropes_textiles: 'Ropes, Textiles & Yarns',
  beads_embroidery: 'Beads, Embroidery & Accessories',
  clays_composites: 'Resin, Clay, Candles & Soap',
  woods: 'Woodcraft, Laser & CNC',
  leather: 'Leathercraft',
  metals: 'Metals, Forging & Silvercraft',
  decor_lighting_flowers: 'Decor, Lighting, Flowers & Glass',
  arts_printing_calligraphy: 'Fine Arts, Printing & Calligraphy',
  paper_binding: 'Paper Craft & Bookbinding',
  packaging_crafts: 'Boxes & Gift Packaging',
  sewing_upholstery: 'Sewing, Tailoring & Upholstery',
  finishing_aux: 'Finishing & Auxiliary Supplies',
  glass_mosaic: 'Stained Glass & Mosaic Art',
  energy_time_ops: 'Kilns & Batch Operations',
  // Arabic label variants
  'الحبال والنسيج والخيوط': 'Ropes, Textiles & Yarns',
  'الخرز والتطريز والاكسسوارات': 'Beads, Embroidery & Accessories',
  'الريزن والطين والشموع والصابون': 'Resin, Clay, Candles & Soap',
  'الاخشاب والليزر والـ cnc': 'Woodcraft, Laser & CNC',
  'صناعه الجلود': 'Leathercraft',
  'المعادن والحداده وتشكيل الفضه': 'Metals, Forging & Silvercraft',
  'الديكور والاضاءه والزهور والزجاج': 'Decor, Lighting, Flowers & Glass',
  'الفنون والطباعه والخط العربي': 'Fine Arts, Printing & Calligraphy',
  'الورق والتجليد وعجينه الورق': 'Paper Craft & Bookbinding',
  'صناعه العلب والتغليف': 'Boxes & Gift Packaging',
  'الخياطه والتفصيل والتنجيد': 'Sewing, Tailoring & Upholstery',
  'التشطيب والخامات المساعده': 'Finishing & Auxiliary Supplies',
  'الزجاج المعشق والموزاييك': 'Stained Glass & Mosaic Art',
  'الافران والطاقه والتشغيل بالدفعات': 'Kilns & Batch Operations',
};

const CRAFT_AND_CATEGORY_EN: Record<string, string> = {
  // Craft IDs
  macrame: 'Macrame',
  crochet: 'Crochet',
  zigzag: 'Rope Zigzag',
  punch_needle: 'Punch Needle',
  tufting_gun: 'Tufting',
  kelim: 'Kelim & Handloom',
  aqqada: 'Passementerie & Tassels',
  spinning: 'Hand Spinning',
  knitting: 'Hand Knitting',
  felting: 'Felting',
  dyeing: 'Hand Dyeing',
  craft_fusion: 'Mixed Media Craft',
  beadwork: 'Beadwork & Beaded Bags',
  embroidery: 'Hand Embroidery',
  sirma_embroidery: 'Sirma & Metallic Embroidery',
  jewelry: 'Handmade Jewelry',
  wire_wrapping: 'Wire Wrapping',
  sequins_rhinestones: 'Sequins & Rhinestones',
  resin: 'Epoxy Resin',
  uv_resin: 'UV Resin',
  polyester_resin: 'Polyester Resin & Fiberglass',
  concrete: 'Decorative Concrete & Terrazzo',
  gypsum: 'Decorative Gypsum',
  jesmonite: 'Jesmonite',
  polymer_clay: 'Polymer Clay',
  pottery: 'Pottery & Ceramics',
  ceramics: 'Ceramic Tiles',
  candles: 'Candle Making',
  cold_process_soap: 'Cold Process Soap',
  melt_pour_soap: 'Melt & Pour Soap',
  mold_making: 'Silicone Mold Making',
  relative_recipes: 'Botanical Blends & Perfumes',
  bamboo: 'Bamboo Craft',
  wicker: 'Wicker & Palm Frond',
  rattan: 'Rattan Craft',
  scroll_saw: 'Scroll Saw Woodcraft',
  arabesque: 'Arabesque & Mother of Pearl',
  carpentry: 'Carpentry & Woodturning',
  pyrography: 'Wood Pyrography',
  decoupage: 'Decoupage',
  wood_inlay: 'Wood Inlay',
  laser_cnc: 'Laser & CNC Craft',
  '3d_printing': '3D Printing',
  leathercraft: 'Leathercraft',
  metalwork_forging: 'Metalwork & Forging',
  copper_silver_shaping: 'Silver & Copper Shaping',
  lighting_craft: 'Lighting & Chandeliers',
  natural_dried_flowers: 'Natural & Dried Flowers',
  handmade_flowers: 'Handmade Flowers',
  acrylic_glass_decor: 'Glass & Acrylic Decor',
  canvas_painting: 'Canvas & Acrylic Painting',
  oil_painting: 'Oil Painting',
  watercolor_gouache: 'Watercolor & Gouache',
  surface_painting: 'Surface Painting',
  screen_printing: 'Screen Printing',
  heat_vinyl: 'Heat Transfer Vinyl (HTV)',
  linocut: 'Linocut Printmaking',
  calligraphy_gilding: 'Arabic Calligraphy & Gilding',
  sublimation: 'Sublimation Printing',
  paper_cards: 'Paper Cards & Origami',
  bookbinding: 'Art Bookbinding',
  papier_mache: 'Papier-Mâché',
  packaging_boxes_bags: 'Boxes & Gift Packaging',
  sewing_garments: 'Sewing & Apparel',
  cushions_upholstery: 'Cushions & Upholstery',
  finishing_adhesives_coatings: 'Finishing & Coatings',
  mosaic_art: 'Mosaic Art',
  stained_glass: 'Stained Glass',
  kiln_machine_ops: 'Kiln & Batch Ops',

  // Sub-craft Arabic names
  'مكرميه': 'Macrame',
  'كروشيه': 'Crochet',
  'زجزاج الحبال': 'Rope Zigzag',
  'ابره النقاش (punch needle)': 'Punch Needle',
  'ابره النقاش': 'Punch Needle',
  'مسدس التافت (tufting)': 'Tufting',
  'مسدس التافت': 'Tufting',
  'الكليم والنول اليدوي': 'Kelim & Handloom',
  'العقاده والشرابات': 'Passementerie & Tassels',
  'الغزل اليدوي': 'Hand Spinning',
  'التريكو اليدوي والنول الدائري': 'Hand Knitting',
  'اللباد (felting)': 'Felting',
  'اللباد': 'Felting',
  'الصباغه اليدويه': 'Hand Dyeing',
  'دمج المشغولات (universal fusion)': 'Mixed Media Craft',
  'الخرز وشنط الخرز': 'Beadwork & Beaded Bags',
  'التطريز اليدوي': 'Hand Embroidery',
  'تطريز السيرما والقصب': 'Sirma & Metallic Embroidery',
  'الحلي والاكسسوارات': 'Handmade Jewelry',
  'تشكيل الاسلاك (wire wrapping)': 'Wire Wrapping',
  'الترصيع والترتر والفصوص': 'Sequins & Rhinestones',
  'الريزن الايبوكسي (epoxy)': 'Epoxy Resin',
  'ريزن uv': 'UV Resin',
  'ريزن البوليستر والالياف الزجاجيه': 'Polyester Resin & Fiberglass',
  'الكونكريت الديكوري والترازو': 'Decorative Concrete & Terrazzo',
  'الجبس الديكوري': 'Decorative Gypsum',
  'الجيسمونايت (jesmonite ac100)': 'Jesmonite',
  'الصلصال الحراري': 'Polymer Clay',
  'الخزف والفخار': 'Pottery & Ceramics',
  'السيراميك وبلاطات الخزف': 'Ceramic Tiles',
  'صناعه الشموع': 'Candle Making',
  'الصابون بالطريقه البارده': 'Cold Process Soap',
  'الصابون بالصب': 'Melt & Pour Soap',
  'صناعه قوالب السيليكون': 'Silicone Mold Making',
  'الوصفات النسبيه (بلسم، عطور، بخور)': 'Botanical Blends & Perfumes',
  'البامبو والخيزران': 'Bamboo Craft',
  'الخوص وسعف النخيل': 'Wicker & Palm Frond',
  'الراتان (rattan)': 'Rattan Craft',
  'الاركت والتفريغ': 'Scroll Saw Woodcraft',
  'الارابيسك والتصديف': 'Arabesque & Mother of Pearl',
  'النجاره والخراطه': 'Carpentry & Woodturning',
  'الحرق علي الخشب (pyrography)': 'Wood Pyrography',
  'الديكوباج': 'Decoupage',
  'تطعيم الخشب (inlay)': 'Wood Inlay',
  'القص بالليزر والـ cnc': 'Laser & CNC Craft',
  'الطباعه ثلاثيه الابعاد': '3D Printing',
  'صناعه الجلود (طبيعي وصناعي)': 'Leathercraft',
  'الحداده وتشكيل الحديد والالومنيوم والستانلس': 'Metalwork & Forging',
  'تشكيل الفضه والنحاس والالومنيوم': 'Silver & Copper Shaping',
  'وحدات الاضاءه والنجف': 'Lighting & Chandeliers',
  'تنسيق الزهور الطبيعيه والمجففه': 'Natural & Dried Flowers',
  'صناعه الزهور اليدويه': 'Handmade Flowers',
  'ديكورات الزجاج والاكريليك': 'Glass & Acrylic Decor',
  'لوحات الكانفاس والاكريليك': 'Canvas & Acrylic Painting',
  'الرسم بالالوان الزيتيه': 'Oil Painting',
  'الالوان المائيه والجواش': 'Watercolor & Gouache',
  'الرسم علي الاسطح (زجاج/خزف/خشب)': 'Surface Painting',
  'طباعه القماش والشبلونه': 'Screen Printing',
  'الطباعه الحراريه والفينيل (htv)': 'Heat Transfer Vinyl (HTV)',
  'الحفر والطباعه باللينوليوم': 'Linocut Printmaking',
  'الخط العربي والتذهيب': 'Arabic Calligraphy & Gilding',
  'الطباعه بالتسامي (sublimation)': 'Sublimation Printing',
  'الورق والكروت والاوريجامي': 'Paper Cards & Origami',
  'التجليد الفني والدفاتر': 'Art Bookbinding',
  'عجينه الورق (papier-mâché)': 'Papier-Mâché',
  'صناعه العلب والاكياس والتغليف': 'Boxes & Gift Packaging',
  'الخياطه وتفصيل الملابس والشنط': 'Sewing & Apparel',
  'الكوشن والتنجيد': 'Cushions & Upholstery',
  'التشطيب واللصق والدهان والعزل': 'Finishing & Coatings',
  'فن الموزاييك': 'Mosaic Art',
  'الزجاج المعشق (تيفاني ورصاص)': 'Stained Glass',
  'الافران والماكينات والطاقه بالدفعات': 'Kiln & Batch Ops',

  // Sample Categories (all 50+ crafts)
  'رانر': 'Table Runner',
  'ستائر': 'Curtains',
  'سجاد': 'Rug',
  'كوشن': 'Cushion',
  'جداريه': 'Wall Hanging',
  'بوف': 'Pouf',
  'كرسي': 'Chair',
  'ارجوحه': 'Hammock Swing',
  'نجف واضاءه': 'Chandelier & Lighting',
  'شنطه او كلاتش': 'Bag / Clutch',
  'باسكت كروشيه': 'Crochet Basket',
  'شال': 'Shawl',
  'مفرش': 'Tablecloth',
  'بطانيه اطفال': 'Baby Blanket',
  'شنطه كروشيه': 'Crochet Bag',
  'اميجورومي': 'Amigurumi',
  'سلال ومنظمات 3d': '3D Rope Baskets & Organizers',
  'صواني حبال': 'Rope Trays',
  'كوسترات': 'Coasters',
  'سجاد حبال زجزاج': 'Zigzag Rope Rugs',
  'شنط حبال': 'Rope Bags',
  'تابلوه حائطي': 'Wall Art Frame',
  'كوشن بارز': 'Textured Cushion',
  'كوستر صوف': 'Wool Coaster',
  'مراه مؤطره': 'Framed Mirror',
  'سجاده فنيه ارضيه': 'Art Floor Rug',
  'لوحه جداريه تافتنج': 'Tufted Wall Art',
  'مخده بارزه': 'Tufted Pillow',
  'كليم نول ارضي': 'Handwoven Kelim Rug',
  'رانر صوف': 'Wool Table Runner',
  'معلقه نسيج': 'Woven Wall Hanging',
  'شرابه ستاره': 'Curtain Tassel',
  'حبل مبروم': 'Twisted Cord',
  'عقده زخرفيه': 'Decorative Knot',
  'شله صوف مغزول': 'Hand-Spun Wool Skein',
  'خيط كتان يدوي': 'Handmade Linen Yarn',
  'بلوفر تريكو': 'Knitted Sweater',
  'كوفيه نول': 'Loom Scarf',
  'بطانيه صوف': 'Wool Blanket',
  'حقيبه لباد': 'Felt Bag',
  'مفرش صوف مضغوط': 'Felted Wool Mat',
  'مجسم لباد': 'Felt Figurine',
  'شلات مصبوغه نباتيا': 'Botanical Dyed Skeins',
  'اقمشه شيبوري': 'Shibori Dyed Fabrics',
  'حبال مصبوغه': 'Dyed Cords',
  'مكرميه وخشب اركت': 'Macrame & Woodcraft',
  'صينيه ريزن وحبال': 'Resin & Rope Tray',
  'جلد مع خرز او تطريز': 'Leather with Beads / Embroidery',
  'شنطه لولي': 'Pearl Beaded Bag',
  'صينيه خرز': 'Beaded Tray',
  'ميداليه كريستال': 'Crystal Keychain',
  'طاره تطريز': 'Embroidery Hoop',
  'منديل كتب كتاب': 'Wedding Handkerchief',
  'تابلوه كتان': 'Linen Wall Art',
  'تطريز قفطان سيرما': 'Sirma Embroidered Kaftan',
  'لوحه قصب تراثيه': 'Heritage Metallic Art',
  'عقد احجار كريمه': 'Gemstone Necklace',
  'سوار سلسله': 'Chain Bracelet',
  'حلق مطلي': 'Plated Earrings',
  'تعليقه سلك نحاس وحجر': 'Copper Wire & Stone Pendant',
  'تاج اسلاك': 'Wire Crown',
  'فستان مرصع': 'Embellished Dress',
  'طرحه ترتر وفصوص': 'Sequined Veil',
  'صينيه ريزن': 'Resin Tray',
  'كوسترات جيود': 'Geode Coasters',
  'شياله كحك': 'Tiered Cake Stand',
  'حلي ريزن uv': 'UV Resin Jewelry',
  'تغليف ميداليات': 'Resin Keychains',
  'احواض فايبرجلاس': 'Fiberglass Planters',
  'تماثيل ومجسمات صب': 'Cast Sculptures',
  'صينيه كونكريت': 'Concrete Tray',
  'اصيص ترازو': 'Terrazzo Planter',
  'كوب شمع اسمنتي': 'Concrete Candle Vessel',
  'فازه جبس مضلع': 'Ribbed Gypsum Vase',
  'لوحه جبسيه بارزه': 'Textured Gypsum Wall Art',
  'طقم صواني جيسمونايت': 'Jesmonite Tray Set',
  'حامل شموع': 'Candle Holder',
  'مج مزخرف بالصلصال': 'Polymer Clay Decorated Mug',
  'حلق صلصال حراري': 'Polymer Clay Earrings',
  'مج خزف': 'Ceramic Mug',
  'فازه فخار': 'Pottery Vase',
  'طاجن فخاري': 'Clay Tagine',
  'لوحه بلاط سيراميك': 'Ceramic Tile Art',
  'كوسترات خزفيه': 'Ceramic Coasters',
  'شمعه صويا معطره': 'Scented Soy Candle',
  'شمعه قوالب': 'Sculptural Pillar Candle',
  'صابون زيت زيتون وغار': 'Olive & Laurel Soap',
  'صابون فحم وشوفان': 'Charcoal & Oat Soap',
  'صابون هدايا جليسرين': 'Glycerin Gift Soap',
  'توزيعات صابون': 'Soap Favors',
  'قالب سيليكون صينيه': 'Silicone Tray Mold',
  'قالب شمعه مجسمه': 'Sculptural Candle Mold',
  'مخمريه وبادي باتر': 'Body Butter & Perfume Balm',
  'بخور وعطور منزليه': 'Incense & Home Fragrances',
  'مراه بامبو': 'Bamboo Mirror',
  'اباجوره خيزران': 'Bamboo Lamp',
  'ستاند نباتات': 'Plant Stand',
  'سبت غسيل خوص': 'Wicker Laundry Basket',
  'شنطه خوص': 'Wicker Bag',
  'مقعد سعف': 'Palm Frond Stool',
  'اثاث راتان': 'Rattan Furniture',
  'صينيه وهيدبورد راتان': 'Rattan Tray & Headboard',
  'فانوس اركت': 'Scroll Saw Lantern',
  'لوحه حروف مفرغه': 'Cutout Wooden Sign',
  'صندوق صدف': 'Mother of Pearl Box',
  'مشربيه ارابيسك': 'Arabesque Mashrabiya',
  'بلانشه زان': 'Beechwood Cutting Board',
  'طربيزه يدويه': 'Handmade Wooden Table',
  'عصا مكرميه': 'Macrame Wooden Dowel',
  'لوحه حرق خشب': 'Wood-Burned Plaque',
  'كوسترات محروقه': 'Pyrography Coasters',
  'صينيه ديكوباج': 'Decoupage Tray',
  'علبه مناديل فنتج': 'Vintage Tissue Box',
  'لوحه تطعيم قشره خشب': 'Wood Veneer Inlay Art',
  'علبه مطعمه': 'Inlaid Wooden Box',
  'تابلوه ليزر متعدد الطبقات': 'Layered Laser Wall Art',
  'ديكور cnc': 'CNC Wood Decor',
  'فازات مطبوعه 3d': '3D Printed Vases',
  'قوالب وماستر سيليكون': '3D Printed Molds & Masters',
  'حقيبه جلد طبيعي': 'Genuine Leather Bag',
  'محفظه يدويه': 'Handmade Leather Wallet',
  'حزام وكفر': 'Leather Belt & Cover',
  'شاسيه معدن للطاولات': 'Metal Table Base',
  'ستاند اضاءه حديد': 'Wrought Iron Lamp Stand',
  'مشغولات فيرفورجيه': 'Wrought Iron Decor',
  'خاتم فضه 925': '925 Silver Ring',
  'اسوره نحاس مطروق': 'Hammered Copper Bracelet',
  'صينيه نحاس': 'Copper Tray',
  'اباجوره هاند ميد': 'Handmade Table Lamp',
  'نجفه بوهو مضيئه': 'Boho Pendant Chandelier',
  'بوكيه زهور مجففه': 'Dried Flower Bouquet',
  'سنتربيس طبيعي': 'Natural Centerpiece',
  'زهور ستان': 'Satin Flowers',
  'ورود فوم عملاقه': 'Giant Foam Roses',
  'زهور ورقيه': 'Paper Flowers',
  'لوحه اكريليك مرايا': 'Mirrored Acrylic Wall Art',
  'صينيه زجاج واكريليك': 'Glass & Acrylic Tray',
  'لوحه تجريديه بارزه': 'Textured Abstract Painting',
  'بورتريه اكريليك': 'Acrylic Portrait',
  'لوحه زيتيه كلاسيكيه': 'Classic Oil Painting',
  'منظر طبيعي زيت': 'Oil Landscape Painting',
  'لوحه الوان مائيه': 'Watercolor Painting',
  'الستريشن جواش': 'Gouache Illustration',
  'مج مرسوم يدويا': 'Hand-Painted Mug',
  'مراه مرسومه': 'Hand-Painted Mirror',
  'توت باج مطبوع شبلونه': 'Screen-Printed Tote Bag',
  'تيشيرت مطبوع': 'Printed T-Shirt',
  'ملابس فينيل حراري': 'HTV Custom Apparel',
  'كوشن مطبوع': 'Printed Cushion',
  'مطبوعات لينوكات فنيه': 'Linocut Art Prints',
  'بطاقات محفوره': 'Block-Printed Cards',
  'لوحه خط ثلث مذهبه': 'Gilded Thuluth Calligraphy',
  'مصحف مزخرف': 'Illuminated Manuscript',
  'مج سبلميشن': 'Sublimation Mug',
  'تيشيرت ووساده تسامي': 'Sublimation Tee & Pillow',
  'دعوات فرح': 'Wedding Invitations',
  'بطاقات منتجات وكروت': 'Product Tags & Cards',
  'مجسمات اوريجامي': 'Origami Sculptures',
  'اجنده تجليد يدوي': 'Handbound Planner',
  'سكتش بوك فني': 'Artisan Sketchbook',
  'البوم صور': 'Photo Album',
  'فازات واطباق عجينه ورق': 'Papier-Mâché Vases & Bowls',
  'اقنعه ومجسمات': 'Masks & Sculptures',
  'علب هدايا مخصصه': 'Custom Gift Boxes',
  'اكياس ورقيه بيد حبل': 'Rope-Handle Paper Bags',
  'كيمونو وملابس يدويه': 'Handmade Kimono & Apparel',
  'شنط توت باج قماش': 'Canvas Tote Bags',
  'كوشن ديكوري': 'Decorative Cushion',
  'تنجيد كرسي وبوف': 'Chair & Pouf Upholstery',
  'حزمه تشطيب وعزل لمشروع': 'Finishing & Sealer Kit',
  'صنفره وتلميع اخشاب': 'Wood Sanding & Polishing',
  'طاوله موزاييك': 'Mosaic Table',
  'لوحه فسيفساء': 'Mosaic Wall Art',
  'مرايا موزاييك': 'Mosaic Mirror',
  'لوحه زجاج معشق تيفاني': 'Tiffany Stained Glass Panel',
  'اباجوره زجاج ملون': 'Stained Glass Lamp',
  'تشغيل فرن خزف كامل': 'Full Pottery Kiln Firing',
  'دفعه صهر او خبز متعدده القطع': 'Multi-Piece Firing Batch',

  // Common generic craft & supplier terms
  'مشغوله يدويه': 'Handmade Craft',
  'منتجات يدويه': 'Handmade Products',
  'حرف يدويه': 'Handmade Crafts',
  'خامات هاند ميد': 'Handmade Supplies',
  'خامات': 'Supplies',
  'خيوط وحبال': 'Yarns & Cords',
  'اكسسوارات': 'Accessories',
  'ادوات': 'Tools',
  'تغليف': 'Packaging',
  'ديكور منزلي': 'Home Decor',
  'هدايا': 'Gifts',
  'اخري': 'Other',
  'غير مصنف': 'General',
  'الكل': 'All',
  'الكل (جميع المنتجات)': 'All Products',
  'كافه المعروضات': 'All Products',
  'معلقات جداريه': 'Wall Hangings',
  'كوشن وتكايات': 'Cushions & Pillows',
  'شنط وكلاتشات': 'Bags & Clutches',
  'سجاد ورانرات': 'Rugs & Runners',
  'اضاءه واباجورات': 'Lighting & Lamps',
  'صواني وباسكت': 'Trays & Baskets',
  'اثاث وديكور': 'Furniture & Decor',
};

const MULTI_LOCALE_COMMON_TERMS: Partial<Record<PublicLocaleCode, Record<string, string>>> = {
  fr: {
    Macrame: 'Macramé',
    Crochet: 'Crochet',
    'Wall Hanging': 'Suspension murale',
    'Table Runner': 'Chemin de table',
    Cushion: 'Coussin',
    Curtains: 'Rideaux',
    Rug: 'Tapis',
    Pouf: 'Pouf',
    'Bag / Clutch': 'Sac / Pochette',
    'Handmade Craft': 'Artisanat fait main',
    'Handmade Supplies': 'Fournitures créatives',
    'Epoxy Resin': 'Résine époxy',
    'Candle Making': 'Bougies artisanales',
    Leathercraft: 'Maroquinerie',
    'Hand Embroidery': 'Broderie main',
    'Handmade Jewelry': 'Bijoux faits main',
  },
  de: {
    Macrame: 'Makramee',
    Crochet: 'Häkeln',
    'Wall Hanging': 'Wandbehang',
    'Table Runner': 'Tischläufer',
    Cushion: 'Kissen',
    Curtains: 'Vorhänge',
    Rug: 'Teppich',
    Pouf: 'Pouf',
    'Bag / Clutch': 'Tasche / Clutch',
    'Handmade Craft': 'Handgemacht',
    'Handmade Supplies': 'Bastelbedarf',
    'Epoxy Resin': 'Epoxidharz',
    'Candle Making': 'Kerzenkunst',
    Leathercraft: 'Lederhandwerk',
    'Hand Embroidery': 'Handstickerei',
    'Handmade Jewelry': 'Handgemachter Schmuck',
  },
  es: {
    Macrame: 'Macramé',
    Crochet: 'Crochet',
    'Wall Hanging': 'Tapiz de pared',
    'Table Runner': 'Camino de mesa',
    Cushion: 'Cojín',
    Curtains: 'Cortinas',
    Rug: 'Alfombra',
    Pouf: 'Puf',
    'Bag / Clutch': 'Bolso / Clutch',
    'Handmade Craft': 'Artesanía',
    'Handmade Supplies': 'Insumos artesanales',
    'Epoxy Resin': 'Resina epoxi',
    'Candle Making': 'Velas artesanales',
    Leathercraft: 'Marroquinería',
    'Hand Embroidery': 'Bordado a mano',
    'Handmade Jewelry': 'Joyería artesanal',
  },
  it: {
    Macrame: 'Macramè',
    Crochet: 'Uncinetto',
    'Wall Hanging': 'Arazzo da parete',
    'Table Runner': 'Runner da tavola',
    Cushion: 'Cuscino',
    Curtains: 'Tende',
    Rug: 'Tappeto',
    Pouf: 'Pouf',
    'Bag / Clutch': 'Borsa / Pochette',
    'Handmade Craft': 'Artigianato',
    'Handmade Supplies': 'Forniture artigianali',
    'Epoxy Resin': 'Resina epossidica',
    'Candle Making': 'Candele artigianali',
    Leathercraft: 'Pelletteria',
    'Hand Embroidery': 'Ricamo a mano',
    'Handmade Jewelry': 'Gioielli artigianali',
  },
  tr: {
    Macrame: 'Makrome',
    Crochet: 'Tığ İşi',
    'Wall Hanging': 'Duvar Süsü',
    'Table Runner': 'Masa Runnerı',
    Cushion: 'Kırlent',
    Curtains: 'Perde',
    Rug: 'Kilim / Halı',
    Pouf: 'Puf',
    'Bag / Clutch': 'Çanta / Clutch',
    'Handmade Craft': 'El Yapımı',
    'Handmade Supplies': 'Hobi Malzemeleri',
    'Epoxy Resin': 'Epoksi Reçine',
    'Candle Making': 'Mum Yapımı',
    Leathercraft: 'Deri İşçiliği',
    'Hand Embroidery': 'El Nakışı',
    'Handmade Jewelry': 'El Yapımı Takı',
  },
  nl: {
    Macrame: 'Macramé',
    Crochet: 'Haken',
    'Wall Hanging': 'Wandhanger',
    'Table Runner': 'Tafelloper',
    Cushion: 'Kussen',
    Curtains: 'Gordijnen',
    Rug: 'Vloerkleed',
    Pouf: 'Poef',
    'Bag / Clutch': 'Tas / Clutch',
    'Handmade Craft': 'Handgemaakt',
    'Handmade Supplies': 'Hobbybenodigdheden',
    'Epoxy Resin': 'Epoxyhars',
    'Candle Making': 'Kaarsen maken',
    Leathercraft: 'Lederbewerking',
    'Hand Embroidery': 'Handborduurwerk',
    'Handmade Jewelry': 'Handgemaakte sieraden',
  },
};

/**
 * Localizes any built-in section, craft, or category label cleanly so non-Arabic
 * storefronts never show leftover Arabic craft/category labels.
 */
export function localizeCraftTerm(
  rawText: string | undefined | null,
  locale: PublicLocaleCode
): string {
  const original = String(rawText || '').trim();
  if (!original || locale === 'ar') return original;

  const key = normalizeArKey(original);
  const enMatch =
    CRAFT_AND_CATEGORY_EN[original] ||
    CRAFT_AND_CATEGORY_EN[key] ||
    SECTION_TRANSLATIONS_EN[original] ||
    SECTION_TRANSLATIONS_EN[key];

  if (enMatch) {
    if (locale === 'en') return enMatch;
    const locMap = MULTI_LOCALE_COMMON_TERMS[locale];
    return locMap?.[enMatch] || enMatch;
  }

  return original;
}

const COLOR_DICTIONARY_EN: Record<string, string> = {
  'اوف وايت': 'Off-White',
  'اوفوايت': 'Off-White',
  'ابيض': 'White',
  'اسود': 'Black',
  'بيج': 'Beige',
  'جملي': 'Camel',
  'كافيه': 'Coffee',
  'موكا': 'Mocha',
  'بني': 'Brown',
  'بني غامق': 'Dark Brown',
  'بني فاتح': 'Light Brown',
  'خشبي': 'Wood',
  'طبيعي': 'Natural',
  'كريمي': 'Cream',
  'سكري': 'Ivory',
  'عاجي': 'Ivory',
  'زيتي': 'Olive',
  'اخضر': 'Green',
  'اخضر غامق': 'Dark Green',
  'اخضر فاتح': 'Light Green',
  'اخضر زمردي': 'Emerald',
  'زمردي': 'Emerald',
  'فستقي': 'Pistachio',
  'منت': 'Mint',
  'نعناعي': 'Mint',
  'كحلي': 'Navy',
  'ازرق': 'Blue',
  'ازرق ملكي': 'Royal Blue',
  'سماوي': 'Sky Blue',
  'بيبي بلو': 'Baby Blue',
  'بترولي': 'Teal',
  'تركواز': 'Turquoise',
  'احمر': 'Red',
  'نبيتي': 'Burgundy',
  'عنابي': 'Burgundy',
  'خمري': 'Wine',
  'وردي': 'Pink',
  'بينك': 'Pink',
  'زهري': 'Rose',
  'كشمير': 'Dusty Rose',
  'خوخي': 'Peach',
  'سلمون': 'Salmon',
  'مرجاني': 'Coral',
  'موف': 'Purple',
  'بنفسجي': 'Violet',
  'لافندر': 'Lavender',
  'اصفر': 'Yellow',
  'مسترده': 'Mustard',
  'خردلي': 'Mustard',
  'برتقالي': 'Orange',
  'تيراكوتا': 'Terracotta',
  'طوبي': 'Terracotta',
  'نحاسي': 'Copper',
  'برونزي': 'Bronze',
  'ذهبي': 'Gold',
  'فضي': 'Silver',
  'رمادي': 'Gray',
  'رصاصي': 'Gray',
  'رمادي غامق': 'Charcoal',
  'رمادي فاتح': 'Light Gray',
  'فحمي': 'Charcoal',
  'ملون': 'Multicolor',
  'متعدد الالوان': 'Multicolor',
  'شفاف': 'Clear',
};

const SIZE_WORD_REPLACEMENTS_EN: Array<[RegExp, string]> = [
  [/كبير\s*جدا|كبير\s*جداً|اكس\s*اكس\s*لارج|دبل\s*اكس\s*لارج/gi, 'XXL'],
  [/اكس\s*لارج|إكس\s*لارج/gi, 'XL'],
  [/صغير\s*جدا|صغير\s*جداً|اكس\s*سمول/gi, 'XS'],
  [/مقاس\s*موحد|فري\s*سايز|مقاس\s*واحد/gi, 'One Size'],
  [/صغير|سمول/gi, 'Small'],
  [/متوسط|وسط|ميديم|ميديام/gi, 'Medium'],
  [/كبير|لارج/gi, 'Large'],
  [/جامبو|عملاق/gi, 'Jumbo'],
  [/ميني/gi, 'Mini'],
  [/قطر/gi, 'Dia.'],
  [/عرض/gi, 'W'],
  [/طول/gi, 'L'],
  [/ارتفاع/gi, 'H'],
  [/عمق/gi, 'D'],
  [/سم/gi, 'cm'],
  [/متر/gi, 'm'],
  [/مم/gi, 'mm'],
  [/بوصه|إنش|انش/gi, 'in'],
  [/قطعه|قطع/gi, 'pcs'],
];

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

function toLatinDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS_MAP[d] || d);
}

/**
 * Localizes a size variant label using explicit translations first, then smart
 * rule-based translation for common Arabic size words & dimensions (سم -> cm, وسط -> Medium).
 */
export function localizeSizeLabel(
  rawLabel: string,
  locale: PublicLocaleCode,
  explicitTranslations?: Partial<Record<string, string>>,
  labelEn?: string
): string {
  const original = String(rawLabel || '').trim();
  if (!original || locale === 'ar') return original;

  const exactLocale = explicitTranslations?.[locale]?.trim();
  if (exactLocale) return exactLocale;

  const explicitEn = (labelEn || explicitTranslations?.en || '').trim();
  if (explicitEn) return explicitEn;

  let transformed = toLatinDigits(original)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');

  for (const [pattern, replacement] of SIZE_WORD_REPLACEMENTS_EN) {
    transformed = transformed.replace(pattern, replacement);
  }
  transformed = transformed.replace(/\s+/g, ' ').trim();

  // Only return transformed if it actually translated something or had Arabic numerals
  if (transformed !== original) return transformed;
  return original;
}

/**
 * Localizes a color label using explicit translations first, then built-in craft color dictionary.
 */
export function localizeColorLabel(
  rawColor: string,
  locale: PublicLocaleCode,
  explicitTranslations?: Partial<Record<string, string>>
): string {
  const original = String(rawColor || '').trim();
  if (!original || locale === 'ar') return original;

  const exactLocale = explicitTranslations?.[locale]?.trim();
  if (exactLocale) return exactLocale;

  const explicitEn = explicitTranslations?.en?.trim();
  if (explicitEn) return explicitEn;

  const key = normalizeArKey(original);
  const direct = COLOR_DICTIONARY_EN[key];
  if (direct) return direct;

  // Handle compound colors like "أوف وايت × جملي" or "بيج وذهبي"
  if (/[\+\/×\-]/.test(original)) {
    const parts = original.split(/(\s*[\+\/×\-]\s*)/);
    let changed = false;
    const mapped = parts.map((part) => {
      const k = normalizeArKey(part);
      if (COLOR_DICTIONARY_EN[k]) {
        changed = true;
        return COLOR_DICTIONARY_EN[k];
      }
      return part;
    });
    if (changed) return mapped.join('');
  }

  return original;
}

/**
 * Quick local instant fallback for size/color/craft terms when typing or before AI call.
 */
export function suggestEnglishCraftOrTerm(rawArabic: string, kind: 'size' | 'color' | 'craft'): string {
  if (kind === 'size') return localizeSizeLabel(rawArabic, 'en');
  if (kind === 'color') return localizeColorLabel(rawArabic, 'en');
  return localizeCraftTerm(rawArabic, 'en');
}
