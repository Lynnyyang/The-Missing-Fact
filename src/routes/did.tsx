import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LessonShell, type Step } from "@/components/Shell";
import { Callout, Chip, GuessBox, Panel, Quiz, Tile, Toggle } from "@/components/kit";
import { AutoReview } from "@/components/AutoReview";
import { DID_YEARS, OPEN_YEAR, makeBlocks, type Block } from "@/lib/synth";
import { did, fitLine, fmt, mean } from "@/lib/stats";
import { useApp, useCompanionSnapshot } from "@/state/app";

export const Route = createFileRoute("/did")({
  head: () => ({
    meta: [
      { title: "银线通车 · 双重差分与匹配｜寻找缺失的事实" },
      {
        name: "description",
        content: "点选对照街区、检查平行趋势、看反事实那条虚线怎么画出来、一步步算双重差分，再把通车年份改成假的做检验。",
      },
      { property: "og:title", content: "银线通车 · 双重差分与匹配" },
      { property: "og:description", content: "通车后都涨了还不是效应，缺的是通车街区若不通车的那一格。" },
    ],
  }),
  component: DidLesson,
});

const STEPS: Step[] = [
  { id: "did-1", title: "了解情况" },
  { id: "did-2", title: "搭出双重差分" },
  { id: "did-4", title: "画出反事实" },
  { id: "did-3", title: "平行趋势" },
  { id: "did-5", title: "逐年检查" },
  { id: "did-6", title: "小结" },
];

function ControlPicker({
  controls,
  picked,
  onToggle,
  treatedPre,
  treatedSlope,
  preYears,
  compact,
}: {
  controls: Block[];
  picked: string[];
  onToggle: (b: Block) => void;
  treatedPre: number;
  treatedSlope: number;
  preYears: number[];
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {controls.map((b) => {
        const on = picked.includes(b.key);
        const slope = fitLine(preYears, preYears.map((y) => b.prices[y] ?? 0)).b;
        const slopeGap = Math.abs(slope - treatedSlope);
        const levelGap = (b.prices[preYears[preYears.length - 1] ?? OPEN_YEAR - 1] ?? 0) - treatedPre;
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onToggle(b)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              on
                ? b.trap
                  ? "border-rose bg-rose/10"
                  : "border-copper bg-copper/10"
                : "border-border hover:border-copper/60"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span>{b.name}</span>
              <span className="num text-[11px] text-muted-foreground">
                通车前斜率差 {fmt(slopeGap, 3)}
              </span>
            </div>
            <div className="num mt-1 text-[11px] text-muted-foreground">
              密度 {b.density} · {fmt(b.distance, 1)} km · 水平差 {levelGap > 0 ? "+" : ""}
              {fmt(levelGap)}
            </div>
            {b.note && (
              <div className={`mt-1 text-[11px] ${b.trap ? "text-rose" : "text-muted-foreground"}`}>{b.note}</div>
            )}
            <div className="mt-1 text-[11px] text-copper">{on ? "已选为对照" : "点一下加入对照"}</div>
          </button>
        );
      })}
    </div>
  );
}

function DidLesson() {
  const { visit, track } = useApp();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(["hx", "nw"]);
  const [fakeYear, setFakeYear] = useState(OPEN_YEAR);
  const [postYear, setPostYear] = useState(2020);
  const [preYear, setPreYear] = useState(2017);
  const [trendStart, setTrendStart] = useState(2014);
  const [alignLevel, setAlignLevel] = useState(false);
  const [showEach, setShowEach] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [effectRevealed, setEffectRevealed] = useState(false);
  const [compareMode, setCompareMode] = useState<"post" | "prepost" | "did">("post");
  const [buildStage, setBuildStage] = useState(0);
  const [cfDrag, setCfDrag] = useState(0); // 用户拖出来的反事实端点
  const [cfDrawn, setCfDrawn] = useState(false);

  const blocks = useMemo(() => makeBlocks(), []);
  const treated = blocks.filter((b) => b.treated);
  const controls = blocks.filter((b) => !b.treated);
  const chosen = controls.filter((b) => picked.includes(b.key));

  const avg = (bs: Block[], y: number) => mean(bs.map((b) => b.prices[y] ?? 0));
  const t0 = avg(treated, preYear);
  const t1 = avg(treated, postYear);
  const c0 = chosen.length ? avg(chosen, preYear) : 0;
  const c1 = chosen.length ? avg(chosen, postYear) : 0;
  const box = did(t0, t1, c0, c1);
  const levelGap = c0 - t0;

  const preYears = DID_YEARS.filter((y) => y >= trendStart && y < OPEN_YEAR);
  const slopeT = fitLine(preYears, preYears.map((y) => avg(treated, y))).b;
  const slopeC = chosen.length ? fitLine(preYears, preYears.map((y) => avg(chosen, y))).b : 0;
  const parallelGap = Math.abs(slopeT - slopeC);
  const hasTrap = chosen.some((b) => b.trap);

  const compareValue =
    compareMode === "post" ? t1 - c1 : compareMode === "prepost" ? box.treatedChange : box.att;
  const compareNote =
    compareMode === "post"
      ? `只比事后两组，等于把通车前本来就有的 ${fmt(Math.abs(levelGap))} 万元水平差也算成了通车的功劳。`
      : compareMode === "prepost"
        ? `只比通车街区自己的前后，等于把全城同期的涨幅 ${fmt(box.controlChange)} 万元也算了进来。`
        : `双重差分把固定的水平差和同期的大势各减掉一次，剩下的 ${fmt(box.att)} 万元才是通车多出来的部分。`;

  const shift = alignLevel ? t0 - c0 : 0;
  const trendData = DID_YEARS.map((y) => {
    const cAvg = chosen.length ? avg(chosen, y) : null;
    const row: Record<string, number | string | null> = {
      year: String(y),
      通车街区: Math.round(avg(treated, y) * 100) / 100,
      选中的对照: cAvg === null ? null : Math.round((cAvg + shift) * 100) / 100,
    };
    if (showEach) {
      chosen.forEach((b) => (row[b.name] = Math.round(((b.prices[y] ?? 0) + shift) * 100) / 100));
    }
    return row;
  });

  const cfValue = cfDrag || t0;
  const tOpen = avg(treated, OPEN_YEAR);
  const cOpen = chosen.length ? avg(chosen, OPEN_YEAR) : 0;
  const cfData = DID_YEARS.map((y) => {
    const cAvg = chosen.length ? avg(chosen, y) : 0;
    const cf = y >= OPEN_YEAR && chosen.length ? Math.round((tOpen + (cAvg - cOpen)) * 100) / 100 : null;
    return {
      year: String(y),
      通车街区: Math.round(avg(treated, y) * 100) / 100,
      对照街区: chosen.length ? Math.round(cAvg * 100) / 100 : null,
      "若不通车（反事实）": showCf ? cf : null,
      你拖出来的线: cfDrawn && chosen.length && (y === preYear || y === postYear)
        ? Math.round((y === preYear ? t0 : cfValue) * 100) / 100
        : null,
    };
  });

  const yearly = DID_YEARS.filter((y) => y !== preYear).map((y) => {
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

  useEffect(() => {
    setEffectRevealed(false);
  }, [picked, preYear, postYear, step]);

  useEffect(() => {
    setCfDrawn(false);
    setCfDrag(0);
  }, [picked, preYear, postYear]);

  const hints: string[] = [];
  if (chosen.length < 2) hints.push("至少选两个对照街区，一个街区的波动会直接进到估计里。");
  if (hasTrap)
    hints.push(
      `选中的对照里有 ${chosen.filter((b) => b.trap).map((b) => b.name).join("、")}，它们通车前的走势本来就跟通车街区不一样，不适合当对照。`,
    );
  if (Math.abs(levelGap) > 0.2)
    hints.push(`对照通车前的房价水平比通车街区${levelGap < 0 ? "低" : "高"} ${fmt(Math.abs(levelGap))} 万元，这没关系，双重差分只借变化量。`);
  if (step === 3 && !hasTrap && chosen.length >= 2)
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
      事前取的年份: preYear,
      事后取的年份: postYear,
      "通车街区事前房价（万元/平方米）": fmt(t0),
      通车街区事后房价: fmt(t1),
      对照事前房价: fmt(c0),
      对照事后房价: fmt(c1),
      通车前水平差: fmt(levelGap),
      通车街区这段时间的变化: fmt(box.treatedChange),
      对照这段时间的变化: fmt(box.controlChange),
      "反事实事后房价（通车街区若不通车）": fmt(box.counterfactual),
      "双重差分估计 ATT": effectRevealed ? fmt(box.att) : "未揭示（等待用户先猜）",
      通车前趋势起算年: trendStart,
      通车前年斜率差: fmt(parallelGap, 3),
      对齐水平开关: alignLevel ? "已把对照线平移到同一水平" : "关",
      参考线（反事实）: showCf ? "开" : "关（默认）",
      用户拖的反事实端点: cfDrawn ? fmt(cfValue) : "还没拖",
      安慰剂通车年: fakeYear,
      安慰剂缺口: fmt(fakeBox.att),
      当前比法: compareMode === "post" ? "只比事后两组" : compareMode === "prepost" ? "只比通车街区前后" : "双重差分",
      当前比法给出的数: fmt(compareValue),
      "一格一格搭进度（0-3）": buildStage,
      对照里是否含陷阱街区: hasTrap ? "含（金贸或机场边）" : "不含",
    },
    hints: hints.length ? hints : ["点街区加减对照，趋势线和估计会立刻重算。"],
  });

  const togglePick = (b: Block) => {
    const on = picked.includes(b.key);
    setPicked((p) => (on ? p.filter((x) => x !== b.key) : [...p, b.key]));
    track(STEPS[step]?.title ?? "", "点选对照街区", `${b.name} ${on ? "移出" : "加入"}`);
  };

  return (
    <LessonShell
      lesson="银线通车"
      subtitle="双重差分：用对照街区的变化，减掉通车街区里同期的大势"
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
          <Panel title="通车街区" hint="铜色为被银线穿过的四个街区，它们是处理组。">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {treated.map((b) => (
                <div key={b.key} className="panel border-copper/60 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-copper">{b.name}</span>
                    <span className="num text-muted-foreground">{fmt(b.prices[preYear] ?? 0)}</span>
                  </div>
                  <div className="num mt-1 text-[11px] text-muted-foreground">
                    密度 {b.density} · 距中心 {fmt(b.distance, 1)} km
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="现在就挑对照街区"
            hint="点一下就加入或移出对照，下面的数字立刻跟着变。水平不一样没关系，通车前涨得一样快才重要。"
          >
            <ControlPicker
              controls={controls}
              picked={picked}
              onToggle={togglePick}
              treatedPre={t0}
              treatedSlope={slopeT}
              preYears={preYears}
              compact
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="对照个数" value={chosen.length} />
              <Tile label={`通车街区 ${preYear}`} value={t0} tone="copper" />
              <Tile label={`对照 ${preYear}`} value={c0} tone="teal" />
              <Tile label="通车前水平差" value={levelGap} unit="万元" />
            </div>
            {Math.abs(levelGap) > 0.2 && (
              <div className="mt-3">
                <Callout>
                  两组通车前的水平本来就差 {fmt(Math.abs(levelGap))} 万元。这不影响双重差分——它借的是对照
                  <span className="text-copper">这段时间涨了多少</span>，不是对照的水平。
                </Callout>
              </div>
            )}
          </Panel>
        </>
      )}

      {step === 1 && (
        <>
          <Panel title="换一种比法，看看数字会变成什么" hint="同一批数据，三种比法给出三个不同的答案。点一下切换。">
            <div className="flex flex-wrap gap-2">
              <Chip
                tone="rose"
                active={compareMode === "post"}
                onClick={() => {
                  setCompareMode("post");
                  track("搭出双重差分", "切换比法", "只比事后两组");
                }}
              >
                只比事后两组
              </Chip>
              <Chip
                tone="rose"
                active={compareMode === "prepost"}
                onClick={() => {
                  setCompareMode("prepost");
                  track("搭出双重差分", "切换比法", "只比通车街区前后");
                }}
              >
                只比通车街区前后
              </Chip>
              <Chip
                active={compareMode === "did"}
                onClick={() => {
                  setCompareMode("did");
                  track("搭出双重差分", "切换比法", "双重差分");
                }}
              >
                双重差分
              </Chip>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="这种比法的答案" value={compareValue} unit="万元" tone={compareMode === "did" ? "copper" : "rose"} />
              <Tile label="通车前水平差" value={levelGap} unit="万元" />
              <Tile label="对照同期涨幅" value={box.controlChange} unit="万元" tone="teal" />
            </div>
            <div className="mt-3">
              <Callout tone={compareMode === "did" ? "copper" : "rose"}>{compareNote}</Callout>
            </div>
          </Panel>

          <Panel title="一格一格搭出来" hint="点「下一步」，看着两个变化怎么变成一个估计。">
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip
                onClick={() => {
                  const s = Math.min(3, buildStage + 1);
                  setBuildStage(s);
                  track("搭出双重差分", "搭建进度", `第 ${s} 步`);
                }}
              >
                下一步
              </Chip>
              <Chip
                tone="rose"
                onClick={() => {
                  setBuildStage(0);
                  track("搭出双重差分", "搭建进度", "重来");
                }}
              >
                重来
              </Chip>
              <span className="self-center text-[11px] text-muted-foreground">进度 {buildStage} / 3</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label={`通车街区 ${preYear}`} value={t0} tone="copper" />
              <Tile label={`通车街区 ${postYear}`} value={t1} tone="copper" />
              <Tile label={`对照 ${preYear}`} value={c0} tone="teal" />
              <Tile label={`对照 ${postYear}`} value={c1} tone="teal" />
            </div>
            <div className="mt-3 space-y-2 text-xs leading-relaxed">
              {buildStage >= 1 && (
                <div className="panel px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">第一步：通车街区自己涨了多少</div>
                  <div className="num mt-1">
                    {fmt(t1)} − {fmt(t0)} = <span className="text-copper">{fmt(box.treatedChange)}</span>
                  </div>
                </div>
              )}
              {buildStage >= 2 && (
                <div className="panel px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">第二步：对照街区同期涨了多少（借来的大势）</div>
                  <div className="num mt-1">
                    {fmt(c1)} − {fmt(c0)} = <span className="text-teal">{fmt(box.controlChange)}</span>
                  </div>
                </div>
              )}
              {buildStage >= 3 && (
                <div className="panel px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">第三步：两个变化相减，就是双重差分</div>
                  <div className="num mt-1">
                    {fmt(box.treatedChange)} − {fmt(box.controlChange)} = <span className="text-copper">{fmt(box.att)}</span>
                  </div>
                </div>
              )}
              {buildStage === 0 && (
                <p className="text-muted-foreground">四个格子已经在上面了。点「下一步」，一次看清一个减法。</p>
              )}
            </div>
          </Panel>

          <Panel title="换事前、事后年份，看这套算法稳不稳" hint="四格取的年份变了，估计也会变。">
            <div className="mb-2 flex flex-wrap gap-2">
              {DID_YEARS.filter((y) => y < OPEN_YEAR).map((y) => (
                <Chip
                  key={y}
                  active={preYear === y}
                  onClick={() => {
                    setPreYear(y);
                    track("搭出双重差分", "事前年份", String(y));
                  }}
                >
                  事前取 {y}
                </Chip>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {DID_YEARS.filter((y) => y > OPEN_YEAR).map((y) => (
                <Chip
                  key={y}
                  tone="teal"
                  active={postYear === y}
                  onClick={() => {
                    setPostYear(y);
                    track("搭出双重差分", "事后年份", String(y));
                  }}
                >
                  事后取 {y}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="通车街区变化" value={box.treatedChange} unit="万元" tone="copper" />
              <Tile label="对照变化" value={box.controlChange} unit="万元" tone="teal" />
              <Tile label="双重差分" value={box.att} unit="万元" />
            </div>
          </Panel>

          {hasTrap && (
            <Callout tone="rose">选中的对照里有陷阱街区，它们通车前的走势本来就不一样，借来的「大势」是假的。</Callout>
          )}
        </>
      )}


      {step === 3 && (
        <>
          <Panel
            title="通车前两条线走得一样吗"
            hint="看的是斜率，不是水平。水平差可以用开关先抹掉，方便对比。"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">趋势起算年</span>
              {DID_YEARS.filter((y) => y <= 2016).map((y) => (
                <Chip
                  key={y}
                  active={trendStart === y}
                  onClick={() => {
                    setTrendStart(y);
                    track("平行趋势", "趋势起算年", String(y));
                  }}
                >
                  {y}
                </Chip>
              ))}
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <Toggle
                label="把对照线平移到同一水平"
                checked={alignLevel}
                hint="只改画法，不改任何估计"
                onChange={(v) => {
                  setAlignLevel(v);
                  track("平行趋势", "对齐水平", v ? "开" : "关");
                }}
              />
              <Toggle
                label="拆开看每个对照街区"
                checked={showEach}
                hint="看清是不是某一个街区在拖"
                onChange={(v) => {
                  setShowEach(v);
                  track("平行趋势", "拆开对照街区", v ? "开" : "关");
                }}
              />
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                  <ReferenceArea x1={String(trendStart)} x2={String(OPEN_YEAR - 1)} fill="var(--copper)" fillOpacity={0.06} />
                  <ReferenceLine x={String(OPEN_YEAR)} stroke="var(--copper)" label={{ value: "通车", fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Line type="monotone" dataKey="通车街区" stroke="var(--copper)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="选中的对照" stroke="var(--teal)" strokeWidth={2} dot={false} connectNulls />
                  {showEach &&
                    chosen.map((b) => (
                      <Line
                        key={b.key}
                        type="monotone"
                        dataKey={b.name}
                        stroke="var(--muted-foreground)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="通车街区通车前斜率" value={slopeT} unit="万元/年" tone="copper" />
              <Tile label="对照通车前斜率" value={slopeC} unit="万元/年" tone="teal" />
              <Tile label="斜率差" value={parallelGap} tone={parallelGap > 0.06 ? "rose" : "teal"} />
              <Tile label="通车前水平差" value={levelGap} unit="万元" sub="水平差不要求为 0" />
            </div>
          </Panel>
          <Callout>
            平行趋势要求的是<span className="text-copper">通车前两条线的斜率接近</span>，不要求水平相同。
            两组起点差 {fmt(Math.abs(levelGap))} 万元也可以做双重差分，因为固定的水平差会在两次相减里被消掉。
          </Callout>
        </>
      )}

      {step === 2 && (
        <>
          <Panel
            title="在图上亲手拖出反事实"
            hint="反事实是看不见的：通车街区若不通车，事后会走到哪里？先拖滑杆猜一个位置，再按对照的涨幅画出来对照。"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">事后取</span>
              {DID_YEARS.filter((y) => y >= OPEN_YEAR).map((y) => (
                <Chip
                  key={y}
                  active={postYear === y}
                  onClick={() => {
                    setPostYear(y);
                    track("画出反事实", "事后年份", String(y));
                  }}
                >
                  {y} 年
                </Chip>
              ))}
              <Toggle
                label="参考线（按对照涨幅补出的反事实）"
                checked={showCf}
                onChange={(v) => {
                  setShowCf(v);
                  track("画出反事实", "参考线", v ? "开" : "关");
                }}
              />
            </div>
            <div className="mb-3 panel px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] text-muted-foreground">
                  拖动这条深色虚线：你觉得 {postYear} 年若不通车会在哪？
                </span>
                <input
                  type="range"
                  min={Math.round((t0 - 0.5) * 20) / 20}
                  max={Math.round((t1 + 0.2) * 20) / 20}
                  step={0.05}
                  value={cfValue}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setCfDrag(v);
                    setCfDrawn(true);
                    track("画出反事实", "拖反事实端点", fmt(v));
                  }}
                  className="w-56 accent-[var(--copper)]"
                />
                <span className="num text-sm text-copper">{cfDrawn ? fmt(cfValue) : "拖一下试试"}</span>
                <Chip
                  onClick={() => {
                    setCfDrag(Math.round(box.counterfactual * 100) / 100);
                    setCfDrawn(true);
                    setShowCf(true);
                    track("画出反事实", "按对照涨幅画出", fmt(box.counterfactual));
                  }}
                >
                  按对照的涨幅画出来
                </Chip>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                这条虚线的含义：从 {preYear} 年的 {fmt(t0)} 出发，按你自己的判断走到 {postYear} 年。
              </p>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={cfData}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                  <ReferenceLine x={String(OPEN_YEAR)} stroke="var(--copper)" label={{ value: "通车", fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <ReferenceLine x={String(postYear)} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="通车街区" stroke="var(--copper)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="对照街区" stroke="var(--teal)" strokeWidth={2} dot={false} connectNulls />
                  <Line
                    type="monotone"
                    dataKey="若不通车（反事实）"
                    stroke="var(--rose)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="你拖出来的线"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    strokeDasharray="2 3"
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="你拖的端点" value={cfDrawn ? cfValue : "—"} unit="万元" />
              <Tile label={`按对照涨幅应在 ${preYear}→${postYear}`} value={showCf ? box.counterfactual : "开虚线看"} unit="万元" tone="rose" />
              <Tile label="差了多少" value={cfDrawn && showCf ? Math.round((cfValue - box.counterfactual) * 100) / 100 : "—"} unit="万元" tone={cfDrawn && showCf && Math.abs(cfValue - box.counterfactual) > 0.15 ? "rose" : "teal"} />
              <Tile label="图上竖直距离＝估计" value={showCf ? box.att : "开虚线看"} unit="万元" tone="copper" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {postYear} 年铜线（实际）与红色虚线（若不通车）之间的垂直距离，就是双重差分估计。反事实的意义正在于此：它是「缺的那一格」，现实中永远观测不到，只能借对照的涨幅补出来。
            </p>
          </Panel>

          <Panel title="一步步算" hint="两个变化相减，就是双重差分。">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label={`通车街区 ${preYear}`} value={t0} tone="copper" />
              <Tile label={`通车街区 ${postYear}`} value={t1} tone="copper" />
              <Tile label={`对照 ${preYear}`} value={c0} tone="teal" />
              <Tile label={`对照 ${postYear}`} value={c1} tone="teal" />
            </div>
            <div className="mt-3 space-y-2 text-xs leading-relaxed">
              <div className="panel px-3 py-2">
                <div className="text-[11px] text-muted-foreground">第一步：通车街区自己的变化</div>
                <div className="num mt-1">
                  {fmt(t1)} − {fmt(t0)} = <span className="text-copper">{fmt(box.treatedChange)}</span> 万元/平方米
                </div>
              </div>
              <div className="panel px-3 py-2">
                <div className="text-[11px] text-muted-foreground">第二步：对照街区同期的变化（这就是借来的大势）</div>
                <div className="num mt-1">
                  {fmt(c1)} − {fmt(c0)} = <span className="text-teal">{fmt(box.controlChange)}</span> 万元/平方米
                </div>
              </div>
              <div className="panel px-3 py-2">
                <div className="text-[11px] text-muted-foreground">第三步：两个变化相减，得到通车多出来的部分</div>
                <div className="num mt-1">
                  {fmt(box.treatedChange)} − {fmt(box.controlChange)} ={" "}
                  <span className="text-copper">{effectRevealed ? fmt(box.att) : "先猜后显示"}</span> 万元/平方米
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Callout>
                固定的水平差（现在是 {fmt(levelGap)} 万元）在第一步和第二步里各自被减掉，所以两组事前水平不同也不影响估计。
              </Callout>
            </div>
          </Panel>

          <GuessBox
            question="先猜：通车让这四个街区房价多涨了多少？"
            unit="万元/平方米"
            truth={box.att}
            tolerance={0.12}
            onReveal={() => setEffectRevealed(true)}
            onResolve={(g, ok) => track("画出反事实", "先猜再对照", `猜 ${fmt(g)}，${ok ? "在容差内" : "偏了"}`)}
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
          <Panel title="换掉对照，再看一眼逐年缺口" hint="对照换了，柱子会跟着变。">
            <ControlPicker
              controls={controls}
              picked={picked}
              onToggle={togglePick}
              treatedPre={t0}
              treatedSlope={slopeT}
              preYears={preYears}
              compact
            />
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
          <Quiz
            question="对照街区通车前房价比通车街区低 0.7 万元，这算问题吗？"
            options={[
              "不算，双重差分只借变化量，固定的水平差会被减掉",
              "算，两组水平必须一样才能比",
              "算，必须先把对照的房价调到一样高",
            ]}
            answer={0}
            onAnswer={(ok) => track("小结", "水平差选择题", ok ? "答对" : "答错")}
          />
          <Callout>对照借来的是「这段时间走了多远」。所以关键前提是通车前两条线走得一样，而不是水平一样。</Callout>
        </>
      )}
    </LessonShell>
  );
}
