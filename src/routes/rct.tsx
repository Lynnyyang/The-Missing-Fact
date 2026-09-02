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
import { Callout, Chip, Dial, NoteBox, Panel, Quiz, Tile, Toggle } from "@/components/kit";
import { AutoReview } from "@/components/AutoReview";
import { makeStudents, type Student } from "@/lib/synth";
import { diffMeans, fmt, mean, rng } from "@/lib/stats";
import { useApp, useCompanionSnapshot } from "@/state/app";

export const Route = createFileRoute("/rct")({
  head: () => ({
    meta: [
      { title: "青藤抽签 · 随机分组｜寻找缺失的事实" },
      {
        name: "description",
        content: "拖招生偏向、改名额、连抽多次、调不依从与缺考比例，亲手看随机抽签怎么造出可信的对照组。",
      },
      { property: "og:title", content: "青藤抽签 · 随机分组" },
      { property: "og:description", content: "按成绩录取的期末差有多脏？随机抽签之后又剩下什么？" },
    ],
  }),
  component: RctLesson,
});

const STEPS: Step[] = [
  { id: "rct-1", title: "了解情况" },
  { id: "rct-2", title: "选择偏差" },
  { id: "rct-3", title: "随机抽签" },
  { id: "rct-4", title: "潜在结果" },
  { id: "rct-5", title: "算出效应" },
  { id: "rct-6", title: "小结" },
];

type Mode = "抽签" | "按成绩";

function RctLesson() {
  const { visit, track, profile, setNote } = useApp();
  const [step, setStep] = useState(0);

  // 0 = 完全随机抽签，1 = 完全按入学前成绩录取
  const [bias, setBias] = useState(1);
  const [seats, setSeats] = useState(80);
  const [seed, setSeed] = useState(1);
  const [spill, setSpill] = useState(0);
  const [noncompliance, setNoncompliance] = useState(false);
  const [noncompRate, setNoncompRate] = useState(0.18);
  const [attrition, setAttrition] = useState(false);
  const [attritionRate, setAttritionRate] = useState(0.65);
  const [show, setShow] = useState<"观测" | "两格">("观测");
  const [opened, setOpened] = useState<number[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [draws, setDraws] = useState<number[]>([]);

  const students = useMemo(() => makeStudents(), []);
  const mode: Mode = bias < 0.15 ? "抽签" : "按成绩";

  const drawSet = useMemo(() => {
    const rand = rng(1000 + seed * 7919);
    const withRank = students.map((s) => ({
      s,
      r: bias * (s.eliteRank / students.length) + (1 - bias) * rand(),
    }));
    withRank.sort((a, b) => a.r - b.r);
    return new Set(withRank.slice(0, seats).map((x) => x.s.id));
  }, [students, bias, seats, seed]);

  const assigned = useMemo(
    () => students.map((s) => ({ s, treated: drawSet.has(s.id) })),
    [students, drawSet],
  );

  const rows = useMemo(() => {
    const rand = rng(4242 + seed);
    return assigned.map(({ s, treated }) => {
      const complied = treated ? !(noncompliance && rand() < noncompRate) : false;
      const spillGain = !treated ? spill * 7.4 : 0;
      const y = complied ? s.y1 : s.y0 + spillGain;
      const missing = attrition && !treated && s.ability < 44 && rand() < attritionRate;
      return { s, treated, complied, y, missing };
    });
  }, [assigned, noncompliance, noncompRate, attrition, attritionRate, spill, seed]);

  const kept = rows.filter((r) => !r.missing);
  const T = kept.filter((r) => r.treated);
  const C = kept.filter((r) => !r.treated);
  const covar = {
    能力: diffMeans(T.map((r) => r.s.ability), C.map((r) => r.s.ability)),
    收入: diffMeans(T.map((r) => r.s.income), C.map((r) => r.s.income)),
    入学前成绩: diffMeans(T.map((r) => r.s.pre), C.map((r) => r.s.pre)),
  };
  const est = diffMeans(T.map((r) => r.y), C.map((r) => r.y));
  const balanced = Math.abs(covar.能力.diff) < 2 && Math.abs(covar.收入.diff) < 1.2 && Math.abs(covar.入学前成绩.diff) < 1.8;

  // 连抽多次：每次记录一次「入学前成绩差」
  const runDraws = (n: number) => {
    const out: number[] = [];
    for (let k = 1; k <= n; k += 1) {
      const rand = rng(90000 + (seed + k) * 6151);
      const withRank = students.map((s) => ({
        s,
        r: bias * (s.eliteRank / students.length) + (1 - bias) * rand(),
      }));
      withRank.sort((a, b) => a.r - b.r);
      const set = new Set(withRank.slice(0, seats).map((x) => x.s.id));
      const t = students.filter((s) => set.has(s.id)).map((s) => s.pre);
      const c = students.filter((s) => !set.has(s.id)).map((s) => s.pre);
      out.push(mean(t) - mean(c));
    }
    setDraws(out);
    track("随机抽签", "连抽多次", `${n} 次，抽签前成绩差平均 ${fmt(mean(out))}`);
  };

  const drawHist = useMemo(() => {
    if (!draws.length) return [] as { name: string; v: number }[];
    const lo = Math.min(-6, Math.floor(Math.min(...draws)));
    const hi = Math.max(6, Math.ceil(Math.max(...draws)));
    const bins = 12;
    const w = (hi - lo) / bins;
    const counts = new Array(bins).fill(0) as number[];
    draws.forEach((d) => {
      const i = Math.min(bins - 1, Math.max(0, Math.floor((d - lo) / w)));
      counts[i] = (counts[i] ?? 0) + 1;
    });
    return counts.map((c, i) => ({ name: fmt(lo + w * i, 1), v: c }));
  }, [draws]);

  useEffect(() => {
    visit(STEPS[step]?.id ?? STEPS[0]!.id, 12);
  }, [step, visit]);

  const hints: string[] = [];
  if (step === 1 && mode === "按成绩")
    hints.push("按成绩录取时，两组在抽签之前的入学前成绩就差了 " + fmt(covar.入学前成绩.diff) + " 分，期末差里混着这一截。");
  if (step === 1 && mode === "抽签") hints.push("换成随机抽签后，入学前成绩的差应该缩到接近 0，再看期末差。");
  if (step === 1 && bias > 0.15 && bias < 0.85) hints.push(`招生偏向拖到 ${Math.round(bias * 100)}%，是半随机半按成绩，偏差也只消掉一半。`);
  if (step === 2 && !balanced) hints.push("三个差里有明显偏的，按「再抽一次」换个签，或看看你手动换组换掉了谁。");
  if (step === 2 && balanced) hints.push("三个差都不大，说明抽签没有系统性把某一类人抽进班；这不代表期末差就是政策效果的证明，但对照可用。");
  if (step === 2 && draws.length) hints.push(`你连抽了 ${draws.length} 次，抽签前成绩差平均 ${fmt(mean(draws))} 分：单次会偏，多次围着 0 转才是随机抽签的意思。`);
  if (step === 3 && spill > 0) hints.push("溢出打开后对照组也沾到好处，两组之差会被压小，估计偏低。");
  if (step === 4 && noncompliance) hints.push(`有 ${Math.round(noncompRate * 100)}% 抽中不去，按分组算出来的是意向处理效应，不是真正上课的效果。`);
  if (step === 4 && attrition) hints.push(`缺考比例 ${Math.round(attritionRate * 100)}%，只发生在对照组的低能力学生身上，对照被拧高了，估计会偏小。`);
  if (est.coversZero) hints.push("置信区间盖住 0，现在这组数字说不出有效果。");

  useCompanionSnapshot({
    lesson: "青藤抽签（随机分组）",
    page: STEPS[step]?.title ?? "",
    facts: {
      录取办法: mode === "抽签" ? "随机抽签" : "按入学前成绩录取",
      "招生偏向（按成绩的比重）": `${Math.round(bias * 100)}%`,
      实验班名额: seats,
      抽签第几次: seed,
      连抽次数: draws.length ? `${draws.length} 次，平均抽签前成绩差 ${fmt(mean(draws))}` : "还没连抽",
      溢出强度: `${Math.round(spill * 100)}%`,
      不依从: noncompliance ? `开，比例 ${Math.round(noncompRate * 100)}%` : "关",
      缺考: attrition ? `开，比例 ${Math.round(attritionRate * 100)}%` : "关",
      "学习能力差（实验班−对照）": fmt(covar.能力.diff),
      "家庭收入差（万元/年）": fmt(covar.收入.diff),
      入学前成绩差: fmt(covar.入学前成绩.diff),
      期末科学测验差: fmt(est.diff),
      "95%置信区间": `${fmt(est.lo)} 到 ${fmt(est.hi)}`,
      实验班人数: T.length,
      对照人数: C.length,
    },
    hints: hints.length ? hints : ["控件都会改数字，试着先拖招生偏向，再连抽几次看差怎么散开。"],
  });

  const covarChart = [
    { name: "学习能力", v: covar.能力.diff },
    { name: "家庭收入", v: covar.收入.diff },
    { name: "入学前成绩", v: covar.入学前成绩.diff },
  ];

  return (
    <LessonShell
      lesson="青藤抽签"
      subtitle="随机分组：让没进班的那些人替处理组说话"
      steps={STEPS}
      step={step}
      onStep={setStep}
    >
      {step === 0 && (
        <>
          <Panel title="情况" hint="实验班学位只够一半申请者。校长想按入学前成绩录取。">
            <p className="text-sm leading-relaxed">
              我们要估的是：<span className="text-copper">进了实验班的这批学生，如果没进，期末科学测验会考多少。</span>
              那个世界不存在，所以要给它找替身。
            </p>
          </Panel>
          <Panel title="勾出这一课真正要回答的问题" hint="可以多选，选错了小果会说。">
            <div className="flex flex-wrap gap-2">
              {[
                "实验班让期末科学测验平均提高了多少分",
                "谁更应该被录取进实验班",
                "如果这批学生没进班，他们会考多少分",
                "入学前成绩高的学生是不是更聪明",
              ].map((q, i) => (
                <Chip
                  key={q}
                  active={questions.includes(q)}
                  tone={i === 1 || i === 3 ? "rose" : "copper"}
                  onClick={() => {
                    setQuestions((p) => (p.includes(q) ? p.filter((x) => x !== q) : [...p, q]));
                    track("了解情况", "研究问题", q);
                  }}
                >
                  {q}
                </Chip>
              ))}
            </div>
            {questions.some((q) => q.includes("更应该") || q.includes("更聪明")) && (
              <div className="mt-3">
                <Callout tone="rose">「谁该被录取」是分配问题，不是效应问题。效应只关心缺失的那一格。</Callout>
              </div>
            )}
          </Panel>
        </>
      )}

      {step === 1 && (
        <>
          <Panel title="录取办法可以连续地调" hint="拖这根杆，从纯随机抽签一路走到纯按成绩录取。">
            <div className="flex gap-2">
              {(["按成绩", "抽签"] as Mode[]).map((m) => (
                <Chip
                  key={m}
                  active={mode === m}
                  onClick={() => {
                    setBias(m === "抽签" ? 0 : 1);
                    track("选择偏差", "录取办法", m === "抽签" ? "随机抽签" : "按入学前成绩录取");
                  }}
                >
                  {m === "抽签" ? "随机抽签" : "按入学前成绩录取"}
                </Chip>
              ))}
            </div>
            <div className="mt-4">
              <Dial
                label="招生偏向：按成绩的比重"
                value={Math.round(bias * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => {
                  setBias(v / 100);
                  track("选择偏差", "招生偏向", `${v}% 按成绩`);
                }}
                hint="0% 是完全摇号，100% 是完全按入学前成绩排队。"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="学习能力差" value={covar.能力.diff} tone={Math.abs(covar.能力.diff) > 2 ? "rose" : "teal"} />
              <Tile label="家庭收入差" value={covar.收入.diff} unit="万元" tone={Math.abs(covar.收入.diff) > 1.2 ? "rose" : "teal"} />
              <Tile
                label="入学前成绩差"
                value={covar.入学前成绩.diff}
                tone={Math.abs(covar.入学前成绩.diff) > 1.8 ? "rose" : "teal"}
              />
              <Tile label="期末测验差" value={est.diff} tone="copper" sub="这就是你会报出去的数字" />
            </div>
            <Callout tone={mode === "按成绩" ? "rose" : "copper"}>
              {mode === "按成绩"
                ? "按成绩录取时，入学前差距在政策发生之前就存在，期末差是脏的。"
                : "随机抽签后抽签前的差回到 0 附近，期末差才接近实验班本身的作用。"}
            </Callout>
          </Panel>
          <Panel title="抽签前的三个差" hint="靠近 0 才说明分组齐整。">
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={covarChart}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
                    formatter={(v: number) => fmt(v)}
                  />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Bar dataKey="v" radius={4}>
                    {covarChart.map((d) => (
                      <Cell key={d.name} fill={Math.abs(d.v) > 1.5 ? "var(--rose)" : "var(--teal)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}

      {step === 2 && (
        <>
          <Panel title="调名额、再抽一次" hint="每次改动三个差都会跟着动。">
            <div className="grid gap-4 sm:grid-cols-2">
              <Dial
                label="实验班名额"
                value={seats}
                min={20}
                max={140}
                unit=" 人"
                onChange={(v) => {
                  setSeats(v);
                  track("随机抽签", "实验班名额", v);
                }}
                hint="名额越少，两组人数越不平衡，置信区间越宽。"
              />
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBias(0);
                    setSeed((s) => s + 1);
                    track("随机抽签", "再抽一次", `第 ${seed + 1} 次`);
                  }}
                  className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  再抽一次（第 {seed} 次）
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Tile label="学习能力差" value={covar.能力.diff} tone={Math.abs(covar.能力.diff) > 2 ? "rose" : "teal"} />
              <Tile label="家庭收入差" value={covar.收入.diff} unit="万元" tone={Math.abs(covar.收入.diff) > 1.2 ? "rose" : "teal"} />
              <Tile
                label="入学前成绩差"
                value={covar.入学前成绩.diff}
                tone={Math.abs(covar.入学前成绩.diff) > 1.8 ? "rose" : "teal"}
              />
            </div>
          </Panel>

          <Panel title="连着抽很多次" hint="一次抽签会偏，很多次抽签的差围着 0 转，这才是随机抽签的承诺。">
            <div className="flex flex-wrap items-center gap-2">
              {[20, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => runDraws(n)}
                  className="rounded-md border border-border px-3 py-2 text-xs hover:border-copper"
                >
                  连抽 {n} 次
                </button>
              ))}
              {draws.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDraws([]);
                    track("随机抽签", "清空连抽结果", "清空");
                  }}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  清空
                </button>
              )}
            </div>
            {draws.length > 0 ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile label="抽签次数" value={draws.length} unit=" 次" />
                  <Tile label="抽签前成绩差的平均" value={mean(draws)} tone="teal" />
                  <Tile label="最偏的一次" value={draws.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0)} tone="rose" />
                  <Tile
                    label="差超过 2 分的次数"
                    value={draws.filter((d) => Math.abs(d) > 2).length}
                    unit=" 次"
                    tone="copper"
                  />
                </div>
                <div className="mt-4 h-52">
                  <ResponsiveContainer>
                    <BarChart data={drawHist}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
                      />
                      <Bar dataKey="v" radius={3} fill="var(--teal)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Callout tone={Math.abs(mean(draws)) < 0.6 ? "copper" : "rose"}>
                  {Math.abs(mean(draws)) < 0.6
                    ? "很多次抽签的抽签前成绩差平均下来贴着 0：单次抽签可以运气不好，但没有系统偏向。"
                    : "平均还明显偏离 0，说明现在的招生偏向不是纯随机，先把上一页的偏向拖到 0。"}
                </Callout>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">按一次上面的按钮，就会把每次抽签的「抽签前成绩差」画成分布。</p>
            )}
          </Panel>
        </>
      )}

      {step === 3 && (
        <>
          <Panel title="同一个人只有一格能被看见">
            <div className="flex flex-wrap gap-2">
              {(["观测", "两格"] as const).map((m) => (
                <Chip
                  key={m}
                  active={show === m}
                  onClick={() => {
                    setShow(m);
                    track("潜在结果", "显示模式", m === "观测" ? "只看观测到的" : "偷看两格");
                  }}
                >
                  {m === "观测" ? "只看观测到的" : "偷看两格（现实里做不到）"}
                </Chip>
              ))}
            </div>
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {rows.slice(0, 12).map((r) => {
                const open = opened.includes(r.s.id) || show === "两格";
                return (
                  <button
                    key={r.s.id}
                    type="button"
                    onClick={() => {
                      setOpened((p) => (p.includes(r.s.id) ? p.filter((x) => x !== r.s.id) : [...p, r.s.id]));
                      track("潜在结果", "点开格子", r.s.name);
                    }}
                    className="panel flex items-center justify-between px-3 py-2 text-xs hover:border-copper"
                  >
                    <span>
                      {r.s.name}
                      <span className={r.treated ? "ml-2 text-copper" : "ml-2 text-muted-foreground"}>
                        {r.treated ? "实验班" : "对照"}
                      </span>
                    </span>
                    <span className="num flex gap-3">
                      <span className={r.treated ? "text-copper" : open ? "text-muted-foreground" : "opacity-30"}>
                        进班 {r.treated || open ? fmt(r.s.y1, 1) : "？"}
                      </span>
                      <span className={!r.treated ? "text-teal" : open ? "text-muted-foreground" : "opacity-30"}>
                        不进班 {!r.treated || open ? fmt(r.s.y0, 1) : "？"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <Callout>
                问号那一格就是缺失的事实。随机分组的作用不是把问号填上，而是让对照组的平均值能替处理组的问号说话。
              </Callout>
            </div>
          </Panel>
          <Panel title="溢出：对照组也沾到好处" hint="拖大它，看两组之差怎么被压小。">
            <Dial
              label="溢出强度"
              value={spill}
              min={0}
              max={0.8}
              step={0.05}
              onChange={(v) => {
                setSpill(v);
                track("潜在结果", "溢出强度", `${Math.round(v * 100)}%`);
              }}
              hint="实验班的讲义传给了对照班同学。"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Tile label="期末测验差" value={est.diff} tone="copper" />
              <Tile label="置信区间" value={`${fmt(est.lo)} ~ ${fmt(est.hi)}`} tone={est.coversZero ? "rose" : "teal"} />
            </div>
          </Panel>
        </>
      )}

      {step === 4 && (
        <>
          <Panel title="先看清这个数字是怎么算出来的" hint="随机分组成立时，这个差才等于政策效应。">
            <div className="rounded-lg border border-border bg-card/60 p-4 text-sm leading-relaxed">
              <p className="num text-copper">效应估计 ＝ 实验班期末均值 − 对照期末均值</p>
              <p className="num mt-2 text-xs text-muted-foreground">
                ＝ {fmt(mean(T.map((r) => r.y)))} − {fmt(mean(C.map((r) => r.y)))} ＝ {fmt(est.diff)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                之所以能用对照组的均值代替实验班「没进班」那一格，靠的是随机抽签让两组在政策发生之前平均意义上没有系统差别。
                置信区间用两组的组内波动和人数算出来，衡量这个差有多不稳。
              </p>
            </div>
          </Panel>

          <Panel title="加两种现实麻烦" hint="打开开关后还能拖比例，看这个差被拉走多少。">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Toggle
                  label="不依从：抽中的人有些没去上课"
                  checked={noncompliance}
                  hint="按分组算出来的是意向处理效应。"
                  onChange={(v) => {
                    setNoncompliance(v);
                    track("算出效应", "不依从", v ? "开" : "关");
                  }}
                />
                {noncompliance && (
                  <Dial
                    label="抽中却没去上课的比例"
                    value={noncompRate}
                    min={0}
                    max={0.6}
                    step={0.02}
                    onChange={(v) => {
                      setNoncompRate(v);
                      track("算出效应", "不依从比例", `${Math.round(v * 100)}%`);
                    }}
                    hint="比例越大，按分组算出来的差越被稀释。"
                  />
                )}
              </div>
              <div className="space-y-3">
                <Toggle
                  label="缺考：对照组里低能力学生更容易缺考"
                  checked={attrition}
                  hint="对照被拧高，估计偏小。"
                  onChange={(v) => {
                    setAttrition(v);
                    track("算出效应", "缺考", v ? "开" : "关");
                  }}
                />
                {attrition && (
                  <Dial
                    label="低能力学生缺考的比例"
                    value={attritionRate}
                    min={0}
                    max={0.95}
                    step={0.05}
                    onChange={(v) => {
                      setAttritionRate(v);
                      track("算出效应", "缺考比例", `${Math.round(v * 100)}%`);
                    }}
                    hint="拖大它，对照组剩下的人越来越强。"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="实验班期末均值" value={mean(T.map((r) => r.y))} tone="copper" />
              <Tile label="对照期末均值" value={mean(C.map((r) => r.y))} tone="teal" />
              <Tile label="差" value={est.diff} />
              <Tile label="置信区间" value={`${fmt(est.lo)} ~ ${fmt(est.hi)}`} tone={est.coversZero ? "rose" : "teal"} />
            </div>
            {(noncompliance || attrition) && (
              <div className="mt-3">
                <Callout tone="rose">
                  打开这两种麻烦之后，上面那个差就不再等于政策效应了。
                  {noncompliance && "抽中却没去上课的人还留在实验班一栏里，算出来的是「被分到实验班」的效应，而不是「真的上了课」的效应。"}
                  {attrition && "对照组里低能力学生缺考被剔除，对照均值被拧高，两组之差不再只反映实验班的作用。"}
                  公式没变，变的是分组之外还有别的东西在影响这个差。
                </Callout>
              </div>
            )}
          </Panel>

          <Panel title="核对清单" hint="全部勾上才算把这个数字交出去。">
            <div className="flex flex-wrap gap-2">
              {["分组是随机抽签", "三个抽签前的差都不大", "溢出已检查", "置信区间没盖住 0", "知道估的是意向处理效应还是上课效果"].map(
                (c) => (
                  <Chip
                    key={c}
                    active={checks.includes(c)}
                    onClick={() => {
                      setChecks((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
                      track("算出效应", "核对清单", c);
                    }}
                  >
                    {c}
                  </Chip>
                ),
              )}
            </div>
          </Panel>
        </>
      )}

      {step === 5 && (
        <>
          <AutoReview />
          <Quiz
            question="随机抽签让这个比较可信，靠的是什么？"
            options={[
              "抽签让两组在抽签之前平均意义上没有系统差别",
              "抽签让每个人的能力都变成一样",
              "抽签保证实验班一定考得更好",
            ]}
            answer={0}
            onAnswer={(ok) => track("小结", "选择题", ok ? "答对" : "答错")}
          />
          <Panel title="用两句话写下你的结论" hint="小果会照着你写的用词点评。">
            <NoteBox value={profile.notes["rct"] ?? ""} onChange={(v) => setNote("rct", v)} />
          </Panel>
          <Callout>
            随机化发生在申请者里，所以这个数字说的是申请实验班的这批人。换一群人、换一所学校，不能直接搬。
          </Callout>
        </>
      )}
    </LessonShell>
  );
}
