const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Try multiple possible Excel file locations
const possiblePaths = [
  "c:\\Users\\h4088\\Downloads\\New Microsoft Excel Worksheet.xlsx",
  "./test.xlsx",
  "./data.xlsx",
  "./subscribers.xlsx",
  "./excel.xlsx",
];

let excelPath = null;
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    excelPath = path;
    break;
  }
}

if (!excelPath) {
  console.log("❌ No Excel file found in these locations:");
  possiblePaths.forEach((path) => console.log(`   - ${path}`));
  console.log(
    "\n💡 Please place your Excel file in one of these locations or modify the script.",
  );
  process.exit(1);
}

console.log("✅ Found Excel file:", excelPath);

console.log("\n=== Excel File Analysis ===\n");

const workbook = XLSX.read(fs.readFileSync(excelPath), { type: "buffer" });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

console.log("Sheet Name:", sheetName);
console.log("Sheet Names in workbook:", workbook.SheetNames);

// Get the raw data
const data = XLSX.utils.sheet_to_json(worksheet);

console.log("\n📊 Data Analysis:");
console.log(`Total Rows: ${data.length}`);

if (data.length > 0) {
  console.log("\n📋 Column Names Detected:");
  const columns = Object.keys(data[0]);
  columns.forEach((col, idx) => {
    console.log(`  ${idx + 1}. "${col}"`);
  });

  console.log("\n📝 Row Data:");
  data.forEach((row, idx) => {
    console.log(`\nRow ${idx + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
      console.log(`  "${key}": ${JSON.stringify(value)}`);
    });
  });
}

console.log("\n=== Expected Column Names ===");
console.log("Arabic Names:");
console.log("  - اسم المستخدم (username)");
console.log("  - كلمة المرور (password)");
console.log("  - اسم الزبون (fullName)");
console.log("  - رقم الجوال (phone)");
console.log("  - الخط (package)");
console.log("  - المبلغ الشهري (monthlyPrice)");
console.log("  - تاريخ اول اتصال (firstContactDate) - اختياري");
console.log("  - ملاحظات (notes)");

console.log("\nEnglish Names:");
console.log("  - username");
console.log("  - password");
console.log("  - fullName");
console.log("  - phone");
console.log("  - package");
console.log("  - monthlyPrice");
console.log("  - firstContactDate - optional");
console.log("  - notes");

console.log("\n=== Matching Results ===\n");

const requiredFields = [
  { en: "username", ar: ["اسم المستخدم", "User Name"] },
  { en: "password", ar: ["كلمة المرور", "Password"] },
  { en: "fullName", ar: ["اسم الزبون", "Full Name", "اسم العميل"] },
  { en: "phone", ar: ["رقم الجوال", "رقم الهاتف", "Phone"] },
  { en: "package", ar: ["الخط", "الباقة", "Package"] },
  {
    en: "monthlyPrice",
    ar: ["المبلغ الشهري", "المبلغ", "Price", "Monthly Price"],
  },
  { en: "notes", ar: ["ملاحظات", "Notes", "Remarks"] },
];

// Optional fields (not required but can be included)
const optionalFields = [
  {
    en: "firstContactDate",
    ar: ["تاريخ اول اتصال", "تاريخ الاتصال الأول", "First Contact Date"],
  },
];

if (data.length > 0) {
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  requiredFields.forEach((field) => {
    const foundCol = columns.find(
      (col) => col === field.en || field.ar.includes(col),
    );
    if (foundCol) {
      console.log(`✅ ${field.en.padEnd(15)}: Found as "${foundCol}"`);
    } else {
      console.log(`❌ ${field.en.padEnd(15)}: NOT FOUND`);
      console.log(`   Looking for: "${field.en}" or [${field.ar.join(", ")}]`);
    }
  });

  console.log("\nOptional Fields:");
  optionalFields.forEach((field) => {
    console.log(`\n🔍 Checking for ${field.en}:`);
    console.log(`   English: "${field.en}"`);
    console.log(
      `   Arabic options: [${field.ar.map((a) => `"${a}"`).join(", ")}]`,
    );

    const foundCol = columns.find(
      (col) => col === field.en || field.ar.includes(col),
    );

    if (foundCol) {
      console.log(
        `✅ ${field.en.padEnd(15)}: Found as "${foundCol}" (optional)`,
      );
    } else {
      console.log(`⚪ ${field.en.padEnd(15)}: Not found (optional field)`);
      console.log(
        `   Available columns: [${columns.map((c) => `"${c}"`).join(", ")}]`,
      );
    }
  });
}

console.log("\n=== Suggestions ===\n");
console.log("If columns are not matching, your Excel file structure might be:");
console.log("1. Using different Arabic text (check spelling)");
console.log("2. Having extra spaces or special characters");
console.log("3. Using a different sheet name or structure");
console.log("\nRecommendation:");
console.log(
  "Download the template from the dashboard and use it as a reference.",
);
console.log("Copy your data into the template columns with the correct names.");
