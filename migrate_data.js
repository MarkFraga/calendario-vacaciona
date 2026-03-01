const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("ERROR: MONGODB_URI no está definido en el archivo .env o variables de entorno.");
    process.exit(1);
}

// Ensure the same schemas are defined here for the migration
const userSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password_hash: String,
    role: { type: String, default: 'employee' },
    name: String,
    nickname: String,
    dept: String,
    group: String,
    color: String,
    hideFromList: { type: Boolean, default: false },
    extraDays: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const vacationSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    date: { type: String, required: true },
    type: { type: String, required: true }
});
vacationSchema.index({ user_id: 1, date: 1 }, { unique: true });
const Vacation = mongoose.model('Vacation', vacationSchema);

const fixedVacationSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }
});
const FixedVacation = mongoose.model('FixedVacation', fixedVacationSchema);

async function formatUsername(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
}

async function migrate() {
    console.log("Connecting to MongoDB for migration...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    console.log("Clearing all old data from the collection...");
    await User.deleteMany({});
    await Vacation.deleteMany({});
    await FixedVacation.deleteMany({});

    // 1. Read the old JSON file
    const oldDataPath = path.join(__dirname, 'vacation_data.json');
    if (!fs.existsSync(oldDataPath)) {
        console.error(`Migration Failed: Could not find ${oldDataPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(oldDataPath, 'utf-8');
    const oldData = JSON.parse(rawData);

    // Default passwords for the web version (will be hashed)
    const ADMIN_PASS = 'admin123';
    const EMPLOYEE_PASS = '1234';
    const adminHash = await bcrypt.hash(ADMIN_PASS, 10);
    const employeeHash = await bcrypt.hash(EMPLOYEE_PASS, 10);

    const usersToInsert = [];
    const vacationsToInsert = [];
    const fixedToInsert = [];

    // Migrate Employees
    if (oldData.employees) {
        for (const emp of oldData.employees) {
            let role = 'employee';
            let password_hash = employeeHash;

            // Give admin rights exclusively to the boss
            if (emp.name.toUpperCase().includes("JEFE")) {
                role = 'admin';
                password_hash = adminHash;
            }

            // Fallback username creation
            const rawUsername = await formatUsername(emp.name);
            const username = emp.nickname ? await formatUsername(emp.nickname) : rawUsername;

            usersToInsert.push({
                id: emp.id,
                username: username,
                password_hash: password_hash,
                role: role,
                name: emp.name,
                nickname: emp.nickname || '',
                dept: emp.dept || '',
                group: emp.group || '',
                color: emp.color || '#000000',
                hideFromList: emp.hideFromList || false,
                extraDays: oldData.extraDays ? (oldData.extraDays[emp.id] || 0) : 0
            });
        }
    }

    // Migrate User Vacations
    if (oldData.userVacations) {
        for (const [userIdStr, datesArray] of Object.entries(oldData.userVacations)) {
            const userId = parseInt(userIdStr);
            if (Array.isArray(datesArray)) {
                datesArray.forEach(vac => {
                    // JSON format might have been { date: 'YYYY-MM-DD', type: 'vacation' }
                    if (vac && vac.date && vac.type) {
                        vacationsToInsert.push({ user_id: userId, date: vac.date, type: vac.type });
                    }
                });
            }
        }
    }

    // Migrate Fixed Vacations
    if (oldData.fixedVacations && Array.isArray(oldData.fixedVacations)) {
        oldData.fixedVacations.forEach(dateStr => {
            fixedToInsert.push({ date: dateStr });
        });
    }

    // Execute Bulk Inserts
    if (usersToInsert.length > 0) await User.insertMany(usersToInsert);
    if (vacationsToInsert.length > 0) await Vacation.insertMany(vacationsToInsert);
    if (fixedToInsert.length > 0) await FixedVacation.insertMany(fixedToInsert);

    console.log(`\n--- Migration Complete to MongoDB! ---`);
    console.log(`Migrated ${usersToInsert.length} users.`);
    console.log(`Migrated ${vacationsToInsert.length} vacation days.`);
    console.log(`Migrated ${fixedToInsert.length} fixed holidays.`);
    console.log(`----------------------------------\n`);

    console.log("IMPORTANT: The default users and passwords were created during migration:");
    console.log(`Admin Password: ${ADMIN_PASS}`);
    console.log(`Employee Passwords: ${EMPLOYEE_PASS}`);

    mongoose.disconnect();
    process.exit(0);
}

migrate();
