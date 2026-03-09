// Utility to help create sample subscribers for testing
// This file is not used with MySQL - use SQL queries directly
// or import from Excel file

import { getPool } from "../config/database";
import { formatDateForMySQL } from "../models/Subscriber";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export const createSampleSubscribers = async () => {
  const pool = getPool();

  if (!pool) {
    console.error("Database not available - cannot seed sample data");
    return;
  }

  const samples = [
    {
      username: "user1",
      password: "pass123",
      fullName: "أحمد محمد",
      phone: "0501234567",
      package: "Premium",
      monthlyPrice: 150,
      startDate: new Date(),
      isActive: true,
      notes: "مشترك تجريبي 1",
    },
    {
      username: "user2",
      password: "pass456",
      fullName: "محمد علي",
      phone: "0507654321",
      package: "Standard",
      monthlyPrice: 100,
      startDate: new Date(),
      isActive: true,
      notes: "مشترك تجريبي 2",
    },
    {
      username: "user3",
      password: "pass789",
      fullName: "سارة أحمد",
      phone: "0509876543",
      package: "Basic",
      monthlyPrice: 75,
      startDate: new Date(),
      isActive: false,
      notes: "مشترك تجريبي 3",
    },
  ];

  try {
    for (const sample of samples) {
      // Check if exists
      const [existing] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM subscribers WHERE username = ?",
        [sample.username]
      );

      if (existing.length === 0) {
        await pool.execute<ResultSetHeader>(
          `INSERT INTO subscribers (username, password, fullName, phone, \`package\`, monthlyPrice, startDate, isActive, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sample.username,
            sample.password,
            sample.fullName,
            sample.phone,
            sample.package,
            sample.monthlyPrice,
            formatDateForMySQL(sample.startDate),
            sample.isActive,
            sample.notes,
          ]
        );
        console.log(`Created sample subscriber: ${sample.username}`);
      }
    }
    console.log("Sample data seeding complete");
  } catch (error) {
    console.error("Error seeding data:", error);
  }
};
