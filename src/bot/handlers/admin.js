const auth = require('../../middlewares/auth');
const role = require('../../middlewares/roles');
const ROLES = require('../../constants/roles');
const Class = require('../../models/Class');
const Student = require('../../models/Student');
const User = require('../../models/User');

module.exports = (bot) => {
  const chunkArray = (arr, size) => {
    const res = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  };

  bot.hears('/create_class', auth, role(ROLES.ADMIN), async (ctx) => {
    ctx.reply('To create an empty class, reply exactly like this:\nCREATE_CLASS: ClassName');
  });

  bot.hears('/rename_class', auth, role(ROLES.ADMIN), async (ctx) => {
    const classes = await Class.find().sort({ grade: 1, section: 1 });
    if (classes.length === 0) return ctx.reply('No classes found.');

    const buttonList = classes.map((c) => ({ text: c.name, callback_data: `adm_rn_cls_${c._id}` }));
    const buttons = chunkArray(buttonList, 2);
    return ctx.reply('Select a class to rename:', { reply_markup: { inline_keyboard: buttons } });
  });

  bot.action(/^adm_rn_cls_([a-fA-F0-9]{24})$/, auth, role(ROLES.ADMIN), async (ctx) => {
    const classId = ctx.match[1];
    const targetClass = await Class.findById(classId);
    if (!targetClass) return ctx.answerCbQuery('Class not found!', { show_alert: true });

    ctx.session ??= {};
    ctx.session.adminMode = 'RENAME_CLASS';
    ctx.session.adminTargetId = classId;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `You selected ${targetClass.name}.\nReply exactly with the new name for this class.`
    );
  });

  bot.hears('/delete_student', auth, role(ROLES.ADMIN), async (ctx) => {
    const classes = await Class.find().sort({ grade: 1, section: 1 });
    if (classes.length === 0) return ctx.reply('No classes found.');

    const buttonList = classes.map((c) => ({
      text: c.name,
      callback_data: `adm_del_scls_${c._id}`,
    }));
    const buttons = chunkArray(buttonList, 2);
    return ctx.reply('Select the class of the student you want to delete:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/^adm_del_scls_([a-fA-F0-9]{24})$/, auth, role(ROLES.ADMIN), async (ctx) => {
    const classId = ctx.match[1];
    const students = await Student.find({ classId }).sort({ tableNumber: 1 });
    if (students.length === 0)
      return ctx.answerCbQuery('No students in this class.', { show_alert: true });

    const targetClass = await Class.findById(classId);

    const buttonList = students.map((s) => ({
      text: `${s.name} (T: ${s.tableNumber})`,
      callback_data: `adm_del_stu_${s._id}`,
    }));
    const buttons = chunkArray(buttonList, 2);
    buttons.push([{ text: '⬅️ Back', callback_data: 'back_del_stu_cls' }]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `Select a student from ${targetClass ? targetClass.name : 'this class'} to permanently delete:`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  });

  bot.action('back_del_stu_cls', auth, role(ROLES.ADMIN), async (ctx) => {
    const classes = await Class.find().sort({ grade: 1, section: 1 });
    const buttonList = classes.map((c) => ({
      text: c.name,
      callback_data: `adm_del_scls_${c._id}`,
    }));
    const buttons = chunkArray(buttonList, 2);
    await ctx.answerCbQuery();
    await ctx.editMessageText('Select the class of the student you want to delete:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/^adm_del_stu_([a-fA-F0-9]{24})$/, auth, role(ROLES.ADMIN), async (ctx) => {
    const studentId = ctx.match[1];
    const deleted = await Student.findByIdAndDelete(studentId);
    if (deleted) {
      // Sync delete with Hikvision cameras
      try {
        const { getCameras } = require('../../services/hikvision');
        const { enterCamera, exitCamera } = getCameras();
        if (deleted.employeeNo) {
          if (enterCamera) enterCamera.deleteUser(deleted.employeeNo).catch(console.error);
          if (exitCamera) exitCamera.deleteUser(deleted.employeeNo).catch(console.error);
        }
      } catch (err) {
        console.error('Hikvision Delete Hook Error:', err);
      }

      await ctx.answerCbQuery('Student deleted!');
      await ctx.editMessageText(`Student ${deleted.name} has been permanently deleted.`);
    } else {
      await ctx.answerCbQuery('Student not found!', { show_alert: true });
      await ctx.editMessageText('Student could not be found.');
    }
  });

  bot.hears('/delete_user', auth, role(ROLES.ADMIN), async (ctx) => {
    const roles = Object.values(ROLES);
    const buttonList = roles.map((r) => ({ text: r, callback_data: `adm_del_urole_${r}` }));
    const buttons = chunkArray(buttonList, 2);
    return ctx.reply('Select a role to view users:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/^adm_del_urole_(.+)$/, auth, role(ROLES.ADMIN), async (ctx) => {
    const r = ctx.match[1];
    const users = await User.find({ role: r }).sort({ name: 1 });
    if (users.length === 0)
      return ctx.answerCbQuery(`No users found with role ${r}.`, { show_alert: true });

    const buttonList = users.map((u) => ({
      text: `${u.name || u.telegramId} ${u.phone ? `(${u.phone})` : ''}`,
      callback_data: `adm_del_user_${u._id}`,
    }));
    const buttons = chunkArray(buttonList, 2);
    buttons.push([{ text: '⬅️ Back', callback_data: 'back_del_usr_rl' }]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Select a user in role ${r} to permanently delete:`, {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action('back_del_usr_rl', auth, role(ROLES.ADMIN), async (ctx) => {
    const roles = Object.values(ROLES);
    const buttonList = roles.map((r) => ({ text: r, callback_data: `adm_del_urole_${r}` }));
    const buttons = chunkArray(buttonList, 2);
    await ctx.answerCbQuery();
    await ctx.editMessageText('Select a role to view users:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/^adm_del_user_([a-fA-F0-9]{24})$/, auth, role(ROLES.ADMIN), async (ctx) => {
    const userId = ctx.match[1];
    if (userId === ctx.user._id.toString()) {
      return ctx.answerCbQuery('You cannot delete yourself!', { show_alert: true });
    }

    const deleted = await User.findByIdAndDelete(userId);
    if (deleted) {
      await ctx.answerCbQuery('User deleted!');
      await ctx.editMessageText(`User ${deleted.name || deleted.telegramId} has been deleted.`);
    } else {
      await ctx.answerCbQuery('User not found!', { show_alert: true });
      await ctx.editMessageText('User could not be found.');
    }
  });

  bot.on('text', auth, async (ctx, next) => {
    if (ctx.user.role !== ROLES.ADMIN) return next();

    const text = ctx.message.text;

    if (ctx.session?.adminMode === 'RENAME_CLASS' && ctx.session?.adminTargetId) {
      const classId = ctx.session.adminTargetId;
      const newName = text.trim();
      const updated = await Class.findByIdAndUpdate(classId, { name: newName });

      ctx.session.adminMode = null;
      ctx.session.adminTargetId = null;

      if (updated) {
        return ctx.reply(`Class renamed from ${updated.name} to ${newName}`);
      }
      return ctx.reply('Class not found!');
    }

    if (text.startsWith('CREATE_CLASS:')) {
      const className = text.replace('CREATE_CLASS:', '').trim();
      const existing = await Class.findOne({ name: className });
      if (existing) return ctx.reply('Class already exists!');
      await Class.create({ name: className });
      return ctx.reply(`Class ${className} created successfully!`);
    }

    return next();
  });

  bot.hears('/clear', auth, role(ROLES.ADMIN), async (ctx) => {
    const currentId = ctx.message.message_id;

    // Create an array of recent message IDs
    const idsToDelete = [];
    for (let i = 0; i < 50; i++) {
      idsToDelete.push(currentId - i);
    }

    try {
      await ctx.telegram.deleteMessages(ctx.chat.id, idsToDelete);
    } catch (e) {
      for (const id of idsToDelete) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, id);
        } catch (err) {}
      }
    }

    ctx.session = null;
    ctx.reply('Chat history (last 50 messages) and session state have been cleared.');
  });
};
