/**
 * Simple seed script — creates a couple of test users.
 * Run with: npm run seed
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp';

const testUsers = [
  { name: 'Alice Johnson', email: 'alice@example.com', password: 'password123' },
  { name: 'Bob Smith', email: 'bob@example.com', password: 'password123' },
];

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    for (const u of testUsers) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`- Skipping ${u.email} (already exists)`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.create({ ...u, password: hashedPassword });
      console.log(`+ Created ${u.email} / password: ${u.password}`);
    }

    console.log('🌱 Seeding complete');
  } catch (error) {
    console.error('Seed error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();
