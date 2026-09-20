/**
 * Canonical Uzbekistan phone normalization & validation library.
 * Standardizes all valid Uzbekistan formats to E.164 (+998XXXXXXXXX).
 */

/**
 * Normalizes an Uzbekistan phone number to canonical E.164: "+998XXXXXXXXX".
 * Validates length and operator/area code starting digit [2-9].
 * Returns empty string "" if the input is invalid.
 *
 * Supported valid formats:
 * - +998770176699
 * - 998770176699
 * - +998 77 017 66 99
 * - 998 77 017 66 99
 * - 8 77 017 66 99
 * - 8770176699
 * - 77 017 66 99
 */
function normalizeUzPhone(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  let local = "";

  if (digits.length === 12 && digits.startsWith("998")) {
    local = digits.slice(3);
  } else if (digits.length === 10 && digits.startsWith("8")) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return "";
  }

  // Operator / area code in Uzbekistan: exactly 9 digits, starting with [2-9] (never 0 or 1)
  if (!/^[2-9]\d{8}$/.test(local)) {
    return "";
  }

  return "+998" + local;
}

/**
 * Returns raw 12 digits ("998XXXXXXXXX") without "+", needed for Eskiz API and synthetic emails.
 * Returns empty string "" if phone is invalid.
 */
function toEskizPhone(value) {
  const canon = normalizeUzPhone(value);
  if (!canon) return "";
  return canon.slice(1); // "998XXXXXXXXX"
}

/**
 * Formats canonical or raw phone for friendly display: "+998 (77) 017-66-99"
 */
function formatPhoneDisplay(value) {
  const canon = normalizeUzPhone(value);
  if (!canon) return "";
  const local = canon.slice(4); // 9 digits
  return (
    "+998 (" +
    local.slice(0, 2) +
    ") " +
    local.slice(2, 5) +
    "-" +
    local.slice(5, 7) +
    "-" +
    local.slice(7, 9)
  );
}

/**
 * Returns true if value is a valid Uzbekistan phone number in any supported format.
 */
function isValidUzPhone(value) {
  return normalizeUzPhone(value) !== "";
}

module.exports = {
  normalizeUzPhone: normalizeUzPhone,
  toEskizPhone: toEskizPhone,
  formatPhoneDisplay: formatPhoneDisplay,
  isValidUzPhone: isValidUzPhone,
};
