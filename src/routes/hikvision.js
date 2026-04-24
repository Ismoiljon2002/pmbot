const express = require('express');
const router = express.Router();
const multer = require('multer');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const GateLog = require('../models/GateLog');
const TIMESLOTS = require('../constants/timeslots');

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/event', upload.any(), async (req, res) => {
  try {
    let eventData = req.body;

    if (req.files && req.files.length > 0) {
      const jsonFile = req.files.find(
        (f) => f.originalname.endsWith('.json') || f.mimetype === 'application/json'
      );
      if (jsonFile) {
        eventData = JSON.parse(jsonFile.buffer.toString('utf-8'));
      }
    } else if (typeof req.body === 'string') {
      try {
        eventData = JSON.parse(req.body);
      } catch (e) {}
    }

    if (!eventData || !eventData.AccessControllerEvent) {
      return res.status(200).json({ status: 'ok', msg: 'ignored - missing AccessControllerEvent' });
    }

    const eventInfo = eventData.AccessControllerEvent;
    const employeeNo = eventInfo.employeeNoString;

    if (employeeNo) {
      console.log(`Hikvision Event Received for employeeNo: ${employeeNo}`);

      const student = await Student.findOne({ employeeNo });
      if (student) {
        console.log(`Matched Student: ${student.name}`);

        const requestIp = req.ip || req.connection?.remoteAddress || '';
        let direction = 'IN';
        if (process.env.HIKVISION_EXIT_IP && requestIp.includes(process.env.HIKVISION_EXIT_IP)) {
          direction = 'OUT';
        } else if (
          process.env.HIKVISION_ENTER_IP &&
          requestIp.includes(process.env.HIKVISION_ENTER_IP)
        ) {
          direction = 'IN';
        }

        await GateLog.create({
          studentId: student._id,
          direction,
          ip: requestIp,
        });

        const now = new Date();

        const h = now.getHours();
        const m = now.getMinutes();
        const time = h + m / 60;

        let activeSlot = null;
        if (time >= 7 && time < 11.5) activeSlot = TIMESLOTS.LUNCH;
        else if (time >= 11.5 && time < 14) activeSlot = TIMESLOTS.SNACK;
        else if (time >= 14 && time < 20) activeSlot = TIMESLOTS.DINNER;
        else if (time >= 20 || time < 7) activeSlot = TIMESLOTS.BREAKFAST;

        if (activeSlot) {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          let attendance = await Attendance.findOne({
            classId: student.classId,
            timeSlot: activeSlot,
            createdAt: { $gte: startOfDay },
          });

          // Create pending attendance tracking if the teacher hasn't created it yet
          if (!attendance) {
            attendance = await Attendance.create({
              classId: student.classId,
              timeSlot: activeSlot,
              presentStudents: [student._id],
              status: 'PENDING', // Teacher still needs to confirm it
            });
          } else {
            // Add student if not already present
            if (!attendance.presentStudents.includes(student._id)) {
              attendance.presentStudents.push(student._id);
              await attendance.save();
            }
          }
        }
      }
    }

    // Always return 200 OK to Hikvision so it doesn't queue and retry eternally
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling Hikvision event:', error);
    // Even on error, best practice is 200 or 500. We do 200 to clear the device queue.
    return res.status(200).json({ status: 'error' });
  }
});

module.exports = router;
