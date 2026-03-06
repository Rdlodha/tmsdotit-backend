const mongoose = require("mongoose");
const AdminTask = require("../models/AdminTask");
const { User } = require("../models");
const sendEmail = require("../utils/sendEmail");

function isValidObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
}

// ─── Admin: create a task and assign it to a user ──────────────────────────────
async function createAdminTask(req, res) {
    try {
        const { title, description, assignedTo, deadline } = req.body;
        const imageName = req.file ? req.file.filename : null;

        if (!title) {
            return res.status(400).json({ message: "title is required" });
        }

        if (!assignedTo || !isValidObjectId(assignedTo)) {
            return res.status(400).json({ message: "A valid assignedTo user id is required" });
        }

        const targetUser = await User.findById(assignedTo);
        if (!targetUser) {
            return res.status(404).json({ message: "Assigned user not found" });
        }

        const task = await AdminTask.create({
            title,
            description,
            image: imageName,
            assignedTo,
            assignedBy: req.user.id,
            deadline: deadline || undefined,
        });

        // Notify the assigned user via email (fire-and-forget)
        sendEmail({
            to: targetUser.email,
            subject: `DOT IT \u2013 New task assigned: ${title}`,
            html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2>New Task Assigned \ud83d\udcdd</h2>
          <p>Hi ${targetUser.name},</p>
          <p>You have been assigned a new task: <strong>${title}</strong></p>
          ${description ? `<p style="color:#555">${description}</p>` : ""}
          ${deadline ? `<p>Deadline: <strong>${new Date(deadline).toLocaleDateString()}</strong></p>` : ""}
        </div>
      `,
        }).catch((err) => console.error("Admin-task email failed:", err.message));

        return res.status(201).json(task);
    } catch (error) {
        return res.status(500).json({ message: "Failed to create admin task", error: error.message });
    }
}

// ─── Admin: get all tasks they have assigned ───────────────────────────────────
async function getAllAdminTasks(req, res) {
    try {
        const tasks = await AdminTask.find({ assignedBy: req.user.id })
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });
        return res.json(tasks);
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch admin tasks", error: error.message });
    }
}

// ─── Admin: update an assigned task ────────────────────────────────────────────
async function updateAdminTask(req, res) {
    try {
        const { id } = req.params;
        const { title, description, image, status, deadline } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid task id" });
        }

        const updates = {};
        if (typeof title !== "undefined") updates.title = title;
        if (typeof description !== "undefined") updates.description = description;
        if (typeof image !== "undefined") updates.image = image;
        if (typeof status !== "undefined") updates.status = status;
        if (typeof deadline !== "undefined") updates.deadline = deadline;

        const updatedTask = await AdminTask.findOneAndUpdate(
            { _id: id, assignedBy: req.user.id },
            updates,
            { new: true, runValidators: true }
        ).populate("assignedTo", "name email");

        if (!updatedTask) {
            return res.status(404).json({ message: "Task not found" });
        }

        return res.json(updatedTask);
    } catch (error) {
        return res.status(500).json({ message: "Failed to update admin task", error: error.message });
    }
}

// ─── Admin: delete an assigned task ────────────────────────────────────────────
async function deleteAdminTask(req, res) {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid task id" });
        }

        const deletedTask = await AdminTask.findOneAndDelete({
            _id: id,
            assignedBy: req.user.id,
        });

        if (!deletedTask) {
            return res.status(404).json({ message: "Task not found" });
        }

        return res.json({ message: "Task deleted", task: deletedTask });
    } catch (error) {
        return res.status(500).json({ message: "Failed to delete admin task", error: error.message });
    }
}

// ─── Admin: list all users (for the assign-to dropdown) ────────────────────────
async function listUsers(req, res) {
    try {
        const users = await User.find({ role: "user" }).select("name email _id");
        return res.json(users);
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
}

// ─── User: get tasks assigned to me ────────────────────────────────────────────
async function getMyAssignedTasks(req, res) {
    try {
        const tasks = await AdminTask.find({ assignedTo: req.user.id })
            .populate("assignedBy", "name email")
            .sort({ createdAt: -1 });
        return res.json(tasks);
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch assigned tasks", error: error.message });
    }
}

// ─── User: update status of a task assigned to me ──────────────────────────────
async function updateMyAssignedTaskStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid task id" });
        }

        if (!["pending", "in-progress", "completed"].includes(status)) {
            return res.status(400).json({ message: "status must be pending, in-progress, or completed" });
        }

        const updatedTask = await AdminTask.findOneAndUpdate(
            { _id: id, assignedTo: req.user.id },
            { status },
            { new: true, runValidators: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Notify admin via email if task is completed
        if (status === "completed") {
            const admin = await User.findById(updatedTask.assignedBy);
            if (admin) {
                sendEmail({
                    to: admin.email,
                    subject: `DOT IT \u2013 Task completed: ${updatedTask.title}`,
                    html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
              <h2>Task Completed \ud83c\udf89</h2>
              <p>${req.user.name} has completed the task: <strong>${updatedTask.title}</strong></p>
            </div>
          `,
                }).catch((err) => console.error("Task-completed email failed:", err.message));
            }
        }

        return res.json(updatedTask);
    } catch (error) {
        return res.status(500).json({ message: "Failed to update task status", error: error.message });
    }
}

module.exports = {
    createAdminTask,
    getAllAdminTasks,
    updateAdminTask,
    deleteAdminTask,
    listUsers,
    getMyAssignedTasks,
    updateMyAssignedTaskStatus,
};
