import { cmp, div, mul, parseDecimalToRat, type Rat } from "./decimal";
import { scoreValue } from "./scoring";

export const LAB_PROGRESS_KEY = "rr_estimation_lab_v1";
export const LAB_MAX_SCORE = 500;

type Factor = {
  label: string;
  question: string;
  unit: string;
  reference: string;
  clue: string;
  divide?: true;
};

export type LabCase = {
  id: string;
  title: string;
  category: string;
  question: string;
  unit: string;
  formula: string;
  coefficient: string;
  factors: readonly [Factor, Factor, Factor];
  context: string;
  sources: readonly { name: string; url: string }[];
};

export const LAB_CASES: readonly LabCase[] = [
  {
    id: "stadium-rain",
    title: "The flooded pitch",
    category: "Sport & weather",
    question: "How many litres of rain hit a full-size football pitch during a storm that drops about an inch of rain?",
    unit: "L",
    formula: "Length × width × rainfall depth. One millimetre over one square metre makes one litre.",
    coefficient: "1",
    factors: [
      { label: "Pitch length", question: "How far is it from goal line to goal line?", unit: "m", reference: "105", clue: "Think about the length of a 100-metre sprint." },
      { label: "Pitch width", question: "How wide is the pitch from touchline to touchline?", unit: "m", reference: "68", clue: "FIFA’s recommended width is about two-thirds of the length." },
      { label: "Rainfall", question: "How many millimetres is about one inch of rainfall?", unit: "mm", reference: "25", clue: "A metric ruler has 10 millimetres in every centimetre. One inch is about two and a half centimetres." },
    ],
    context: "The model uses FIFA’s recommended pitch dimensions and rounds an inch of rainfall to 25 mm. It counts the rain that lands on the pitch, regardless of where it drains.",
    sources: [{ name: "FIFA pitch dimensions", url: "https://inside.fifa.com/innovation/stadium-guidelines/technical-guidelines/stadiums-guidelines/pitch-dimensions-and-surrounding-areas" }],
  },
  {
    id: "moon-road-trip",
    title: "A road trip to the Moon",
    category: "Space & travel",
    question: "Imagine a straight road to the Moon. How many days would the trip take at motorway speed if you drove for one work shift each day?",
    unit: "days",
    formula: "Distance ÷ driving speed ÷ driving hours per day.",
    coefficient: "1",
    factors: [
      { label: "Distance to the Moon", question: "On average, how far is the Moon from Earth?", unit: "km", reference: "384400", clue: "The distance is roughly 30 Earth diameters. Earth is about 13,000 km wide." },
      { label: "Cruising speed", question: "What steady motorway speed will you use for the model?", unit: "km/h", reference: "100", clue: "Think of a speed a little above 60 miles an hour.", divide: true },
      { label: "Hours at the wheel", question: "How many driving hours will you count in one work shift?", unit: "h/day", reference: "8", clue: "Think of a nine-to-five shift, counting the whole shift.", divide: true },
    ],
    context: "NASA gives the average Earth–Moon distance. The imaginary drive uses a steady 100 km/h and eight hours at the wheel each day.",
    sources: [{ name: "NASA Moon facts", url: "https://science.nasa.gov/moon/facts/" }],
  },
  {
    id: "cash-cube",
    title: "A million in cash",
    category: "Money & materials",
    question: "How much space would one million US dollar bills take up if you packed them without gaps?",
    unit: "m³",
    formula: "Length × width × thickness × one million notes, then convert cubic millimetres to cubic metres.",
    coefficient: "0.001",
    factors: [
      { label: "Bill length", question: "How long is a US dollar bill?", unit: "mm", reference: "156", clue: "The long edge is a little over six inches, similar to a large smartphone." },
      { label: "Bill width", question: "How wide is the short edge of the bill?", unit: "mm", reference: "66", clue: "The short edge is just under three inches." },
      { label: "Bill thickness", question: "How thick is a single bill?", unit: "mm", reference: "0.11", clue: "Think of putting around one hundred notes in a stack just over a centimetre thick." },
    ],
    context: "The model rounds the official banknote dimensions to millimetres. Its average thickness comes from the currency issuer’s estimate of more than 14.5 million notes in a mile-high stack.",
    sources: [
      { name: "US Currency Education Program dimensions", url: "https://www.uscurrency.gov/history" },
      { name: "US Currency Education Program stack estimate", url: "https://www.uscurrency.gov/about-us/currency-facts" },
    ],
  },
  {
    id: "marathon-steps",
    title: "A marathon in footsteps",
    category: "Sport & motion",
    question: "How many steps would a recreational runner take to finish a marathon, holding a steady four-hour-ish pace?",
    unit: "steps",
    formula: "Race distance ÷ running speed × 60 minutes per hour × steps per minute.",
    coefficient: "60",
    factors: [
      { label: "Race distance", question: "How long is an official marathon?", unit: "km", reference: "42.195", clue: "Two half marathons of about 21 kilometres make a full marathon." },
      { label: "Running speed", question: "What speed would bring you to the finish in about four hours?", unit: "km/h", reference: "10", clue: "Divide a marathon’s distance by about four. Use a round number for speed.", divide: true },
      { label: "Step rate", question: "What step rate will you use for a steady jog?", unit: "steps/min", reference: "165", clue: "Think two and three-quarter steps every second." },
    ],
    context: "World Athletics fixes the race distance. This model assumes the same speed and cadence for the whole race. Real step counts vary with the runner and course.",
    sources: [{ name: "World Athletics marathon distance", url: "https://worldathletics.org/disciplines/relays/marathon" }],
  },
  {
    id: "library-lights",
    title: "Keep the library lit",
    category: "Energy & everyday life",
    question: "A library has 24 LED reading lamps as bright as old 60-watt bulbs. How much electricity do the lamps use in a year if they run for a work shift every weekday?",
    unit: "kWh",
    formula: "LED watts × hours per day × days per year × 24 lamps ÷ 1,000.",
    coefficient: "0.024",
    factors: [
      { label: "Power per lamp", question: "How many watts does a typical LED replacement for an old 60-watt bulb draw?", unit: "W", reference: "8", clue: "An LED needs around one seventh as much power for the same brightness." },
      { label: "Daily use", question: "How many hours a day are the lamps on?", unit: "h/day", reference: "8", clue: "Use the full time from nine in the morning to five in the afternoon." },
      { label: "Open days", question: "How many weekdays are there in a 52-week year?", unit: "days", reference: "260", clue: "Take five days out of each week. Ignore holidays." },
    ],
    context: "The US Department of Energy puts LED replacements for 60-watt bulbs at roughly 6–10.5 W. This model uses 8 W, eight hours per day and 260 opening days.",
    sources: [{ name: "US Department of Energy lighting guide", url: "https://www.energy.gov/cmei/femp/purchasing-energy-efficient-light-bulbs" }],
  },
];

export function projectLabCase(labCase: LabCase, values: readonly Rat[]): Rat {
  return labCase.factors.reduce((total, factor, index) => {
    const value = values[index]!;
    return factor.divide ? div(total, value) : mul(total, value);
  }, parseDecimalToRat(labCase.coefficient)!);
}

export function evaluateLabCase(labCase: LabCase, guesses: readonly Rat[]) {
  const references = labCase.factors.map(({ reference }) => parseDecimalToRat(reference)!);
  const projected = projectLabCase(labCase, guesses);
  const model = projectLabCase(labCase, references);
  const total = scoreValue(projected, model);
  const factors = references.map((reference, index) => scoreValue(guesses[index]!, reference));
  const weakest = factors.reduce((worst, factor, index) =>
    cmp(factor.errorFactor, factors[worst]!.errorFactor) > 0 ? index : worst, 0);
  const effects = references.map((reference, index) =>
    cmp(guesses[index]!, reference) * (labCase.factors[index]!.divide ? -1 : 1));
  return {
    references, projected, model, factors, total,
    weakest: factors[weakest]!.mark === "Exact" ? null : weakest,
    opposingErrors: effects.includes(-1) && effects.includes(1),
    points: factors.reduce((sum, factor) => sum + factor.points, total.points * 2),
  };
}

export function readLabBests(raw: string | null): Record<string, number> {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (saved && typeof saved === "object") {
      return Object.fromEntries(LAB_CASES.flatMap(({ id }) => {
        const score = saved[id];
        return Number.isInteger(score) && score >= 0 && score <= LAB_MAX_SCORE ? [[id, score]] : [];
      }));
    }
  } catch {
    // A malformed local record starts a new case board.
  }
  return {};
}
