const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: String, // e.g. "Grade 1 - A"
  grade: Number,
  section: String,
});

module.exports = mongoose.model('Class', classSchema);
