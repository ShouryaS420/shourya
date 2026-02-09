export const sendVendorUserToken = (user, res, statusCode = 200) => {
    const token = user.getJWTToken();

    const userData = user;

    const next = (() => {
        // If NOT approved -> onboarding/review
        if (user.approvalStatus !== "APPROVED") {
            if (user.onboardingStep !== "SUBMITTED" && user.onboardingStep !== "DONE") {
                return { screen: "Onboarding", mode: "FILL" };
            }
            return { screen: "AppTabsNavigator", mode: "WAITING" };
        }
        return { screen: "AppTabsNavigator", mode: "FULL" };
    })();

    return res.status(statusCode).json({
        success: true,
        setToken: token,     // IMPORTANT: frontend expects setToken
        user: userData,
        next,
    });
};
