const mongoose = require("mongoose");

const adminTaskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        image: {
            type: String,
            default: "",
            trim: true,
        },
        // The user this task is assigned to.
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // The admin who created / assigned this task.
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["pending", "in-progress", "completed"],
            default: "pending",
            index: true,
        },
        deadline: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("AdminTask", adminTaskSchema);
