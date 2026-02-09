function nav(screen, params = {}) {
    return { type: "NAVIGATE", screen, params };
}

/* ───────────── Placement inference ───────────── */
export function inferPlacement(code) {
    if (code.startsWith("INFO_")) return "HOME_INFO";
    return "HOME_TOP";
}

/* ───────────── HOME TOP (Offer / Behavioral) ───────────── */
export function resolveHomeTopRule(code, ctx) {
    console.log('code:', code);

    if (code.includes("PAYOUT")) {
        return {
            eligible: ctx?.payout?.due === true,
            deepLink: nav("Payout"),
            weight: 100,
        };
    }

    if (code.includes("ATTEND")) {
        return { eligible: true, deepLink: nav("Attendance"), weight: 90 };
    }

    if (code.includes("SAFETY")) {
        return { eligible: true, deepLink: nav("SafetyRules"), weight: 80 };
    }

    if (code.includes("LEADERSHIP")) {
        return {
            eligible:
                ctx?.leadership?.eligible &&
                !ctx?.leadership?.isLeader &&
                !ctx?.leadership?.hasPendingApplication,
            deepLink: nav("LeadershipPrograms"),
            weight: 70,
        };
    }

    return { eligible: true, deepLink: nav("Home"), weight: 30 };
}

/* ───────────── HOME INFO (Education) ───────────── */
export function resolveHomeInfoRule(code) {
    if (code.includes("PAYOUT")) return nav("InfoPayout");
    if (code.includes("ATTEND")) return nav("InfoAttendance");
    if (code.includes("SAFETY")) return nav("InfoSafety");
    if (code.includes("LEADERSHIP")) return nav("InfoLeadership");
    return nav("InfoHub");
}
