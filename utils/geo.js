export const haversineMeters = (lat1, lng1, lat2, lng2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// IST-safe YYYY-MM-DD key (Asia/Kolkata)
export const toDateKey = (d) => {
    try {
        return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
        return "";
    }
};
