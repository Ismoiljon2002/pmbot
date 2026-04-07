const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ROLES = require('../constants/roles');

exports.sendToChief = async (timeSlot, bot) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const attendances = await Attendance.find({
    timeSlot,
    status: 'MEDIC_CONFIRMED',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).populate('presentStudents');

  const tableCounts = {};

  for (const att of attendances) {
    for (const student of att.presentStudents) {
      const tb = student.tableNumber;
      if (!tableCounts[tb]) {
        tableCounts[tb] = 0;
      }
      tableCounts[tb]++;
    }
  }

  // Format the output
  const sortedTables = Object.keys(tableCounts).sort((a, b) => Number(a) - Number(b));

  let report = `🥘 <b>${timeSlot} uchun ovqatlanish buyurtmasi</b> 🥘\n\n`;
  for (const tb of sortedTables) {
    report += `#${tb}: ${tableCounts[tb]} ta o'quvchi\n`;
  }

  // Calculate total across tables
  const total = Object.values(tableCounts).reduce((acc, c) => acc + c, 0);
  report += `\n<b>Umumiy:</b> ${total}`;

  // Notify CHIEFs
  const chiefs = await User.find({ role: ROLES.CHIEF, approved: true });
  for (const chief of chiefs) {
    if (!chief.telegramId) continue;
    await bot.telegram.sendMessage(chief.telegramId, report, { parse_mode: 'HTML' });
  }

  // Mark attendances as CHIEF_SENT
  await Attendance.updateMany(
    { _id: { $in: attendances.map((a) => a._id) } },
    { status: 'CHIEF_SENT' }
  );
};
