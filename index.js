require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/db');
const bot = require('./src/bot/bot');

const app = express();

connectDB();

// Setup Cron Jobs
const cronService = require('./src/services/cron');
cronService(bot);

// Process level error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Bot error handler
bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

// Start bot
bot
  .launch()
  .then(() => {
    console.log('Telegraf Bot launched successfully');
  })
  .catch((err) => {
    console.error('Bot launch failed:', err);
  });

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
app.get('/', (req, res) => {
  res.send('Bot is running...');
});

app.listen(3000, () => console.log('Server running on port 3000'));
