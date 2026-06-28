'use strict';

const slug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randFloat = (min, max, decimals = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

const randBool = (trueProbability = 0.5) => Math.random() < trueProbability;

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

const randDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const uniqueSlug = (base, suffix) => `${slug(base)}-${suffix}`;

const sample = (arr, n) => {
  const copy = [...arr];
  const result = [];
  while (result.length < n && copy.length) {
    const idx = randInt(0, copy.length - 1);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
};

const indianPhone = (i) => {
  const prefixes = ['98', '97', '96', '95', '94', '93', '91', '90', '89', '88', '87', '86', '85', '84', '83', '82', '81', '80', '79', '78'];
  return `+91${rand(prefixes)}${String(i + 1).padStart(2, '0')}${randInt(100000, 999999)}`;
};

const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;

const productImageUrl = (productName) => {
  const map = {
    'Ashwagandha Capsules':        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ashwagandha_plant.jpg/320px-Ashwagandha_plant.jpg',
    'Triphala Tablets':            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Triphala_powder.jpg/320px-Triphala_powder.jpg',
    'Brahmi Mind Booster':         'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Bacopa_monnieri_02.jpg/320px-Bacopa_monnieri_02.jpg',
    'Shilajit Gold Capsules':      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Shilajit.jpg/320px-Shilajit.jpg',
    'Chyawanprash Immunity Boost': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Chyawanprash.jpg/320px-Chyawanprash.jpg',
    'Bhringraj Hair Oil':          'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Eclipta_prostrata_W_IMG_2175.jpg/320px-Eclipta_prostrata_W_IMG_2175.jpg',
    'Mahanarayan Massage Oil':     'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sesame_oil.jpg/320px-Sesame_oil.jpg',
    'Coconut-Brahmi Hair Oil':     'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Kokosnuss-Coconut_edit.jpg/320px-Kokosnuss-Coconut_edit.jpg',
    'Dhanwantharam Tailam':        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sesame_oil.jpg/320px-Sesame_oil.jpg',
    'Sesame Body Oil':             'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Sesamum_indicum_seed_oil.jpg/320px-Sesamum_indicum_seed_oil.jpg',
    'Neem Face Wash':              'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Neem_leaves.jpg/320px-Neem_leaves.jpg',
    'Kumkumadi Face Pack':         'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Saffron_threads.jpg/320px-Saffron_threads.jpg',
    'Rose Water Toner':            'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/RoseWaterBottle.jpg/320px-RoseWaterBottle.jpg',
    'Sandalwood Soap':             'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Sandalwood_chips-1.jpg/320px-Sandalwood_chips-1.jpg',
    'Turmeric Glow Cream':         'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Turmeric_Powder_Bulk.jpg/320px-Turmeric_Powder_Bulk.jpg',
    'Tulsi Green Tea':             'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Ocimum_tenuiflorum3.jpg/320px-Ocimum_tenuiflorum3.jpg',
    'Ginger Lemon Honey Tea':      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ginger-root-and-powder.jpg/320px-Ginger-root-and-powder.jpg',
    'Amla Juice':                  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Amla.jpg/320px-Amla.jpg',
    'Aloe Vera Juice':             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Aloe_vera_flower_inset.png/320px-Aloe_vera_flower_inset.png',
    'Giloy Immunity Drink':        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Tinospora_cordifolia.jpg/320px-Tinospora_cordifolia.jpg',
    'Ashwagandha Powder':          'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ashwagandha_plant.jpg/320px-Ashwagandha_plant.jpg',
    'Triphala Churna':             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Triphala_powder.jpg/320px-Triphala_powder.jpg',
    'Shatavari Powder':            'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Asparagus_racemosus_-_Shatavari.jpg/320px-Asparagus_racemosus_-_Shatavari.jpg',
    'Turmeric Root Powder':        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Turmeric_Powder_Bulk.jpg/320px-Turmeric_Powder_Bulk.jpg',
    'Amla Powder':                 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Amla.jpg/320px-Amla.jpg',
  };
  return map[productName] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/320px-No_image_available.svg.png';
};

const categoryImageUrl = (categoryName) => {
  const map = {
    'Herbal Supplements':       'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ashwagandha_plant.jpg/320px-Ashwagandha_plant.jpg',
    'Massage & Hair Oils':      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sesame_oil.jpg/320px-Sesame_oil.jpg',
    'Skincare & Personal Care': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Neem_leaves.jpg/320px-Neem_leaves.jpg',
    'Wellness Teas & Juices':   'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Ocimum_tenuiflorum3.jpg/320px-Ocimum_tenuiflorum3.jpg',
    'Single Herb Powders':      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Turmeric_Powder_Bulk.jpg/320px-Turmeric_Powder_Bulk.jpg',
  };
  return map[categoryName] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/320px-No_image_available.svg.png';
};

const blogCoverUrl = (category) => {
  const map = {
    Health:    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Ocimum_tenuiflorum3.jpg/640px-Ocimum_tenuiflorum3.jpg',
    Wellness:  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ashwagandha_plant.jpg/640px-Ashwagandha_plant.jpg',
    Skincare:  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Neem_leaves.jpg/640px-Neem_leaves.jpg',
    Nutrition: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Amla.jpg/640px-Amla.jpg',
    Ayurveda:  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Triphala_powder.jpg/640px-Triphala_powder.jpg',
  };
  return map[category] || map.Health;
};

module.exports = {
  slug, rand, randInt, randFloat, randBool,
  daysAgo, daysFromNow, randDate, uniqueSlug,
  sample, indianPhone, avatarUrl,
  productImageUrl, categoryImageUrl, blogCoverUrl,
};
