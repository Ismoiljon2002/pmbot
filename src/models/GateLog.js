const mongoose = require('mongoose');

const gateLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  direction: {
    type: String,
    enum: ['IN', 'OUT'],
  },
  timestamp: { type: Date, default: Date.now },
  ip: { type: String },
});

gateLogSchema.index({ studentId: 1, timestamp: -1 });
gateLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('GateLog', gateLogSchema);
