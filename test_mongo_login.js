const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const userSchema = new mongoose.Schema({
    username: String,
    password_hash: String,
    role: String
});
const User = mongoose.model('User', userSchema);

async function testLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to Mongo.");

        // Fetch administrative user
        const adminUser = await User.findOne({ username: 'jefe' });
        if (!adminUser) {
            console.log("TEST FAILED: Admin user 'jefe' not found in database.");
        } else {
            console.log(`Found user: ${adminUser.username} with role ${adminUser.role}`);
            const isValid = await bcrypt.compare('admin123', adminUser.password_hash);
            console.log(`Password 'admin123' validation result: ${isValid}`);
        }

        // Fetch normal user
        const normalUser = await User.findOne({ username: 'administrativo1' });
        if (!normalUser) {
            console.log("TEST FAILED: User 'administrativo1' not found.");
        } else {
            console.log(`Found user: ${normalUser.username} with role ${normalUser.role}`);
            const isValid = await bcrypt.compare('1234', normalUser.password_hash);
            console.log(`Password '1234' validation result: ${isValid}`);
        }

    } catch (err) {
        console.error("Connection or query error:", err);
    } finally {
        mongoose.disconnect();
    }
}

testLogin();
