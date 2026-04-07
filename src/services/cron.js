const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const User = require('../models/User');
const ROLES = require('../constants/roles');
const TIMESLOTS = require('../constants/timeslots');

module.exports = (bot) => {
  // Helper to check missing classes and notify
  const checkAndNotify = async (timeSlot, roleToNotify, timeName) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const attendances = await Attendance.find({
      timeSlot,
      createdAt: { $gte: startOfDay },
    });

    const submittedClassIds = attendances.map((a) => a.classId.toString());
    const allClasses = await Class.find().sort({ grade: 1, section: 1 });

    const missingClasses = allClasses.filter((c) => !submittedClassIds.includes(c._id.toString()));

    if (missingClasses.length > 0) {
      const classNames = missingClasses.map((c) => c.name).join(', ');
      const message = `⚠️ Diqqat!\n\nQuyidagi sinflar **${timeName}** davomatini topshirmagan:\n${classNames}\n\nIltimos, tezroq /attendance orqali davomatni yakunlang!`;

      const usersToNotify = await User.find({ role: roleToNotify, approved: true });
      for (const u of usersToNotify) {
        if (!u.telegramId) continue;
        bot.telegram.sendMessage(u.telegramId, message, { parse_mode: 'Markdown' }).catch(() => {});
      }
    }
  };

  cron.schedule('*/10 * * * *', () => {
    const now = new Date();
    // Use local time for logic. Assuming server is in correct timezone (Namangan/Tashkent UTC+5)
    const h = now.getHours();
    const m = now.getMinutes();
    const time = h + m / 60;

    // Lunch -> 08:30 to 11:29
    if (time >= 8.5 && time < 11.5) {
      checkAndNotify(TIMESLOTS.LUNCH, ROLES.TEACHER, '2-nonushta + tushlik (13:00)');
    }
    // Snack -> 11:30 to 13:59
    else if (time >= 11.5 && time < 14) {
      checkAndNotify(TIMESLOTS.SNACK, ROLES.TEACHER, 'Peshinlik (16:00)');
    }
    // Dinner -> 14:00 to 19:59
    else if (time >= 14 && time < 20) {
      checkAndNotify(TIMESLOTS.DINNER, ROLES.TEACHER, 'Kechki ovqat (19:00)');
    }
    // Breakfast -> 20:00 to 23:59
    else if (time >= 20 && time < 24) {
      checkAndNotify(TIMESLOTS.BREAKFAST, ROLES.TUTOR, 'Nonushta (7:00)');
    }
  });

  console.log('Cron jobs registered for persistent attendance 10-minute reminders.');
};
