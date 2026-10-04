const DAY = 86_400_000;

export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * DAY).toISOString();

export const localDayKey = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const daysBetween = (fromIso: string, toIso: string) => {
  const a = new Date(localDayKey(fromIso));
  const b = new Date(localDayKey(toIso));
  return Math.round((b.getTime() - a.getTime()) / DAY);
};

export const startOfWeek = (iso: string) => {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
};
