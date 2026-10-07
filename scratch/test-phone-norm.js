const assert = require("assert");
const phoneLib = require("../api/_lib/phone-lib");

console.log("Running phone normalization tests...");

const tests = [
  { input: "+998770176699", expected: "+998770176699", eskiz: "998770176699" },
  { input: "998770176699", expected: "+998770176699", eskiz: "998770176699" },
  { input: "+998 77 017 66 99", expected: "+998770176699", eskiz: "998770176699" },
  { input: "998 77 017 66 99", expected: "+998770176699", eskiz: "998770176699" },
  { input: "8 77 017 66 99", expected: "+998770176699", eskiz: "998770176699" },
  { input: "8770176699", expected: "+998770176699", eskiz: "998770176699" },
  { input: "77 017 66 99", expected: "+998770176699", eskiz: "998770176699" },
  { input: "770176699", expected: "+998770176699", eskiz: "998770176699" },
  { input: "  +998 (90) 123-45-67  ", expected: "+998901234567", eskiz: "998901234567" },
  { input: "901234567", expected: "+998901234567", eskiz: "998901234567" },
  { input: "8901234567", expected: "+998901234567", eskiz: "998901234567" },
];

for (const t of tests) {
  const norm = phoneLib.normalizeUzPhone(t.input);
  const eskiz = phoneLib.toEskizPhone(t.input);
  assert.strictEqual(norm, t.expected, `Input: ${t.input} failed canonical test`);
  assert.strictEqual(eskiz, t.eskiz, `Input: ${t.input} failed eskiz test`);
  console.log(`PASS: "${t.input}" => "${norm}" / "${eskiz}"`);
}

// Invalid tests:
const invalid = [
  "123456789", // starts with 1
  "077017669", // starts with 0
  "88888888888888", // length > 12
  "8770176", // length < 9
  "",
  null,
  undefined,
  "abc",
  "+1234567890",
  "998123456789", // starts with 1
];

for (const inv of invalid) {
  const norm = phoneLib.normalizeUzPhone(inv);
  assert.strictEqual(norm, "", `Invalid input: ${inv} should return ""`);
  assert.strictEqual(phoneLib.isValidUzPhone(inv), false, `isValidUzPhone("${inv}") should be false`);
  console.log(`PASS invalid: "${inv}" => ""`);
}

console.log("\nAll phone normalization tests passed successfully!");
