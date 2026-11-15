import { describe, expect, it } from "vitest";
import { parseNumber, formatDisplay } from "@/lib/domain/numberParser";

function ok(s: string, mode: "count" | "measured" = "measured", unit = "kg") {
  const r = parseNumber(s, mode, unit);
  if (!r.ok) throw new Error(`expected "${s}" to parse: ${r.message}`);
  return r;
}
const bad = (s: string, mode: "count" | "measured" = "measured", unit = "kg") => !parseNumber(s, mode, unit).ok;

describe("number parser — valid", () => {
  it("whole numbers and grouping", () => {
    expect(ok("5000").value.d).toBe(1n);
    expect(ok("5,000").canonical).toBe("5000");
    expect(ok("5 000").canonical).toBe("5000");
    expect(ok("1,234,567").canonical).toBe("1234567");
    expect(ok("1 234 567").canonical).toBe("1234567");
  });

  it("decimals", () => {
    expect(ok(".5").canonical).toBe("0.5");
    expect(ok("0.5").canonical).toBe("0.5");
    expect(ok("1.25").canonical).toBe("1.25");
    expect(ok("42.195").canonical).toBe("42.195");
    expect(ok("1,234.5").canonical).toBe("1234.5");
  });

  it("suffixes, case-insensitive", () => {
    expect(ok("1.2k").canonical).toBe("1200");
    expect(ok("1.2K").canonical).toBe("1200");
    expect(ok("2.5k").canonical).toBe("2500");
    expect(ok("3million").canonical).toBe("3000000");
    expect(ok("3 million").canonical).toBe("3000000");
    expect(ok("4b").canonical).toBe("4000000000");
    expect(ok("4Billion").canonical).toBe("4000000000");
    expect(ok("5t").canonical).toBe("5000000000000");
    expect(ok("2 thousand").canonical).toBe("2000");
  });

  it("range boundaries inclusive", () => {
    expect(ok("0.000000001").ok).toBe(true); // 1e-9
    expect(ok("1000000000000000").ok).toBe(true); // 1e15
    expect(bad("0.0000000009")); // 9e-10
    expect(bad("1000000000000001"));
  });

  it("count mode integrality after expansion", () => {
    expect(ok("5k", "count").ok).toBe(true); // 5000 whole
    expect(ok("1.5k", "count").ok).toBe(true); // 1500 whole after expansion
    expect(bad("5.5", "count"));
    expect(ok("0.5k", "count").ok).toBe(true); // 500 — whole after expansion
    expect(bad("1.23", "count"));
  });
});

describe("number parser — rejected", () => {
  it("negative and dashes", () => {
    expect(bad("-5"));
    expect(bad("−5")); // minus sign
    expect(bad("–5")); // en dash used as minus
    expect(bad("—5")); // em dash
  });

  it("zero", () => {
    expect(bad("0"));
    expect(bad("0.0"));
  });

  it("scientific notation and arithmetic", () => {
    expect(bad("1e3"));
    expect(bad("1E3"));
    expect(bad("2+2"));
    expect(bad("5*3"));
  });

  it("appended units", () => {
    expect(bad("900 kg"));
    expect(bad("42.195km"));
    expect(bad("5kg"));
  });

  it("malformed grouping", () => {
    expect(bad("5,00"));
    expect(bad("50,00"));
    expect(bad("5,000,00"));
    expect(bad("5,00.5"));
    expect(bad("5,000 000")); // mixed separators
    expect(bad("5 000,000"));
    expect(bad("1,,2"));
    expect(bad("5."));
  });

  it("decimal-comma ambiguity", () => {
    expect(bad("5,5"));
    expect(bad("1,25"));
  });

  it("junk and empties", () => {
    expect(bad(""));
    expect(bad("   "));
    expect(bad("abc"));
    expect(bad("9 9"));
  });

  it("length cap", () => {
    expect(bad("1".repeat(65)));
    expect(ok("0".repeat(59) + "10000").ok).toBe(true); // 64 chars, value 10,000
  });

  it("precision cap after expansion", () => {
    expect(bad("0.1234567891")); // 10 fractional digits
    expect(ok("0.123456789").ok).toBe(true); // 9 fractional digits
  });
});

describe("display formatting", () => {
  it("groups thousands", () => {
    expect(formatDisplay("5000")).toBe("5,000");
    expect(formatDisplay("3300000")).toBe("3,300,000");
    expect(formatDisplay("35162.5")).toBe("35,162.5");
    expect(formatDisplay("1234567890123456")).toBe("1,234,567,890,123,456");
  });
});
