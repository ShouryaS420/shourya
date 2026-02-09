// import jwt from "jsonwebtoken";
// import VendorUsers from "../models/VendorUsers.js";

// export async function isVendorAuthenticated(req, res, next) {
//   try {
//     const hdr = req.headers.authorization || "";
//     const headerToken = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
//     const cookieToken = req.cookies?.vendorToken || req.cookies?.token || null;
//     const token = headerToken || cookieToken;

//     // DEV fallback: allow X-VENDOR-ID header for quick testing
//     const devVendorId = req.headers["x-vendor-id"] || req.query.vendorUserId;

//     let vendor = null;

//     if (token) {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       vendor = await VendorUsers.findById(decoded?._id);
//     } else if (devVendorId) {
//       vendor = await VendorUsers.findById(devVendorId);
//     }

//     if (!vendor) {
//       return res.status(401).json({ success: false, message: "Vendor auth required" });
//     }

//     req.vendor = vendor;
//     next();
//   } catch (e) {
//     return res.status(401).json({ success: false, message: "Invalid vendor token" });
//   }
// }

import jwt from "jsonwebtoken";
import VendorUsers from "../models/VendorUsers.js";

export const isVendorAuthenticated = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const token = bearer || req.headers["x-auth-token"] || req.cookies?.token;

    if (!token) {
      return res.status(401).json({ success: false, message: "No token. Please login again." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const vendorId = decoded?._id;
    if (!vendorId) {
      return res.status(401).json({ success: false, message: "Invalid token payload." });
    }

    const vendor = await VendorUsers.findById(vendorId);
    if (!vendor) {
      return res.status(401).json({ success: false, message: "User not found for token." });
    }

    // ✅ Controllers expect this
    req.vendor = vendor;

    // Optional: keep backwards compatibility
    req.user = vendor;

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized", error: err.message });
  }
};