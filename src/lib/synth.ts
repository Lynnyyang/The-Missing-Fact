import { normal, rng } from "./stats";

/* ---------------- 第一课：青藤抽签（随机分组） ---------------- */

export type Student = {
  id: number;
  name: string;
  ability: number; // 学习能力（合成）
  income: number; // 家庭收入 万元/年
  pre: number; // 入学前科学测验
  y0: number; // 未进实验班时的期末分
  y1: number; // 进实验班时的期末分
  lotteryRank: number; // 抽签顺序
  eliteRank: number; // 按成绩排序位次
};

const XING = ["林", "陈", "赵", "沈", "许", "周", "叶", "郑", "邓", "何", "苏", "冯"];
const MING = ["晓月", "允", "书白", "南", "青禾", "岸", "望舒", "岐", "宁", "砚", "拾", "岚"];

export function makeStudents(seed = 20240901, n = 160): Student[] {
  const rand = rng(seed);
  const list: Student[] = [];
  for (let i = 0; i < n; i++) {
    const ability = normal(rand, 50, 10);
    const income = Math.max(4, normal(rand, 12 + (ability - 50) * 0.18, 5));
    const pre = 55 + (ability - 50) * 0.7 + normal(rand, 0, 5);
    const y0 = 58 + (ability - 50) * 0.8 + (pre - 55) * 0.2 + normal(rand, 0, 6);
    const y1 = y0 + 7.4 + normal(rand, 0, 2.4);
    list.push({
      id: i,
      name: `${XING[i % XING.length]}${MING[(i * 5) % MING.length]}${i < 12 ? "" : String(i)}`,
      ability,
      income,
      pre,
      y0,
      y1,
      lotteryRank: rand(),
      eliteRank: 0,
    });
  }
  const byPre = [...list].sort((a, b) => b.pre - a.pre);
  byPre.forEach((s, idx) => (s.eliteRank = idx));
  return list;
}

/* ---------------- 第二课：碣石渡免票（事前事后） ---------------- */

export type FerryPoint = {
  t: number; // 距离 2015-01 的月数
  label: string; // 2018-07
  year: number;
  month: number;
  visits: number;
  base: number;
};

export type ShockKey = "typhoon" | "viral" | "fire";

export function makeFerry(opts: { shocks: Record<ShockKey, boolean>; policyMonth: number }): FerryPoint[] {
  const rand = rng(77003);
  const out: FerryPoint[] = [];
  for (let t = 0; t < 84; t++) {
    const year = 2015 + Math.floor(t / 12);
    const month = (t % 12) + 1;
    const season = 380 * Math.sin(((month - 3) / 12) * 2 * Math.PI);
    const festival = month === 9 ? 240 : 0; // 渔获节，每年都有
    let v = 4200 + 9 * t + season + festival + normal(rand, 0, 90);
    if (t >= opts.policyMonth) v += 420;
    if (opts.shocks.typhoon && year === 2018 && month === 9) v -= 900;
    if (opts.shocks.viral && ((year === 2019 && month >= 5 && month <= 8) || (year === 2019 && month === 4))) v += 700;
    if (opts.shocks.fire && year === 2017 && month >= 7 && month <= 9) v -= 620;
    out.push({ t, label: `${year}-${String(month).padStart(2, "0")}`, year, month, visits: Math.round(v), base: 4200 + 9 * t });
  }
  return out;
}

export const POLICY_MONTH = (2018 - 2015) * 12 + 6; // 2018-07 的索引

/* ---------------- 第三课：银线通车（双重差分＋匹配） ---------------- */

export type Block = {
  key: string;
  name: string;
  treated: boolean;
  density: number; // 人/公顷
  distance: number; // 到中心 km
  prePrice: number;
  note?: string;
  trap?: "商务中心" | "机场噪音";
  prices: Record<number, number>;
};

export const DID_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021];
export const OPEN_YEAR = 2018;

export function makeBlocks(): Block[] {
  const rand = rng(51817);
  const spec: Array<Omit<Block, "prices">> = [
    { key: "qk", name: "青枧", treated: true, density: 214, distance: 4.2, prePrice: 3.1 },
    { key: "sh", name: "石桁", treated: true, density: 198, distance: 5.0, prePrice: 2.9 },
    { key: "ly", name: "留邺", treated: true, density: 233, distance: 3.6, prePrice: 3.3 },
    { key: "bt", name: "白塔口", treated: true, density: 187, distance: 5.8, prePrice: 2.7 },
    { key: "hx", name: "河西", treated: false, density: 205, distance: 4.5, prePrice: 3.0 },
    { key: "nw", name: "南屋", treated: false, density: 191, distance: 5.4, prePrice: 2.8 },
    { key: "tq", name: "桐渠", treated: false, density: 224, distance: 3.9, prePrice: 3.2 },
    { key: "cl", name: "长垒", treated: false, density: 179, distance: 6.1, prePrice: 2.6 },
    { key: "jm", name: "金贸", treated: false, density: 268, distance: 1.4, prePrice: 4.6, trap: "商务中心", note: "总部搬迁潮，通车前趋势就更陡" },
    { key: "jc", name: "机场边", treated: false, density: 122, distance: 11.2, prePrice: 1.9, trap: "机场噪音", note: "扩建噪音，通车前趋势往下走" },
  ];
  return spec.map((b) => {
    const prices: Record<number, number> = {};
    const slope = b.trap === "商务中心" ? 0.3 : b.trap === "机场噪音" ? -0.02 : 0.12;
    DID_YEARS.forEach((y, i) => {
      let p = b.prePrice + slope * i + normal(rand, 0, 0.035);
      if (b.treated && y >= OPEN_YEAR) p += 0.38 * Math.min(1, (y - OPEN_YEAR + 1) / 2);
      prices[y] = Math.round(p * 100) / 100;
    });
    return { ...b, prices };
  });
}

/* ---------------- 第四课：岚城煤改气（合成控制） ---------------- */

export type City = {
  key: string;
  name: string;
  alreadyTreated?: boolean;
  note?: string;
  pm: number[];
};

export const SC_YEARS = Array.from({ length: 16 }, (_, i) => 2005 + i);
export const SC_TREAT_YEAR = 2014;

export function makeCities(): City[] {
  const rand = rng(140214);
  const spec = [
    { key: "lan", name: "岚城", level: 86, drift: -1.4, wave: 6 },
    { key: "hy", name: "怀垣", level: 79, drift: -1.1, wave: 5 },
    { key: "ps", name: "浦沙", level: 94, drift: -1.7, wave: 7 },
    { key: "yq", name: "允泉", level: 71, drift: -0.9, wave: 4 },
    { key: "tl", name: "潼乐", level: 102, drift: -2.0, wave: 8 },
    { key: "jz", name: "晋洲", level: 68, drift: -0.6, wave: 3 },
    { key: "bh", name: "北鹤", level: 88, drift: -1.5, wave: 6, alreadyTreated: true, note: "2013 年已做过同类煤改气" },
    { key: "wd", name: "梧甸", level: 75, drift: -1.0, wave: 5, alreadyTreated: true, note: "2015 年起限煤，属被处理城市" },
    { key: "ck", name: "沧口", level: 110, drift: -2.4, wave: 9 },
  ];
  return spec.map((c) => {
    const pm = SC_YEARS.map((y, i) => {
      let v = c.level + c.drift * i + c.wave * Math.sin(i / 2.1) + normal(rand, 0, 1.6);
      if (c.key === "lan" && y >= SC_TREAT_YEAR) v -= 12 * Math.min(1, (y - SC_TREAT_YEAR + 1) / 2);
      if (c.key === "bh" && y >= 2013) v -= 9;
      if (c.key === "wd" && y >= 2015) v -= 7;
      return Math.round(v * 10) / 10;
    });
    return { key: c.key, name: c.name, alreadyTreated: c.alreadyTreated, note: c.note, pm };
  });
}
