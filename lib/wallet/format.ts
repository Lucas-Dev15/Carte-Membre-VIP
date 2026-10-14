/** Formats de date français, fuseau Europe/Paris, sans zéro initial. */
const TZ = "Europe/Paris";

function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...options }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out;
}

/** « 18 h 30 » (« 18 h » pile) */
export function formatTime(date: Date): string {
  const p = parts(date, { hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const hour = String(Number(p.hour));
  return p.minute === "00" ? `${hour} h` : `${hour} h ${p.minute}`;
}

/** « 12 nov. · 18 h 30 » */
export function formatShortWhen(date: Date): string {
  const p = parts(date, { day: "numeric", month: "short" });
  return `${p.day} ${p.month} · ${formatTime(date)}`;
}

/** « 12 nov. » (recto du pass : le titre de la conférence garde la place, l'heure est au verso) */
export function formatShortDate(date: Date): string {
  const p = parts(date, { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

/** « jeu. 12 nov. 2026 · 18 h 30 » */
export function formatLongWhen(date: Date): string {
  const p = parts(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${p.weekday} ${p.day} ${p.month} ${p.year} · ${formatTime(date)}`;
}

/** « jeu. 12 nov. à 18 h 30 » (notifications) */
export function formatNotifWhen(date: Date): string {
  const p = parts(date, { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday} ${p.day} ${p.month} à ${formatTime(date)}`;
}

/** « mars 2026 » */
export function formatMonthYear(date: Date): string {
  const p = parts(date, { month: "long", year: "numeric" });
  return `${p.month} ${p.year}`;
}
