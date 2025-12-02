export function toFlatpickrFormat(fmt?: string): string {
    if (!fmt) return 'Y/m/d';
    return String(fmt)
        // year
        .replace(/YYYY|yyyy/g, 'Y')
        .replace(/YY|yy/g, 'y')
        // month names -> flatpickr short/long
        .replace(/MMMM/g, 'F')
        .replace(/MMM/g, 'M')
        // numeric months
        .replace(/MM/g, 'm')
        .replace(/\bM\b/g, 'n')
        // day
        .replace(/DD/g, 'd')
        .replace(/\bD\b/g, 'j')
        // weekday (app tokens EEEE/EEE -> flatpickr full/short)
        .replace(/EEEE/g, 'l')
        .replace(/\bEEE\b/g, 'D');
}

/**
 * Format a date using the app token set:
 * Supported tokens: YYYY, YY, MMMM, MMM, MM, M, DD, D, EEEE, EEE
 * Falls back to `fallback` (default "YYYY-MM-DD") when format is falsy.
 */
export function formatWithAppTokens(
    dateInput: any,
    format?: string | null,
    fallback = 'YYYY-MM-DD'
): string {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput);

    const pad = (n: number) => String(n).padStart(2, '0');

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsLong = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];

    const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaysLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const fmt = (format && String(format).trim()) || fallback;

    // Replace longer tokens first to avoid partial matches.
    return String(fmt)
        .replace(/YYYY/g, String(d.getFullYear()))
        .replace(/YY/g, String(d.getFullYear()).slice(-2))
        .replace(/MMMM/g, monthsLong[d.getMonth()])
        .replace(/MMM/g, monthsShort[d.getMonth()])
        .replace(/MM/g, pad(d.getMonth() + 1))
        .replace(/M(?![a-zA-Z])/g, String(d.getMonth() + 1))
        .replace(/DD/g, pad(d.getDate()))
        .replace(/D(?![a-zA-Z])/g, String(d.getDate()))
        .replace(/EEEE/g, weekdaysLong[d.getDay()])
        .replace(/\bEEE\b/g, weekdaysShort[d.getDay()]);
}