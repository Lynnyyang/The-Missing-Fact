import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LessonShell, type Step } from "@/components/Shell";
import { Callout, Chip, Dial, Panel, Quiz, Tile, Toggle } from "@/components/kit";
import { AutoReview } from "@/components/AutoReview";
import { fmt, mean, rng } from "@/lib/stats";
import { useApp, useCompanionSnapshot } from "@/state/app";

export const Route = createFileRoute("/basics")({
  head: () => ({
    meta: [
      { title: "预备课 · 潜在结果与因果效应｜寻找缺失的事实" },
      {
        name: "description",
        content:
          "翻牌看两个世界、掷硬币分组、拖自选倾向，用互动小游戏先弄懂潜在结果、个体因果效应、平均效应与选择偏差。",
      },
      { property: "og:title", content: "预备课 · 潜在结果与因果效应" },
      {
        property: "og:description",
        content: "一个人只能过一种人生，另一格永远是问号。先玩懂这件事，再进四课案例。",
      },
    ],
  }),
  component: BasicsLesson,
});

const STEPS: Step[] = [
  { id: "basics-1", title: "两个世界" },
  { id: "basics-2", title: "个体效应" },
  { id: "basics-3", title: "缺失的一半" },
  { id: "basics-4", title: "掷硬币分组" },
  { id: "basics-5", title: "自己选就偏了" },
  { id: "basics-6", title: "小结" },
];

type Person = {
  id: number;
  name: string;
  y0: number;
  y1: number;
  effect: number;
};

const NAMES = ["阿安", "小舟", "青禾", "石头", "云溪", "阿柳", "南浔", "松原", "临湖", "景山"];

function makePeople(): Person[] {
  const rand = rng(20260903);
  return NAMES.map((name, i) => {
    const y0 = 48 + Math.round(rand() * 26 + i * 0.6);
    const effect = Math.round((1 + rand() * 13) * 10) / 10;
    return { id: i, name, y0, y1: Math.round((y0 + effect) * 10) / 10, effect };
  });
}

function BasicsLesson() {
  const { visit, track } = useApp();
  const [step, setStep] = useState(0);

  // 第 1 步：翻牌
  const [flipped, setFlipped] = useState<number[]>([]);
  const [godMode, setGodMode] = useState(false);

  // 第 2 步：挑一个人看个体效应
  const [who, setWho] = useState(0);
  const [sorted, setSorted] = useState(false);

  // 第 2 步：为什么不能直接相减
  const [naiveGodMode, setNaiveGodMode] = useState(false);
  const [naiveMode, setNaiveMode] = useState<"random" | "highY0" | "highEffect">("highY0");
  const [naiveSeed, setNaiveSeed] = useState(1);

  // 第 3、4 步
  const [coinSeed, setCoinSeed] = useState(1);
  const [batch, setBatch] = useState<number[]>([]);
  const [bias, setBias] = useState(0);
  const [hideMissing, setHideMissing] = useState(true);


  const people = useMemo(() => makePeople(), []);
  const ate = mean(people.map((p) => p.effect));

  useEffect(() => {
    visit(STEPS[step]!.id, 6);
  }, [step, visit]);

  // 分配：bias = 0 完全掷硬币；bias = 1 完全按「谁受益大谁就报名」
  const assign = (b: number, seed: number) => {
    const rand = rng(7000 + seed * 6151);
    const scored = people.map((p) => ({
      p,
      score: b * (p.effect / 14) + (1 - b) * rand(),
    }));
    scored.sort((a, c) => c.score - a.score);
    const treated = new Set(scored.slice(0, Math.round(people.length / 2)).map((x) => x.p.id));
    return people.map((p) => ({ p, treated: treated.has(p.id) }));
  };

  const coinRows = useMemo(() => assign(0, coinSeed), [people, coinSeed]);
  const biasRows = useMemo(() => assign(bias, 99), [people, bias]);

  const stat = (rows: { p: Person; treated: boolean }[]) => {
    const T = rows.filter((r) => r.treated).map((r) => r.p);
    const C = rows.filter((r) => !r.treated).map((r) => r.p);
    const obsT = mean(T.map((p) => p.y1));
    const obsC = mean(C.map((p) => p.y0));
    const att = mean(T.map((p) => p.effect));
    const selection = mean(T.map((p) => p.y0)) - mean(C.map((p) => p.y0));
    return { T, C, obsT, obsC, obs: obsT - obsC, att, selection };
  };

  const coin = stat(coinRows);
  const biased = stat(biasRows);

  const naiveRows = useMemo(() => {
    if (naiveMode === "random") {
      const rand = rng(8000 + naiveSeed * 3333);
      const scored = people.map((p) => ({ p, score: rand() }));
      scored.sort((a, b) => b.score - a.score);
      const treated = new Set(scored.slice(0, Math.round(people.length / 2)).map((x) => x.p.id));
      return people.map((p) => ({ p, treated: treated.has(p.id) }));
    }
    if (naiveMode === "highY0") {
      const sorted = [...people].sort((a, b) => b.y0 - a.y0);
      const treated = new Set(sorted.slice(0, Math.round(people.length / 2)).map((p) => p.id));
      return people.map((p) => ({ p, treated: treated.has(p.id) }));
    }
    const sorted = [...people].sort((a, b) => b.effect - a.effect);
    const treated = new Set(sorted.slice(0, Math.round(people.length / 2)).map((p) => p.id));
    return people.map((p) => ({ p, treated: treated.has(p.id) }));
  }, [people, naiveMode, naiveSeed]);
  const naiveStat = useMemo(() => stat(naiveRows), [naiveRows]);

  const effectBars = useMemo(() => {

    const list = people.map((p) => ({ name: p.name, v: p.effect, id: p.id }));
    return sorted ? [...list].sort((a, b) => b.v - a.v) : list;
  }, [people, sorted]);

  const batchHist = useMemo(() => {
    if (!batch.length) return [] as { name: string; v: number }[];
    const lo = Math.min(...batch, ate - 6);
    const hi = Math.max(...batch, ate + 6);
    const bins = 12;
    const w = (hi - lo) / bins;
    const out = Array.from({ length: bins }, (_, i) => ({
      name: fmt(lo + w * (i + 0.5), 1),
      v: 0,
    }));
    batch.forEach((d) => {
      const k = Math.min(bins - 1, Math.max(0, Math.floor((d - lo) / w)));
      out[k]!.v += 1;
    });
    return out;
  }, [batch, ate]);

  const p = people[who]!;
  const flipCount = flipped.length;

  const facts: Record<string, string | number> = {
    当前步骤: STEPS[step]!.title,
    人数: people.length,
    已翻开的人: flipCount,
    "上帝视角（现实里看不到）": godMode ? "打开" : "关闭",
  };
  if (step === 1) {
    facts["选中的人"] = p.name;
    facts["参加提升营的期末成绩 Y(1)"] = p.y1;
    facts["没参加提升营的期末成绩 Y(0)"] = p.y0;
    facts["提升营让他多考几分（个体效应）"] = fmt(p.effect);
    facts["全体平均效应 ATE"] = fmt(ate);
  }
  if (step === 2) {
    facts["分组方式"] =
      naiveMode === "random" ? "随机分组" : naiveMode === "highY0" ? "成绩好的优先参加" : "觉得自己进步大的优先";
    facts["上帝视角"] = naiveGodMode ? "打开" : "关闭";
    facts["参加营者观测均值"] = fmt(naiveStat.obsT);
    facts["没参加营者观测均值"] = fmt(naiveStat.obsC);
    facts["观测到的均值差"] = fmt(naiveStat.obs);
    facts["参加营者若没参加的均值"] = naiveGodMode ? fmt(naiveStat.obsC + naiveStat.selection) : "？";
    facts["选择偏差"] = naiveGodMode ? fmt(naiveStat.selection) : "？";
    facts["全体平均效应 ATE"] = fmt(ate);
  }
  if (step === 3) {

    facts["第几次掷硬币"] = coinSeed;
    facts["参加营组观测均值"] = fmt(coin.obsT);
    facts["没参加营组观测均值"] = fmt(coin.obsC);
    facts["观测到的均值差"] = fmt(coin.obs);
    facts["全体平均效应 ATE"] = fmt(ate);
    facts["选择偏差"] = fmt(coin.selection);
    if (batch.length) facts["连掷多次的平均"] = fmt(mean(batch));
  }
  if (step === 4) {
    facts["自选倾向"] = fmt(bias);
    facts["观测到的均值差"] = fmt(biased.obs);
    facts["参加营者的平均效应 ATT"] = fmt(biased.att);
    facts["选择偏差"] = fmt(biased.selection);
    facts["缺失的一半是否隐藏"] = hideMissing ? "隐藏" : "显示";
  }

  useCompanionSnapshot({
    lesson: "预备课：潜在结果与因果效应",
    page: STEPS[step]!.title,
    facts,
    hints:
      step === 0
        ? ["每张牌背后有两格期末成绩：参加提升营的 Y(1) 与没参加提升营的 Y(0)。"]
        : step === 1
          ? ["提升营让这个人多考的分数＝Y(1) − Y(0)，现实里永远只观测到其中一格。"]
          : step === 2
            ? naiveGodMode
              ? [
                  `观测差 ${fmt(naiveStat.obs)} 分＝真实效应 ATT ${fmt(naiveStat.att)} 分＋选择偏差 ${fmt(naiveStat.selection)} 分。`,
                ]
              : ["打开上帝视角，看看参加营的人如果没来，平均分是不是也比没参加的人高。"]
            : step === 3

            ? Math.abs(coin.selection) > 3
              ? ["这一次掷硬币两组底子差得有点多，再掷一次或连掷多次看看。"]
              : ["掷硬币让选择偏差围着 0 抖，所以观测差才近似 ATE。"]
            : step === 4
              ? bias > 0.4
                ? ["自选倾向调高后，观测差里混进了选择偏差，不再是纯效应。"]
                : ["把自选倾向往右拖，看观测差怎么离开 ATT。"]
              : ["把三个词说清楚：潜在结果、个体效应、选择偏差。"],
  });

  return (
    <LessonShell
      lesson="预备课：两个世界"
      subtitle="先玩懂潜在结果、因果效应和缺失的那一半，再进四课案例"
      steps={STEPS}
      step={step}
      onStep={setStep}
    >
      {step === 0 && (
        <>
          <Panel title="情景：暑期数学提升营">
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                10 名初一学生刚结束学期。学校开设了一个<strong>暑期数学提升营</strong>，为期 4 周。
                我们想知道：参加这个营，会让期末数学测验成绩提高多少分？
              </p>
              <p>对每个学生，其实都有两个可能的期末成绩：</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <strong className="text-teal">Y(1)</strong>：参加提升营后的期末成绩
                </li>
                <li>
                  <strong className="text-muted-foreground">Y(0)</strong>：没参加提升营的期末成绩
                </li>
              </ul>
              <p>
                现实里，每个学生只能走其中一条路。另一格成绩永远不会被观测到——这就是因果推断里著名的
                <strong>缺失的反事实</strong>。
              </p>
            </div>
          </Panel>

          <Panel
            title="翻牌看两格期末成绩"
            hint="点一张牌翻开：左边是他参加提升营后的期末成绩 Y(1)，右边是他没参加提升营的期末成绩 Y(0)。教学数据里两格都写好了，现实里只有一格会发生。"
            right={
              <Chip
                onClick={() => {
                  setFlipped(flipped.length === people.length ? [] : people.map((x) => x.id));
                  track("两个世界", "全部翻开/收起", flipped.length === people.length ? "收起" : "全部翻开");
                }}
              >
                {flipped.length === people.length ? "全部收起" : "全部翻开"}
              </Chip>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {people.map((q) => {
                const open = flipped.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setFlipped((f) => (f.includes(q.id) ? f.filter((x) => x !== q.id) : [...f, q.id]));
                      track("两个世界", "翻牌", `${q.name} ${open ? "收起" : "翻开"}`);
                    }}
                    className={
                      open
                        ? "rounded-xl border border-copper bg-copper/10 p-2 text-left"
                        : "rounded-xl border border-border p-2 text-left hover:border-copper/60"
                    }
                  >
                    <div className="text-xs font-medium">{q.name}</div>
                    {open ? (
                      <div className="num mt-1 space-y-0.5 text-[11px]">
                        <div className="text-teal">参加营 {fmt(q.y1, 1)}</div>
                        <div className="text-muted-foreground">不参加营 {fmt(q.y0, 1)}</div>
                        <div className="text-copper">提高 {fmt(q.effect, 1)}</div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground">点开看两格</div>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="现实里只有一格会发生">
            <Toggle
              label="上帝视角（现实里看不到）"
              checked={godMode}
              onChange={(v) => {
                setGodMode(v);
                track("两个世界", "上帝视角", v ? "打开" : "关闭");
              }}
              hint="关掉它，翻开的牌只剩下真正发生的那一格，另一格变成问号。"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {people.map((q, i) => {
                const treated = i % 2 === 0;
                return (
                  <div key={q.id} className="rounded-xl border border-border p-2">
                    <div className="text-xs">{q.name}</div>
                    <div className="num mt-1 space-y-0.5 text-[11px]">
                      <div className={treated ? "text-teal" : "text-muted-foreground"}>
                        参加营 {treated || godMode ? fmt(q.y1, 1) : "？"}
                      </div>
                      <div className={!treated ? "text-teal" : "text-muted-foreground"}>
                        不参加营 {!treated || godMode ? fmt(q.y0, 1) : "？"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Callout>
              这就是全部困难所在：<strong>同一个人不能同时参加提升营又不参加提升营</strong>
              。每个问号都是一段没发生的期末成绩，方法课要做的事，就是替这些问号找个合理的替身。
            </Callout>
          </Panel>
        </>
      )}

      {step === 1 && (
        <>
          <Panel title="提升营让他多考几分？" hint="拖滑杆换人，看同一个人两格期末成绩之间的距离。">
            <Dial
              label="看谁"
              value={who}
              min={0}
              max={people.length - 1}
              onChange={(v) => {
                setWho(v);
                track("个体效应", "看谁", people[v]!.name);
              }}
              hint={`当前：${p.name}`}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="参加营的期末成绩 Y(1)" value={p.y1} tone="teal" />
              <Tile label="不参加营的期末成绩 Y(0)" value={p.y0} />
              <Tile label="提升营让他多考几分" value={p.effect} tone="copper" sub="Y(1) − Y(0)" />
              <Tile label="全体平均效应 ATE" value={ate} sub="十个人的效应平均" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              公式只有一行：提升营对{p.name}的效应 ＝ Y(1) − Y(0) ＝ {fmt(p.effect, 1)} 分。它对每个人都不一样，
              全体平均是 {fmt(ate)} 分。
              现实里我们永远只观测到其中一格，所以这一行公式没法直接算 —— 能算的只有平均。
            </p>
          </Panel>

          <Panel
            title="效应人人不同"
            hint="每根柱子是一个人的个体因果效应，虚线是全体平均效应 ATE。"
            right={
              <Chip
                active={sorted}
                onClick={() => {
                  setSorted(!sorted);
                  track("个体效应", "按效应排序", sorted ? "还原" : "从大到小");
                }}
              >
                按效应排序
              </Chip>
            }
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={effectBars}>
                  <CartesianGrid stroke="rgba(235,230,214,0.08)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8d8878" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8d8878" }} />
                  <Tooltip
                    contentStyle={{ background: "#12161c", border: "1px solid rgba(196,122,44,0.4)", fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), "个体效应"]}
                  />
                  <ReferenceLine y={ate} stroke="#c47a2c" strokeDasharray="4 4" />
                  <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                    {effectBars.map((b) => (
                      <Cell key={b.id} fill={b.id === p.id ? "#c47a2c" : "rgba(94,168,160,0.6)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Callout>
              效应有高有低，所以「这个政策有多大用」这句话必须说清是对<strong>谁</strong>
              的平均：全体的平均叫 ATE，只算参加者的平均叫 ATT。
            </Callout>
          </Panel>
        </>
      )}

      {step === 2 && (
        <>
          <Panel title="能拿到的数据长什么样" hint="现实数据只有一列期末成绩，加一列「参加提升营了没有」。">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1.5">人</th>
                    <th className="py-1.5">参加营了没有</th>
                    <th className="py-1.5">观测到的期末成绩</th>
                    <th className="py-1.5">没发生的那一格</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {people.map((q, i) => {
                    const treated = i % 2 === 0;
                    return (
                      <tr key={q.id} className="border-t border-border/60">
                        <td className="py-1.5 font-sans">{q.name}</td>
                        <td className="py-1.5 font-sans">{treated ? "参加营" : "没参加营"}</td>
                        <td className="py-1.5 text-teal">{fmt(treated ? q.y1 : q.y0, 1)}</td>
                        <td className="py-1.5 text-rose">？</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Callout tone="rose">
              一半的格子永远是问号，这叫<strong>缺失的反事实</strong>
              。所有方法都在做同一件事：拿别人的观测值，替这些问号补一个可信的估计。
            </Callout>
          </Panel>

          <Quiz
            question="为什么不能直接用「参加营者的期末成绩 − 没参加营者的期末成绩」当成提升营的因果效应？"
            options={[
              "因为样本太小，多找些人就准了",
              "因为两组人本来的 Y(0) 可能就不一样，差里混着他们原来的差距",
              "因为成绩测量有误差",
            ]}
            answer={1}
            onAnswer={(ok) => track("缺失的一半", "小测", ok ? "答对" : "答错")}
          />
        </>
      )}

      {step === 3 && (
        <>
          <Panel
            title="掷硬币决定谁参加营"
            hint="随机分组不会让缺失的格子出现，但它让两组人的底子平均上一样，于是观测差近似 ATE。"
            right={
              <div className="flex gap-2">
                <Chip
                  onClick={() => {
                    setCoinSeed(coinSeed + 1);
                    track("掷硬币分组", "再掷一次", `第 ${coinSeed + 1} 次`);
                  }}
                >
                  再掷一次
                </Chip>
                <Chip
                  onClick={() => {
                    const out: number[] = [];
                    for (let k = 1; k <= 200; k += 1) out.push(stat(assign(0, 500 + k)).obs);
                    setBatch(out);
                    track("掷硬币分组", "连掷 200 次", `平均观测差 ${fmt(mean(out))}`);
                  }}
                >
                  连掷 200 次
                </Chip>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="参加营组观测均值" value={coin.obsT} tone="teal" />
              <Tile label="没参加营组观测均值" value={coin.obsC} />
              <Tile label="观测到的均值差" value={coin.obs} tone="copper" />
              <Tile label="全体平均效应 ATE" value={ate} sub="教学数据里的真值" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {coinRows.map((r) => (
                <div
                  key={r.p.id}
                  className={
                    r.treated
                      ? "rounded-xl border border-teal/50 bg-teal/10 p-2"
                      : "rounded-xl border border-border p-2"
                  }
                >
                  <div className="text-xs">{r.p.name}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    {r.treated ? "参加营" : "没参加营"} {fmt(r.treated ? r.p.y1 : r.p.y0, 1)}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              这一次两组的底子差（选择偏差）是 {fmt(coin.selection)}。它不是 0，但换个随机种子它会换个方向，
              平均下来围着 0 抖 —— 这就是随机分组唯一但关键的好处。
            </p>
          </Panel>

          {batch.length > 0 && (
            <Panel
              title="连掷 200 次的观测差分布"
              hint={`200 次里观测差平均 ${fmt(mean(batch))}，真值 ATE 是 ${fmt(ate)}（铜色虚线）。`}
            >
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={batchHist}>
                    <CartesianGrid stroke="rgba(235,230,214,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8d8878" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#8d8878" }} />
                    <Tooltip
                      contentStyle={{ background: "#12161c", border: "1px solid rgba(196,122,44,0.4)", fontSize: 12 }}
                      formatter={(v: number) => [`${v} 次`, "落在这一格"]}
                    />
                    <Bar dataKey="v" fill="rgba(94,168,160,0.6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Callout>
                单次会偏，<strong>但不会系统性地偏</strong>
                。四课里的青藤抽签就是这一页的完整版本。
              </Callout>
            </Panel>
          )}
        </>
      )}

      {step === 4 && (
        <>
          <Panel
            title="换成自己报名，差就脏了"
            hint="把滑杆往右拖：越靠右，越是「觉得自己受益大的人才报名参营」。"
          >
            <Dial
              label="自选倾向（0＝掷硬币，1＝完全自己挑）"
              value={bias}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => {
                setBias(v);
                track("自己选就偏了", "自选倾向", fmt(v));
              }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="观测到的均值差" value={biased.obs} tone="copper" />
              <Tile label="参加营者的平均效应 ATT" value={biased.att} tone="teal" />
              <Tile label="选择偏差" value={biased.selection} tone="rose" sub="两组本来的底子差" />
              <Tile label="全体平均效应 ATE" value={ate} />
            </div>
            <p className="num mt-3 text-sm">
              观测差 {fmt(biased.obs)} ＝ ATT {fmt(biased.att)} ＋ 选择偏差 {fmt(biased.selection)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              分解式左右两边永远相等。掷硬币时右边第二项被压到 0 附近，观测差才能当效应读；
              一旦谁参加营是自己挑的，观测差里就多了一块跟提升营无关的底子差。
            </p>
          </Panel>

          <Panel title="看看谁被挑进去了">
            <Toggle
              label="隐藏缺失的一半"
              checked={hideMissing}
              onChange={(v) => {
                setHideMissing(v);
                track("自己选就偏了", "隐藏缺失的一半", v ? "隐藏" : "显示");
              }}
              hint="关掉它就能看到两格真值，对照一下自选把哪些人挑走了。"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {biasRows.map((r) => (
                <div
                  key={r.p.id}
                  className={
                    r.treated
                      ? "rounded-xl border border-teal/50 bg-teal/10 p-2"
                      : "rounded-xl border border-border p-2"
                  }
                >
                  <div className="text-xs">{r.p.name}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    {r.treated ? "参加营" : "没参加营"} {fmt(r.treated ? r.p.y1 : r.p.y0, 1)}
                  </div>
                  <div className="num text-[11px]">
                    {hideMissing ? (
                      <span className="text-rose">另一格 ？</span>
                    ) : (
                      <span className="text-copper">效应 {fmt(r.p.effect, 1)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Quiz
            question="自选倾向拖到 1 之后，观测到的均值差更接近哪一个？"
            options={["全体平均效应 ATE", "参加者的平均效应 ATT 加上一块选择偏差", "个体因果效应"]}
            answer={1}
            onAnswer={(ok) => track("自己选就偏了", "小测", ok ? "答对" : "答错")}
          />
        </>
      )}

      {step === 5 && (
        <>
          <Panel title="预备课带走三句话">
            <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                1. 每个人有两格潜在结果 Y(1) 与 Y(0)，<strong className="text-foreground">只有一格会发生</strong>。
              </li>
              <li>
                2. 个体因果效应是 Y(1) − Y(0)，算不出来；能估的是平均 —— 对全体是 ATE，对参加者是 ATT。
              </li>
              <li>
                3. 观测到的均值差 ＝ ATT ＋ 选择偏差。所有方法的功夫，都花在把第二项压到可以忽略。
              </li>
            </ol>
            <Callout>
              接下来四课就是四种压法：<strong>随机抽签</strong>、<strong>用自己的过去</strong>、
              <strong>用平行的对照街区</strong>、<strong>用一篮子城市拼一个替身</strong>。
            </Callout>
          </Panel>
          <AutoReview />
        </>
      )}
    </LessonShell>
  );
}
