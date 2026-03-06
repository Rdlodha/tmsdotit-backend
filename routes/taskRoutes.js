const express = require("express");
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", getTasks);
router.post("/", upload.single("taskImage"), createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

module.exports = router;
