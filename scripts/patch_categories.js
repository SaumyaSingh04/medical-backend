'use strict';

/**
 * patch_categories.js
 * -------------------
 * Updates the 5 existing Category rows in-place.
 * Does NOT insert, delete, or change IDs / slugs / parentId.
 * Only fills fields that are currently NULL or have poor-quality values.
 *
 * Fields patched per row:
 *   name            – corrected to proper medical category name (kept same where fine)
 *   description     – rich, accurate 500-char-safe description
 *   imageUrl        – real Unsplash photo that matches the category
 *   imagePublicId   – human-readable Cloudinary-style public_id (no upload needed)
 *   metaTitle       – ≤ 60 chars, SEO keyword-rich
 *   metaDescription – ≤ 160 chars, Google snippet quality
 *   sortOrder       – explicit 1-5
 *   isActive        – true
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Category patch data ──────────────────────────────────────────────────────
// Keyed by the existing UUID so nothing can accidentally match the wrong row.

const patches = [
  {
    id: 'c8ab14d0-59e5-4a59-9d9a-f20eae1cae72',   // Herbal Supplements
    name: 'Herbal Supplements',
    description:
      'Explore our curated range of Ayurvedic and herbal supplements — capsules, tablets, syrups, and wellness formulations crafted from time-tested botanicals. Supports immunity, digestion, energy, and holistic well-being.',
    imageUrl:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop',
    imagePublicId: 'medical-ecommerce/categories/herbal-supplements',
    metaTitle: 'Herbal Supplements – Ayurvedic Capsules & Tablets',
    metaDescription:
      'Shop premium Ayurvedic herbal supplements including Ashwagandha, Triphala, Shilajit & more. Natural capsules and tablets for immunity, energy, and wellness.',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: '3075055d-df6c-4933-b6eb-774c27792068',   // Massage & Hair Oils
    name: 'Massage & Hair Oils',
    description:
      'Discover authentic Ayurvedic massage tailams, therapeutic body oils, and hair nourishment formulations. Blended with herbs like Bhringraj, Brahmi, and Dhanwantharam for deep tissue relief and scalp health.',
    imageUrl:
      'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&auto=format&fit=crop',
    imagePublicId: 'medical-ecommerce/categories/massage-hair-oils',
    metaTitle: 'Massage & Hair Oils – Ayurvedic Tailams & Body Oils',
    metaDescription:
      'Buy traditional Ayurvedic massage oils, hair oils, and body tailams. Bhringraj, Mahanarayan, Dhanwantharam and more for pain relief and hair growth.',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'd96e17b0-5c9e-498e-a97f-f00e965d521b',   // Skincare & Personal Care
    name: 'Skincare & Personal Care',
    description:
      'Natural skincare essentials formulated with Ayurvedic herbs. From Neem face wash and Kumkumadi face packs to rose water toners and turmeric glow creams — gentle, effective, and free from harsh chemicals.',
    imageUrl:
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&auto=format&fit=crop',
    imagePublicId: 'medical-ecommerce/categories/skincare-personal-care',
    metaTitle: 'Skincare & Personal Care – Herbal Beauty Products',
    metaDescription:
      'Shop herbal skincare products including Neem face wash, Kumkumadi oil, rose water toner, and turmeric cream. Natural beauty made with Ayurvedic ingredients.',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'be7d4785-918f-4599-95a5-4e69906d1bce',   // Wellness Teas & Juices
    name: 'Wellness Teas & Juices',
    description:
      'Revitalise your daily routine with organic herbal teas, immunity-boosting juices, and health tonics. Sourced from certified organic farms — Tulsi, Ginger Lemon, Amla, Aloe Vera, and Giloy blends for everyday vitality.',
    imageUrl:
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop',
    imagePublicId: 'medical-ecommerce/categories/wellness-teas-juices',
    metaTitle: 'Wellness Teas & Juices – Organic Herbal Drinks',
    metaDescription:
      'Buy organic herbal teas, Amla juice, Aloe Vera juice, and Giloy immunity drinks. Caffeine-free, naturally sourced wellness beverages for the whole family.',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'ee471c56-1b70-49a4-b3d9-29c3a3433124',   // Single Herb Powders
    name: 'Single Herb Powders',
    description:
      'Pure, unadulterated single-herb powders stone-ground and sifted for maximum potency. Ashwagandha, Triphala Churna, Shatavari, Turmeric Root, and Amla powders — no fillers, no additives, lab-tested for purity.',
    imageUrl:
      'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=800&auto=format&fit=crop',
    imagePublicId: 'medical-ecommerce/categories/single-herb-powders',
    metaTitle: 'Single Herb Powders – Pure Ayurvedic Churnas',
    metaDescription:
      'Buy pure Ayurvedic single herb powders: Ashwagandha, Triphala, Shatavari, Turmeric and Amla. Lab-tested, no fillers. Ideal for daily supplementation.',
    sortOrder: 5,
    isActive: true,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧  Patching 5 categories...\n');

  for (const patch of patches) {
    const { id, ...data } = patch;

    // Confirm the row actually exists before updating
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      console.warn(`⚠️   Category ${id} not found — skipping.`);
      continue;
    }

    await prisma.category.update({
      where: { id },
      data: {
        name:            data.name,
        description:     data.description,
        imageUrl:        data.imageUrl,
        imagePublicId:   data.imagePublicId,
        metaTitle:       data.metaTitle,
        metaDescription: data.metaDescription,
        sortOrder:       data.sortOrder,
        isActive:        data.isActive,
        // slug, parentId, ancestors, level, createdAt — intentionally untouched
      },
    });

    console.log(`  ✅  [${data.sortOrder}] ${data.name}`);
    console.log(`        image   → ${data.imageUrl.slice(0, 72)}…`);
    console.log(`        meta    → "${data.metaTitle}"\n`);
  }

  // ─── Verify ─────────────────────────────────────────────────────────────────
  const rows = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  const nullFields = rows.flatMap((r) =>
    ['imageUrl', 'metaTitle', 'metaDescription', 'description']
      .filter((f) => r[f] == null)
      .map((f) => `${r.name}.${f}`)
  );

  if (nullFields.length === 0) {
    console.log('✔   Verification passed — no NULL fields remain on any category.');
  } else {
    console.warn('⚠️   Still-NULL fields detected:', nullFields);
  }

  console.log('\n🎉  Category patch complete.');
}

main()
  .catch((e) => { console.error('❌  Patch failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
