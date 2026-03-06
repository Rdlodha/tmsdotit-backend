const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { requireAccessToken } = require("./controllers/authController");

dotenv.config();
connectDB().catch((error) => {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
});

const app = express();

const PORT = Number(process.env.PORT || 5000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const allowedOrigins = new Set([CLIENT_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"]);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// ─── Static files (uploads) ────────────────────────────────────────────────
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", require("./routes/authRoutes"));
app.use("/api/tasks", requireAccessToken, require("./routes/taskRoutes"));
app.use("/api/admin-tasks", requireAccessToken, require("./routes/adminTaskRoutes"));

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
