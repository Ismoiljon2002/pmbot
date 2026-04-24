const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const ROLES = require('../constants/roles');

async function sendChiefReport(bot, timeSlot, timeName, forTomorrow = false) {
  try {
    const startOfDay = new Date();
    if (forTomorrow) startOfDay.setDate(startOfDay.getDate() + 1);
    startOfDay.setHours(0, 0, 0, 0);

    const attendances = await Attendance.find({
      timeSlot,
      createdAt: { $gte: startOfDay },
    }).populate('presentStudents');

    let totalPresent = 0;
    let tablesMap = {}; // mapping table number to distinct count

    attendances.forEach((a) => {
      if (!a.presentStudents) return;
      a.presentStudents.forEach((student) => {
        totalPresent++;
        const tbl = student.tableNumber || 0;
        if (!tablesMap[tbl]) tablesMap[tbl] = 0;
        tablesMap[tbl]++;
      });
    });

    // Determine absent by subtracting from total students (if helpful), but Chief mainly needs table data
    const totalStudents = await Student.countDocuments();
    const absentCount = totalStudents - totalPresent;

    let message = `👨‍🍳 ${timeName} (CHIEF HISOBOTI):\n`;
    message += `Jami o'quvchilar: ${totalStudents}\n`;
    message += `Keladiganlar: ${totalPresent}\n`;
    message += `Kelmaydiganlar: ${absentCount}\n\n`;
    message += `🍽 STOLLAR BO'YICHA TAQSIMOT:\n`;

    const sortedTables = Object.keys(tablesMap)
      .map(Number)
      .sort((a, b) => a - b);

    if (sortedTables.length === 0) {
      message += "Hech qanday o'quvchi ma'lumoti kiritilmagan.";
    } else {
      sortedTables.forEach((tbl) => {
        const tName = tbl === 0 ? "Noma'lum" : `Stol ${tbl}`;
        message += `${tName}: ${tablesMap[tbl]} ta\n`;
      });
    }

    const chiefs = await User.find({ role: ROLES.CHIEF, approved: true });
    for (const c of chiefs) {
      if (c.telegramId) {
        bot.telegram.sendMessage(c.telegramId, message).catch((e) => console.error(e));
      }
    }
  } catch (error) {
    console.error('sendChiefReport Error:', error);
  }
}

module.exports = {
  sendChiefReport,
};
