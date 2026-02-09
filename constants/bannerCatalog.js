export const BANNER_CODES = {
    HOME_TOP: [
        "OFFER_PAYOUT",
        "OFFER_SAFETY",
        "OFFER_ATTENDANCE",
        "OFFER_LEADERSHIP",
        "INSPIRE_DISCIPLINE",
        "INSPIRE_GROWTH",
    ],
    HOME_INFO: [
        "INFO_PAYOUT",
        "INFO_SAFETY",
        "INFO_ATTENDANCE",
        "INFO_LEADERSHIP",
        "INFO_BENEFITS",
    ],
};

export const ALL_BANNER_CODES = new Set([
    ...BANNER_CODES.HOME_TOP,
    ...BANNER_CODES.HOME_INFO,
]);
