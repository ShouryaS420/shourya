import { Router } from 'express';
import { adminAuthConfig } from '../../config/adminAuthConfig.js';
import { requireAdminAuth } from '../../middleware/adminAuth/requireAdminAuth.js';
import { requireRole } from '../../middleware/adminAuth/requireRole.js';

import { resolveRoleByEmail, upsertAdminUserByEmail } from '../../lib/adminAuth/resolveRoleByEmail.js';
import { signAccessJwt } from '../../lib/adminAuth/jwt.js';
import {
    generateRefreshToken, createSession, setRefreshCookiePair,
    clearRefreshCookie, verifySessionById, revokeSession
} from '../../lib/adminAuth/refreshTokens.js';
import { createOtpChallenge, verifyAndConsumeOtp } from '../../lib/adminAuth/otp.js';
import { sendmail } from '../../utils/sendmail.js';

const r = Router();

// ---------- Health ----------
r.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'admin-auth', ts: new Date().toISOString() });
});

// ---------- DEV: issue token (unchanged; disabled in prod) ----------
r.get('/dev/issue-token', async (req, res) => {
    if (adminAuthConfig.isProd()) return res.status(403).json({ ok: false, error: 'disabled_in_production' });
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        const name = String(req.query.name || '') || undefined;
        const avatarUrl = String(req.query.avatarUrl || '') || undefined;
        if (!email) return res.status(400).json({ ok: false, error: 'email_required' });

        const role = await resolveRoleByEmail(email);
        if (!role) return res.status(403).json({ ok: false, error: 'not_authorized' });

        const adminUser = await upsertAdminUserByEmail(email, { name, avatarUrl, role });
        const token = signAccessJwt({
            sub: adminUser._id.toString(),
            email: adminUser.email,
            role: adminUser.role,
            name: adminUser.name,
            avatarUrl: adminUser.avatarUrl,
        });

        res.json({ ok: true, token, user: { id: adminUser._id, email: adminUser.email, role: adminUser.role, name: adminUser.name, avatarUrl: adminUser.avatarUrl } });
    } catch (err) {
        console.error('dev/issue-token error', err);
        res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// ================================================================
//                           EMAIL OTP LOGIN
// ================================================================

// 1) Start OTP: POST /api/admin-auth/email/start  { email }
r.post('/email/start', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ ok: false, error: 'email_required' });

        const role = await resolveRoleByEmail(email);
        if (!role) {
            // generic response to avoid user enumeration
            return res.status(200).json({ ok: true, sent: true });
        }

        const { code } = await createOtpChallenge(email);

        await sendMail({
            to: email,  // << important: TO field
            subject: `Your 99SquareWall Dashboard login code`,
            html: `
        <div style="font-family:Inter,Arial,sans-serif;font-size:16px">
          <p>Use this code to sign in:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
        });

        if (!adminAuthConfig.isProd()) console.log(`[OTP] ${email} => ${code}`);

        return res.json({ ok: true, sent: true });
    } catch (err) {
        console.error('email/start error', {
            code: err?.code,
            responseCode: err?.responseCode,
            response: err?.response,
            message: err?.message,
        });
        res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// 2) Verify OTP: POST /api/admin-auth/email/verify { email, code, name?, avatarUrl? }
r.post('/email/verify', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const code = String(req.body.code || '').trim();

        if (!email || !code) return res.status(400).json({ ok: false, error: 'email_and_code_required' });

        // rate-limited verification + consume
        const vr = await verifyAndConsumeOtp(email, code);
        if (!vr.ok) return res.status(401).json({ ok: false, error: `otp_${vr.reason}` });

        // resolve role (founder / admin / employee) from Vendor + founder email
        const role = await resolveRoleByEmail(email);
        if (!role) return res.status(403).json({ ok: false, error: 'not_authorized' });

        // upsert AdminUser facade (kept minimal)
        const adminUser = await upsertAdminUserByEmail(email, {
            name: req.body.name, avatarUrl: req.body.avatarUrl, role
        });

        // issue short-lived access JWT
        const accessToken = signAccessJwt({
            sub: adminUser._id.toString(),
            email: adminUser.email,
            role: adminUser.role,
            name: adminUser.name,
            avatarUrl: adminUser.avatarUrl,
        });

        // create a long-lived refresh session and set cookie
        const opaque = generateRefreshToken();
        const sess = await createSession({
            userId: adminUser._id,
            refreshToken: opaque,
            deviceId: req.headers['x-device-id'],
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });
        setRefreshCookiePair(res, sess._id.toString(), opaque, adminAuthConfig.refreshMs());

        return res.json({
            ok: true,
            accessToken,
            user: { id: adminUser._id, email: adminUser.email, role: adminUser.role, name: adminUser.name, avatarUrl: adminUser.avatarUrl }
        });
    } catch (err) {
        console.error('email/verify error', err);
        res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// 3) Refresh access token: POST /api/admin-auth/session/refresh
r.post('/session/refresh', async (req, res) => {
    try {
        const cookieName = adminAuthConfig.ADMIN_REFRESH_COOKIE_NAME;
        const v = req.cookies?.[cookieName];
        if (!v) return res.status(401).json({ ok: false, error: 'no_refresh_cookie' });

        const dot = v.indexOf('.');
        if (dot <= 0) return res.status(401).json({ ok: false, error: 'invalid_cookie' });

        const sessionId = v.slice(0, dot);
        const token = v.slice(dot + 1);

        const sess = await verifySessionById(sessionId, token);
        if (!sess) return res.status(401).json({ ok: false, error: 'invalid_or_expired' });

        // load user (tiny read)
        const { default: AdminUser } = await import('../../models/adminAuth/AdminUser.js');
        const user = await AdminUser.findById(sess.userId).lean();
        if (!user || user.status === 'suspended') {
            await revokeSession(sessionId);
            clearRefreshCookie(res);
            return res.status(403).json({ ok: false, error: 'suspended_or_missing' });
        }

        const accessToken = signAccessJwt({
            sub: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
            avatarUrl: user.avatarUrl,
        });

        return res.json({ ok: true, accessToken, user: { id: user._id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl } });
    } catch (err) {
        console.error('session/refresh error', err);
        res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// 4) Logout: POST /api/admin-auth/logout
r.post('/logout', async (req, res) => {
    try {
        const cookieName = adminAuthConfig.ADMIN_REFRESH_COOKIE_NAME;
        const v = req.cookies?.[cookieName];
        if (v) {
            const dot = v.indexOf('.');
            if (dot > 0) {
                const sessionId = v.slice(0, dot);
                await revokeSession(sessionId);
            }
        }
        clearRefreshCookie(res);
        res.json({ ok: true, loggedOut: true });
    } catch (err) {
        console.error('logout error', err);
        res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// ---------- WhoAmI & example protected (from Step 2) ----------
r.get('/me', requireAdminAuth, (req, res) => {
    res.json({ ok: true, user: req.admin });
});
r.get('/protected-example', requireAdminAuth, requireRole('admin', 'founder'), (req, res) => {
    res.json({ ok: true, message: 'admin/founder only', user: req.admin });
});

// ---- DEV: mailer smoke test ----
r.post('/dev/send-test-mail', async (req, res) => {
    if (adminAuthConfig.isProd()) return res.status(403).json({ ok: false, error: 'disabled_in_production' });
    try {
        // accept both keys; prefer explicit `to`
        const to =
            (req.body && (req.body.to || req.body.email)) ||
            adminAuthConfig.FOUNDER_EMAIL;

            console.log(to);

        if (!to || !String(to).trim()) {
            return res.status(400).json({ ok: false, error: 'recipient_required' });
        }

        await sendmail({
            to: String(to).trim(),
            subject: 'Dashboard mail test',
            html: '<p>If you received this, SMTP auth+policy are good.</p>',
        });

        res.json({ ok: true, sent: true, to: String(to).trim() });
    } catch (err) {
        console.error('dev/send-test-mail error:', {
            code: err?.code,
            responseCode: err?.responseCode,
            response: err?.response,
            message: err?.message,
        });
        res.status(500).json({
            ok: false,
            error: 'send_failed',
            detail: String(err?.response || err?.message || err),
        });
    }
});

export default r;
