/**
 * Seven quantitative target-match datasets (56 targets total). Every target
 * equals an entry value (best match = Exact) and each dataset carries at least
 * two entries below the Close band (ratio < 0.9) so distractor checks pass.
 */

import { dataset, type TargetSpec } from "./helpers.mts";
import type { EditorialDataset } from "@/lib/content/types";

type DSConfig = {
  ds: EditorialDataset;
  noun: string;
  unit: string;
  category: string;
  comparison: string;
  sourceTitle: string;
  targets: [string, string][]; // [target id, target value]
};

const configs: DSConfig[] = [
  {
    noun: "mountain",
    unit: "m",
    category: "geography",
    comparison: "All twelve eight-thousanders lie in the Himalaya–Karakoram region; the reference peaks below them show the scale.",
    sourceTitle: "Editorial elevation table compiled from public survey data",
    targets: [
      ["everest", "8849"], ["k2", "8611"], ["kangchenjunga", "8586"], ["lhotse", "8516"],
      ["makalu", "8485"], ["cho-oyu", "8188"], ["dhaulagiri", "8167"], ["manaslu", "8163"],
      ["nanga-parbat", "8126"], ["annapurna", "8091"], ["gasherbrum-i", "8080"], ["broad-peak", "8051"],
    ],
    ds: dataset("mountains-elev", "Mountain summit elevations", "m", [
      ["everest", "Mount Everest", "8849", ["Chomolungma", "Sagarmatha"]],
      ["k2", "K2", "8611", ["Mount Godwin Austen"]],
      ["kangchenjunga", "Kangchenjunga", "8586"],
      ["lhotse", "Lhotse", "8516"],
      ["makalu", "Makalu", "8485"],
      ["cho-oyu", "Cho Oyu", "8188"],
      ["dhaulagiri", "Dhaulagiri I", "8167"],
      ["manaslu", "Manaslu", "8163"],
      ["nanga-parbat", "Nanga Parbat", "8126", ["Diamer"]],
      ["annapurna", "Annapurna I", "8091"],
      ["gasherbrum-i", "Gasherbrum I", "8080", ["Hidden Peak"]],
      ["broad-peak", "Broad Peak", "8051"],
      ["denali", "Denali", "6190", ["Mount McKinley"]],
      ["kilimanjaro", "Mount Kilimanjaro", "5895"],
      ["mont-blanc", "Mont Blanc", "4808", ["Monte Bianco"]],
      ["matterhorn", "Matterhorn", "4478", ["Monte Cervino"]],
    ]),
  },
  {
    noun: "river",
    unit: "km",
    category: "geography",
    comparison: "Lengths follow the usual combined main-stem convention, so paired systems count both branches.",
    sourceTitle: "Editorial river-length table compiled from public reference data",
    targets: [
      ["nile", "6650"], ["amazon", "6400"], ["yangtze", "6300"], ["mississippi-missouri", "6275"],
      ["yenisei", "5539"], ["yellow", "5464"], ["ob-irtysh", "5410"], ["parana", "4880"],
      ["congo", "4700"], ["amur", "4444"], ["lena", "4400"], ["mekong", "4350"],
    ],
    ds: dataset("rivers-length", "River system lengths", "km", [
      ["nile", "Nile", "6650", ["River Nile"]],
      ["amazon", "Amazon", "6400", ["Amazon River"]],
      ["yangtze", "Yangtze", "6300", ["Chang Jiang"]],
      ["mississippi-missouri", "Mississippi–Missouri", "6275", ["Mississippi", "Missouri River"]],
      ["yenisei", "Yenisei", "5539", ["Yenisey"]],
      ["yellow", "Yellow River", "5464", ["Huang He"]],
      ["ob-irtysh", "Ob–Irtysh", "5410", ["Ob", "Irtysh"]],
      ["parana", "Paraná", "4880", ["Parana River"]],
      ["congo", "Congo", "4700", ["Zaire River"]],
      ["amur", "Amur", "4444", ["Amur River"]],
      ["lena", "Lena", "4400", ["Lena River"]],
      ["mekong", "Mekong", "4350", ["Mekong River"]],
      ["volga", "Volga", "3530", ["Volga River"]],
      ["indus", "Indus", "3180", ["Indus River"]],
      ["danube", "Danube", "2860", ["Danube River"]],
      ["ganges", "Ganges", "2525", ["Ganga"]],
    ]),
  },
  {
    noun: "country (by population)",
    unit: "million",
    category: "geography",
    comparison: "Population figures are recent estimates rounded to the nearest million.",
    sourceTitle: "Editorial population table compiled from public demographic estimates",
    targets: [
      ["japan", "124"], ["ethiopia", "127"], ["mexico", "129"], ["nigeria", "229"],
      ["thailand", "72"], ["turkey", "87"], ["vietnam", "100"], ["dr-congo", "106"], ["philippines", "116"],
    ],
    ds: dataset("countries-pop-millions", "Country populations (millions)", "million", [
      ["india", "India", "1451"],
      ["china", "China", "1416"],
      ["united-states", "United States", "342", ["USA", "United States of America"]],
      ["indonesia", "Indonesia", "283"],
      ["pakistan", "Pakistan", "245"],
      ["nigeria", "Nigeria", "229"],
      ["brazil", "Brazil", "217"],
      ["russia", "Russia", "144"],
      ["mexico", "Mexico", "129"],
      ["ethiopia", "Ethiopia", "127"],
      ["japan", "Japan", "124"],
      ["philippines", "Philippines", "116"],
      ["dr-congo", "DR Congo", "106", ["Democratic Republic of the Congo", "Congo-Kinshasa"]],
      ["vietnam", "Vietnam", "100", ["Viet Nam"]],
      ["turkey", "Turkey", "87", ["Türkiye"]],
      ["germany", "Germany", "84"],
      ["thailand", "Thailand", "72"],
      ["united-kingdom", "United Kingdom", "68", ["UK", "Great Britain"]],
      ["france", "France", "66"],
      ["italy", "Italy", "59"],
      ["kenya", "Kenya", "55"],
      ["colombia", "Colombia", "52"],
      ["spain", "Spain", "48"],
      ["argentina", "Argentina", "46"],
    ]),
  },
  {
    noun: "building (by architectural top height)",
    unit: "m",
    category: "engineering",
    comparison: "Heights are architectural tops as tracked by the standard tall-building rankings.",
    sourceTitle: "Editorial tall-building table compiled from public height rankings",
    targets: [
      ["shanghai-tower", "632"], ["makkah-clock", "601"], ["ping-an", "599.1"], ["lotte-world", "554.5"],
      ["one-wtc", "541.3"], ["chow-tai-fook", "530"], ["citic", "527.7"], ["taipei-101", "508"],
    ],
    ds: dataset("tallest-buildings", "Tall-building heights", "m", [
      ["burj-khalifa", "Burj Khalifa", "828", ["Burj Dubai"]],
      ["merdeka-118", "Merdeka 118", "678.9", ["PNB 118"]],
      ["shanghai-tower", "Shanghai Tower", "632"],
      ["makkah-clock", "Makkah Royal Clock Tower", "601", ["Abraj Al-Bait"]],
      ["ping-an", "Ping An Finance Centre", "599.1"],
      ["lotte-world", "Lotte World Tower", "554.5"],
      ["one-wtc", "One World Trade Center", "541.3", ["Freedom Tower"]],
      ["chow-tai-fook", "Chow Tai Fook Finance Centre", "530"],
      ["citic", "CITIC Tower", "527.7", ["China Zun"]],
      ["taipei-101", "Taipei 101", "508"],
      ["willis", "Willis Tower", "442.1", ["Sears Tower"]],
      ["empire-state", "Empire State Building", "381"],
      ["st-mary-axe", "30 St Mary Axe", "180", ["The Gherkin"]],
    ]),
  },
  {
    noun: "metro area (by population)",
    unit: "million",
    category: "geography",
    comparison: "Figures use wider metropolitan-area estimates, not city-proper counts.",
    sourceTitle: "Editorial metro-area table compiled from public demographic estimates",
    targets: [
      ["dhaka", "23.9"], ["sao-paulo", "22.8"], ["mexico-city", "22.5"], ["cairo", "22.2"],
      ["beijing", "21.6"], ["mumbai", "21.3"], ["osaka", "18.9"], ["chongqing", "17.8"],
    ],
    ds: dataset("city-metro-pop", "Metro-area populations (millions)", "million", [
      ["dhaka", "Dhaka", "23.9", ["Dacca"]],
      ["sao-paulo", "São Paulo", "22.8", ["Sao Paulo"]],
      ["mexico-city", "Mexico City", "22.5", ["Ciudad de Mexico", "CDMX"]],
      ["cairo", "Cairo", "22.2"],
      ["beijing", "Beijing", "21.6", ["Peking"]],
      ["mumbai", "Mumbai", "21.3", ["Bombay"]],
      ["osaka", "Osaka", "18.9"],
      ["chongqing", "Chongqing", "17.8", ["Chungking"]],
      ["london", "London", "14.8", ["Greater London"]],
      ["paris", "Paris", "13.2"],
      ["los-angeles", "Los Angeles", "12.5", ["LA", "L.A."]],
      ["kinshasa", "Kinshasa", "16.3"],
    ]),
  },
  {
    noun: "moon (by mean radius)",
    unit: "km",
    category: "space",
    comparison: "Mean radii for major moons of the Solar System.",
    sourceTitle: "Editorial moon-radius table compiled from public planetary data",
    targets: [["ganymede", "2634.1"], ["titan", "2574.7"], ["callisto", "2410.3"]],
    ds: dataset("moons-radius", "Moon mean radii", "km", [
      ["ganymede", "Ganymede", "2634.1"],
      ["titan", "Titan", "2574.7"],
      ["callisto", "Callisto", "2410.3"],
      ["io", "Io", "1821.6"],
      ["moon", "The Moon", "1737.4", ["Luna"]],
      ["europa", "Europa", "1560.8"],
      ["triton", "Triton", "1353.4"],
    ]),
  },
  {
    noun: "US state (by land area)",
    unit: "km²",
    category: "geography",
    comparison: "Land areas in square kilometres, water area excluded.",
    sourceTitle: "Editorial US-state area table compiled from census land-area data",
    targets: [["arizona", "295234"], ["nevada", "286380"], ["colorado", "269601"], ["wyoming", "253335"]],
    ds: dataset("us-states-area", "US state land areas", "km²", [
      ["arizona", "Arizona", "295234"],
      ["nevada", "Nevada", "286380"],
      ["colorado", "Colorado", "269601"],
      ["wyoming", "Wyoming", "253335"],
      ["oregon", "Oregon", "249033"],
      ["kansas", "Kansas", "213106"],
      ["utah", "Utah", "212818"],
      ["minnesota", "Minnesota", "206232"],
      ["florida", "Florida", "170312"],
      ["wisconsin", "Wisconsin", "169640"],
    ]),
  },
];

export const DATASETS: EditorialDataset[] = configs.map((c) => c.ds);

export const TARGETS: TargetSpec[] = configs.flatMap((c) =>
  c.targets.map(([id, target]) => ({
    id,
    category: c.category,
    datasetId: c.ds.id,
    datasetNoun: c.noun,
    unit: c.unit,
    target,
    comparison: c.comparison,
    sourceTitle: c.sourceTitle,
  })),
);
