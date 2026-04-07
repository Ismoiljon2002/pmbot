const User = require('../models/User');

module.exports = async (ctx, next) => {
  const telegramId = ctx.from.id;

  const user = await User.findOne({ telegramId });

  if (!user) {
    return ctx.reply('Please start the bot first');
  }

  if (!user.approved) {
    return ctx.reply('Waiting for admin approval');
  }

  if (user.blocked) {
    return ctx.reply('You are blocked');
  }

  ctx.user = user;

  return next();
};
