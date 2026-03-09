const mysql = require("mysql2/promise");
require("dotenv").config();

async function cleanup() {
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "subscribers_db",
  });

  try {
    // First, let's see what we have
    const [rows] = await pool.execute(
      `SELECT id, username, password FROM available_usernames LIMIT 20`,
    );
    console.log("First 20 rows:", rows);

    const [result] = await pool.execute(
      `DELETE FROM available_usernames 
       WHERE username = 'Username' 
       OR password = 'Password' 
       OR LOWER(username) = 'username'
       OR LOWER(password) = 'password'`,
    );
    console.log("Deleted rows:", result.affectedRows);
  } catch (error) {
    console.error("Error:", error.message);
  }

  await pool.end();
}

cleanup();
