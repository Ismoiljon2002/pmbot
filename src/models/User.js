const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: String, unique: true },
    name: String,
    phone: String,

    role: {
      type: String,
      enum: ['ADMIN', 'TEACHER', 'TUTOR', 'MEDIC', 'CHIEF'],
      default: null,
    },

    approved: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
