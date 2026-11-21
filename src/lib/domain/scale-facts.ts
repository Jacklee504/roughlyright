export type ScaleFact = {
  id: string;
  category: "Space" | "Earth" | "Life" | "Built world" | "Everyday";
  prompt: string;
  unit: string;
  value: number;
  note: string;
  source: { label: string; url: string };
};

export const CORE_SCALE_FACTS: ScaleFact[] = [
  {
    id: "sun-volume",
    category: "Space",
    prompt: "How many Earths would equal the Sun’s volume?",
    unit: "Earths",
    value: 1_300_000,
    note: "The Sun is about 109 Earths across. To compare volumes, cube that number.",
    source: { label: "NASA", url: "https://ntrs.nasa.gov/api/citations/20160001704/downloads/20160001704.pdf" },
  },
  {
    id: "jupiter-day",
    category: "Space",
    prompt: "How many hours does Jupiter take to spin once?",
    unit: "hours",
    value: 9.9,
    note: "The largest planet has the shortest day in our solar system.",
    source: { label: "NASA", url: "https://science.nasa.gov/jupiter/jupiter-facts/" },
  },
  {
    id: "sunlight-seconds",
    category: "Space",
    prompt: "About how many seconds does sunlight take to reach Earth?",
    unit: "seconds",
    value: 499,
    note: "At a distance of one astronomical unit, the trip takes a little over eight minutes.",
    source: { label: "NASA JPL", url: "https://ssd.jpl.nasa.gov/astro_par.html" },
  },
  {
    id: "challenger-deep",
    category: "Earth",
    prompt: "How far below the sea surface is the deepest known point in the ocean?",
    unit: "m",
    value: 10_935,
    note: "Challenger Deep lies in the Mariana Trench. Its depth is greater than Everest’s height above sea level.",
    source: { label: "NOAA", url: "https://oceanexplorer.noaa.gov/explainers/mapping/" },
  },
  {
    id: "ocean-sound",
    category: "Earth",
    prompt: "How far does sound travel through seawater in a second?",
    unit: "m",
    value: 1_500,
    note: "Temperature and pressure affect the speed. A typical value is more than four times the speed of sound in air.",
    source: { label: "NOAA", url: "https://oceanservice.noaa.gov/facts/sound.html" },
  },
  {
    id: "blue-whale",
    category: "Life",
    prompt: "How long can an Antarctic blue whale grow?",
    unit: "ft",
    value: 110,
    note: "A blue whale in Antarctic waters can stretch about as long as three school buses parked end to end.",
    source: { label: "NOAA Fisheries", url: "https://www.fisheries.noaa.gov/species/blue-whale" },
  },
  {
    id: "hummingbird",
    category: "Life",
    prompt: "How many times per second does a ruby-throated hummingbird beat its wings in straight flight?",
    unit: "wingbeats/sec",
    value: 70,
    note: "During a dive the wingbeat can rise past 200 per second.",
    source: { label: "Smithsonian’s National Zoo", url: "https://nationalzoo.si.edu/migratory-birds/hummingbirds" },
  },
  {
    id: "giraffe-neck",
    category: "Life",
    prompt: "About how long is an adult giraffe’s neck?",
    unit: "cm",
    value: 180,
    note: "A giraffe has seven neck vertebrae, the same count as a person.",
    source: { label: "San Diego Zoo Wildlife Alliance", url: "https://animals.sandiegozoo.org/animals/giraffe" },
  },
  {
    id: "eiffel-rivets",
    category: "Built world",
    prompt: "How many rivets hold together the Eiffel Tower’s metal frame?",
    unit: "rivets",
    value: 2_500_000,
    note: "The tower was assembled from 18,038 metal parts.",
    source: { label: "Eiffel Tower", url: "https://www.toureiffel.paris/en/the-monument/key-figures" },
  },
  {
    id: "golden-gate",
    category: "Built world",
    prompt: "How long is the Golden Gate Bridge, including the approaches?",
    unit: "ft",
    value: 8_981,
    note: "Its main suspension span accounts for 4,200 feet of that length.",
    source: { label: "Golden Gate Bridge District", url: "https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/" },
  },
  {
    id: "gutenberg-bible",
    category: "Everyday",
    prompt: "How many pages are in a complete Gutenberg Bible?",
    unit: "pages",
    value: 1_282,
    note: "Most pages were printed in two columns of 42 lines each.",
    source: { label: "Library of Congress", url: "https://www.loc.gov/exhibits/bibles/interactives/gutenberg/page.html" },
  },
  {
    id: "us-nickel",
    category: "Everyday",
    prompt: "How much does a single United States five-cent coin weigh?",
    unit: "g",
    value: 5,
    note: "Four nickels weigh 20 grams together and are worth twenty cents.",
    source: { label: "U.S. Mint", url: "https://www.usmint.gov/learn/coins-and-medals/circulating-coins/nickel" },
  },
];
