const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const UserSchema = new mongoose.Schema({
    email: String,
    role: String,
}, { timestamps: true });

async function findUser() {
    try {
        const emailToFind = "rdlodha007@gmail.com";
        await mongoose.connect(process.env.MONGO_URI);
        const User = mongoose.model("User", UserSchema);
        const user = await User.findOne({ email: emailToFind });
        if (user) {
            console.log("USER_FOUND");
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            console.log(`Verified: ${user.isEmailVerified}`);
            console.log(`Created: ${user.createdAt}`);
        } else {
            console.log("USER_NOT_FOUND");
        }
        await mongoose.connection.close();
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

findUser();
