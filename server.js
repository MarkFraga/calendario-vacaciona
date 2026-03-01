const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

app.use(cors());
app.use(express.json());
// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/calendario_vacacional';
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4 // Use IPv4, skip trying IPv6 first
}).then(() => {
    console.log('Connected to MongoDB.');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
});

// --- MONGOOSE SCHEMAS ---
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
// Compound index ensures a user can't book the same day twice
vacationSchema.index({ user_id: 1, date: 1 }, { unique: true });
const Vacation = mongoose.model('Vacation', vacationSchema);

const fixedVacationSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }
});
const FixedVacation = mongoose.model('FixedVacation', fixedVacationSchema);


// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Requires admin privileges' });
    next();
};

// --- AUTH ROUTES ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ error: 'User not found' });

        if (await bcrypt.compare(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ token, role: user.role, userId: user.id });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API ROUTES ---

// Get all data (Users, Vacations, Fixed) to render the calendar
app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({});
        const vacations = await Vacation.find({});
        const fixed = await FixedVacation.find({});

        const result = { employees: [], userVacations: {}, extraDays: {}, fixedVacations: [] };

        result.employees = users.map(u => ({
            id: u.id,
            name: u.name,
            nickname: u.nickname,
            dept: u.dept,
            group: u.group,
            color: u.color,
            hideFromList: !!u.hideFromList,
            extraDays: u.extraDays || 0
        }));

        users.forEach(u => result.extraDays[u.id] = u.extraDays || 0);

        vacations.forEach(v => {
            if (!result.userVacations[v.user_id]) result.userVacations[v.user_id] = [];
            result.userVacations[v.user_id].push({ date: v.date, type: v.type });
        });

        result.fixedVacations = fixed.map(f => f.date);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User toggling a vacation day
app.post('/api/vacations', authenticateToken, async (req, res) => {
    const { userId, date, type, isAdding } = req.body;

    // Security: Only admins can edit others' days
    if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ error: 'You can only edit your own vacations.' });
    }

    try {
        if (isAdding) {
            await Vacation.create({ user_id: userId, date, type });
        } else {
            await Vacation.deleteOne({ user_id: userId, date });
        }
        res.json({ success: true });
    } catch (err) {
        // If it's a duplicate key error on insert, just return success (idempotent)
        if (err.code === 11000) return res.json({ success: true });
        res.status(500).json({ error: err.message });
    }
});

// Admin endpoints
app.post('/api/admin/fixed_vacation', authenticateToken, isAdmin, async (req, res) => {
    const { date, isAdding } = req.body;
    try {
        if (isAdding) {
            // Upsert to ignore duplicates
            await FixedVacation.updateOne({ date }, { date }, { upsert: true });
        } else {
            await FixedVacation.deleteOne({ date });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/extra_days', authenticateToken, isAdmin, async (req, res) => {
    const { userId, extraDays } = req.body;
    try {
        await User.updateOne({ id: userId }, { extraDays });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
