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
import { Callout, Chip, Dial, GuessBox, NoteBox, Panel, Quiz, Tile, Toggle } from "@/components/kit";
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
        content: "改名额、重抽签、点学生换组、开关不依从与缺考，亲手看随机分组怎么造出可信的对照组。",
      },
      { property: "og:title", content: "青藤抽签 · 随机分组" },
      { property: "og:description", content: "按成绩录取的期末差有多脏？公开抽签之后又剩下什么？" },
    ],
  }),
  component: RctLesson,
});

const STEPS: Step[] = [
  { id: "rct-1", title: "了解情况" },
  { id: "rct-2", title: "选择偏差" },
  { id: "rct-3", title: "公开抽签" },
  { id: "rct-4", title: "潜在结果" },
  { id: "rct-5", title: "算出效应" },
  { id: "rct-6", title: "小结" },
];

type Mode = "抽签" | "按成绩";

function RctLesson() {
  const { visit, track, profile, setNote } = useApp();
  const [step, setStep] = useState(0);

  const [mode, setMode] = useState<Mode>("按成绩");
  const [seats, setSeats] = useState(80);
  const [seed, setSeed] = useState(1);
  const [swaps, setSwaps] = useState<Record<number, boolean>>({});
  const [spill, setSpill] = useState(0);
  const [noncompliance, setNoncompliance] = useState(false);
  const [attrition, setAttrition] = useState(false);
  const [show, setShow] = useState<"观测" | "两格">("观测");
  const [opened, setOpened] = useState<number[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);


  const students = useMemo(() => makeStudents(), []);

  const assigned = useMemo(() => {
    const rand = rng(1000 + seed * 7919);
    const withRank = students.map((s) => ({ s, r: mode === "抽签" ? rand() : s.eliteRank / students.length }));
    withRank.sort((a, b) => a.r - b.r);
    const set = new Set(withRank.slice(0, seats).map((x) => x.s.id));
    return students.map((s) => ({
      s,
      treated: swaps[s.id] ?? set.has(s.id),
    }));
  }, [students, mode, seats, seed, swaps]);

  const rows = useMemo(() => {
    const rand = rng(4242 + seed);
    return assigned.map(({ s, treated }) => {
      const complied = treated ? !(noncompliance && rand() < 0.18) : false;
      const spillGain = !treated ? spill * 7.4 : 0;
      const y = complied ? s.y1 : s.y0 + spillGain;
      const missing = attrition && !treated && s.ability < 44 && rand() < 0.65;
      return { s, treated, complied, y, missing };
    });
  }, [assigned, noncompliance, attrition, spill, seed]);

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

  useEffect(() => {
    visit(STEPS[step]?.id ?? STEPS[0]!.id, 12);
  }, [step, visit]);

  const hints: string[] = [];
  if (step === 1 && mode === "按成绩")
    hints.push("按成绩录取时，两组在抽签之前的入学前成绩就差了 " + fmt(covar.入学前成绩.diff) + " 分，期末差里混着这一截。");
  if (step === 1 && mode === "抽签") hints.push("换成公开抽签后，入学前成绩的差应该缩到接近 0，再看期末差。");
  if (step === 2 && !balanced) hints.push("三个差里有明显偏的，按「再抽一次」换个签，或看看你手动换组换掉了谁。");
  if (step === 2 && balanced) hints.push("三个差都不大，说明抽签没有系统性把某一类人抽进班；这不代表期末差就是政策效果的证明，但对照可用。");
  if (step === 2 && Object.keys(swaps).length > 0)
    hints.push(`你手动改了 ${Object.keys(swaps).length} 名学生的分组，随机性已经被你破坏了一部分。`);
  if (step === 3 && spill > 0) hints.push("溢出打开后对照组也沾到好处，两组之差会被压小，估计偏低。");
  if (step === 4 && noncompliance) hints.push("有人抽中不去，按分组算出来的是意向处理效应，不是真正上课的效果。");
  if (step === 4 && attrition) hints.push("缺考只发生在对照组的低能力学生身上，对照被拧高了，估计会偏小。");
  if (est.coversZero) hints.push("置信区间盖住 0，现在这组数字说不出有效果。");

  useCompanionSnapshot({
    lesson: "青藤抽签（随机分组）",
    page: STEPS[step]?.title ?? "",
    facts: {
      录取办法: mode === "抽签" ? "公开抽签" : "按入学前成绩录取",
      实验班名额: seats,
      抽签第几次: seed,
      手动换组人数: Object.keys(swaps).length,
      溢出强度: `${Math.round(spill * 100)}%`,
      不依从: noncompliance ? "开" : "关",
      缺考: attrition ? "开" : "关",
      "学习能力差（实验班−对照）": fmt(covar.能力.diff),
      "家庭收入差（万元/年）": fmt(covar.收入.diff),
      入学前成绩差: fmt(covar.入学前成绩.diff),
      期末科学测验差: step === 4 && !revealed ? "学生还没猜，界面未显示" : fmt(est.diff),
      "95%置信区间": step === 4 && !revealed ? "学生还没猜，界面未显示" : `${fmt(est.lo)} 到 ${fmt(est.hi)}`,
      实验班人数: T.length,
      对照人数: C.length,
    },
    hints: hints.length ? hints : ["控件都会改数字，试着先动名额和抽签。"],
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
          <Panel title="两种录取办法，切换看两组在抽签之前差多少">
            <div className="flex gap-2">
              {(["按成绩", "抽签"] as Mode[]).map((m) => (
                <Chip
                  key={m}
                  active={mode === m}
                  onClick={() => {
                    setMode(m);
                    setSwaps({});
                    track("选择偏差", "录取办法", m === "抽签" ? "公开抽签" : "按入学前成绩录取");
                  }}
                >
                  {m === "抽签" ? "公开抽签" : "按入学前成绩录取"}
                </Chip>
              ))}
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
                : "公开抽签后抽签前的差回到 0 附近，期末差才接近实验班本身的作用。"}
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
                  track("公开抽签", "实验班名额", v);
                }}
                hint="名额越少，两组人数越不平衡，置信区间越宽。"
              />
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("抽签");
                    setSeed((s) => s + 1);
                    setSwaps({});
                    track("公开抽签", "再抽一次", `第 ${seed + 1} 次`);
                  }}
                  className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  再抽一次（第 {seed} 次）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwaps({});
                    track("公开抽签", "撤销手动换组", "全部撤销");
                  }}
                  className="rounded-md border border-border px-3 py-2 text-xs"
                >
                  撤销手动换组
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
          <Panel title="点学生换组" hint="点一行就把这名学生挪到另一组，看三个差怎么被你带偏。">
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">学生</th>
                    <th className="px-2 py-2 text-right">学习能力</th>
                    <th className="px-2 py-2 text-right">家庭收入</th>
                    <th className="px-2 py-2 text-right">入学前成绩</th>
                    <th className="px-2 py-2 text-right">分组</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 40).map((r) => (
                    <tr
                      key={r.s.id}
                      onClick={() => {
                        setSwaps((p) => ({ ...p, [r.s.id]: !r.treated }));
                        track("公开抽签", "点学生换组", `${r.s.name} → ${!r.treated ? "实验班" : "对照"}`);
                      }}
                      className="cursor-pointer border-t border-border hover:bg-accent"
                    >
                      <td className="px-2 py-1.5">{r.s.name}</td>
                      <td className="num px-2 py-1.5 text-right">{fmt(r.s.ability, 1)}</td>
                      <td className="num px-2 py-1.5 text-right">{fmt(r.s.income, 1)}</td>
                      <td className="num px-2 py-1.5 text-right">{fmt(r.s.pre, 1)}</td>
                      <td className={`px-2 py-1.5 text-right ${r.treated ? "text-copper" : "text-muted-foreground"}`}>
                        {r.treated ? "实验班" : "对照"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <Panel title="加两种现实麻烦">
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                label="不依从：抽中的人有些没去上课"
                checked={noncompliance}
                hint="按分组算出来的是意向处理效应。"
                onChange={(v) => {
                  setNoncompliance(v);
                  track("算出效应", "不依从", v ? "开" : "关");
                }}
              />
              <Toggle
                label="缺考：对照组里低能力学生更容易缺考"
                checked={attrition}
                hint="对照被拧高，估计偏小。"
                onChange={(v) => {
                  setAttrition(v);
                  track("算出效应", "缺考", v ? "开" : "关");
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="实验班期末均值" value={mean(T.map((r) => r.y))} tone="copper" />
              <Tile label="对照期末均值" value={mean(C.map((r) => r.y))} tone="teal" />
              <Tile label="差" value={revealed ? est.diff : "先猜一个"} />
              <Tile
                label="置信区间"
                value={revealed ? `${fmt(est.lo)} ~ ${fmt(est.hi)}` : "先猜一个"}
                tone={revealed ? (est.coversZero ? "rose" : "teal") : "copper"}
              />
            </div>
            {!revealed && (
              <p className="mt-2 text-xs text-muted-foreground">差和置信区间要等你在下面猜过一次，才会显示出来。</p>
            )}
          </Panel>
          <GuessBox
            question="先猜：实验班让期末科学测验平均高了多少分？"
            unit="分"
            truth={est.diff}
            tolerance={2.5}
            onResolve={(g, ok) => {
              setRevealed(true);
              track("算出效应", "先猜再对照", `猜 ${fmt(g)}，${ok ? "在容差内" : "偏了"}`);
            }}
          />

          <Panel title="核对清单" hint="全部勾上才算把这个数字交出去。">
            <div className="flex flex-wrap gap-2">
              {["分组是公开抽签", "三个抽签前的差都不大", "溢出已检查", "置信区间没盖住 0", "知道估的是意向处理效应还是上课效果"].map(
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
            question="公开抽签让这个比较可信，靠的是什么？"
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
