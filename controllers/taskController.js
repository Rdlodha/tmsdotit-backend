const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const { PersonalTask, User } = require("../models");
const sendEmail = require("../utils/sendEmail");

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function deleteTaskImageIfExists(imageValue) {
  if (!imageValue) {
    return;
  }

  const rawImage = String(imageValue).trim();
  const imageName = path.basename(rawImage);
  const imagePath = path.resolve(__dirname, "..", "uploads", imageName);

  try {
    await fs.unlink(imagePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function getTasks(req, res) {
  try {
    const { completed } = req.query;
    const filter = { user: req.user.id };

    if (typeof completed !== "undefined") {
      if (completed !== "true" && completed !== "false") {
        return res.status(400).json({ message: "completed must be true or false" });
      }
      filter.completed = completed === "true";
    }

    const tasks = await PersonalTask.find(filter).sort({ createdAt: -1 });
    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
}

async function createTask(req, res) {
  try {
    const { title, description, completed } = req.body;
    const imageName = req.file ? req.file.filename : null;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const task = await PersonalTask.create({
      user: req.user.id,
      title,
      description,
      image: imageName,
      completed,
    });

    // Send task-created notification email (fire-and-forget)
    sendEmail({
      to: req.user.email,
      subject: `DOT IT \u2013 New task created: ${title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2>Task Created \u2705</h2>
          <p>Hi ${req.user.name},</p>
          <p>Your task <strong>${title}</strong> has been created successfully.</p>
          ${description ? `<p style="color:#555">${description}</p>` : ""}
        </div>
      `,
    }).catch((err) => console.error("Task-created email failed:", err.message));

    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create task", error: error.message });
  }
}

async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { title, description, image, completed } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const updates = {};
    if (typeof title !== "undefined") updates.title = title;
    if (typeof description !== "undefined") updates.description = description;
    if (typeof image !== "undefined") updates.image = image;
    if (typeof completed !== "undefined") updates.completed = completed;

    const updatedTask = await PersonalTask.findOneAndUpdate(
      { _id: id, user: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Send completion notification email when task is marked as completed
    if (updatedTask.completed === true && updates.completed === true) {
      sendEmail({
        to: req.user.email,
        subject: `DOT IT \u2013 Task completed: ${updatedTask.title}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
            <h2>Task Completed \ud83c\udf89</h2>
            <p>Hi ${req.user.name},</p>
            <p>Great job! Your task <strong>${updatedTask.title}</strong> has been marked as complete.</p>
          </div>
        `,
      }).catch((err) => console.error("Task-completed email failed:", err.message));
    }

    return res.json(updatedTask);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update task", error: error.message });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const deletedTask = await PersonalTask.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });
    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await deleteTaskImageIfExists(deletedTask.image);

    return res.json({ message: "Task deleted", task: deletedTask });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete task", error: error.message });
  }
}

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
};
