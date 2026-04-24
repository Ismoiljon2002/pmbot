const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const User = require('../models/User');
const Student = require('../models/Student');
const GateLog = require('../models/GateLog');
const ROLES = require('../constants/roles');
const TIMESLOTS = require('../constants/timeslots');
const { sendChiefReport } = require('./chief');

module.exports = (bot) => {
  // ─── ATTENDANCE ALERT NOTIFICATIONS (commented out per request) ──────────────
  // const checkAndNotify = async (timeSlot, roleToNotify, timeName) => { ... }
  // cron.schedule('*/10 * * * *', () => { ... checkAndNotify ... });
  // ─────────────────────────────────────────────────────────────────────────────

  // Helper: determine if a student is currently "inside" based on gate logs
  const isStudentInside = async (studentId) => {
    const lastLog = await GateLog.findOne({ studentId }).sort({ timestamp: -1 });
    // Student is inside if their last log is IN, or if they have no OUT log at all
    if (!lastLog) return false; // never seen = not inside
    return lastLog.direction === 'IN';
  };

  // ─── AUTOMATED BREAKFAST BUILDER (runs at 20:00 = 8 PM, builds tomorrow's breakfast) ───
  cron.schedule('0 20 * * *', async () => {
    console.log('Running Automated Breakfast builder via Gate Logs...');
    try {
      const students = await Student.find();
      const presentIdsByClass = {};

      for (const student of students) {
        const inside = await isStudentInside(student._id);
        if (inside) {
          const key = student.classId.toString();
          if (!presentIdsByClass[key]) presentIdsByClass[key] = [];
          presentIdsByClass[key].push(student._id);
        }
      }

      const classes = await Class.find();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let createdCount = 0;
      for (const cls of classes) {
        const presentList = presentIdsByClass[cls._id.toString()] || [];

        let existing = await Attendance.findOne({
          classId: cls._id,
          timeSlot: TIMESLOTS.BREAKFAST,
          createdAt: { $gte: startOfDay },
        });

        if (!existing) {
          await Attendance.create({
            classId: cls._id,
            timeSlot: TIMESLOTS.BREAKFAST,
            presentStudents: presentList,
            status: 'MEDIC_CONFIRMED',
          });
          createdCount++;
        } else {
          // Merge: add all who are inside (don't remove manually overridden ones)
          const merged = [
            ...new Set([
              ...existing.presentStudents.map((id) => id.toString()),
              ...presentList.map((id) => id.toString()),
            ]),
          ];
          existing.presentStudents = merged;
          existing.status = 'MEDIC_CONFIRMED';
          await existing.save();
        }
      }
      console.log(`Breakfast automatically populated for ${createdCount} classes!`);
    } catch (e) {
      console.error('Failed automated breakfast cron:', e);
    }
  });

  // ─── DAILY MEDIC REPORT (runs at 20:30 every night) ─────────────────────────
  cron.schedule('30 20 * * *', async () => {
    console.log('Sending daily report to MEDICs...');
    try {
      const { generateDailyReport } = require('./report');
      const report = await generateDailyReport();
      const medics = await User.find({ role: ROLES.MEDIC, approved: true });
      for (const medic of medics) {
        if (!medic.telegramId) continue;
        await bot.telegram
          .sendDocument(
            medic.telegramId,
            { source: report.buffer, filename: report.filename },
            { caption: '📋 Bugungi kunlik davomat hisoboti' }
          )
          .catch((e) => console.error(`MEDIC report send fail: ${e.message}`));
      }
      console.log(`Daily report sent to ${medics.length} medic(s).`);
    } catch (e) {
      console.error('Failed daily medic report cron:', e);
    }
  });

  // ─── CHIEF KITCHEN REPORTS ───────────────────────────────────────────────────
  cron.schedule('0 22 * * *', () => sendChiefReport(bot, TIMESLOTS.BREAKFAST, 'Nonushta', true));
  cron.schedule('30 8 * * *', () => sendChiefReport(bot, TIMESLOTS.LUNCH_11, '11:00 Tushlik'));
  cron.schedule('0 11 * * *', () => sendChiefReport(bot, TIMESLOTS.LUNCH, '13:00 Tushlik'));
  cron.schedule('0 14 * * *', () => sendChiefReport(bot, TIMESLOTS.SNACK, '16:00 Peshinlik'));
  cron.schedule('0 16 * * *', () => sendChiefReport(bot, TIMESLOTS.DINNER, '19:00 Kechki ovqat'));

  console.log('Cron jobs registered: Breakfast builder, MEDIC daily report, Chief alerts.');
};
