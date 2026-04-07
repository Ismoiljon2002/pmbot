const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ROLES = require('../constants/roles');
const TIMESLOTS = require('../constants/timeslots');
const { generateDailyReport } = require('./report');

exports.checkAllSubmitted = async (timeSlot, bot) => {
  // Check if 14 classes have submitted for TODAY
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const attendances = await Attendance.find({
    timeSlot,
    status: 'PENDING',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const Class = require('../models/Class');
  const countClasses = await Class.countDocuments();

  if (attendances.length >= countClasses && countClasses > 0) {
    // Notify Medic
    const medics = await User.find({ role: ROLES.MEDIC, approved: true });

    let totalPresent = 0;
    attendances.forEach((a) => {
      totalPresent += a.presentStudents.length;
    });

    const msg = `Barcha ${countClasses} sinflar ${timeSlot} uchun davomatni yubordi.\nJami keldi: ${totalPresent}\n\nTasdiqlang.`;

    let reportBuffer = null;
    let reportFilename = '';

    if (timeSlot === TIMESLOTS.DINNER) {
      try {
        const report = await generateDailyReport();
        reportBuffer = report.buffer;
        reportFilename = report.filename;
      } catch (err) {
        console.error('Error generating daily report:', err);
      }
    }

    for (const medic of medics) {
      if (!medic.telegramId) continue;

      await bot.telegram.sendMessage(medic.telegramId, msg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Tasdiqlash ${timeSlot}`, callback_data: `medic_confirm_${timeSlot}` }],
          ],
        },
      });

      if (reportBuffer) {
        try {
          await bot.telegram.sendDocument(medic.telegramId, {
            source: reportBuffer,
            filename: reportFilename,
          });
        } catch (e) {
          console.error(`Failed to send report to medic ${medic.telegramId}:`, e);
        }
      }
    }
  }
};
