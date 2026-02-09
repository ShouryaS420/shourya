import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const isAuthenticated = async (req, res, next) => {
  try {
    let token = null;

    // 1) Bearer token (mobile)
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7);

    // 2) Cookie (web)
    if (!token && req.cookies?.token) token = req.cookies.token;

    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// middleware/auth.js
export function requireAuth(req, res, next) {
  // assume req.user is set by your existing auth
  if (!req.user?._id) return res.status(401).json({ success: false, message: "Unauthorized" });
  next();
}

export function requireCRM(req, res, next) {
  // protect with an internal token or role check
  const key = req.headers["x-internal-key"];
  if (!key || key !== process.env.CRM_INTERNAL_KEY)
    return res.status(403).json({ success: false, message: "Forbidden" });
  next();
}
