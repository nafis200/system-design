/**
 * International phone handling.
 *
 * The console previously accepted Bangladesh mobiles only — `^(\+?880|0)1[3-9]\d{8}$`
 * — which rejected every supplier in China, every customer in Germany, and any
 * landline anywhere. Numbers are now stored in E.164 (`+8801712345678`,
 * `+4915112345678`) whatever form they were typed in, so search, deduplication
 * and `wa.me` links all work off one canonical shape.
 *
 * Input is deliberately forgiving: with or without a `+`, with spaces, dashes or
 * brackets, and with a national trunk `0` that the caller's own dial code
 * replaces. Anything that cannot be resolved to a plausible number is rejected
 * rather than silently stored half-formed.
 */

/** Dial codes the console offers first. Sorted longest-first when matching. */
export const DIAL_CODES: { code: string; country: string; iso: string; trunk?: string }[] = [
  { code: "+880", country: "Bangladesh", iso: "BD", trunk: "0" },
  { code: "+91", country: "India", iso: "IN", trunk: "0" },
  { code: "+86", country: "China", iso: "CN", trunk: "0" },
  { code: "+49", country: "Germany", iso: "DE", trunk: "0" },
  { code: "+44", country: "United Kingdom", iso: "GB", trunk: "0" },
  { code: "+1", country: "United States", iso: "US" },
  { code: "+971", country: "United Arab Emirates", iso: "AE", trunk: "0" },
  { code: "+966", country: "Saudi Arabia", iso: "SA", trunk: "0" },
  { code: "+60", country: "Malaysia", iso: "MY", trunk: "0" },
  { code: "+65", country: "Singapore", iso: "SG" },
  { code: "+92", country: "Pakistan", iso: "PK", trunk: "0" },
  { code: "+94", country: "Sri Lanka", iso: "LK", trunk: "0" },
  { code: "+977", country: "Nepal", iso: "NP", trunk: "0" },
  { code: "+81", country: "Japan", iso: "JP", trunk: "0" },
  { code: "+82", country: "South Korea", iso: "KR", trunk: "0" },
  { code: "+61", country: "Australia", iso: "AU", trunk: "0" },
  { code: "+33", country: "France", iso: "FR", trunk: "0" },
  { code: "+39", country: "Italy", iso: "IT" },
  { code: "+34", country: "Spain", iso: "ES" },
  { code: "+31", country: "Netherlands", iso: "NL", trunk: "0" },
  { code: "+7", country: "Russia", iso: "RU", trunk: "8" },
  { code: "+90", country: "Türkiye", iso: "TR", trunk: "0" },
  { code: "+20", country: "Egypt", iso: "EG", trunk: "0" },
  { code: "+27", country: "South Africa", iso: "ZA", trunk: "0" },
  { code: "+55", country: "Brazil", iso: "BR", trunk: "0" },
  { code: "+62", country: "Indonesia", iso: "ID", trunk: "0" },
  { code: "+63", country: "Philippines", iso: "PH", trunk: "0" },
  { code: "+66", country: "Thailand", iso: "TH", trunk: "0" },
  { code: "+84", country: "Vietnam", iso: "VN", trunk: "0" },
];

/** E.164: a leading `+`, a non-zero country digit, then 7–15 digits total. */
const E164 = /^\+[1-9]\d{6,14}$/;

/** Strips everything a human might type that is not part of the number. */
function stripFormatting(value: string): string {
  return value.replace(/[\s().\-‐-―]/g, "");
}

/**
 * Normalises a typed number to E.164, or returns null when it cannot be.
 *
 * `defaultDialCode` is applied when the input carries no country code of its
 * own, which is what makes "01712345678" and "+8801712345678" the same number
 * for a Bangladesh install and "015112345678" the right one for a German one.
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultDialCode = "+880",
): string | null {
  if (!input) return null;

  let value = stripFormatting(String(input));
  if (!value) return null;

  // `00` is the international prefix in most of the world; `011` in NANP.
  if (value.startsWith("00")) value = `+${value.slice(2)}`;

  if (value.startsWith("+")) {
    return E164.test(value) ? value : null;
  }

  const dial = stripFormatting(defaultDialCode || "+880");
  const dialDigits = dial.replace(/^\+/, "");

  if (!/^\d{1,4}$/.test(dialDigits)) return null;

  // Already carries the country code without a `+`, e.g. "8801712345678".
  if (value.startsWith(dialDigits) && value.length > dialDigits.length + 5) {
    const candidate = `+${value}`;
    if (E164.test(candidate)) return candidate;
  }

  const trunk = DIAL_CODES.find((entry) => entry.code === `+${dialDigits}`)?.trunk;

  // A national trunk prefix is dropped, not kept: "+880" + "01712345678" would
  // otherwise produce a number one digit too long that dials nowhere.
  const national = trunk && value.startsWith(trunk) ? value.slice(trunk.length) : value;

  const candidate = `+${dialDigits}${national}`;

  return E164.test(candidate) ? candidate : null;
}

/** True when the value is a usable phone number in any country. */
export function isValidPhone(input: string | null | undefined, defaultDialCode = "+880"): boolean {
  return normalizePhone(input, defaultDialCode) !== null;
}

/**
 * Digits only, for `wa.me/<number>` links — which reject a leading `+` and every
 * separator.
 */
export function toWhatsAppNumber(
  input: string | null | undefined,
  defaultDialCode = "+880",
): string {
  const normalized = normalizePhone(input, defaultDialCode);
  return normalized ? normalized.slice(1) : "";
}

/**
 * Splits a stored E.164 number back into a dial code and the national part, so
 * an edit form can pre-select the right country instead of showing one long
 * string the user has to re-parse.
 */
export function splitPhone(input: string | null | undefined): {
  dialCode: string;
  national: string;
} {
  const value = String(input ?? "").trim();

  if (!value.startsWith("+")) return { dialCode: "", national: stripFormatting(value) };

  const match = [...DIAL_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((entry) => value.startsWith(entry.code));

  if (!match) return { dialCode: "", national: value };

  return { dialCode: match.code, national: value.slice(match.code.length) };
}
