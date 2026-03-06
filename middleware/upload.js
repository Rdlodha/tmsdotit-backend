const multer = require("multer");
const path = require("path");

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

// File filter (images + PDF)
const fileFilter = (req, file, cb) => {
  // Allowed mimetypes
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Rejects the file with a helpful error message
    cb(new Error("Only .jpg, .jpeg, .png, and .pdf formats are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;