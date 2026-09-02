import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LessonShell, type Step } from "@/components/Shell";
import { Callout, Chip, Dial, GuessBox, NoteBox, Panel, Quiz, Tile, Toggle } from "@/components/kit";
import { AutoReview } from "@/components/AutoReview";
import { makeFerry, POLICY_MONTH, type ShockKey } from "@/lib/synth";
import { fitLine, fmt, mean } from "@/lib/stats";
import { useApp, useCompanionSnapshot } from "@/state/app";

export const Route = createFileRoute("/prepost")({
  head: () => ({
    meta: [
      { title: "碣石渡免票 · 事前事后｜寻找缺失的事实" },
      {
        name: "description",
        content: "拖开始月份、切换水平延续与趋势外推、开关台风短视频火灾，看事前事后什么时候能用。",
      },
      { property: "og:title", content: "碣石渡免票 · 事前事后" },
      { property: "og:description", content: "用这座岛自己的过去当对照，前提是窗口里没有别的大事。" },
    ],
  }),
  component: PrePostLesson,
});

const STEPS: Step[] = [
  { id: "prepost-1", title: "了解情况" },
  { id: "prepost-2", title: "核对时间轴" },
  { id: "prepost-3", title: "画出对照线" },
  { id: "prepost-4", title: "算出效应" },
  { id: "prepost-5", title: "加入干扰" },
  { id: "prepost-6", title: "小结" },
];

const EVENTS = [
  { key: "festival", label: "渔获节（每年 9 月）", noise: false, note: "每年都有，属于季节，不是干扰。" },
  { key: "typhoon", label: "2018 年 9 月台风", noise: true, note: "叠在免票之后，会压低客流。" },
  { key: "viral", label: "2019 年短视频爆火", noise: true, note: "只发生在窗口里，会被误当成政策。" },
  { key: "fire", label: "2017 年码头火灾", noise: true, note: "免票之前的冲击，会拉低事前均值。" },
] as const;

function PrePostLesson() {
  const { visit, track, profile, setNote } = useApp();
  const [step, setStep] = useState(0);
  const [why, setWhy] = useState<string[]>([]);
  const [clicked, setClicked] = useState<string[]>([]);
  const [counterfactual, setCounterfactual] = useState<"水平" | "趋势">("水平");
  const [startMonth, setStartMonth] = useState(POLICY_MONTH);
  const [window_, setWindow] = useState(18);
  const [shocks, setShocks] = useState<Record<ShockKey, boolean>>({ typhoon: false, viral: false, fire: false });

  const data = useMemo(() => makeFerry({ shocks, policyMonth: POLICY_MONTH }), [shocks]);

  // 窗口要对称，而且安慰剂窗口不能跨过真正的免票月，否则「假的开始月份」也会捡到真效应
  let effWindow = Math.min(window_, startMonth, data.length - startMonth);
  if (startMonth < POLICY_MONTH) effWindow = Math.min(effWindow, POLICY_MONTH - startMonth);
  else if (startMonth > POLICY_MONTH) effWindow = Math.min(effWindow, startMonth - POLICY_MONTH);
  effWindow = Math.max(3, effWindow);
  const trimmed = effWindow < window_;

  const pre = data.filter((d) => d.t < startMonth && d.t >= startMonth - effWindow);
  const post = data.filter((d) => d.t >= startMonth && d.t < startMonth + effWindow);
  const preMean = mean(pre.map((d) => d.visits));
  const postMean = mean(post.map((d) => d.visits));

  const line = fitLine(pre.map((d) => d.t), pre.map((d) => d.visits));
  const trendPred = mean(post.map((d) => line.a + line.b * d.t));
  const estimate = counterfactual === "水平" ? postMean - preMean : postMean - trendPred;
  const fake = startMonth !== POLICY_MONTH;

  const chart = data.map((d) => ({
    label: d.label,
    t: d.t,
    客流: d.visits,
    对照线:
      d.t >= startMonth - effWindow && d.t < startMonth + effWindow
        ? counterfactual === "水平"
          ? preMean
          : line.a + line.b * d.t
        : null,
  }));


  useEffect(() => {
    visit(STEPS[step]?.id ?? STEPS[0]!.id, 12);
  }, [step, visit]);

  const hints: string[] = [];
  if (step === 2 && fake)
    hints.push(
      `你把开始月份挪到了 ${data[startMonth]?.label}，那里没有政策，估计应当靠近 0；现在是 ${fmt(estimate, 0)} 人次。`,
    );
  if (step === 2 && counterfactual === "水平" && Math.abs(line.b) > 4)
    hints.push("事前本来就在往上走，只用水平延续会把这条慢趋势算成政策。试试趋势外推。");
  if (step === 2 && trimmed)
    hints.push(`为了不跨过真正的免票月 ${data[POLICY_MONTH]?.label}，前后各只用了 ${effWindow} 个月。`);
  if (step === 3 && counterfactual === "水平") hints.push("换成趋势外推再看一遍这个数字，差别就是趋势的份。");
  if (step === 4 && (shocks.typhoon || shocks.viral || shocks.fire))
    hints.push("现在窗口里有别的大事，「期间没有别的干扰」这条前提已经不成立了。");
  if (step === 1 && clicked.includes("festival")) hints.push("渔获节每年都有，季节可以有，别把它当成干扰。");

  useCompanionSnapshot({
    lesson: "碣石渡免票（事前事后）",
    page: STEPS[step]?.title ?? "",
    facts: {
      免票开始月份: data[POLICY_MONTH]?.label ?? "2018-07",
      当前设定的开始月份: data[startMonth]?.label ?? "",
      是否为假的开始月份: fake ? "是" : "否",
      对照线类型: counterfactual === "水平" ? "水平延续" : "趋势外推",
      "窗口长度（月）": window_,
      "实际使用的窗口（月）": effWindow,
      事前均值: fmt(preMean, 0),
      事后均值: fmt(postMean, 0),
      "估计效应（人次/月）": fmt(estimate, 0),
      "事前每月趋势（人次）": fmt(line.b, 1),
      打开的干扰: [shocks.typhoon && "台风", shocks.viral && "短视频", shocks.fire && "火灾"].filter(Boolean).join("、") || "无",
    },
    hints: hints.length ? hints : ["把开始月份拖到没有政策的月份，看看估计会不会靠近 0。"],
  });

  return (
    <LessonShell
      lesson="碣石渡免票"
      subtitle="事前事后：把这座岛自己的过去当对照"
      steps={STEPS}
      step={step}
      onStep={setStep}
    >
      {step === 0 && (
        <>
          <Panel title="情况" hint="岛上几乎只有一条渡轮，2018 年 7 月免票。结果是月度到访人次。">
            <p className="text-sm leading-relaxed">
              没有别的岛可以当对照，只能拿免票之前的自己。可行的前提是：
              <span className="text-copper">免票前后没有别的大事足以推动客流。</span>
            </p>
          </Panel>
          <Panel title="点亮：为什么这座岛能当自己的对照">
            <div className="flex flex-wrap gap-2">
              {[
                "交通封闭，几乎只有这一条渡轮",
                "客流受季节影响，但季节每年都一样",
                "岛上人口很多，所以样本大",
                "免票窗口里没有别的大事",
              ].map((s, i) => (
                <Chip
                  key={s}
                  active={why.includes(s)}
                  tone={i === 2 ? "rose" : "copper"}
                  onClick={() => {
                    setWhy((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
                    track("了解情况", "点亮理由", s);
                  }}
                >
                  {s}
                </Chip>
              ))}
            </div>
            {why.includes("岛上人口很多，所以样本大") && (
              <div className="mt-3">
                <Callout tone="rose">样本大只让区间变窄，不能让对照变可信。</Callout>
              </div>
            )}
          </Panel>
        </>
      )}

      {step === 1 && (
        <Panel title="核对时间轴" hint="点每个事件，判断它是季节还是叠在免票上的干扰。">
          <div className="space-y-2">
            {EVENTS.map((e) => {
              const on = clicked.includes(e.key);
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => {
                    setClicked((p) => (p.includes(e.key) ? p.filter((x) => x !== e.key) : [...p, e.key]));
                    track("核对时间轴", "点事件", e.label);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    on ? (e.noise ? "border-rose bg-rose/10" : "border-teal bg-teal/10") : "border-border hover:border-copper/60"
                  }`}
                >
                  <span className="font-medium">{e.label}</span>
                  {on && <span className="mt-1 block text-muted-foreground">{e.note}</span>}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {(step === 2 || step === 3 || step === 4) && (
        <>
          <Panel
            title="月度到访人次与你画出的对照线"
            hint="铜色是实际客流，浅色是「若无免票」的对照线。"
          >
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={11} />
                  <YAxis
                    domain={["dataMin - 300", "dataMax + 300"]}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
                    formatter={(v: number) => fmt(v, 0)}
                  />
                  <ReferenceLine
                    x={chart[startMonth]?.label ?? ""}
                    stroke={fake ? "var(--rose)" : "var(--copper)"}
                    label={{ value: fake ? "假的开始" : "免票开始", fill: "var(--muted-foreground)", fontSize: 10 }}
                  />
                  <Line type="monotone" dataKey="客流" stroke="var(--copper)" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="对照线" stroke="var(--teal)" dot={false} strokeDasharray="5 4" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {step === 2 && (
            <Panel title="对照怎么画">
              <div className="flex gap-2">
                {(["水平", "趋势"] as const).map((c) => (
                  <Chip
                    key={c}
                    active={counterfactual === c}
                    onClick={() => {
                      setCounterfactual(c);
                      track("画出对照线", "对照线类型", c === "水平" ? "水平延续" : "趋势外推");
                    }}
                  >
                    {c === "水平" ? "水平延续事前均值" : "事前趋势外推"}
                  </Chip>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Dial
                  label="开始月份（可以挪到没有政策的月份做安慰剂）"
                  value={startMonth}
                  min={24}
                  max={72}
                  onChange={(v) => {
                    setStartMonth(v);
                    track("画出对照线", "开始月份", data[v]?.label ?? String(v));
                  }}
                  hint={`当前：${data[startMonth]?.label}`}
                />
                <Dial
                  label="前后各取几个月"
                  value={window_}
                  min={6}
                  max={30}
                  unit=" 月"
                  onChange={(v) => {
                    setWindow(v);
                    track("画出对照线", "窗口长度", `${v} 月`);
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tile label="估计效应" value={estimate} unit="人次/月" tone={fake ? "rose" : "copper"} />
                <Tile label="事前每月趋势" value={line.b} unit="人次" />
                <Tile label="实际使用的窗口" value={effWindow} unit="月" />
              </div>
              {trimmed && (
                <div className="mt-3">
                  <Callout>
                    为了让前后两段都不跨过真正的免票月 {data[POLICY_MONTH]?.label}，前后各只取了 {effWindow} 个月。
                  </Callout>
                </div>
              )}
              {fake && (
                <div className="mt-3">
                  <Callout tone="rose">这是假的开始月份，估计还这么大就说明你的对照线在替趋势或干扰记账。</Callout>
                </div>
              )}
            </Panel>
          )}

          {step === 3 && (
            <>
              <Panel title="事前事后均值">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile label="事前均值" value={preMean} unit="人次" tone="teal" />
                  <Tile label="事后均值" value={postMean} unit="人次" tone="copper" />
                  <Tile label="对照线预测" value={counterfactual === "水平" ? preMean : trendPred} unit="人次" />
                  <Tile label="估计效应" value={estimate} unit="人次/月" tone="copper" />
                </div>
              </Panel>
              <GuessBox
                question="先猜：免票让每月到访人次多了多少？"
                unit="人次/月"
                truth={estimate}
                tolerance={120}
                onResolve={(g, ok) => track("算出效应", "先猜再对照", `猜 ${fmt(g, 0)}，${ok ? "在容差内" : "偏了"}`)}
              />
            </>
          )}

          {step === 4 && (
            <Panel title="把干扰一个个打开" hint="每开一个，估计都会动。">
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["typhoon", "2018 年 9 月台风"],
                    ["viral", "2019 年短视频爆火"],
                    ["fire", "2017 年码头火灾"],
                  ] as Array<[ShockKey, string]>
                ).map(([k, label]) => (
                  <Toggle
                    key={k}
                    label={label}
                    checked={shocks[k]}
                    onChange={(v) => {
                      setShocks((p) => ({ ...p, [k]: v }));
                      track("加入干扰", label, v ? "开" : "关");
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Tile label="现在的估计" value={estimate} unit="人次/月" tone="copper" />
                <Tile
                  label="干扰个数"
                  value={Object.values(shocks).filter(Boolean).length}
                  tone={Object.values(shocks).some(Boolean) ? "rose" : "teal"}
                />
              </div>
            </Panel>
          )}
        </>
      )}

      {step === 5 && (
        <>
          <AutoReview />
          <Quiz
            question="什么时候应该放弃事前事后，换成双重差分？"
            options={[
              "当窗口里可能有别的大事，需要一个同期的对照单位来吸收它",
              "当样本太小的时候",
              "当政策效果太大的时候",
            ]}
            answer={0}
            onAnswer={(ok) => track("小结", "选择题", ok ? "答对" : "答错")}
          />
          <Panel title="写下你的结论">
            <NoteBox value={profile.notes["prepost"] ?? ""} onChange={(v) => setNote("prepost", v)} />
          </Panel>
          <Callout>事前事后估的是水平或趋势外推下的前后差。它承担了「窗口里没别的事」这条很重的假设。</Callout>
        </>
      )}
    </LessonShell>
  );
}
