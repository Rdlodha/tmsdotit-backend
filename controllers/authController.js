const crypto = require("crypto");
const { User } = require("../models");
const sendEmail = require("../utils/sendEmail");


// ─── Config ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 5000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const ACCESS_TOKEN_SECRET =
    process.env.ACCESS_TOKEN_SECRET || "dev_access_secret_change_me";
const REFRESH_TOKEN_SECRET =
    process.env.REFRESH_TOKEN_SECRET || "dev_refresh_secret_change_me";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toBase64Url(value) {
    return Buffer.from(value).toString("base64url");
}

function timingSafeEqualText(a, b) {
    const first = Buffer.from(a);
    const second = Buffer.from(b);
    if (first.length !== second.length) return false;
    return crypto.timingSafeEqual(first, second);
}

function signJwt(payload, secret, expiresInSeconds) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(signingInput)
        .digest("base64url");

    return `${signingInput}.${signature}`;
}

function verifyJwt(token, secret) {
    const tokenParts = token?.split(".");
    if (!tokenParts || tokenParts.length !== 3) {
        throw new Error("Invalid token format");
    }

    const [encodedHeader, encodedPayload, signature] = tokenParts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(signingInput)
        .digest("base64url");

    if (!timingSafeEqualText(signature, expectedSignature)) {
        throw new Error("Invalid token signature");
    }

    const payloadText = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(payloadText);

    if (!payload.exp || Math.floor(Date.now() / 1000) >= payload.exp) {
        throw new Error("Token expired");
    }

    return payload;
}

function parseCookies(cookieHeader = "") {
    const entries = cookieHeader
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
            const separatorIndex = item.indexOf("=");
            if (separatorIndex === -1) return [item, ""];
            const key = item.slice(0, separatorIndex).trim();
            const value = item.slice(separatorIndex + 1).trim();
            return [key, decodeURIComponent(value)];
        });

    return Object.fromEntries(entries);
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    const [salt, existingHash] = String(storedPassword || "").split(":");
    if (!salt || !existingHash) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqualText(hash, existingHash);
}

function sanitizeUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
    };
}

function createAccessToken(user) {
    return signJwt(
        {
            sub: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            type: "access",
        },
        ACCESS_TOKEN_SECRET,
        ACCESS_TOKEN_TTL_SECONDS
    );
}

function createRefreshToken(user) {
    return signJwt(
        { sub: user._id.toString(), type: "refresh" },
        REFRESH_TOKEN_SECRET,
        REFRESH_TOKEN_TTL_SECONDS
    );
}

function setRefreshCookie(res, refreshToken) {
    const isProduction = NODE_ENV === "production";
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
        path: "/",
    });
}

function clearRefreshCookie(res) {
    const isProduction = NODE_ENV === "production";
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: "/",
    });
}

// ─── Middleware: require access token ──────────────────────────────────────────
function requireAccessToken(req, res, next) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing access token" });
    }

    const token = authHeader.slice("Bearer ".length);

    try {
        const payload = verifyJwt(token, ACCESS_TOKEN_SECRET);
        if (payload.type !== "access" || !payload.sub) {
            return res.status(401).json({ message: "Invalid access token" });
        }

        req.user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            role: payload.role,
        };
        next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired access token" });
    }
}

// ─── Route handlers ────────────────────────────────────────────────────────────
async function register(req, res) {
    try {
        const { name, email, password, role } = req.body || {};

        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email and password are required" });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        if (!normalizedEmail.includes("@")) {
            return res.status(400).json({ message: "Invalid email" });
        }

        if (String(password).length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await User.create({
            name: String(name).trim(),
            email: normalizedEmail,
            password: hashPassword(String(password)),
            isEmailVerified: false,
            verificationToken,
            verificationTokenExpires,
            role: role === "admin" ? "admin" : "user",

        });

        const verifyUrl = `${process.env.BACKEND_URL}/auth/verify-email?token=${verificationToken}`;

        try {
            const emailResult = await sendEmail({
                to: normalizedEmail,
                subject: "DOT IT – Verify your email address",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
                      <h2>Welcome to DOT IT, ${String(name).trim()}!</h2>
                      <p>Please verify your email address by clicking the button below:</p>
                      <a href="${verifyUrl}"
                         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">
                        Verify Email
                      </a>
                      <p style="margin-top:16px;font-size:12px;color:#666;">This link expires in 24 hours.</p>
                    </div>`
            });

            console.log("Email sent successfully:", JSON.stringify(emailResult, null, 2));

            return res.status(201).json({
                message: "Registration successful! Please check your email to verify your account before logging in.",
            });
        } catch (emailError) {
            console.error("Failed to send verification email:", emailError.message,JSON.stringify(emailResult, null, 2));
            
            // Delete the user since email verification is critical
            await User.deleteOne({ _id: user._id });
            
            return res.status(500).json({ 
                message: "Failed to send verification email. Please try registering again.",
                error: emailError.message 
            });
        }
    } catch (error) {
        console.error("Registration error:", error.message);
        return res.status(500).json({ message: "Registration failed", error: error.message });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required" });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user || !verifyPassword(String(password), user.password)) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in. Check your inbox for the verification link.",
            });
        }

        const accessToken = createAccessToken(user);
        const refreshToken = createRefreshToken(user);
        setRefreshCookie(res, refreshToken);

        return res.json({
            user: sanitizeUser(user),
            accessToken,
        });
    } catch (error) {
        return res.status(500).json({ message: "Login failed", error: error.message });
    }
}

async function refresh(req, res) {
    const cookies = parseCookies(req.headers.cookie || "");
    const refreshToken = cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: "Missing refresh token" });
    }

    try {
        const payload = verifyJwt(refreshToken, REFRESH_TOKEN_SECRET);
        if (payload.type !== "refresh" || !payload.sub) {
            throw new Error("Invalid refresh token payload");
        }

        const user = await User.findById(payload.sub);
        if (!user) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        setRefreshCookie(res, refreshToken);
        const accessToken = createAccessToken(user);

        return res.json({
            user: sanitizeUser(user),
            accessToken,
        });
    } catch {
        clearRefreshCookie(res);
        return res.status(401).json({ message: "Invalid refresh token" });
    }
}

async function verifyEmail(req, res) {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: "Verification token is required" });
        }

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired verification token" });
        }

        user.isEmailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        return res.redirect(`${CLIENT_ORIGIN}/login?verified=true`);
    } catch (error) {
        return res.status(500).json({ message: "Email verification failed", error: error.message });
    }
}

function logout(req, res) {
    clearRefreshCookie(res);
    return res.json({ message: "Logged out" });
}

async function me(req, res) {
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: sanitizeUser(user) });
}

module.exports = {
    requireAccessToken,
    register,
    login,
    refresh,
    verifyEmail,
    logout,
    me,
};
