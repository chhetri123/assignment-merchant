import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { User, UserRole } from '../../users/user.entity';

// One user per role, safe to re-run.
const SEED_USERS: Array<Pick<User, 'email' | 'fullName' | 'role'>> = [
  { email: 'admin@merchant.test', fullName: 'Ada Admin', role: UserRole.ADMIN },
  { email: 'reviewer@merchant.test', fullName: 'Rhea Reviewer', role: UserRole.REVIEWER },
  { email: 'reviewer2@merchant.test', fullName: 'Rob Reviewer', role: UserRole.REVIEWER },
  { email: 'sales@merchant.test', fullName: 'Sam Sales', role: UserRole.SALES },
  { email: 'sales2@merchant.test', fullName: 'Sara Sales', role: UserRole.SALES },
];

async function seed(): Promise<void> {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error('SEED_PASSWORD is required to seed users');
  }

  await dataSource.initialize();
  const users = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(password, 10);

  for (const seedUser of SEED_USERS) {
    const existing = await users.findOne({ where: { email: seedUser.email } });
    if (existing) {
      continue;
    }
    await users.save(users.create({ ...seedUser, passwordHash, isActive: true }));
    console.log(`seeded ${seedUser.role} ${seedUser.email}`);
  }

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('seed failed', error);
  process.exit(1);
});
