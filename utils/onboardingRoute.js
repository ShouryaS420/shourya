export function routeFromStep(step) {
    switch (step) {
        case "PROFILE":
            return { route: "Onboarding/Profile", ctaLabel: "Continue" };
        case "SKILLS":
            return { route: "Onboarding/Skills", ctaLabel: "Continue" };
        case "KYC":
            return { route: "Onboarding/Kyc", ctaLabel: "Continue" };
        case "CONSENT":
            return { route: "Onboarding/Consent", ctaLabel: "Submit" };
        case "SUBMITTED":
            return { route: "App/Home", ctaLabel: null };
        default:
            return { route: "Onboarding/Profile", ctaLabel: "Continue" };
    }
}
