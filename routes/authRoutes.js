const express = require("express");
const {
    requireAccessToken,
    register,
    login,
    refresh,
    verifyEmail,
    logout,
    me,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/verify-email", verifyEmail);
router.post("/logout", logout);
router.get("/me", requireAccessToken, me);

module.exports = router;
