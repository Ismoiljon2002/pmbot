const auth = require('../../middlewares/auth');
const role = require('../../middlewares/roles');
const ROLES = require('../../constants/roles');
const { generateDailyReport } = require('../../services/report');

module.exports = (bot) => {
  bot.hears('/report', auth, role(ROLES.ADMIN, ROLES.MEDIC), async (ctx) => {
    const buttons = [
      [{ text: 'Bugungi davomat', callback_data: 'rep_today' }],
      [{ text: 'Kechagi davomat', callback_data: 'rep_yest' }],
      [{ text: 'Boshqa sana', callback_data: 'rep_other' }],
    ];
    return ctx.reply('Qaysi sanaga hisobot kerak?', { reply_markup: { inline_keyboard: buttons } });
  });

  bot.action('rep_today', auth, role(ROLES.ADMIN, ROLES.MEDIC), async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Hisobot tayyorlanmoqda (Bugun)...');
    try {
      const report = await generateDailyReport(new Date());
      await ctx.replyWithDocument({ source: report.buffer, filename: report.filename });
      await ctx.editMessageText('Hisobot yuborildi.');
    } catch (e) {
      console.error(e);
      await ctx.editMessageText('Xatolik yuz berdi.');
    }
  });

  bot.action('rep_yest', auth, role(ROLES.ADMIN, ROLES.MEDIC), async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Hisobot tayyorlanmoqda (Kecha)...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const report = await generateDailyReport(yesterday);
      await ctx.replyWithDocument({ source: report.buffer, filename: report.filename });
      await ctx.editMessageText('Hisobot yuborildi.');
    } catch (e) {
      console.error(e);
      await ctx.editMessageText('Xatolik yuz berdi.');
    }
  });

  bot.action('rep_other', auth, role(ROLES.ADMIN, ROLES.MEDIC), async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.reportMode = true;
    await ctx.editMessageText(
      'Iltimos sanani quyidagi formatda yozib yuboring (masalan, 07.04.2026):\n\nREPORT: DD.MM.YYYY'
    );
  });

  bot.on('text', auth, async (ctx, next) => {
    const text = ctx.message.text;
    if (
      text.startsWith('REPORT:') &&
      ctx.user &&
      (ctx.user.role === ROLES.ADMIN || ctx.user.role === ROLES.MEDIC)
    ) {
      const dateStr = text.replace('REPORT:', '').trim();
      const parts = dateStr.split('.');

      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const targetDate = new Date(y, m, d);

        const progressMsg = await ctx.reply('Hisobot tayyorlanmoqda...');
        try {
          const report = await generateDailyReport(targetDate);
          await ctx.replyWithDocument({ source: report.buffer, filename: report.filename });
          await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id).catch(() => {});
        } catch (e) {
          console.error(e);
          await ctx.reply('Xatolik yuz berdi.');
        }
      } else {
        await ctx.reply("Sana formati noto'g'ri! Yana bir bor kiriting: REPORT: DD.MM.YYYY");
      }
      return;
    }
    return next();
  });
};
