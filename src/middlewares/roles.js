module.exports = (...roles) => {
  return async (ctx, next) => {
    if (!roles.includes(ctx.user.role)) {
      return ctx.reply('Access denied');
    }
    return next();
  };
};
