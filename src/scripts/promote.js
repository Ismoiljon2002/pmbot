const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const Class = require('../models/Class');
const Student = require('../models/Student');

const promoteStudents = async () => {
  await connectDB();
  const grade11Classes = await Class.find({ grade: 11 });
  for (const cls of grade11Classes) {
    const deleted = await Student.deleteMany({ classId: cls._id });
    console.log(`Graduated (Removed) ${deleted.deletedCount} students from ${cls.name}`);
  }

  for (let g = 10; g >= 1; g--) {
    const currentClasses = await Class.find({ grade: g });

    for (const currentClass of currentClasses) {
      const nextGrade = g + 1;
      let nextClass = await Class.findOne({ grade: nextGrade, section: currentClass.section });

      if (!nextClass) {
        nextClass = await Class.create({
          grade: nextGrade,
          section: currentClass.section,
          name: `Grade ${nextGrade} - ${currentClass.section}`,
        });
      }

      const updated = await Student.updateMany(
        { classId: currentClass._id },
        { classId: nextClass._id }
      );

      console.log(
        `Promoted ${updated.modifiedCount} students from ${currentClass.name} to ${nextClass.name}`
      );
    }
  }

  console.log('Annual Promotion Complete!');
  console.log('Grade 5 classes are now empty and ready for new incoming students.');
  process.exit(0);
};

if (require.main === module) {
  promoteStudents().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = promoteStudents;
