const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const UserSchema = new mongoose.Schema({
    email: String,
    role: String,
}, { timestamps: true });

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = mongoose.model("User", UserSchema);
        const users = await User.find({}, "email role createdAt").sort({ createdAt: -1 });
        console.log("Found " + users.length + " users.");
        users.forEach(u => {
            console.log(`Email: ${u.email}, Role: ${u.role}, CreatedAt: ${u.createdAt}`);
        });
        await mongoose.connection.close();
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

checkUsers();
