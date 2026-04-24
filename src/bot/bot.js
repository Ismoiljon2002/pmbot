const { Telegraf, session } = require('telegraf');
const startHandler = require('./handlers/start');
const adminHandler = require('./handlers/admin');
const adminHikvisionHandler = require('./handlers/admin_hikvision');
const roleHandler = require('./handlers/role');
const attendanceHandler = require('./handlers/attendance');
const medicHandler = require('./handlers/medic');
const reportCmdHandler = require('./handlers/report_cmd');
const helpHandler = require('./handlers/help');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session());

startHandler(bot);
adminHandler(bot);
adminHikvisionHandler(bot);
roleHandler(bot);
attendanceHandler(bot);
medicHandler(bot);
reportCmdHandler(bot);
helpHandler(bot);

module.exports = bot;
