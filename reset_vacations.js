const mongoose = require('mongoose');
require('dotenv').config();

const vacationSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    date: { type: String, required: true },
    type: { type: String, required: true }
});
const Vacation = mongoose.model('Vacation', vacationSchema);

async function resetVacations() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");

        const result = await Vacation.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} vacation records from the database.`);

    } catch (err) {
        console.error("Error resetting vacations:", err);
    } finally {
        mongoose.disconnect();
    }
}

resetVacations();
