type WarmupRound = {
  prompt: string;
  unit: string;
  countMode: boolean;
  hint: string;
  answer: number;
  work: string;
};

type Sample = (choices: number[]) => number;
const scenarios: Array<(sample: Sample) => WarmupRound> = [
  (sample) => {
    const hours = sample([2, 3, 4, 5]);
    const interval = sample([6, 8, 12, 15]);
    return {
      prompt: `A time-lapse camera takes a photo every ${interval} seconds for ${hours} hours. How many photos will it take?`,
      unit: "photos",
      countMode: true,
      hint: "Count the seconds first. The first photo is taken after one interval.",
      answer: hours * 3_600 / interval,
      work: `${hours} hours × 3,600 seconds per hour ÷ ${interval} seconds per photo.`,
    };
  },
  (sample) => {
    const guests = sample([180, 240, 320, 460]);
    const serving = sample([150, 200, 250, 300]);
    return {
      prompt: `A café serves ${guests} glasses of lemonade, each holding ${serving} mL. How many litres of lemonade is that?`,
      unit: "L",
      countMode: false,
      hint: "A litre is 1,000 mL.",
      answer: guests * serving / 1_000,
      work: `${guests} glasses × ${serving} mL per glass ÷ 1,000 mL per litre.`,
    };
  },
  (sample) => {
    const lights = sample([12, 18, 24, 36]);
    const watts = sample([5, 8, 10, 15]);
    const hours = sample([4, 5, 6, 8]);
    return {
      prompt: `How many kilowatt-hours does a row of ${lights} lamps use in ${hours} hours if each lamp draws ${watts} W?`,
      unit: "kWh",
      countMode: false,
      hint: "1 kWh is 1,000 watt-hours.",
      answer: lights * watts * hours / 1_000,
      work: `${lights} lamps × ${watts} W × ${hours} hours ÷ 1,000.`,
    };
  },
  (sample) => {
    const trays = sample([4, 6, 8, 9]);
    const days = sample([9, 14, 16, 21]);
    return {
      prompt: `A bakery sells ${trays} trays of 24 buns every morning. How many buns does it sell in ${days} days?`,
      unit: "buns",
      countMode: true,
      hint: "For a ballpark, round 24 buns per tray to 25.",
      answer: trays * 24 * days,
      work: `${trays} trays per day × 24 buns per tray × ${days} days.`,
    };
  },
  (sample) => {
    const speed = sample([18, 24, 30, 36]);
    const minutes = sample([35, 45, 50, 70]);
    return {
      prompt: `A cyclist holds ${speed} km/h for ${minutes} minutes. How many kilometres do they cover?`,
      unit: "km",
      countMode: false,
      hint: "Convert minutes to a fraction of an hour.",
      answer: speed * minutes / 60,
      work: `${speed} km/h × (${minutes} ÷ 60) hours.`,
    };
  },
  (sample) => {
    const bottles = sample([250, 400, 650, 900]);
    const mass = sample([12, 16, 24, 32]);
    return {
      prompt: `An empty bottle weighs ${mass} g. How many kilograms do ${bottles} empty bottles weigh together?`,
      unit: "kg",
      countMode: false,
      hint: "A kilogram is 1,000 grams.",
      answer: bottles * mass / 1_000,
      work: `${bottles} bottles × ${mass} g per bottle ÷ 1,000 g per kilogram.`,
    };
  },
  (sample) => {
    const depth = sample([18, 25, 32, 45]);
    const width = sample([2, 3, 4, 6]);
    const length = sample([5, 8, 10, 12]);
    return {
      prompt: `A tarp ${width} m wide and ${length} m long catches ${depth} mm of rain. How many litres fall on it?`,
      unit: "L",
      countMode: false,
      hint: "One millimetre of rain over a square metre is one litre.",
      answer: width * length * depth,
      work: `${width} m × ${length} m × ${depth} litres per square metre.`,
    };
  },
  (sample) => {
    const rows = sample([7, 9, 12, 14]);
    const spacing = sample([20, 25, 32, 40]);
    const length = sample([4, 8, 12, 16]);
    return {
      prompt: `A garden has ${rows} rows that are each ${length} m long. You allot ${spacing} cm of row per seedling. How many seedlings can you plant?`,
      unit: "seedlings",
      countMode: true,
      hint: "Count how many whole spaces fit in a single row before multiplying by the number of rows.",
      answer: rows * Math.floor(length * 100 / spacing),
      work: `Each row fits ${Math.floor(length * 100 / spacing)} whole spaces after converting metres to centimetres. Multiply by ${rows} rows.`,
    };
  },
  (sample) => {
    const people = sample([28, 42, 65, 84]);
    const weeks = sample([13, 23, 35, 46]);
    return {
      prompt: `If ${people} coworkers each buy one hot drink on every weekday for ${weeks} weeks, how many cups do they go through?`,
      unit: "cups",
      countMode: true,
      hint: "Assume five weekdays per week and ignore holidays.",
      answer: people * weeks * 5,
      work: `${people} cups per weekday × 5 weekdays per week × ${weeks} weeks.`,
    };
  },
  (sample) => {
    const gap = sample([18, 25, 32, 48]);
    const length = sample([90, 110, 160, 180]);
    return {
      prompt: `Street lights mark out sections ${gap} m long along a ${length} km route. How many full sections are there?`,
      unit: "sections",
      countMode: true,
      hint: "Each kilometre is 1,000 metres. Count only full sections.",
      answer: Math.floor(length * 1_000 / gap),
      work: `${length} km × 1,000 ÷ ${gap} m per section, rounded down to the last full section.`,
    };
  },
  (sample) => {
    const hours = sample([8, 12, 15, 18]);
    const cadence = sample([45, 60, 75, 85]);
    return {
      prompt: `A rider pedals for ${hours} hours over a weekend, averaging ${cadence} turns of the pedals per minute. How many turns is that?`,
      unit: "turns",
      countMode: true,
      hint: "How many turns would the rider make in one hour first?",
      answer: hours * 60 * cadence,
      work: `${hours} hours × 60 minutes per hour × ${cadence} turns per minute.`,
    };
  },
  (sample) => {
    const mass = sample([3, 5, 7, 9]);
    const fraction = sample([12, 15, 22, 28]);
    return {
      prompt: `A ${mass} kg bag of trail mix is ${fraction}% raisins by weight. How many grams of raisins are in the bag?`,
      unit: "g",
      countMode: false,
      hint: "10% of each kilogram is 100 g. Use that to get in the ballpark.",
      answer: mass * 10 * fraction,
      work: `${mass} kg × 1,000 g per kilogram × (${fraction} ÷ 100).`,
    };
  },
  (sample) => {
    const hours = sample([1, 2, 3, 5]);
    const flow = sample([14, 18, 21, 24]);
    return {
      prompt: `A hose runs for ${hours} hours at ${flow} litres a minute. How much water comes out, in cubic metres?`,
      unit: "m³",
      countMode: false,
      hint: "A cubic metre of water is 1,000 litres.",
      answer: hours * 60 * flow / 1_000,
      work: `${hours} hours × 60 minutes per hour × ${flow} litres per minute ÷ 1,000.`,
    };
  },
  (sample) => {
    const copies = sample([150, 240, 320, 460]);
    const pages = sample([64, 96, 112, 144]);
    const thickness = sample([8, 10, 12, 14]);
    return {
      prompt: `A print shop makes ${copies} double-sided booklets of ${pages} pages each. If a stack of 100 sheets is ${thickness} mm thick, how tall would all the sheets be stacked together, in metres?`,
      unit: "m",
      countMode: false,
      hint: "Each sheet has two pages, and there are 1,000 mm in a metre.",
      answer: copies * pages * thickness / 200_000,
      work: `${copies} × (${pages} pages ÷ 2) sheets × (${thickness} mm ÷ 100) per sheet ÷ 1,000.`,
    };
  },
];

/** Choose five distinct scenarios and vary the inputs each time. */
export function makeWarmup(previous: number[] = [], random = Math.random): Array<WarmupRound & { scenario: number }> {
  const eligible = scenarios.flatMap((_, index) => previous.includes(index) ? [] : [index]);
  const remaining = eligible.length >= 5 ? eligible : scenarios.map((_, index) => index);
  const sample: Sample = (choices) => choices[Math.floor(random() * choices.length)];
  return Array.from({ length: 5 }, () => {
    const [scenario] = remaining.splice(Math.floor(random() * remaining.length), 1);
    return { ...scenarios[scenario](sample), scenario };
  });
}
