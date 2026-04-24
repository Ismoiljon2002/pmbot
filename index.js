require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/db');
const bot = require('./src/bot/bot');
const cronService = require('./src/services/cron');
const hikvisionService = require('./src/services/hikvision');

const app = express();

connectDB();

cronService(bot);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

bot
  .launch()
  .then(() => {
    console.log('Telegraf Bot launched successfully');
  })
  .catch((err) => {
    console.error('Bot launch failed:', err);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.get('/', (req, res) => {
  res.send('Bot is running...');
});

app.use('/api/hikvision', require('./src/routes/hikvision'));
app.listen(3000, () => console.log('Server running on port 3000'));
