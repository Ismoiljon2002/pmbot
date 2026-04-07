const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  TabStopType,
  TabStopPosition,
} = require('docx');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const TIMESLOTS = require('../constants/timeslots');

async function generateDailyReport(requestDate = new Date()) {
  const today = new Date(requestDate);
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const classes = await Class.find().sort({ grade: 1, section: 1 });

  const attendances = await Attendance.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const rows = [];
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];

    const studentsCount = await Student.countDocuments({ classId: cls._id });
    const clsAtt = attendances.filter((a) => a.classId.toString() === cls._id.toString());

    const getCount = (slot) => {
      const att = clsAtt.find((a) => a.timeSlot === slot);
      return att ? att.presentStudents.length : 0;
    };

    const breakfastCount = getCount(TIMESLOTS.BREAKFAST);
    const lunchCount = getCount(TIMESLOTS.LUNCH);
    const snackCount = getCount(TIMESLOTS.SNACK);
    const dinnerCount = getCount(TIMESLOTS.DINNER);

    const presentSet = new Set();
    clsAtt.forEach((att) => {
      att.presentStudents.forEach((id) => presentSet.add(id.toString()));
    });
    const keldi = presentSet.size;
    const kelmadi = Math.max(0, studentsCount - keldi);

    rows.push({
      index: i + 1,
      name: cls.name,
      total: studentsCount,
      keldi,
      kelmadi,
      breakfast: breakfastCount,
      secondBreakfast: 0,
      lunch: lunchCount,
      snack: snackCount,
      dinner: dinnerCount,
    });
  }

  let total = 0,
    totalCome = 0,
    totalNotCome = 0,
    totalBreakfast = 0,
    totalLunch = 0,
    totalSnack = 0,
    totalDinner = 0;
  rows.forEach((r) => {
    total += r.total;
    totalCome += r.keldi;
    totalNotCome += r.kelmadi;
    totalBreakfast += r.breakfast;
    totalLunch += r.lunch;
    totalSnack += r.snack;
    totalDinner += r.dinner;
  });

  rows.push({
    index: '',
    name: 'JAMI',
    total: total,
    keldi: totalCome,
    kelmadi: totalNotCome,
    breakfast: totalBreakfast,
    secondBreakfast: 0,
    lunch: totalLunch,
    snack: totalSnack,
    dinner: totalDinner,
  });

  const headers = [
    'T/r',
    'Sinflar',
    'Jami',
    'Keldi',
    'Kelmadi',
    'Nonushta',
    '2-nonushta',
    'Tushlik',
    'Peshinlik',
    'Kechki ovqat',
  ];

  const createCell = (text, isHeader = false) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text !== null && text !== undefined ? text.toString() : '-',
              bold: isHeader,
              font: 'Times New Roman',
              size: isHeader ? 20 : 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      margins: { top: 100, bottom: 100 },
      verticalAlign: 'center',
    });

  const tableRows = [new TableRow({ children: headers.map((h) => createCell(h, true)) })];

  rows.forEach((r) => {
    const isJami = r.name === 'JAMI';
    tableRows.push(
      new TableRow({
        children: [
          createCell(r.index, isJami),
          createCell(r.name, isJami),
          createCell(r.total, isJami),
          createCell(r.keldi, isJami),
          createCell(r.kelmadi, isJami),
          createCell(r.breakfast, isJami),
          createCell(r.secondBreakfast, isJami),
          createCell(r.lunch, isJami),
          createCell(r.snack, isJami),
          createCell(r.dinner, isJami),
        ],
      })
    );
  });

  const docDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'TASDIQLAYMAN', bold: true, font: 'Times New Roman', size: 24 }),
            ],
            alignment: AlignmentType.CENTER,
            indent: { left: 4500 },
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Namangan shahridagi Prezident maktabi M.F.B.D.O‘,',
                bold: true,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'ijrochi direktori v.v.b __________ S.Hasanov',
                bold: true,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Namangan shahridagi Prezident maktabi o‘quvchilarining ovqatlanish uchun kunlik davomat',
                bold: true,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'JADVALI', bold: true, font: 'Times New Roman', size: 28 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: `${docDate} yil.`, font: 'Times New Roman', size: 24 }),
              new TextRun({ text: '\t2025-2026 o‘quv yili', font: 'Times New Roman', size: 24 }),
            ],
            spacing: { after: 400 },
          }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: 'Oshxona ish yurituvchisi:', font: 'Times New Roman', size: 24 }),
              new TextRun({ text: '\t___________________', font: 'Times New Roman', size: 24 }),
            ],
            spacing: { before: 800, after: 400 },
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: 'Hamshira:', font: 'Times New Roman', size: 24 }),
              new TextRun({ text: '\t___________________', font: 'Times New Roman', size: 24 }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename: `kunlik_davomat_${docDate}.docx` };
}

module.exports = { generateDailyReport };
