const Attendance = require('../models/Attendance');

exports.createAttendance = async ({ classId, timeSlotId, userId, count }) => {
  return Attendance.create({
    classId,
    timeSlotId,
    takenBy: userId,
    studentsPresent: count,
  });
};

async function detectInOut(userId) {
  const last = await Attendance.findOne({
    where: { userId },
    order: [['timestamp', 'DESC']],
  });

  if (!last) return 'IN';

  return last.status === 'IN' ? 'OUT' : 'IN';
}

async function markAttendance({ userId, timestamp, status, source }) {
  return Attendance.create({
    userId,
    timestamp,
    status,
    source,
  });
}

module.exports = {
  ...module.exports,
  detectInOut,
  markAttendance,
};
