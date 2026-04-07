const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    timeSlot: String, // breakfast, lunch, etc
    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // teacher id
    presentStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }], // tracks exactly who is present
    status: {
      type: String,
      enum: ['PENDING', 'MEDIC_CONFIRMED', 'CHIEF_SENT'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
