const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');

exports.createOrUpdateUser = async (data) => {
  return User.findOneAndUpdate({ telegramId: data.telegramId }, data, {
    upsert: true,
    returnDocument: 'after',
  });
};

exports.assignRole = async (userId, role) => {
  return User.findByIdAndUpdate(userId, {
    role,
    approved: true,
  });
};

exports.blockUser = async (userId, blocked = true) => {
  return User.findByIdAndUpdate(userId, { blocked });
};

exports.importStudents = async (text) => {
  const lines = text.split('\n');

  const results = [];

  for (let line of lines) {
    if (!line.trim()) continue;

    const [className, studentName, table] = line.split(',');

    if (!className || !studentName || !table) {
      results.push({ line, status: 'INVALID_FORMAT' });
      continue;
    }

    let cls = await Class.findOne({ name: className.trim() });

    if (!cls) {
      cls = await Class.create({ name: className.trim() });
    }

    const student = await Student.create({
      name: studentName.trim(),
      classId: cls._id,
      tableNumber: Number(table),
    });

    results.push({ student, status: 'CREATED' });
  }

  return results;
};
