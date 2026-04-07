const TimeSlot = require('../models/TimeSlot');

exports.createTimeSlot = async (data) => {
  return TimeSlot.create(data);
};

exports.getAll = async () => {
  return TimeSlot.find();
};

exports.updateTimeSlot = async (id, data) => {
  return TimeSlot.findByIdAndUpdate(id, data, { returnDocument: 'after' });
};
