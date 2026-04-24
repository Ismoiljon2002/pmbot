const ROLES = require('../../constants/roles');
const auth = require('../../middlewares/auth');
const role = require('../../middlewares/roles');
const AdmZip = require('adm-zip');
const xlsx = require('xlsx');
const fetch = require('node-fetch');
const { getCameras } = require('../../services/hikvision');
const Student = require('../../models/Student');
const Class = require('../../models/Class');

module.exports = (bot) => {
  bot.command('import_students', auth, role(ROLES.ADMIN), async (ctx) => {
    ctx.session ??= {};
    ctx.session.importMode = 'HIKVISION';
    ctx.reply(
      "Iltimos, .zip formatidagi o'quvchilar ma'lumotlarini yuklang.\n\nExcel ustunlari: Sinf, F.I.SH., ID, Stol\nRasmlar: ID.jpg formatida (masalan: 160.jpg)"
    );
  });

  bot.on('document', auth, async (ctx, next) => {
    if (ctx.user.role !== ROLES.ADMIN || ctx.session?.importMode !== 'HIKVISION') return next();

    const doc = ctx.message.document;
    if (!doc.file_name.endsWith('.zip')) {
      return ctx.reply('Iltimos, faqat .zip formatidagi fayl yuklang.');
    }

    try {
      const progressMsg = await ctx.reply('Fayl yuklanmoqda va qayta ishlanmoqda...');
      const fileUrl = await ctx.telegram.getFileLink(doc.file_id);

      const response = await fetch(fileUrl.href);
      const buffer = await response.buffer();

      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();

      let studentsData = [];
      let images = {};

      for (const entry of zipEntries) {
        if (!entry.isDirectory) {
          if (entry.entryName.endsWith('.xlsx') || entry.entryName.endsWith('.xls')) {
            const excelBuffer = entry.getData();
            const workbook = xlsx.read(excelBuffer, { type: 'buffer' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            studentsData = xlsx.utils.sheet_to_json(worksheet);
          } else if (entry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
            const fileName = entry.entryName.split('/').pop();
            const baseName = fileName.split('.')[0];
            images[baseName] = entry.getData();
          }
        }
      }

      if (studentsData.length === 0) {
        return ctx.reply("Excel fayl topilmadi yoki bo'sh!");
      }

      ctx.session.importMode = null;
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `Excel o'qildi: ${studentsData.length} ta o'quvchi. Kameraga yuklanmoqda...`
      );

      let successCount = 0;
      let failCount = 0;
      let faceErrors = [];
      const { enterCamera, exitCamera } = getCameras();

      for (const row of studentsData) {
        try {
          const className = row['Sinf'] || row['Class'];
          const studentName = row['F.I.SH.'] || row['Name'];
          const studentIdStr = String(row['ID'] ?? '').trim();
          const tableNumber = row['Stol'] || row['Table'];

          if (!className || !studentName || !studentIdStr) {
            failCount++;
            continue;
          }

          let cls = await Class.findOne({ name: className });
          if (!cls) cls = await Class.create({ name: className });

          let student = await Student.findOne({ employeeNo: studentIdStr });
          if (!student) {
            student = await Student.create({
              name: studentName,
              classId: cls._id,
              employeeNo: studentIdStr,
              tableNumber: tableNumber ? parseInt(tableNumber, 10) : null,
            });
          }

          const employeeNo = student.employeeNo;
          const imageBuffer = images[employeeNo];

          if (!imageBuffer) {
            faceErrors.push(`⚠️ ${studentName} (ID: ${employeeNo}): rasm topilmadi`);
          }

          // Add user to cameras
          if (enterCamera) {
            await enterCamera.addUser(employeeNo, studentName).catch((e) => {
              console.error(`Enter addUser fail ${employeeNo}:`, e.message);
            });
            if (imageBuffer) {
              await enterCamera.addFace(employeeNo, imageBuffer).catch((e) => {
                faceErrors.push(
                  `❌ ${studentName} (ID: ${employeeNo}) Kirish kamera yuzi: ${e.message}`
                );
              });
            }
          }
          if (exitCamera) {
            await exitCamera.addUser(employeeNo, studentName).catch((e) => {
              console.error(`Exit addUser fail ${employeeNo}:`, e.message);
            });
            if (imageBuffer) {
              await exitCamera.addFace(employeeNo, imageBuffer).catch((e) => {
                faceErrors.push(
                  `❌ ${studentName} (ID: ${employeeNo}) Chiqish kamera yuzi: ${e.message}`
                );
              });
            }
          }

          successCount++;
        } catch (e) {
          failCount++;
          console.error('Import error for student:', row, e);
        }
      }

      let summary = `✅ Import yakunlandi!\nMuvaffaqiyatli: ${successCount}\nXatolik: ${failCount}`;
      if (faceErrors.length > 0) {
        summary +=
          `\n\n📸 Yuz yuklash xatoliklari (${faceErrors.length}):\n` + faceErrors.join('\n');
      }

      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, summary);
    } catch (e) {
      console.error(e);
      await ctx.reply(`Xatolik yuz berdi: ${e.message}`);
    }
  });

  bot.command('weekend_report', auth, role(ROLES.ADMIN), async (ctx) => {
    const rawDate = ctx.message.text.split(' ')[1];
    if (!rawDate) {
      return ctx.reply(
        'Iltimos, sanani belgilang. Format: /weekend_report DD.MM.YYYY\nMasalan: /weekend_report 17.04.2026'
      );
    }

    const [dd, mm, yyyy] = rawDate.split('.');
    if (!dd || !mm || !yyyy || isNaN(Date.parse(`${yyyy}-${mm}-${dd}`))) {
      return ctx.reply("Sana formati noto'g'ri. DD.MM.YYYY formatida yozing.");
    }

    // Calculate start and end of that exact requested date
    const targetDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00+05:00`);
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);

    const waitMsg = await ctx.reply(`${rawDate} sanasi uchun hisobot tayyorlanmoqda...`);
    try {
      const GateLog = require('../../models/GateLog');
      const gateLogs = await GateLog.find({
        timestamp: { $gte: targetDate, $lt: nextDate },
      })
        .populate({
          path: 'studentId',
          populate: { path: 'classId' },
        })
        .sort({ timestamp: -1 });

      const header = ['Sinf', 'F.I.SH.', 'Holat', 'Vaqt'];
      const rows = [header];

      // Safe Day of Week calculation circumventing Node container UTC offset
      const day = new Date(yyyy, mm - 1, dd).getDay(); // 0 = Sunday, 5 = Friday

      gateLogs.forEach((log) => {
        if (!log.studentId) return;
        const logDate = new Date(log.timestamp);

        // Check if Sunday IN, or Friday OUT
        if ((day === 0 && log.direction === 'IN') || (day === 5 && log.direction === 'OUT')) {
          const typeStr = day === 0 ? 'Yakshanba (Keldi)' : 'Juma (Ketdi)';
          const timeStr = logDate.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
          const className = log.studentId.classId ? log.studentId.classId.name : "Noma'lum";
          const studentName = log.studentId.name;
          rows.push([className, studentName, typeStr, timeStr]);
        }
      });

      if (rows.length === 1) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
        return ctx.reply(
          "Bu sana uchun mos loglar topilmadi. Yoki Juma emas, yoki Yakshanba emas, yoxud barcha parametrlar bo'sh."
        );
      }

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(rows);
      xlsx.utils.book_append_sheet(wb, ws, 'Dam olish kunlari');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      await ctx.replyWithDocument({ source: buffer, filename: `weekend_report_${rawDate}.xlsx` });
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    } catch (e) {
      console.error(e);
      await ctx.reply('Xatolik yuz berdi report qilinganda.');
    }
  });
};
