import crypto from "crypto";
export const newId = (len = 22) => crypto.randomBytes(len).toString("base64url");
