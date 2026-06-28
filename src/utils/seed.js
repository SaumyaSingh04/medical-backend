'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const {
  slug, rand, randInt, randBool,
  daysAgo, daysFromNow,
  indianPhone, avatarUrl,
  productImageUrl, categoryImageUrl, blogCoverUrl,
} = require(path.join(__dirname, '../../prisma/seed/helpers'));

const prisma = new PrismaClient();

// ─── Raw Data ─────────────────────────────────────────────────────────────────

const categoryData = [
  { name: 'Herbal Supplements',      description: 'Ayurvedic tablets, capsules, and wellness formulations.',       sortOrder: 1 },
  { name: 'Massage & Hair Oils',     description: 'Therapeutic tailams, body oils, and hair formulations.',        sortOrder: 2 },
  { name: 'Skincare & Personal Care',description: 'Herbal soaps, face packs, and organic beauty products.',        sortOrder: 3 },
  { name: 'Wellness Teas & Juices',  description: 'Organic herbal teas, health tonics, and wellness drinks.',      sortOrder: 4 },
  { name: 'Single Herb Powders',     description: 'Pure powders: Ashwagandha, Triphala, Shatavari, Turmeric.',     sortOrder: 5 },
];

const productNames = [
  ['Ashwagandha Capsules', 'Triphala Tablets', 'Brahmi Mind Booster', 'Shilajit Gold Capsules', 'Chyawanprash Immunity Boost'],
  ['Bhringraj Hair Oil', 'Mahanarayan Massage Oil', 'Coconut-Brahmi Hair Oil', 'Dhanwantharam Tailam', 'Sesame Body Oil'],
  ['Neem Face Wash', 'Kumkumadi Face Pack', 'Rose Water Toner', 'Sandalwood Soap', 'Turmeric Glow Cream'],
  ['Tulsi Green Tea', 'Ginger Lemon Honey Tea', 'Amla Juice', 'Aloe Vera Juice', 'Giloy Immunity Drink'],
  ['Ashwagandha Powder', 'Triphala Churna', 'Shatavari Powder', 'Turmeric Root Powder', 'Amla Powder'],
];

const userData = [
  { firstName: 'Aryan',  lastName: 'Sharma', email: 'aryan@example.com' },
  { firstName: 'Priya',  lastName: 'Mehta',  email: 'priya@example.com' },
  { firstName: 'Rohan',  lastName: 'Verma',  email: 'rohan@example.com' },
  { firstName: 'Sneha',  lastName: 'Patel',  email: 'sneha@example.com' },
  { firstName: 'Vikram', lastName: 'Nair',   email: 'vikram@example.com' },
];

const brands = ['Himalaya', 'Patanjali', 'Kerala Ayurveda', 'Dabur', 'Baidyanath'];

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedUsers(hashedPassword) {
  const users = await Promise.all(
    userData.map((u, i) =>
      prisma.user.create({
        data: {
          ...u,
          phone: indianPhone(i),
          password: hashedPassword,
          role: 'user',
          isEmailVerified: true,
          isActive: true,
          avatarUrl: avatarUrl(`${u.firstName} ${u.lastName}`),
          addresses: [
            {
              id: `addr-${i}`,
              label: 'Home',
              fullName: `${u.firstName} ${u.lastName}`,
              phone: indianPhone(i + 10),
              addressLine1: `${i + 1} MG Road`,
              city: rand(['Bangalore', 'Mumbai', 'Delhi', 'Pune', 'Chennai']),
              state: rand(['Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu']),
              pincode: `5600${String(i + 1).padStart(2, '0')}`,
              country: 'India',
              isDefault: true,
            },
          ],
        },
      })
    )
  );

  const admin = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      phone: '+919000000001',
      password: hashedPassword,
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
      avatarUrl: avatarUrl('Admin User'),
    },
  });

  console.log(`✅ Seeded ${users.length + 1} users (including admin)`);
  return { users, admin };
}

async function seedCategories() {
  const categories = await Promise.all(
    categoryData.map((c) =>
      prisma.category.create({
        data: {
          ...c,
          slug: slug(c.name),
          isActive: true,
          imageUrl: categoryImageUrl(c.name),
        },
      })
    )
  );
  console.log(`✅ Seeded ${categories.length} categories`);
  return categories;
}

async function seedProducts(categories) {
  const products = [];
  for (let i = 0; i < categories.length; i++) {
    for (const name of productNames[i]) {
      const price = randInt(149, 999);
      const imgUrl = productImageUrl(name);
      const p = await prisma.product.create({
        data: {
          name,
          slug: slug(name) + '-' + randInt(1000, 9999),
          description: `${name} is a premium Ayurvedic product crafted from natural herbs. It supports overall wellness and vitality. Made with traditional recipes passed down through generations.`,
          shortDescription: `Premium quality ${name} for daily health and wellness.`,
          brand: rand(brands),
          price,
          compareAtPrice: price + randInt(50, 200),
          costPrice: price - randInt(20, 70),
          categoryId: categories[i].id,
          sku: `SKU-${categories[i].name.slice(0, 3).toUpperCase()}-${randInt(10000, 99999)}`,
          stock: randInt(20, 200),
          lowStockThreshold: 5,
          trackInventory: true,
          isFeatured: randBool(0.3),
          isActive: true,
          averageRating: parseFloat((randInt(35, 50) / 10).toFixed(1)),
          ratingCount: randInt(5, 150),
          totalSold: randInt(10, 500),
          tags: ['ayurveda', 'natural', 'herbal', categories[i].name.split(' ')[0].toLowerCase()],
          images: [{ url: imgUrl, publicId: null, alt: name }],
          thumbnailUrl: imgUrl,
          weight: parseFloat((randInt(100, 500) / 1000).toFixed(2)),
          metaTitle: name,
          metaDescription: `Buy ${name} online — 100% natural Ayurvedic product.`,
          metaKeywords: ['ayurveda', 'herbal', name.toLowerCase()],
        },
      });
      products.push(p);
    }
  }
  console.log(`✅ Seeded ${products.length} products`);
  return products;
}

async function seedCoupons() {
  const coupons = await Promise.all([
    prisma.coupon.create({
      data: {
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        maxDiscount: 100,
        minOrderAmount: 299,
        description: '10% off on your first order',
        isActive: true,
        startDate: new Date(),
        endDate: daysFromNow(30),
        usageLimit: 1000,
        usagePerUser: 1,
      },
    }),
    prisma.coupon.create({
      data: {
        code: 'FLAT50',
        type: 'flat',
        value: 50,
        minOrderAmount: 499,
        description: 'Flat ₹50 off on orders above ₹499',
        isActive: true,
        startDate: new Date(),
        endDate: daysFromNow(60),
        usageLimit: 500,
        usagePerUser: 2,
      },
    }),
    prisma.coupon.create({
      data: {
        code: 'FREESHIP',
        type: 'free_shipping',
        value: 0,
        minOrderAmount: 599,
        description: 'Free shipping on orders above ₹599',
        freeShipping: true,
        isActive: true,
        startDate: new Date(),
        endDate: daysFromNow(90),
      },
    }),
    prisma.coupon.create({
      data: {
        code: 'AYUR20',
        type: 'percentage',
        value: 20,
        maxDiscount: 200,
        minOrderAmount: 799,
        description: '20% off on Ayurvedic products',
        isActive: true,
        startDate: new Date(),
        endDate: daysFromNow(45),
        usageLimit: 300,
        usagePerUser: 1,
      },
    }),
  ]);
  console.log(`✅ Seeded ${coupons.length} coupons`);
  return coupons;
}

async function seedOrdersAndPayments(users, products) {
  const statuses = ['confirmed', 'processing', 'shipped', 'delivered'];
  const orders = [];

  for (const user of users) {
    const selectedProducts = products.slice(randInt(0, 5), randInt(6, 12));
    const subtotal = selectedProducts.reduce((sum, p) => sum + Number(p.price), 0);
    const shippingCharge = subtotal > 599 ? 0 : 40;
    const totalAmount = subtotal + shippingCharge;
    const orderStatus = rand(statuses);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'razorpay',
        status: 'paid',
        amount: totalAmount,
        currency: 'INR',
        razorpayOrderId: `order_seed${Date.now()}${randInt(100, 999)}`,
        razorpayPaymentId: `pay_seed${Date.now()}${randInt(100, 999)}`,
        paidAt: daysAgo(randInt(1, 30)),
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}-${randInt(1000, 9999)}`,
        userId: user.id,
        subtotal,
        shippingCharge,
        taxAmount: 0,
        totalAmount,
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        paymentId: payment.id,
        status: orderStatus,
        shippingFullName: `${user.firstName} ${user.lastName}`,
        shippingPhone: user.phone,
        shippingAddressLine1: '1 MG Road',
        shippingCity: 'Bangalore',
        shippingState: 'Karnataka',
        shippingPincode: '560001',
        shippingCountry: 'India',
        deliveredAt: orderStatus === 'delivered' ? daysAgo(randInt(1, 10)) : null,
        statusHistory: [
          { status: 'pending',   note: 'Order placed',    timestamp: daysAgo(5) },
          { status: 'confirmed', note: 'Order confirmed', timestamp: daysAgo(4) },
        ],
        items: {
          create: selectedProducts.map((p) => ({
            productId: p.id,
            name: p.name,
            slug: p.slug,
            thumbnail: p.thumbnailUrl,
            sku: p.sku,
            quantity: randInt(1, 3),
            price: p.price,
            totalPrice: p.price,
          })),
        },
      },
    });
    orders.push(order);
  }
  console.log(`✅ Seeded ${orders.length} orders with payments`);
  return orders;
}

async function seedReviews(users, products) {
  const comments = [
    'Excellent product! Highly recommend.',
    'Good quality, noticed improvement in a week.',
    'Very effective and natural ingredients.',
    'Fast delivery, packaging was great.',
    'Value for money. Will buy again.',
    'Authentic Ayurvedic formula. Very satisfied.',
    'My whole family uses this now.',
  ];
  const titles = ['Great Product', 'Highly Recommended', 'Worth Every Rupee', 'Loved It', 'Genuine Quality'];

  const reviews = [];
  // Each user reviews a different set of products
  for (let i = 0; i < users.length; i++) {
    const productSlice = products.slice(i * 4, i * 4 + 4);
    for (const product of productSlice) {
      try {
        const r = await prisma.review.create({
          data: {
            productId: product.id,
            userId: users[i].id,
            rating: randInt(4, 5),
            title: rand(titles),
            comment: rand(comments),
            isVerifiedPurchase: randBool(0.7),
            isApproved: true,
            helpfulVotes: randInt(0, 20),
          },
        });
        reviews.push(r);
      } catch (_) {
        // skip duplicate productId+userId
      }
    }
  }
  console.log(`✅ Seeded ${reviews.length} reviews`);
  return reviews;
}

async function seedCarts(users, products) {
  for (const user of users.slice(0, 3)) {
    const cartProducts = products.slice(randInt(0, 10), randInt(11, 20));
    await prisma.cart.create({
      data: {
        userId: user.id,
        items: {
          create: cartProducts.slice(0, 3).map((p) => ({
            productId: p.id,
            quantity: randInt(1, 3),
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            thumbnail: p.thumbnailUrl,
            name: p.name,
            slug: p.slug,
          })),
        },
      },
    });
  }
  console.log(`✅ Seeded carts for 3 users`);
}

async function seedBlogs(admin) {
  const blogData = [
    {
      title: 'Top 5 Ayurvedic Herbs for Immunity',
      slug: 'top-5-ayurvedic-herbs-immunity',
      category: 'Health',
      tags: ['immunity', 'ayurveda', 'herbs'],
      excerpt: 'Discover five powerful Ayurvedic herbs that can strengthen your immune system naturally.',
      content: 'Ayurveda has long recognized the power of herbs like Tulsi, Ashwagandha, Giloy, Amla, and Turmeric in boosting immunity. These herbs work synergistically to enhance the body\'s natural defense mechanisms. Regular consumption in the right doses can dramatically improve your resistance to common illnesses.',
      status: 'published',
      isFeatured: true,
      views: 340,
      likes: 87,
    },
    {
      title: 'Benefits of Daily Ashwagandha Consumption',
      slug: 'benefits-daily-ashwagandha',
      category: 'Wellness',
      tags: ['ashwagandha', 'stress', 'adaptogen'],
      excerpt: 'Learn how adding Ashwagandha to your daily routine can transform your health.',
      content: 'Ashwagandha (Withania somnifera) is an ancient adaptogen that helps the body manage stress and anxiety. Clinical studies show it reduces cortisol levels by up to 28%, improves sleep quality, and enhances physical endurance. A daily dose of 300–600mg root extract is generally considered safe and effective.',
      status: 'published',
      views: 215,
      likes: 54,
    },
    {
      title: 'How to Choose the Right Ayurvedic Oil',
      slug: 'choose-right-ayurvedic-oil',
      category: 'Skincare',
      tags: ['oil', 'skincare', 'ayurveda'],
      excerpt: 'A guide to selecting the best Ayurvedic oil for your body type.',
      content: 'Choosing the right Ayurvedic oil depends on your prakriti (body constitution) and specific health goals. Vata types benefit from warming oils like sesame and Mahanarayan. Pitta types do well with cooling coconut or Bhringraj oil. Kapha types should opt for light oils like mustard or Dhanwantharam.',
      status: 'draft',
      views: 0,
      likes: 0,
    },
    {
      title: 'Triphala: The Ancient Superfood',
      slug: 'triphala-ancient-superfood',
      category: 'Ayurveda',
      tags: ['triphala', 'digestion', 'detox'],
      excerpt: 'Triphala has been used for over 2,000 years. Here\'s why it still matters.',
      content: 'Triphala is a classical Ayurvedic formulation combining three fruits — Amalaki, Bibhitaki, and Haritaki. It acts as a gentle laxative, antioxidant, and immune booster. Modern research confirms its anti-inflammatory and antimicrobial properties, making it one of the most studied Ayurvedic preparations.',
      status: 'published',
      isFeatured: false,
      views: 128,
      likes: 31,
    },
  ];

  const blogs = await Promise.all(
    blogData.map((b) =>
      prisma.blog.create({
        data: {
          ...b,
          authorId: admin.id,
          publishedAt: b.status === 'published' ? daysAgo(randInt(1, 30)) : null,
          coverImageUrl: blogCoverUrl(b.category),
          coverImageAlt: b.title,
          metaTitle: b.title,
          metaDescription: b.excerpt,
        },
      })
    )
  );
  console.log(`✅ Seeded ${blogs.length} blogs`);
  return blogs;
}

async function seedNotifications(users) {
  const notifData = [
    { type: 'order_placed',    title: 'Order Placed Successfully', message: 'Your order has been placed and is being processed.', isRead: false },
    { type: 'payment_success', title: 'Payment Successful',        message: 'Your payment was received successfully.',            isRead: true  },
    { type: 'order_shipped',   title: 'Order Shipped',             message: 'Your order is on its way!',                         isRead: false },
    { type: 'promo',           title: 'Special Offer Just for You', message: 'Use code AYUR20 to get 20% off your next order.',   isRead: false },
  ];

  for (const user of users) {
    for (const n of notifData.slice(0, randInt(2, 4))) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          ...n,
          readAt: n.isRead ? daysAgo(randInt(1, 5)) : null,
        },
      });
    }
  }
  console.log(`✅ Seeded notifications for ${users.length} users`);
}

async function seedWishlists(users, products) {
  for (const user of users) {
    const wishItems = products
      .slice(randInt(0, 10), randInt(11, 20))
      .slice(0, randInt(3, 6))
      .map((p) => ({ productId: p.id, addedAt: daysAgo(randInt(1, 30)) }));

    await prisma.wishlist.create({
      data: {
        userId: user.id,
        items: wishItems,
      },
    });
  }
  console.log(`✅ Seeded wishlists for ${users.length} users`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...\n');

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // Clear existing data in dependency order
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.loginHistory.deleteMany(),
    prisma.registrationLog.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.wishlist.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.review.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.blog.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('🗑️  Cleared existing data\n');

  const categories = await seedCategories();
  const products   = await seedProducts(categories);
  const { users, admin } = await seedUsers(hashedPassword);
  await seedCoupons();
  await seedOrdersAndPayments(users, products);
  await seedReviews(users, products);
  await seedCarts(users, products);
  await seedBlogs(admin);
  await seedNotifications(users);
  await seedWishlists(users, products);

  console.log('\n🎉 Seed completed successfully!');
  console.log('   Admin  → admin@example.com  / Password@123');
  console.log('   User   → aryan@example.com  / Password@123');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
