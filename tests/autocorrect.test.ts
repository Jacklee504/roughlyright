import { describe, it, expect } from "vitest";
import { repairNumberInput, fuzzyEntityMatches, editDistance, fuzzyThreshold } from "@/lib/domain/autocorrect";
import { parseNumber, formatDisplay } from "@/lib/domain/numberParser";

describe("repairNumberInput returns null for input that is already valid", () => {
  it("does not touch valid guesses", () => {
    expect(repairNumberInput("900", "measured", "kg")).toBeNull();
    expect(repairNumberInput("5,000", "count", "loaves")).toBeNull();
    expect(repairNumberInput("1.2k", "measured", "km")).toBeNull();
    expect(repairNumberInput("1 000 000", "count", "people")).toBeNull();
  });
});

describe("repairNumberInput fixes lookalike characters", () => {
  it("repairs letter O and l as 0 and 1", () => {
    expect(repairNumberInput("9oo", "measured", "kg")?.canonical).toBe("900");
    expect(repairNumberInput("8O0", "count", "cars")?.canonical).toBe("800");
    expect(repairNumberInput("l200", "measured", "m")?.canonical).toBe("1200");
  });

  it("repairs exotic digit systems", () => {
    expect(repairNumberInput("٩٠٠", "measured", "kg")?.canonical).toBe("900"); // Arabic-Indic 900
    expect(repairNumberInput("８００", "count", "cars")?.canonical).toBe("800"); // full-width
  });
});

describe("repairNumberInput strips decoration around the number", () => {
  it("removes currency symbols", () => {
    expect(repairNumberInput("$1,200", "measured", "m")?.canonical).toBe("1200");
    expect(repairNumberInput("€ 2.5 million", "measured", "cars")?.canonical).toBe("2500000");
  });

  it("removes approx markers and wrapping words", () => {
    expect(repairNumberInput("about 900", "measured", "kg")?.canonical).toBe("900");
    expect(repairNumberInput("~2 million", "count", "people")?.canonical).toBe("2000000");
    expect(repairNumberInput("roughly 45,000", "count", "seats")?.canonical).toBe("45000");
  });

  it("removes appended units the player typed by mistake", () => {
    expect(repairNumberInput("900kg", "measured", "kg")?.canonical).toBe("900");
    expect(repairNumberInput("900 kg", "measured", "kg")?.canonical).toBe("900");
  });

  it("strips a leading minus but never invents a negative", () => {
    const r = repairNumberInput("-900", "measured", "kg");
    expect(r?.canonical).toBe("900");
  });
});

describe("repairNumberInput repairs broken grouping", () => {
  it("collapses European grouped dots", () => {
    expect(repairNumberInput("1.234.567", "count", "people")?.canonical).toBe("1234567");
  });

  it("removes non-standard comma grouping", () => {
    expect(repairNumberInput("3,50,000", "count", "people")?.canonical).toBe("350000"); // Indian style
    expect(repairNumberInput("5,00000", "count", "people")?.canonical).toBe("500000");
  });

  it("repairs space and apostrophe separators", () => {
    expect(repairNumberInput("9 00", "measured", "kg")?.canonical).toBe("900");
    expect(repairNumberInput("1'000", "count", "cars")?.canonical).toBe("1000");
  });

  it("collapses doubled decimal points", () => {
    expect(repairNumberInput("5..0", "measured", "kg")?.canonical).toBe("5");
  });

  it("resolves the decimal-comma ambiguity per mode", () => {
    // Count mode: "5,00" must be whole → thousands reading 500.
    expect(repairNumberInput("5,00", "count", "loaves")?.canonical).toBe("500");
    // Measured mode: European decimal comma reading wins → 5.
    expect(repairNumberInput("5,00", "measured", "kg")?.canonical).toBe("5");
    expect(repairNumberInput("1,5", "measured", "km")?.canonical).toBe("1.5");
  });

  it("leaves genuinely unrecognisable input uncorrected", () => {
    expect(repairNumberInput("hello world", "measured", "kg")).toBeNull();
    expect(repairNumberInput("", "measured", "kg")).toBeNull();
  });

  it("every repair actually parses with the official parser", () => {
    const samples: [string, Parameters<typeof parseNumber>[1], string][] = [
      ["9oo", "measured", "kg"],
      ["$1,200", "measured", "m"],
      ["~2 million", "count", "people"],
      ["1.234.567", "count", "people"],
      ["5,00", "count", "loaves"],
      ["900kg", "measured", "kg"],
    ];
    for (const [raw, mode, unit] of samples) {
      const r = repairNumberInput(raw, mode, unit);
      expect(r).not.toBeNull();
      const parsed = parseNumber(r!.fixed, mode, unit);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.canonical).toBe(r!.canonical);
    }
  });
});

describe("fuzzyEntityMatches", () => {
  const entries = [
    "Harbor Lights",
    "The Long Crossing",
    "Paper Mountains",
    "Silver Harbour",
    "Harbor Night",
  ].map((label) => ({ display: label, entryKey: label }));

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  it("suggests close typos, best distance first", () => {
    const hits = fuzzyEntityMatches("harbr lights", entries, norm);
    expect(hits[0].candidate.display).toBe("Harbor Lights");
    expect(hits[0].distance).toBeLessThanOrEqual(2);
  });

  it("handles missing spaces and doubled letters", () => {
    expect(fuzzyEntityMatches("harborlights", entries, norm)[0].candidate.display).toBe("Harbor Lights");
  });

  it("suggests nothing for garbage input", () => {
    expect(fuzzyEntityMatches("zeppelin attack", entries, norm)).toEqual([]);
    expect(fuzzyEntityMatches("ab", entries, norm)).toEqual([]); // too short
  });

  it("distance helpers behave", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
    expect(fuzzyThreshold(4)).toBe(1);
    expect(fuzzyThreshold(10)).toBe(2);
    expect(fuzzyThreshold(20)).toBe(3);
    expect(fuzzyThreshold(2)).toBe(0);
  });

  it("display helper stays consistent with repaired values", () => {
    const r = repairNumberInput("5,00", "count", "loaves");
    expect(formatDisplay(r!.canonical)).toBe("500");
  });
});
