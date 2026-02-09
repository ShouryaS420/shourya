export function computeVendorNext(user) {
    const approval = user?.approvalStatus;
    const step = user?.onboardingStep;

    // ✅ Full access only when approved
    if (approval === "APPROVED") return { screen: "AppTabsNavigator" };

    // ✅ Submitted / pending review
    if (step === "SUBMITTED" || approval === "PENDING") return { screen: "OnboardingReview" };

    // ✅ Resume onboarding
    if (step === "PROFILE" || step === "NEW") return { screen: "Onboarding" };
    if (step === "SKILLS") return { screen: "OnboardingSkill" };
    if (step === "KYC") return { screen: "OnboardingKyc" };
    if (step === "CONSENT") return { screen: "OnboardingConsent" };

    return { screen: "Onboarding" };
}
