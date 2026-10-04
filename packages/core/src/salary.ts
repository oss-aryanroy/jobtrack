import type { Salary, SalaryPeriod } from "./model";

const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  CAD: "C$",
  AUD: "A$",
};

const PERIOD_SUFFIX: Record<SalaryPeriod, string> = { year: "", month: "/mo", hour: "/hr" };

const trim = (n: number) => (Math.round(n * 10) / 10).toString();

export function formatAmount(value: number, currency: string): string {
  const symbol = SYMBOLS[currency];
  const prefix = symbol ?? `${currency} `;
  if (currency === "INR") {
    if (value >= 1e7) return `${prefix}${trim(value / 1e7)}Cr`;
    if (value >= 1e5) return `${prefix}${trim(value / 1e5)}L`;
    return `${prefix}${value.toLocaleString("en-IN")}`;
  }
  if (value >= 1e6) return `${prefix}${trim(value / 1e6)}M`;
  if (value >= 1e3) return `${prefix}${trim(value / 1e3)}K`;
  return `${prefix}${trim(value)}`;
}

export function formatSalary(salary: Salary | undefined): string {
  if (!salary) return "";
  const { min, max, currency, period, estimated } = salary;
  const hasMin = typeof min === "number" && min > 0;
  const hasMax = typeof max === "number" && max > 0;
  let text: string;
  if (hasMin && hasMax && min !== max) text = `${formatAmount(min, currency)} – ${formatAmount(max, currency)}`;
  else if (hasMin) text = hasMax ? formatAmount(min, currency) : `${formatAmount(min, currency)}+`;
  else if (hasMax) text = `up to ${formatAmount(max, currency)}`;
  else return "";
  return `${estimated ? "~" : ""}${text}${PERIOD_SUFFIX[period]}`;
}

const CURRENCY_HINTS: [RegExp, string][] = [
  [/₹|\binr\b|\brs\.?|lpa|lakh|\blac\b|crore|\bcr\b/i, "INR"],
  [/s\$|\bsgd\b/i, "SGD"],
  [/c\$|\bcad\b/i, "CAD"],
  [/a\$|\baud\b/i, "AUD"],
  [/\$|\busd\b/i, "USD"],
  [/€|\beur\b/i, "EUR"],
  [/£|\bgbp\b/i, "GBP"],
  [/\bnok\b/i, "NOK"],
  [/\bsek\b/i, "SEK"],
  [/\bchf\b/i, "CHF"],
];

const UNIT: [RegExp, number][] = [
  [/^(cr|crore)s?$/i, 1e7],
  [/^(l|lpa|lakh|lakhs|lac|lacs)$/i, 1e5],
  [/^(m|mn|million)$/i, 1e6],
  [/^(k|thousand)$/i, 1e3],
];

const unitMultiplier = (unit: string | undefined) => {
  if (!unit) return undefined;
  for (const [pattern, mult] of UNIT) if (pattern.test(unit)) return mult;
  return undefined;
};

export function parseSalary(text: string, defaultCurrency = "INR"): Salary | null {
  const input = text.trim();
  if (!input) return null;
  const currency = CURRENCY_HINTS.find(([pattern]) => pattern.test(input))?.[1] ?? defaultCurrency;
  const period: SalaryPeriod = /\/\s*(mo|month)|per month|monthly|pm\b/i.test(input)
    ? "month"
    : /\/\s*(hr|hour)|per hour|hourly/i.test(input)
      ? "hour"
      : "year";
  const numbers = [...input.matchAll(/(\d+(?:[.,]\d+)*)\s*([a-z]+)?/gi)]
    .map((m) => ({ value: Number((m[1] ?? "").replace(/,/g, "")), unit: m[2] }))
    .filter((n) => Number.isFinite(n.value) && n.value > 0);
  if (numbers.length === 0) return null;
  const sharedUnit = unitMultiplier(numbers[numbers.length - 1]?.unit);
  const fallbackUnit = currency === "INR" && period === "year" ? 1e5 : 1e3;
  const scaled = numbers.slice(0, 2).map(({ value, unit }) => {
    const mult = unitMultiplier(unit) ?? sharedUnit;
    if (mult) return value * mult;
    return value < 1000 && period === "year" ? value * fallbackUnit : value;
  });
  const [min, max] = scaled.length === 2 ? [Math.min(...scaled), Math.max(...scaled)] : [scaled[0], undefined];
  return { min, max, currency, period, estimated: /~|approx|est/i.test(input) };
}
