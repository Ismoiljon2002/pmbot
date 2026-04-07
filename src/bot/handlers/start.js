const User = require('../../models/User');

module.exports = (bot) => {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;

    let user = await User.findOne({ telegramId });

    if (!user) {
      user = await User.create({
        telegramId,
        name: ctx.from.first_name,
      });

      return ctx.reply('Please share your phone number', {
        reply_markup: {
          keyboard: [[{ text: 'Share Phone', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }

    const commands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show available commands' },
    ];
    if (user.role === 'ADMIN') {
      commands.push({ command: 'import_students', description: 'Import students' });
    } else if (user.role === 'TEACHER' || user.role === 'TUTOR') {
      commands.push({ command: 'attendance', description: 'Take attendance for your class' });
    }
    await ctx.telegram
      .setMyCommands(commands, { scope: { type: 'chat', chat_id: telegramId } })
      .catch(() => {});

    if (!user.approved) {
      if (user.phone) {
        // Re-ping admin with the role assignment buttons
        await ctx.telegram
          .sendMessage(
            process.env.ADMIN_TELEGRAM_ID,
            `Reminder - Pending user request:\nName: ${user.name}\nPhone: ${user.phone}\nID: ${telegramId}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Assign ADMIN', callback_data: `assign_role_${telegramId}_ADMIN` }],
                  [
                    { text: 'Assign TEACHER', callback_data: `assign_role_${telegramId}_TEACHER` },
                    { text: 'Assign TUTOR', callback_data: `assign_role_${telegramId}_TUTOR` },
                  ],
                  [
                    { text: 'Assign MEDIC', callback_data: `assign_role_${telegramId}_MEDIC` },
                    { text: 'Assign CHIEF', callback_data: `assign_role_${telegramId}_CHIEF` },
                  ],
                ],
              },
            }
          )
          .catch(() => {});
        return ctx.reply('Waiting for admin approval... (Pinged admin again)');
      }
      return ctx.reply(
        'Waiting for admin approval... (Please ensure you shared your phone number)'
      );
    }

    ctx.reply(`Welcome! Your role: ${user.role}`);
  });

  bot.on('contact', async (ctx) => {
    const telegramId = ctx.from.id;
    const phone = ctx.message.contact.phone_number;

    const user = await User.findOneAndUpdate(
      { telegramId },
      { phone },
      { returnDocument: 'after' }
    );

    // Notify admin
    await ctx.telegram.sendMessage(
      process.env.ADMIN_TELEGRAM_ID,
      `New user request:\nName: ${user.name}\nPhone: ${phone}\nID: ${telegramId}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Assign TEACHER', callback_data: `assign_role_${telegramId}_TEACHER` },
              { text: 'Assign TUTOR', callback_data: `assign_role_${telegramId}_TUTOR` },
            ],
            [
              { text: 'Assign MEDIC', callback_data: `assign_role_${telegramId}_MEDIC` },
              { text: 'Assign CHIEF', callback_data: `assign_role_${telegramId}_CHIEF` },
            ],
          ],
        },
      }
    );

    ctx.reply('Your request sent to admin. Please wait for approval.', {
      reply_markup: { remove_keyboard: true },
    });
  });
};
