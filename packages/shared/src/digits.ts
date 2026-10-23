/** Persian digits and small formatting helpers shared by the app and the server. */
export const FA = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (v: string | number): string => String(v).replace(/[0-9]/g, (d) => FA[+d]);
export const pad = (n: number): string => String(n).padStart(2, '0');
