const Class = require('../../models/Class');
const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const ROLES = require('../../constants/roles');
const TIMESLOTS = require('../../constants/timeslots');
const auth = require('../../middlewares/auth');

module.exports = (bot) => {
  bot.command('attendance', auth, async (ctx) => {
    if (!ctx.user || (ctx.user.role !== ROLES.TEACHER && ctx.user.role !== ROLES.TUTOR)) {
      return ctx.reply('Sizga bunday huquq berilmagan.');
    }

    ctx.session ??= {};
    ctx.session.attendance = {
      timeSlot: null,
      classId: null,
      presentStudents: [], // Will hold ObjectIds of present students
    };

    const isTutor = ctx.user.role === ROLES.TUTOR;

    // Choose timeslot
    const buttons = isTutor
      ? [[{ text: 'Nonushta (7:00)', callback_data: `slot_${TIMESLOTS.BREAKFAST}` }]]
      : [
          [{ text: '2-nonushta + tushlik (13:00)', callback_data: `slot_${TIMESLOTS.LUNCH}` }],
          [{ text: 'Peshinlik (16:00)', callback_data: `slot_${TIMESLOTS.SNACK}` }],
          [{ text: 'Kechki ovqat (19:00)', callback_data: `slot_${TIMESLOTS.DINNER}` }],
        ];

    return ctx.reply('Vaqtni tanlang:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/slot_(.+)/, auth, async (ctx) => {
    ctx.session ??= {};
    ctx.session.attendance = { timeSlot: ctx.match[1], presentStudents: [] };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const submittedDb = await Attendance.find({
      timeSlot: ctx.match[1],
      createdAt: { $gte: startOfDay },
    });
    const submittedClassIds = submittedDb.map((a) => a.classId.toString());

    // Fetch classes
    const classes = await Class.find().sort({ grade: 1, section: 1 });

    const buttons = [];
    let row = [];
    for (let c of classes) {
      const isSubmitted = submittedClassIds.includes(c._id.toString());
      const label = isSubmitted ? `✅ ${c.name}` : c.name;
      row.push({ text: label, callback_data: `sel_cls_${c._id}` });
      if (row.length === 2) {
        buttons.push(row);
        row = [];
      }
    }
    if (row.length > 0) buttons.push(row);

    // Add Back button
    buttons.push([{ text: '⬅️ Orqaga', callback_data: 'back_to_slots' }]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Vaqt: ${ctx.match[1]}\nEndi sinfni tanlang:`, {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action('back_to_slots', auth, async (ctx) => {
    ctx.session ??= {};
    const isTutor = ctx.user.role === ROLES.TUTOR;
    const buttons = isTutor
      ? [[{ text: 'Nonushta (7:00)', callback_data: `slot_${TIMESLOTS.BREAKFAST}` }]]
      : [
          [{ text: 'Tushlik (13:00)', callback_data: `slot_${TIMESLOTS.LUNCH}` }],
          [{ text: 'Kechlik (16:00)', callback_data: `slot_${TIMESLOTS.SNACK}` }],
          [{ text: 'Kechki ovqat (19:00)', callback_data: `slot_${TIMESLOTS.DINNER}` }],
        ];

    await ctx.answerCbQuery();
    await ctx.editMessageText('Vaqtni tanlang:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/sel_cls_(.+)/, auth, async (ctx) => {
    const classId = ctx.match[1];
    if (!ctx.session?.attendance)
      return ctx.answerCbQuery('Sessiya tugagan, /attendance ni qayta bosing.');

    ctx.session.attendance.classId = classId;

    const students = await Student.find({ classId }).sort({ tableNumber: 1 });
    if (students.length === 0) return ctx.editMessageText("Bu sinfda o'quvchi topilmadi.");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existingAtt = await Attendance.findOne({
      classId,
      timeSlot: ctx.session.attendance.timeSlot,
      createdAt: { $gte: startOfDay },
    });

    if (existingAtt) {
      ctx.session.attendance.presentStudents = existingAtt.presentStudents.map((id) =>
        id.toString()
      );
    } else {
      // By default, assume all present
      ctx.session.attendance.presentStudents = students.map((s) => s._id.toString());
    }

    await renderStudentList(ctx, students);
  });

  bot.action(/tog_std_(.+)/, auth, async (ctx) => {
    if (!ctx.session?.attendance?.classId)
      return ctx.answerCbQuery('Sessiya tugagan, /attendance ni qayta bosing.');

    const studentId = ctx.match[1];
    let present = ctx.session.attendance.presentStudents;

    if (present.includes(studentId)) {
      ctx.session.attendance.presentStudents = present.filter((id) => id !== studentId);
    } else {
      ctx.session.attendance.presentStudents.push(studentId);
    }

    const students = await Student.find({ classId: ctx.session.attendance.classId }).sort({
      tableNumber: 1,
    });
    await renderStudentList(ctx, students);
  });

  bot.action('submit_attendance', auth, async (ctx) => {
    if (!ctx.session?.attendance?.classId)
      return ctx.answerCbQuery('Sessiya tugagan, /attendance ni qayta bosing.');

    const { timeSlot, classId, presentStudents } = ctx.session.attendance;

    // Save to DB
    await Attendance.findOneAndUpdate(
      { classId, timeSlot },
      {
        takenBy: ctx.user._id,
        presentStudents,
        status: 'PENDING',
      },
      { upsert: true, returnDocument: 'after' }
    );

    ctx.session.attendance = null; // Clear session

    await ctx.answerCbQuery('Davomat topshirildi!');
    await ctx.editMessageText(`Davomat topshirildi.\nUmumiy: ${presentStudents.length}`);

    // Check if we need to notify MEDIC (this will be done via periodic check or inline check here)
    const { checkAllSubmitted } = require('../../services/medicFlow');
    if (checkAllSubmitted) {
      checkAllSubmitted(timeSlot, bot).catch(console.error);
    }
  });
};

async function renderStudentList(ctx, students) {
  const { presentStudents } = ctx.session.attendance;

  const buttons = students.map((s) => {
    const isPresent = presentStudents.includes(s._id.toString());
    const icon = isPresent ? '✅' : '❌';
    return [{ text: `${icon} ${s.name} (T: ${s.tableNumber})`, callback_data: `tog_std_${s._id}` }];
  });

  buttons.push([{ text: '📤 Davomatni yuborish', callback_data: 'submit_attendance' }]);
  buttons.push([{ text: '⬅️ Orqaga', callback_data: `slot_${ctx.session.attendance.timeSlot}` }]);

  try {
    await ctx.editMessageText('Davomatni belgilash:', {
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e) {
    /* ignore same message error */
  }
  await ctx.answerCbQuery().catch(() => {});
}
