import bcrypt from 'bcryptjs';
import { createMerchant, createStaff, getMerchantBySlug, getStaffByEmail } from './db';

/**
 * Creates the demo merchant + staff account on first run.
 * Demo login: staff@ranna.app / ranna12345
 */
export async function ensureSeed(): Promise<void> {
  let merchant = getMerchantBySlug('demo');
  if (!merchant) {
    merchant = createMerchant({
      nameAr: 'مقهى رنّة',
      nameEn: 'Ranna Café',
      slug: 'demo',
      color: '#0ea5e9',
      googleReviewUrl: 'https://www.google.com/maps',
    });
    console.log('[ranna] seeded demo merchant');
  }

  const email = 'staff@ranna.app';
  if (!getStaffByEmail(email)) {
    const passwordHash = await bcrypt.hash('ranna12345', 10);
    createStaff({
      merchantId: merchant.id,
      name: 'Demo Staff',
      email,
      passwordHash,
      role: 'admin',
    });
    console.log('[ranna] seeded staff account: staff@ranna.app / ranna12345');
  }
}

// Allow `npm run seed`
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  ensureSeed()
    .then(() => {
      console.log('[ranna] seed complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
