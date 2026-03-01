const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'vacation_data.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee',
        name TEXT NOT NULL,
        nickname TEXT,
        dept TEXT,
        "group" TEXT,
        color TEXT,
        hideFromList BOOLEAN DEFAULT 0,
        extraDays INTEGER DEFAULT 0
    )`);

    // 2. Vacations Table
    db.run(`CREATE TABLE IF NOT EXISTS vacations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, date)
    )`);

    // 3. System Settings / Fixed Vacations
    db.run(`CREATE TABLE IF NOT EXISTS fixed_vacations (
        date TEXT PRIMARY KEY
    )`);

    console.log("Database schema created successfully.");
});

db.close();
