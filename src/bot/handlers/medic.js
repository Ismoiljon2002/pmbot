const Attendance = require('../../models/Attendance');
const chiefFlow = require('../../services/chiefFlow');

module.exports = (bot) => {
  bot.action(/medic_confirm_(.+)/, async (ctx) => {
    // Only MEDIC should be able to click this ideally
    const timeSlot = ctx.match[1];

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const updated = await Attendance.updateMany(
      {
        timeSlot,
        status: 'PENDING',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      },
      { status: 'MEDIC_CONFIRMED' }
    );

    if (updated.modifiedCount > 0) {
      await ctx.answerCbQuery('Confirmed!');
      await ctx.editMessageText(
        `Attendance for ${timeSlot} has been confirmed. Sending to Chief...`
      );

      // Notify Chief
      await chiefFlow.sendToChief(timeSlot, bot);
    } else {
      await ctx.answerCbQuery('Already confirmed or no pending records.');
      await ctx.editMessageText(`No pending records found to confirm for ${timeSlot}.`);
    }
  });
};
