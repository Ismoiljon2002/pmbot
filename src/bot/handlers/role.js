const User = require('../../models/User');

module.exports = (bot) => {
  bot.action(/assign_role_(\d+)_(.+)/, async (ctx) => {
    // Only Admin should theoretically be able to click this
    // since the message is sent to ADMIN_TELEGRAM_ID directly.
    const targetUserId = ctx.match[1];
    const role = ctx.match[2];

    const upUser = await User.findOneAndUpdate(
      { telegramId: targetUserId },
      { role, approved: true },
      { returnDocument: 'after' }
    );

    if (upUser) {
      await ctx.answerCbQuery(`Assigned ${role} to ${upUser.name}`);
      await ctx.editMessageText(`Assigned role ${role} to user ${upUser.name} (${upUser.phone})`);
      const commands = [
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Show available commands' },
      ];

      if (role === 'ADMIN') {
        commands.push({ command: 'import_students', description: 'Import students' });
      } else if (role === 'TEACHER' || role === 'TUTOR') {
        commands.push({ command: 'attendance', description: 'Take attendance for your class' });
      }

      await ctx.telegram
        .setMyCommands(commands, { scope: { type: 'chat', chat_id: targetUserId } })
        .catch(() => {});

      // Notify the user
      try {
        await ctx.telegram.sendMessage(
          targetUserId,
          `Admin has approved your registration. Your role is: ${role}. You can now use the bot's features!`
        );
      } catch (e) {
        console.error('Could not notify user', e);
      }
    } else {
      await ctx.answerCbQuery('User not found!');
    }
  });
};
