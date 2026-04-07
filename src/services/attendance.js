exports.createAttendance = async ({ classId, timeSlotId, userId, count }) => {
  return Attendance.create({
    classId,
    timeSlotId,
    takenBy: userId,
    studentsPresent: count,
  });
};
