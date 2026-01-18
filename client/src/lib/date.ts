import { format as formatTz, toZonedTime } from "date-fns-tz";
import { format as formatFns, type FormatOptions } from "date-fns";

let currentTimezone = "Asia/Dhaka";

export function setTimezone(tz: string) {
    currentTimezone = tz;
}

export function getTimezone() {
    return currentTimezone;
}

/**
 * Formats a date in the current application timezone.
 * @param date The date to format (Date object, timestamp, or string).
 * @param formatStr The format string (e.g., 'yyyy-MM-dd').
 * @param options Optional formatting options.
 * @returns The formatted date string.
 */
export function format(
    date: Date | string | number,
    formatStr: string,
    options?: FormatOptions
): string {
    // Convert the input date to a Date object if it's not already
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    // Format the date using date-fns-tz with the specified timezone
    // We pass the original date object (which is a timestamp) and the target timeZone.
    // formatTz will convert the timestamp to the target zone across the board.
    // @ts-ignore - The locale type signature in date-fns-tz is slightly stricter than date-fns, but they are compatible at runtime.
    return formatTz(dateObj, formatStr, { timeZone: currentTimezone, ...options });
}

export * from "date-fns";
