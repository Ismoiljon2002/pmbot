const ROLES = require('../../constants/roles');
const auth = require('../../middlewares/auth');

module.exports = (bot) => {
  bot.command('help', auth, async (ctx) => {
    const role = ctx.user.role;
    let helpText = `Here are your available commands as an <b>${role}</b>:\n\n`;

    helpText += `/start - Start or restart the bot\n`;
    helpText += `/help - Show this help menu\n`;

    if (role === ROLES.ADMIN) {
      helpText += `/import_students - Import students in bulk (Class, Name, Table format)\n`;
      helpText += `/create_class - Create a new empty class\n`;
      helpText += `/delete_student - Delete a student interactively\n`;
      helpText += `/delete_user - Delete a user interactively\n`;
      helpText += `/rename_class - Rename an existing class interactively\n`;
      helpText += `/clear - Clear recent bot chat history\n`;
      helpText += `/report - Generate attendance report for any date\n`;
    } else if (role === ROLES.TEACHER || role === ROLES.TUTOR) {
      helpText += `/attendance - Sinfingiz uchun davomat oling\n`;
    } else if (role === ROLES.MEDIC) {
      helpText += `<i>(Siz bu yerda sinf davomatlarini tasdiqlash uchun bildirishnomalarni olasiz.)</i>\n`;
      helpText += `/report - Istalgan kun uchun davomat xisobotini yuklab olishingiz mumkin\n`;
    } else if (role === ROLES.CHIEF) {
      helpText += `<i>(Siz bu yerda oshxona uchun umumiy ovqatlanish buyurtmalarini olasiz.)</i>\n`;
    }

    // Set the telegram menu for this specific user so they appear when typing /
    const commands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show available commands' },
    ];

    if (role === ROLES.ADMIN) {
      commands.push({ command: 'import_students', description: 'Import students' });
      commands.push({ command: 'create_class', description: 'Create an empty class' });
      commands.push({ command: 'delete_student', description: 'Delete a student' });
      commands.push({ command: 'delete_user', description: 'Delete a user' });
      commands.push({ command: 'rename_class', description: 'Rename a class' });
      commands.push({ command: 'clear', description: 'Clear bot chat history' });
      commands.push({ command: 'report', description: 'Generate attendance report' });
    } else if (role === ROLES.TEACHER || role === ROLES.TUTOR) {
      commands.push({ command: 'attendance', description: 'Take attendance for your class' });
    } else if (role === ROLES.MEDIC) {
      commands.push({ command: 'report', description: 'Generate attendance report' });
    }

    try {
      await ctx.telegram.setMyCommands(commands, { scope: { type: 'chat', chat_id: ctx.from.id } });
    } catch (e) {
      console.error('Failed to set individual commands', e);
    }

    await ctx.reply(helpText, { parse_mode: 'HTML' });
  });
};
