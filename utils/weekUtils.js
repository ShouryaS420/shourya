import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export function getWeekRange(date) {
    const d = dayjs(date);

    // Monday to Saturday
    const start = d.startOf("week").add(1, "day"); // Monday
    const end = start.add(5, "day"); // Saturday

    return {
        start: start.startOf("day").toDate(),
        end: end.endOf("day").toDate(),
        label: `${start.format("DD MMM")} - ${end.format("DD MMM")}`,
    };
}

export function getPreviousWeekRange(date) {
    const d = dayjs(date).subtract(1, "week");

    const start = d.startOf("week").add(1, "day"); // Monday
    const end = start.add(5, "day"); // Saturday

    return {
        start: start.startOf("day").toDate(),
        end: end.endOf("day").toDate(),
        label: `${start.format("DD MMM")} - ${end.format("DD MMM")}`,
    };
}

/**
 * Business Week: Monday → Saturday (6 days)
 * Returns date keys as "YYYY-MM-DD" in Asia/Kolkata.
 */
export const getCurrentWeekRangeKeys = () => {
    const now = dayjs().tz("Asia/Kolkata");

    // day(): 0=Sunday, 1=Monday, ... 6=Saturday
    const dow = now.day();

    // We want the start of business week (Monday).
    // If today is Sunday (0), go back 6 days to last Monday.
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;

    const start = now.subtract(daysSinceMonday, "day").startOf("day"); // Monday
    const end = start.add(5, "day").endOf("day"); // Saturday

    return {
        startKey: start.format("YYYY-MM-DD"),
        endKey: end.format("YYYY-MM-DD"),
    };
};

