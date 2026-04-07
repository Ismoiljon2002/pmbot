require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Class = require('./models/Class');
const Student = require('./models/Student');
const User = require('./models/User');

const seed = async () => {
  await connectDB();

  await Class.deleteMany({});
  await Student.deleteMany({});

  const grades = [5, 6, 7, 8, 9, 10, 11];
  const sections = ['Green', 'Blue'];

  console.log('Clearing old classes and creating 14 classes...');

  for (const g of grades) {
    for (const s of sections) {
      const cls = await Class.create({ name: `${g} - ${s}`, grade: g, section: s });
      console.log(`Created ${cls.name}`);

      for (let i = 1; i <= 12; i++) {
        await Student.create({
          name: `Student ${i} of ${cls.name}`,
          classId: cls._id,
          // random table between 1 and 20
          tableNumber: Math.floor(Math.random() * 20) + 1,
        });
      }
    }
  }

  console.log('Done seeding data.');

  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (adminId && !(await User.findOne({ telegramId: adminId }))) {
    await User.create({
      telegramId: adminId,
      name: 'Test Admin',
      role: 'ADMIN',
      approved: true,
    });
    console.log('Created Admin User.');
  }

  process.exit();
};

seed();
