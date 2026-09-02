import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LessonShell, type Step } from "@/components/Shell";
import { Callout, Chip, GuessBox, NoteBox, Panel, Quiz, Tile } from "@/components/kit";
import { AutoReview } from "@/components/AutoReview";
import { DID_YEARS, OPEN_YEAR, makeBlocks } from "@/lib/synth";
import { did, fitLine, fmt, mean } from "@/lib/stats";
import { useApp, useCompanionSnapshot } from "@/state/app";

export const Route = createFileRoute("/did")({
  head: () => ({
    meta: [
      { title: "银线通车 · 双重差分与匹配｜寻找缺失的事实" },
      {
        name: "description",
        content: "点选对照街区、检查平行趋势、读四格、把通车年份改成假的，看双重差分怎么补上缺失那一格。",
      },
      { property: "og:title", content: "银线通车 · 双重差分与匹配" },
      { property: "og:description", content: "通车后都涨了还不是效应，缺的是通车街区若不通车的那一格。" },
    ],
  }),
  component: DidLesson,
});

const STEPS: Step[] = [
  { id: "did-1", title: "了解情况" },
  { id: "did-2", title: "挑选对照" },
  { id: "did-3", title: "平行趋势" },
  { id: "did-4", title: "四格计算" },
  { id: "did-5", title: "逐年检查" },
  { id: "did-6", title: "小结" },
];

const PRE = 2017;

function DidLesson() {
  const { visit, track, profile, setNote } = useApp();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(["hx", "nw"]);
  const [fakeYear, setFakeYear] = useState(OPEN_YEAR);
  const [postYear, setPostYear] = useState(2020);

  const blocks = useMemo(() => makeBlocks(), []);
  const treated = blocks.filter((b) => b.treated);
  const controls = blocks.filter((b) => !b.treated);
  const chosen = controls.filter((b) => picked.includes(b.key));

  const avg = (bs: typeof blocks, y: number) => mean(bs.map((b) => b.prices[y] ?? 0));
  const t0 = avg(treated, PRE);
  const t1 = avg(treated, postYear);
  const c0 = chosen.length ? avg(chosen, PRE) : 0;
  const c1 = chosen.length ? avg(chosen, postYear) : 0;
  const box = did(t0, t1, c0, c1);

  const preYears = DID_YEARS.filter((y) => y < OPEN_YEAR);
  const slopeT = fitLine(preYears, preYears.map((y) => avg(treated, y))).b;
  const slopeC = chosen.length ? fitLine(preYears, preYears.map((y) => avg(chosen, y))).b : 0;
  const parallelGap = Math.abs(slopeT - slopeC);
  const hasTrap = chosen.some((b) => b.trap);

  const trendData = DID_YEARS.map((y) => ({
    year: String(y),
    通车街区: Math.round(avg(treated, y) * 100) / 100,
    选中的对照: chosen.length ? Math.round(avg(chosen, y) * 100) / 100 : null,
  }));

  const yearly = DID_YEARS.filter((y) => y !== PRE).map((y) => {
    const b = did(t0, avg(treated, y), c0, chosen.length ? avg(chosen, y) : 0);
    return { year: String(y), 缺口: Math.round(b.att * 100) / 100 };
  });

  const fakeBox = did(
    avg(treated, fakeYear - 1),
    avg(treated, fakeYear),
    chosen.length ? avg(chosen, fakeYear - 1) : 0,
    chosen.length ? avg(chosen, fakeYear) : 0,
  );

  useEffect(() => {
    visit(STEPS[step]?.id ?? STEPS[0]!.id, 12);
  }, [step, visit]);

  const hints: string[] = [];
  if (chosen.length < 2) hints.push("至少选两个对照街区，一个街区的波动会直接进到估计里。");
  if (hasTrap)
    hints.push(
      `选中的对照里有 ${chosen.filter((b) => b.trap).map((b) => b.name).join("、")}，它们通车前的走势本来就跟通车街区不一样，不适合当对照。`,
    );
  if (step === 2 && !hasTrap && chosen.length >= 2)
    hints.push(`通车前两条线的年斜率差是 ${fmt(parallelGap, 3)} 万元/年，越小越好。`);
  if (step === 4 && fakeYear < OPEN_YEAR)
    hints.push(`把通车年改成 ${fakeYear} 之后缺口是 ${fmt(fakeBox.att)}，真通车之前应该接近 0。`);

  useCompanionSnapshot({
    lesson: "银线通车（双重差分与匹配）",
    page: STEPS[step]?.title ?? "",
    facts: {
      通车年份: OPEN_YEAR,
      选中的对照街区: chosen.map((b) => b.name).join("、") || "还没选",
      对照个数: chosen.length,
      "通车街区通车前房价（万元/平方米）": fmt(t0),
      通车街区事后房价: fmt(t1),
      对照通车前房价: fmt(c0),
      对照事后房价: fmt(c1),
      "若不通车的那一格（反事实）": fmt(box.counterfactual),
      "双重差分估计 ATT": fmt(box.att),
      通车前年斜率差: fmt(parallelGap, 3),
      事后取的年份: postYear,
      安慰剂通车年: fakeYear,
      安慰剂缺口: fmt(fakeBox.att),
      对照里是否含陷阱街区: hasTrap ? "含（金贸或机场边）" : "不含",
    },
    hints: hints.length ? hints : ["点街区加减对照，四格会立刻重算。"],
  });

  return (
    <LessonShell
      lesson="银线通车"
      subtitle="双重差分：对照街区这段时间走了多远，就借给通车街区用"
      steps={STEPS}
      step={step}
      onStep={setStep}
    >
      {step === 0 && (
        <>
          <Panel title="情况" hint="2018 年银线穿过四个街区。房价单位为万元/平方米。">
            <p className="text-sm leading-relaxed">
              通车后这四个街区房价都涨了。但同期全城都在涨。要的是
              <span className="text-copper">通车街区若不通车的事后水平</span>。
            </p>
          </Panel>
          <Panel title="街区一览" hint="点任意街区看它的属性。铜色为通车街区。">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {blocks.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => track("了解情况", "点街区", b.name)}
                  className={`panel px-3 py-2 text-left text-xs hover:border-copper ${b.treated ? "border-copper/60" : ""}`}
                >
                  <div className="flex justify-between">
                    <span className={b.treated ? "text-copper" : ""}>{b.name}</span>
                    <span className="num text-muted-foreground">{fmt(b.prices[PRE] ?? 0)}</span>
                  </div>
                  <div className="num mt-1 text-[11px] text-muted-foreground">
                    密度 {b.density} · 距中心 {fmt(b.distance, 1)} km
                  </div>
                  {b.note && <div className="mt-1 text-[11px] text-rose">{b.note}</div>}
                </button>
              ))}
            </div>
          </Panel>
        </>
      )}

      {step === 1 && (
        <Panel title="按密度、到中心距离、通车前房价挑对照" hint="点选，至少两个。">
          <div className="grid gap-2 sm:grid-cols-2">
            {controls.map((b) => {
              const on = picked.includes(b.key);
              const gap =
                Math.abs(b.density - mean(treated.map((t) => t.density))) / 100 +
                Math.abs(b.distance - mean(treated.map((t) => t.distance))) +
                Math.abs((b.prices[PRE] ?? 0) - t0) * 2;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => {
                    setPicked((p) => (p.includes(b.key) ? p.filter((x) => x !== b.key) : [...p, b.key]));
                    track("挑选对照", "点选街区", `${b.name} ${on ? "移出" : "加入"}`);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    on ? (b.trap ? "border-rose bg-rose/10" : "border-copper bg-copper/10") : "border-border hover:border-copper/60"
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{b.name}</span>
                    <span className="num text-muted-foreground">匹配差距 {fmt(gap, 2)}</span>
                  </div>
                  <div className="num mt-1 text-[11px] text-muted-foreground">
                    密度 {b.density} · {fmt(b.distance, 1)} km · 通车前 {fmt(b.prices[PRE] ?? 0)}
                  </div>
                  {on && b.note && <div className="mt-1 text-[11px] text-rose">{b.note}</div>}
                </button>
              );
            })}
          </div>
          {hasTrap && (
            <div className="mt-3">
              <Callout tone="rose">金贸是商务中心、机场边在扩建，通车前趋势就跟通车街区不一样，会把估计带偏。</Callout>
            </div>
          )}
        </Panel>
      )}

      {(step === 2 || step === 3) && (
        <Panel title="通车前两条线走得一样吗" hint="一起涨不是效应；通车前分岔才是问题。">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                <ReferenceLine x={String(OPEN_YEAR)} stroke="var(--copper)" label={{ value: "通车", fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Line type="monotone" dataKey="通车街区" stroke="var(--copper)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="选中的对照" stroke="var(--teal)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Tile label="通车街区通车前斜率" value={slopeT} unit="万元/年" />
            <Tile label="对照通车前斜率" value={slopeC} unit="万元/年" />
            <Tile label="斜率差" value={parallelGap} tone={parallelGap > 0.06 ? "rose" : "teal"} />
          </div>
        </Panel>
      )}

      {step === 3 && (
        <>
          <Panel title="四格" hint="点年份切换事后取哪一年。缺的那一格由对照的变化补上。">
            <div className="mb-3 flex flex-wrap gap-2">
              {DID_YEARS.filter((y) => y >= OPEN_YEAR).map((y) => (
                <Chip
                  key={y}
                  active={postYear === y}
                  onClick={() => {
                    setPostYear(y);
                    track("四格计算", "事后年份", String(y));
                  }}
                >
                  {y} 年
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label={`通车街区 ${PRE}`} value={t0} tone="copper" />
              <Tile label={`通车街区 ${postYear}`} value={t1} tone="copper" />
              <Tile label={`对照 ${PRE}`} value={c0} tone="teal" />
              <Tile label={`对照 ${postYear}`} value={c1} tone="teal" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="对照这段时间的变化" value={box.controlChange} unit="万元" />
              <Tile label="若不通车（缺的那一格）" value={box.counterfactual} unit="万元" tone="rose" />
              <Tile label="双重差分估计" value={box.att} unit="万元/平方米" tone="copper" />
            </div>
          </Panel>
          <GuessBox
            question="先猜：通车让这四个街区房价多涨了多少？"
            unit="万元/平方米"
            truth={box.att}
            tolerance={0.12}
            onResolve={(g, ok) => track("四格计算", "先猜再对照", `猜 ${fmt(g)}，${ok ? "在容差内" : "偏了"}`)}
          />
        </>
      )}

      {step === 4 && (
        <>
          <Panel title="逐年缺口" hint="真通车之前的柱子应当接近 0。">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={yearly}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Bar dataKey="缺口" radius={3}>
                    {yearly.map((d) => (
                      <Cell
                        key={d.year}
                        fill={Number(d.year) >= OPEN_YEAR ? "var(--copper)" : Math.abs(d.缺口) > 0.12 ? "var(--rose)" : "var(--teal)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="把通车年改成假的" hint="选一个真通车之前的年份，缺口应当靠近 0。">
            <div className="flex flex-wrap gap-2">
              {DID_YEARS.slice(1).map((y) => (
                <Chip
                  key={y}
                  active={fakeYear === y}
                  tone={y < OPEN_YEAR ? "rose" : "copper"}
                  onClick={() => {
                    setFakeYear(y);
                    track("逐年检查", "假的通车年", String(y));
                  }}
                >
                  {y}
                </Chip>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Tile label={`假设 ${fakeYear} 年通车的缺口`} value={fakeBox.att} unit="万元" tone={Math.abs(fakeBox.att) > 0.1 && fakeYear < OPEN_YEAR ? "rose" : "teal"} />
              <Tile label="真通车年的缺口" value={box.att} unit="万元" tone="copper" />
            </div>
          </Panel>
        </>
      )}

      {step === 5 && (
        <>
          <AutoReview />
          <Quiz
            question="这个双重差分估计说的是谁的效应？"
            options={[
              "通车街区自己的平均处理效应",
              "全城所有街区的平均效应",
              "任何一条新地铁都会带来的涨幅",
            ]}
            answer={0}
            onAnswer={(ok) => track("小结", "选择题", ok ? "答对" : "答错")}
          />
          <Panel title="写下你的结论">
            <NoteBox value={profile.notes["did"] ?? ""} onChange={(v) => setNote("did", v)} />
          </Panel>
          <Callout>对照借来的是「这段时间走了多远」。所以关键前提是通车前两条线走得一样，而不是水平一样。</Callout>
        </>
      )}
    </LessonShell>
  );
}
