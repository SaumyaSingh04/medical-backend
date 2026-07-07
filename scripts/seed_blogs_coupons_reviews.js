'use strict';

require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const prisma = require('../src/repositories/prismaClient');
const { uploadBuffer } = require('../src/config/cloudinary');

// ── IDs ───────────────────────────────────────────────────────────────────────
const U = {
  super : '499e0cc0-452d-4e08-9802-729287cf1a10',
  admin : 'dc2a27b7-8725-4f66-aea9-94c81851f7fd',
  user  : '1024bd2f-ec08-4bcd-a30b-0640c5776595',
};
const P = {
  ashwagandha : '4af9e866-8210-48c9-a085-3eb03dab18c1',
  triphala    : 'e845773e-629f-4386-814c-7dfc080bfa79',
  kumkumadi   : '8cc55ab3-31a2-4f2f-94a4-218d367889ea',
  brahmi      : '2e83c17e-5460-439c-8b38-eceff496aad7',
  shallaki    : 'e4c75a22-9b9e-4e3e-b56a-a66ded03fd1a',
  shatavari   : '0f5be985-207f-403c-9392-0b759e3a08e5',
  giloy       : '2ea74219-ce42-4775-86bc-7ba6a15e2654',
  hingwashtak : '19dd48c2-d27e-4f8c-ac2b-a48a5300f31e',
  neem        : '6e192d94-65bd-429e-8e44-0b3a8f7200a9',
  jatamansi   : 'e33e459c-18a0-455e-bbe3-b86849749336',
  guggul      : '65a01779-0878-4994-a4cc-9c079928ec25',
  lodhra      : '2987624b-b4bf-4efb-9e6a-9a4e51493cfc',
};
const CAT_SKIN     = 'f51e5868-7fdb-422b-b34f-77ea8a9e0de2';
const CAT_IMMUNITY = 'cbc8a2b2-c930-4f3c-9968-5b951308b13b';

async function uploadCover(slug) {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'ayurcat.jpg'));
  return uploadBuffer(buf, 'blogs', {
    public_id: slug, overwrite: true,
    transformation: [{ width: 1200, height: 630, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  });
}

// ── Blog definitions ──────────────────────────────────────────────────────────
const blogDefs = [
  {
    slug: 'top-5-ayurvedic-herbs-for-immunity',
    title: 'Top 5 Ayurvedic Herbs to Supercharge Your Immunity',
    excerpt: 'Discover the most powerful Ayurvedic herbs that have been used for centuries to build a strong immune system.',
    category: 'Immunity', tags: ['immunity', 'ashwagandha', 'giloy', 'tulsi', 'ayurveda'],
    isFeatured: true,
    content: [
      '## Why Immunity Matters More Than Ever',
      'In today\'s fast-paced world, a strong immune system is your first line of defence. Ayurveda has always emphasised building ojas — the vital essence that powers immunity.',
      '### 1. Ashwagandha (Withania somnifera)',
      'KSM-66 Ashwagandha is clinically proven to reduce cortisol by up to 28%, directly strengthening immune response. Take 500mg daily with warm milk.',
      '### 2. Giloy (Tinospora cordifolia)',
      'Known as Amrita (divine nectar), Giloy is a potent immunomodulator. It activates macrophages and increases white blood cell count.',
      '### 3. Tulsi (Ocimum sanctum)',
      'Holy Basil contains eugenol and rosmarinic acid — powerful antioxidants that fight viral and bacterial infections.',
      '### 4. Amalaki (Indian Gooseberry)',
      'With 20x more Vitamin C than oranges, Amalaki is the cornerstone of Triphala and a supreme rasayana for immunity.',
      '### 5. Guduchi Satva',
      'The purified extract of Giloy, Guduchi Satva is ideal for chronic low immunity and recurrent infections.',
      '## How to Use These Herbs',
      'Combine Ashwagandha capsules with Giloy juice every morning on an empty stomach for best results. Add Tulsi tea in the evening for a complete immunity protocol.',
    ].join('\n\n'),
  },
  {
    slug: 'ayurvedic-guide-to-better-digestion',
    title: 'The Complete Ayurvedic Guide to Better Digestion',
    excerpt: 'Learn how Ayurveda approaches digestive health through Agni, the digestive fire, and the best herbs to keep it burning bright.',
    category: 'Digestive Health', tags: ['digestion', 'triphala', 'agni', 'gut health', 'ayurveda'],
    isFeatured: true,
    content: [
      '## Understanding Agni — Your Digestive Fire',
      'Ayurveda teaches that all disease begins in the gut. Agni, the digestive fire, determines how well you absorb nutrients and eliminate toxins (ama).',
      '### Signs of Weak Agni',
      '- Bloating after meals\n- Irregular bowel movements\n- Heaviness and fatigue after eating\n- Coated tongue in the morning',
      '### Triphala — The King of Digestive Herbs',
      'Triphala (Amalaki + Bibhitaki + Haritaki) is the most researched Ayurvedic formula for digestion. It regulates bowel movements without dependency, detoxifies the colon gently and improves nutrient absorption.',
      'Dosage: 1 tsp Triphala churna in warm water at bedtime.',
      '### Hingwashtak Churna for Gas and Bloating',
      'Hing (asafoetida) is the most powerful carminative in Ayurveda. Hingwashtak churna taken before meals eliminates gas, bloating and indigestion within 20 minutes.',
      '### Lifestyle Tips',
      '1. Eat your largest meal at noon when Agni is strongest\n2. Avoid cold water with meals — it douses Agni\n3. Walk 100 steps after dinner (Shatapavali)\n4. Fast one day a week to reset digestive fire',
    ].join('\n\n'),
  },
  {
    slug: 'natural-skin-care-routine-ayurveda',
    title: 'Build Your Natural Skin Care Routine with Ayurveda',
    excerpt: 'Ayurvedic skin care goes beyond topical treatments — it addresses the root cause of skin issues through diet, herbs and daily rituals.',
    category: 'Skin & Hair Care', tags: ['skin care', 'kumkumadi', 'neem', 'ayurveda', 'natural beauty'],
    isFeatured: false,
    content: [
      '## Ayurvedic Skin Care — Inside Out',
      'Ayurveda classifies skin into three types based on your Prakriti (constitution): Vata (dry), Pitta (sensitive/oily) and Kapha (combination). True skin health comes from balancing your dosha.',
      '### Morning Ritual',
      '1. Oil Pulling — swish 1 tbsp sesame oil for 10 minutes to remove toxins\n2. Ubtan Cleanse — mix chickpea flour + turmeric + rose water as a natural face wash\n3. Kumkumadi Serum — apply 3-4 drops on damp skin for saffron-powered radiance',
      '### Key Herbs for Skin',
      'Kumkumadi (Saffron Complex): The gold standard of Ayurvedic skin care. Saffron, sandalwood and 16 rare herbs work together to even skin tone, boost collagen synthesis and provide deep hydration.',
      'Neem (Azadirachta indica): Nature\'s antibiotic for skin. Neem\'s nimbidin compound kills acne-causing bacteria and reduces sebum production.',
      'Manjistha (Rubia cordifolia): The best blood-purifying herb for skin. Clears hormonal acne from within.',
      '### Diet for Glowing Skin',
      '- Drink 2L warm water daily\n- Include ghee in your diet — it lubricates skin from inside\n- Avoid spicy, fried foods (aggravates Pitta)\n- Eat seasonal fruits rich in antioxidants',
    ].join('\n\n'),
  },
  {
    slug: 'manage-stress-naturally-with-ayurveda',
    title: 'How to Manage Stress Naturally — The Ayurvedic Way',
    excerpt: 'Modern stress is a Vata-Pitta imbalance. Discover Ayurvedic adaptogens, breathing techniques and daily routines that restore calm.',
    category: 'Stress & Sleep', tags: ['stress', 'brahmi', 'ashwagandha', 'sleep', 'anxiety', 'ayurveda'],
    isFeatured: false,
    content: [
      '## Stress Through the Ayurvedic Lens',
      'Ayurveda sees chronic stress as an aggravation of Vata dosha — the energy of movement and the nervous system. When Vata goes out of balance, anxiety, insomnia and mental fatigue follow.',
      '### The Adaptogen Protocol',
      'Brahmi (Bacopa monnieri): The premier brain tonic in Ayurveda. Clinical studies show Brahmi reduces anxiety scores by 20% in 12 weeks, improves memory and cognitive function, and promotes GABA activity for natural calm.',
      'Ashwagandha (Withania somnifera): Reduces cortisol (stress hormone) by up to 28%. Best taken at night with warm milk and honey.',
      'Jatamansi (Nardostachys jatamansi): The Ayurvedic equivalent of Valerian. Jatamansi drops under the tongue 30 minutes before bed promote deep, restorative sleep.',
      '### Pranayama for Instant Stress Relief',
      '1. Nadi Shodhana (Alternate Nostril Breathing) — 5 minutes, balances both hemispheres\n2. Bhramari (Humming Bee Breath) — activates the vagus nerve, instant calm\n3. Sheetali (Cooling Breath) — reduces Pitta heat and mental agitation',
      '### Dinacharya (Daily Routine) for Stress',
      '- Wake before sunrise (Brahma Muhurta)\n- Abhyanga (self-massage with sesame oil) before bath\n- No screens 1 hour before bed\n- Warm turmeric milk (Haldi Doodh) at bedtime',
    ].join('\n\n'),
  },
  {
    slug: 'ayurvedic-remedies-for-joint-pain',
    title: '5 Proven Ayurvedic Remedies for Joint Pain and Arthritis',
    excerpt: 'Joint pain affects millions. Ayurveda offers time-tested solutions that address the root cause — not just the symptoms.',
    category: 'Joint & Bone Health', tags: ['joint pain', 'shallaki', 'guggul', 'arthritis', 'bone health'],
    isFeatured: true,
    content: [
      '## Joint Pain in Ayurveda — Ama and Vata',
      'Ayurveda identifies two types of joint disease: Ama Vata (rheumatoid-type, with toxins) and Sandhivata (osteoarthritis-type, with dryness). Treatment differs for each.',
      '### Top 5 Ayurvedic Remedies',
      '1. Shallaki (Boswellia serrata): The most clinically validated Ayurvedic herb for joints. Boswellic acids inhibit 5-LOX enzyme — the same pathway targeted by modern anti-inflammatory drugs, but without side effects.',
      '2. Guggul (Commiphora mukul): Shuddha Guggul reduces uric acid, improves synovial fluid quality and rebuilds cartilage. Best combined with Triphala for maximum absorption.',
      '3. Mahanarayan Oil: The classic external treatment. Warm oil massage penetrates deep into joints, reduces stiffness and improves circulation. Apply before bath daily.',
      '4. Nirgundi (Vitex negundo): Powerful anti-inflammatory leaves. Nirgundi oil or paste applied externally reduces swelling and pain within hours.',
      '5. Rasna (Pluchea lanceolata): Specific for Vata-type joint pain with cracking sounds. Rasna Saptak Kwath is the classical formulation.',
      '### Dietary Guidelines',
      '- Avoid curd, cold foods and excessive sour taste (aggravates Ama)\n- Include ginger, garlic and turmeric in every meal\n- Castor oil (1 tsp at bedtime) is the best Vata-pacifying laxative for joint health\n- Stay warm — cold aggravates Vata and worsens joint pain',
    ].join('\n\n'),
  },
  {
    slug: 'shatavari-complete-guide-womens-health',
    title: 'Shatavari — The Complete Guide to Womens Health in Ayurveda',
    excerpt: 'Shatavari is called the herb of a thousand roots for good reason. Explore its profound benefits for womens health at every life stage.',
    category: 'Womens Wellness', tags: ['shatavari', 'womens health', 'hormones', 'fertility', 'ayurveda'],
    isFeatured: true,
    content: [
      '## Shatavari — Queen of Ayurvedic Herbs for Women',
      'Shatavari (Asparagus racemosus) literally means "she who possesses a hundred husbands" — a testament to its power to restore vitality and reproductive health in women.',
      '### Benefits Across Life Stages',
      'Teenage Years: Regulates menstrual cycle from the start, reduces menstrual cramps (dysmenorrhea) and balances hormonal acne.',
      'Reproductive Years: Improves fertility by nourishing the uterine lining, reduces PMS symptoms — mood swings, bloating, breast tenderness, and supports healthy pregnancy.',
      'Perimenopause and Menopause: Reduces hot flashes and night sweats, maintains bone density (phytoestrogen activity), improves vaginal dryness naturally and supports emotional balance during hormonal transition.',
      '### How to Use Shatavari',
      'Shatavari Syrup: 2 tsp twice daily with warm milk — best for general wellness and hormonal balance.\nShatavari Churna: 1 tsp with ghee and honey — best for fertility support.\nShatavari Kalpa: Sweetened preparation — best for postpartum recovery.',
      '### Combining Shatavari',
      '- With Ashoka: for heavy menstrual bleeding\n- With Lodhra: for PCOS and hormonal acne\n- With Brahmi: for stress-related hormonal imbalance',
      '### Safety',
      'Shatavari is safe for long-term use. Avoid if allergic to asparagus. Consult a doctor during pregnancy.',
    ].join('\n\n'),
  },
];

// ── Review pairs (2 per product, 12 products = 24 reviews) ───────────────────
const reviewPairs = [
  { productId: P.ashwagandha,
    r1: { rating: 5, title: 'Life-changing supplement!', comment: 'Been taking Ashwagandha Gold for 3 months. My energy levels are through the roof and I barely fall sick anymore. The KSM-66 extract is clearly superior quality.' },
    r2: { rating: 4, title: 'Good quality, noticeable results', comment: 'Took about 4 weeks to feel the difference but now I sleep better and feel less stressed. Packaging is premium too.' } },

  { productId: P.triphala,
    r1: { rating: 5, title: 'Best Triphala I have tried', comment: 'I have been using Triphala for years and this is by far the purest. No artificial smell, dissolves well in water. My digestion has improved dramatically.' },
    r2: { rating: 4, title: 'Effective and affordable', comment: 'Works exactly as described. Took it for 2 weeks and my bloating is completely gone. Will definitely reorder.' } },

  { productId: P.kumkumadi,
    r1: { rating: 5, title: 'Genuine Kumkumadi — worth every rupee', comment: 'I was skeptical at first but after 6 weeks my skin tone has visibly evened out. The saffron smell is authentic and the texture is perfect — not too oily.' },
    r2: { rating: 5, title: 'Holy grail serum!', comment: 'My dark spots have faded significantly. I use 3 drops every night and wake up with glowing skin. Best purchase this year.' } },

  { productId: P.brahmi,
    r1: { rating: 4, title: 'Noticeably calmer after 3 weeks', comment: 'I was dealing with work anxiety and these tablets have made a real difference. I fall asleep faster and wake up refreshed. No drowsiness during the day.' },
    r2: { rating: 4, title: 'Good for stress and focus', comment: 'Takes time to work but the results are worth it. My concentration at work has improved and I feel less overwhelmed.' } },

  { productId: P.shallaki,
    r1: { rating: 5, title: 'My knee pain is finally manageable', comment: 'I have had chronic knee pain for 5 years. After using Shallaki oil daily for a month, I can climb stairs without wincing. Genuinely impressed.' },
    r2: { rating: 4, title: 'Good relief for morning stiffness', comment: 'Warm oil massage every morning has reduced my joint stiffness significantly. The oil absorbs well and does not leave a greasy residue.' } },

  { productId: P.shatavari,
    r1: { rating: 5, title: 'Hormonal balance restored', comment: 'My periods were irregular for 2 years. After 3 months of Shatavari syrup my cycle is regular and PMS symptoms are almost gone. Highly recommend.' },
    r2: { rating: 5, title: 'Excellent for postpartum recovery', comment: 'My doctor suggested Shatavari after delivery. My energy came back faster and milk supply improved. The taste is pleasant too.' } },

  { productId: P.giloy,
    r1: { rating: 4, title: 'Great daily immunity drink', comment: 'I take this every morning and have not had a cold in 4 months. The taste is slightly bitter but you get used to it. Good value for money.' },
    r2: { rating: 4, title: 'Effective during seasonal changes', comment: 'Especially useful during monsoon season. Keeps fever and infections at bay. The Tulsi combination is a great addition.' } },

  { productId: P.hingwashtak,
    r1: { rating: 5, title: 'Instant relief from gas and bloating', comment: 'I take half a teaspoon before lunch and dinner. Gas and bloating are completely gone within 20 minutes. This is a staple in my kitchen now.' },
    r2: { rating: 4, title: 'Works fast and effectively', comment: 'Much better than antacids. Natural, no side effects and works every time. The hing smell is strong but that means it is authentic.' } },

  { productId: P.neem,
    r1: { rating: 4, title: 'Gentle yet effective face wash', comment: 'My skin feels clean without being dry. The neem keeps breakouts in check and the aloe vera soothes redness. Perfect for my oily skin.' },
    r2: { rating: 4, title: 'Good for acne-prone skin', comment: 'Been using for 6 weeks. Fewer breakouts and my skin looks clearer. Does not strip moisture like other acne face washes.' } },

  { productId: P.jatamansi,
    r1: { rating: 5, title: 'Finally sleeping through the night', comment: 'I had insomnia for 2 years. These drops work within 30 minutes — I fall asleep naturally and wake up without grogginess. No dependency either.' },
    r2: { rating: 4, title: 'Calming and effective', comment: 'I use 10 drops under the tongue before bed. Sleep quality has improved noticeably. Also helps with evening anxiety.' } },

  { productId: P.guggul,
    r1: { rating: 4, title: 'Bones feel stronger after 2 months', comment: 'My DEXA scan showed improved bone density after 6 months of use. Combined with calcium-rich diet this is a powerful combination.' },
    r2: { rating: 4, title: 'Good for joint flexibility', comment: 'My morning stiffness has reduced. I can move more freely now. Takes time but the results are real.' } },

  { productId: P.lodhra,
    r1: { rating: 5, title: 'Best face pack for hormonal acne', comment: 'I have PCOS and hormonal acne. This face pack twice a week has reduced my breakouts by 70%. Skin feels tighter and brighter after each use.' },
    r2: { rating: 4, title: 'Natural glow after first use', comment: 'Skin feels incredibly soft after washing off. The Manjistha in it really brightens the complexion. Will keep using.' } },
];

async function main() {
  // ── 1. BLOGS ────────────────────────────────────────────────────────────────
  console.log('\n── Blogs ──────────────────────────────────────────────────');
  for (const b of blogDefs) {
    process.stdout.write('  Uploading cover for: ' + b.slug + ' ... ');
    const up  = await uploadCover(b.slug);
    const now = new Date();
    await prisma.blog.create({ data: {
      title:              b.title,
      slug:               b.slug,
      content:            b.content,
      excerpt:            b.excerpt,
      authorId:           U.admin,
      category:           b.category,
      tags:               b.tags,
      coverImageUrl:      up.secure_url,
      coverImagePublicId: up.public_id,
      coverImageAlt:      b.title,
      status:             'published',
      publishedAt:        now,
      isFeatured:         b.isFeatured,
      views:              Math.floor(Math.random() * 800) + 100,
      likes:              Math.floor(Math.random() * 120) + 20,
      metaTitle:          b.title.slice(0, 60),
      metaDescription:    b.excerpt.slice(0, 160),
      metaKeywords:       b.tags,
      isDeleted:          false,
    }});
    console.log('done');
  }
  console.log('Inserted', blogDefs.length, 'blogs');

  // ── 2. COUPONS ──────────────────────────────────────────────────────────────
  console.log('\n── Coupons ────────────────────────────────────────────────');
  const now    = new Date();
  const plus7  = new Date(now); plus7.setDate(plus7.getDate() + 7);
  const plus30 = new Date(now); plus30.setDate(plus30.getDate() + 30);
  const plus60 = new Date(now); plus60.setDate(plus60.getDate() + 60);

  const coupons = [
    {
      code: 'WELCOME10', type: 'percentage', value: 10,
      maxDiscount: 100, minOrderAmount: 299,
      description: '10% off on your first order. Max discount Rs.100.',
      isActive: true, startDate: now, endDate: plus30,
      usageLimit: 500, usagePerUser: 1, totalUsed: 0, freeShipping: false,
      applicableCategories: [], applicableProducts: [], excludedProducts: [], usedBy: [],
    },
    {
      code: 'FLAT150', type: 'flat', value: 150,
      maxDiscount: 150, minOrderAmount: 799,
      description: 'Flat Rs.150 off on orders above Rs.799.',
      isActive: true, startDate: now, endDate: plus30,
      usageLimit: 200, usagePerUser: 2, totalUsed: 0, freeShipping: false,
      applicableCategories: [], applicableProducts: [], excludedProducts: [], usedBy: [],
    },
    {
      code: 'FREESHIP', type: 'free_shipping', value: 0,
      minOrderAmount: 499,
      description: 'Free shipping on orders above Rs.499.',
      isActive: true, startDate: now, endDate: plus60,
      usagePerUser: 3, totalUsed: 0, freeShipping: true,
      applicableCategories: [], applicableProducts: [], excludedProducts: [], usedBy: [],
    },
    {
      code: 'SKIN20', type: 'percentage', value: 20,
      maxDiscount: 200, minOrderAmount: 399,
      description: '20% off on all Skin & Hair Care products.',
      isActive: true, startDate: now, endDate: plus30,
      usageLimit: 100, usagePerUser: 1, totalUsed: 0, freeShipping: false,
      applicableCategories: [CAT_SKIN], applicableProducts: [], excludedProducts: [], usedBy: [],
    },
    {
      code: 'IMMUNITY15', type: 'percentage', value: 15,
      maxDiscount: 150, minOrderAmount: 299,
      description: '15% off on Immunity Booster products.',
      isActive: true, startDate: now, endDate: plus30,
      usageLimit: 150, usagePerUser: 1, totalUsed: 0, freeShipping: false,
      applicableCategories: [CAT_IMMUNITY], applicableProducts: [], excludedProducts: [], usedBy: [],
    },
    {
      code: 'FLASH50', type: 'flat', value: 50,
      maxDiscount: 50, minOrderAmount: 199,
      description: 'Flash sale — flat Rs.50 off. Valid for 7 days only.',
      isActive: true, startDate: now, endDate: plus7,
      usageLimit: 300, usagePerUser: 1, totalUsed: 0, freeShipping: false,
      applicableCategories: [], applicableProducts: [], excludedProducts: [], usedBy: [],
    },
  ];
  await prisma.coupon.createMany({ data: coupons });
  console.log('Inserted', coupons.length, 'coupons');

  // ── 3. REVIEWS ──────────────────────────────────────────────────────────────
  console.log('\n── Reviews ────────────────────────────────────────────────');
  let reviewCount = 0;
  for (const rp of reviewPairs) {
    await prisma.review.create({ data: {
      productId: rp.productId, userId: U.user,
      rating: rp.r1.rating, title: rp.r1.title, comment: rp.r1.comment,
      isVerifiedPurchase: true, isApproved: true, isHidden: false,
      helpfulVotes: Math.floor(Math.random() * 40) + 5, images: [],
    }});
    await prisma.review.create({ data: {
      productId: rp.productId, userId: U.super,
      rating: rp.r2.rating, title: rp.r2.title, comment: rp.r2.comment,
      isVerifiedPurchase: true, isApproved: true, isHidden: false,
      helpfulVotes: Math.floor(Math.random() * 30) + 3, images: [],
    }});
    reviewCount += 2;
    process.stdout.write('.');
  }
  console.log('\nInserted', reviewCount, 'reviews');

  // ── Summary ─────────────────────────────────────────────────────────────────
  const [bc, cc, rc] = await Promise.all([
    prisma.blog.count(),
    prisma.coupon.count(),
    prisma.review.count(),
  ]);
  console.log('\n════ DB Summary ════');
  console.log('Blogs  :', bc);
  console.log('Coupons:', cc);
  console.log('Reviews:', rc);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
