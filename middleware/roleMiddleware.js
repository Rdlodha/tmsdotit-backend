/**
 * Middleware factory that restricts access to users with the specified role(s).
 * Usage: requireRole("admin") or requireRole("admin", "manager")
 * Must be used AFTER requireAccessToken so req.user is populated.
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: "Authentication required" });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied. Insufficient permissions." });
        }

        next();
    };
}

module.exports = { requireRole };
