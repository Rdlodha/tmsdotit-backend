const express = require("express");
const { requireRole } = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const {
    createAdminTask,
    getAllAdminTasks,
    updateAdminTask,
    deleteAdminTask,
    listUsers,
    getMyAssignedTasks,
    updateMyAssignedTaskStatus,
} = require("../controllers/adminTaskController");

const router = express.Router();

// ─── Admin-only routes ─────────────────────────────────────────────────────────
router.post("/", requireRole("admin"), upload.single("taskImage"), createAdminTask);
router.get("/all", requireRole("admin"), getAllAdminTasks);
router.put("/:id", requireRole("admin"), updateAdminTask);
router.delete("/:id", requireRole("admin"), deleteAdminTask);
router.get("/users", requireRole("admin"), listUsers);

// ─── User routes (tasks assigned to them) ──────────────────────────────────────
router.get("/my", getMyAssignedTasks);
router.patch("/my/:id/status", updateMyAssignedTaskStatus);

module.exports = router;
