import ms from 'ms';

function requireEnv(name) {
    const v = process.env[name];
    if (!v || String(v).trim() === '') {
        throw new Error(`Missing required env: ${name}`);
    }
    return v;
}

export const adminAuthConfig = {
    // who is the ultimate owner; first login gets promoted to founder
    FOUNDER_EMAIL: process.env.FOUNDER_EMAIL || 'founder@example.com',

    // JWT
    ADMIN_JWT_SECRET: requireEnv('ADMIN_JWT_SECRET'), // long random string
    ADMIN_JWT_ACCESS_TTL: process.env.ADMIN_JWT_ACCESS_TTL || '15m',
    ADMIN_JWT_REFRESH_TTL: process.env.ADMIN_JWT_REFRESH_TTL || '180d',

    // cookies
    ADMIN_REFRESH_COOKIE_NAME: process.env.ADMIN_REFRESH_COOKIE_NAME || 'dashboard_refresh',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined, // e.g. .yourdomain.com
    NODE_ENV: process.env.NODE_ENV || 'development',

    // OAuth (wired in Phase 4)
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',

    // dashboard SPA origin (CORS)
    DASHBOARD_ORIGIN: process.env.DASHBOARD_ORIGIN || 'http://localhost:3000',

    // mailer sender (Phase 3)
    MAIL_FROM: process.env.MAIL_FROM || 'auth@localhost',

    // derived helpers
    isProd() { return this.NODE_ENV === 'production'; },
    accessMs() { return ms(this.ADMIN_JWT_ACCESS_TTL); },
    refreshMs() { return ms(this.ADMIN_JWT_REFRESH_TTL); },
};
