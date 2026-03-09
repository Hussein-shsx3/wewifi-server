const XLSX = require("xlsx");
const path = require("path");

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Create sample data
const sampleData = [
  {
    username: "ahmed_ali",
    password: "pass123",
    fullName: "أحمد علي محمد",
    phone: "0599123456",
    package: "Premium",
    monthlyPrice: 150,
    notes: "ملاحظة تجريبية",
  },
  {
    username: "fatima_hassan",
    password: "pass456",
    fullName: "فاطمة حسن أحمد",
    phone: "0599234567",
    package: "Standard",
    monthlyPrice: 100,
    notes: "",
  },
  {
    username: "mohammad_khalid",
    password: "pass789",
    fullName: "محمد خالد سالم",
    phone: "0599345678",
    package: "Basic",
    monthlyPrice: 50,
    notes: "",
  },
];

// Create worksheet
const worksheet = XLSX.utils.json_to_sheet(sampleData);

// Set column widths
worksheet["!cols"] = [
  { wch: 15 },
  { wch: 12 },
  { wch: 20 },
  { wch: 15 },
  { wch: 12 },
  { wch: 12 },
  { wch: 20 },
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, "Subscribers");

// Save the file
const filePath = path.join(__dirname, "public", "subscribers_template.xlsx");
XLSX.writeFile(workbook, filePath);

console.log(`✓ Template created at: ${filePath}`);
