const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: String,
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  tableNumber: Number,
  employeeNo: { type: String, unique: true, sparse: true },
});

module.exports = mongoose.model('Student', studentSchema);
