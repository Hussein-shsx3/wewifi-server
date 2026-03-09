const XLSX = require("xlsx");
const path = require("path");

// Create a new workbook with Arabic column names
const workbookArabic = XLSX.utils.book_new();

// Create sample data with Arabic headers
const sampleDataArabic = [
  {
    "اسم المستخدم": "ahmed_ali",
    "كلمة المرور": "pass123",
    "اسم الزبون": "أحمد علي محمد",
    "رقم الجوال": "0599123456",
    الخط: "Premium",
    "المبلغ الشهري": 150,
    ملاحظات: "ملاحظة تجريبية",
  },
  {
    "اسم المستخدم": "fatima_hassan",
    "كلمة المرور": "pass456",
    "اسم الزبون": "فاطمة حسن أحمد",
    "رقم الجوال": "0599234567",
    الخط: "Standard",
    "المبلغ الشهري": 100,
    ملاحظات: "",
  },
  {
    "اسم المستخدم": "mohammad_khalid",
    "كلمة المرور": "pass789",
    "اسم الزبون": "محمد خالد سالم",
    "رقم الجوال": "0599345678",
    الخط: "Basic",
    "المبلغ الشهري": 50,
    ملاحظات: "",
  },
];

// Create worksheet with Arabic headers
const worksheetArabic = XLSX.utils.json_to_sheet(sampleDataArabic);

// Set column widths
worksheetArabic["!cols"] = [
  { wch: 15 },
  { wch: 12 },
  { wch: 20 },
  { wch: 15 },
  { wch: 12 },
  { wch: 12 },
  { wch: 20 },
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbookArabic, worksheetArabic, "المشتركون");

// Save the Arabic template
const filePathArabic = path.join(
  __dirname,
  "public",
  "subscribers_template_ar.xlsx"
);
XLSX.writeFile(workbookArabic, filePathArabic);

console.log(`✓ Arabic template created at: ${filePathArabic}`);

// Also create English version
const workbookEnglish = XLSX.utils.book_new();

const sampleDataEnglish = [
  {
    username: "ahmed_ali",
    password: "pass123",
    fullName: "Ahmed Ali Mohamed",
    phone: "0599123456",
    package: "Premium",
    monthlyPrice: 150,
    notes: "Test note",
  },
  {
    username: "fatima_hassan",
    password: "pass456",
    fullName: "Fatima Hassan Ahmed",
    phone: "0599234567",
    package: "Standard",
    monthlyPrice: 100,
    notes: "",
  },
  {
    username: "mohammad_khalid",
    password: "pass789",
    fullName: "Mohammad Khalid Salem",
    phone: "0599345678",
    package: "Basic",
    monthlyPrice: 50,
    notes: "",
  },
];

const worksheetEnglish = XLSX.utils.json_to_sheet(sampleDataEnglish);
worksheetEnglish["!cols"] = [
  { wch: 15 },
  { wch: 12 },
  { wch: 20 },
  { wch: 15 },
  { wch: 12 },
  { wch: 12 },
  { wch: 20 },
];

XLSX.utils.book_append_sheet(workbookEnglish, worksheetEnglish, "Subscribers");

const filePathEnglish = path.join(
  __dirname,
  "public",
  "subscribers_template_en.xlsx"
);
XLSX.writeFile(workbookEnglish, filePathEnglish);

console.log(`✓ English template created at: ${filePathEnglish}`);
