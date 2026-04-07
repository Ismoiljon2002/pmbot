const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  name: String, // "Breakfast"
  code: String, // BREAKFAST
  deadline: String, // "08:30"
  createdBy: String,
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
