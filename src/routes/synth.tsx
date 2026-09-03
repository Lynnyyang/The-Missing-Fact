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
import { Callout, Chip, Dial, GuessBox, Panel, Quiz, Tile } from "@/components/kit";
import { AutoReview } from "@/components/AutoReview";
import { SC_TREAT_YEAR, SC_YEARS, makeCities } from "@/lib/synth";
import { fitSynth, fmt, rmse } from "@/lib/stats";
import { useApp, useCompanionSnapshot } from "@/state/app";

export const Route = createFileRoute("/synth")({
  head: () => ({
    meta: [
      { title: "岚城煤改气 · 合成控制｜寻找缺失的事实" },
      {
        name: "description",
        content: "开关供体城市、手调或自动拟合权重、跑安慰剂检验，用一篮子城市拼出一个没改气的岚城。",
      },
      { property: "og:title", content: "岚城煤改气 · 合成控制" },
      { property: "og:description", content: "只有一座城被处理，单个对照不够，就用非负权重加权拼一个替身。" },
    ],
  }),
  component: SynthLesson,
});

const STEPS: Step[] = [
  { id: "synth-1", title: "了解情况" },
  { id: "synth-2", title: "挑选城市" },
  { id: "synth-3", title: "分配权重" },
  { id: "synth-4", title: "对照轨迹" },
  { id: "synth-5", title: "安慰剂检验" },
  { id: "synth-6", title: "小结" },
];

const PRE_LEN = SC_YEARS.indexOf(SC_TREAT_YEAR);

function SynthLesson() {
  const { visit, track, profile } = useApp();
  const [step, setStep] = useState(0);
  const cities = useMemo(() => makeCities(), []);
  const target = cities.find((c) => c.key === "lan")!;
  const donorsAll = cities.filter((c) => c.key !== "lan");

  const [on, setOn] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [placebo, setPlacebo] = useState<string | null>(null);
  const [ranAll, setRanAll] = useState(false);
  const [showAllPaths, setShowAllPaths] = useState(false);

  const donors = donorsAll.filter((d) => on.includes(d.key));
  const badIncluded = donors.filter((d) => d.alreadyTreated);

  const norm = useMemo(() => {
    const raw = donors.map((d) => Math.max(0, weights[d.key] ?? 0));
    const s = raw.reduce((a, b) => a + b, 0);
    return donors.map((d, i) => ({ city: d, w: s > 0 ? (raw[i] ?? 0) / s : 0 }));
  }, [donors, weights]);

  const path = SC_YEARS.map((_, t) => norm.reduce((s, n) => s + n.w * (n.city.pm[t] ?? 0), 0));
  const preFit = rmse(path.slice(0, PRE_LEN), target.pm.slice(0, PRE_LEN));
  const gapNow = (target.pm[SC_YEARS.length - 1] ?? 0) - (path[SC_YEARS.length - 1] ?? 0);

  const placeboCity = placebo ? donorsAll.find((c) => c.key === placebo) : null;
  const placeboFit = useMemo(() => {
    if (!placeboCity) return null;
    const others = donorsAll.filter((d) => d.key !== placeboCity.key && on.includes(d.key));
    const fit = fitSynth(
      placeboCity.pm.slice(0, PRE_LEN),
      others.map((d) => d.pm.slice(0, PRE_LEN)),
      1200,
    );
    const p = SC_YEARS.map((_, t) => others.reduce((s, d, j) => s + (fit.weights[j] ?? 0) * (d.pm[t] ?? 0), 0));
    return { gap: (placeboCity.pm[SC_YEARS.length - 1] ?? 0) - (p[SC_YEARS.length - 1] ?? 0), path: p };
  }, [placeboCity, donorsAll, on]);

  // 第二步：对所有未被处理过的在篮供体城市，各跑一次安慰剂
  const eligible = donorsAll.filter((d) => !d.alreadyTreated && on.includes(d.key));
  const placeboAll = useMemo(() => {
    if (!ranAll) return [];
    return eligible.map((city) => {
      const others = eligible.filter((d) => d.key !== city.key);
      const fit = fitSynth(
        city.pm.slice(0, PRE_LEN),
        others.map((d) => d.pm.slice(0, PRE_LEN)),
        1200,
      );
      const p = SC_YEARS.map((_, t) => others.reduce((s, d, j) => s + (fit.weights[j] ?? 0) * (d.pm[t] ?? 0), 0));
      const gap = (city.pm[SC_YEARS.length - 1] ?? 0) - (p[SC_YEARS.length - 1] ?? 0);
      return { city, gap, preRmse: fit.rmse, ratio: fit.rmse > 0.01 ? Math.abs(gap) / fit.rmse : 0, path: p };
    });
  }, [ranAll, eligible]);

  const lanRatio = preFit > 0.01 ? Math.abs(gapNow) / preFit : 0;
  const moreExtreme = placeboAll.filter((r) => Math.abs(r.gap) >= Math.abs(gapNow)).length;
  const ratioMoreExtreme = placeboAll.filter((r) => r.ratio >= lanRatio).length;
  const totalUnits = placeboAll.length + 1;
  const approxP = totalUnits > 1 ? (ratioMoreExtreme + 1) / totalUnits : null;

  const chart = SC_YEARS.map((y, t) => ({
    year: String(y),
    岚城: target.pm[t] ?? 0,
    合成岚城: Math.round((path[t] ?? 0) * 10) / 10,
    ...(placeboFit ? { [`安慰剂 ${placeboCity!.name}`]: Math.round((placeboFit.path[t] ?? 0) * 10) / 10 } : {}),
    ...(showAllPaths
      ? Object.fromEntries(placeboAll.map((r) => [`安慰剂·${r.city.name}`, Math.round((r.path[t] ?? 0) * 10) / 10]))
      : {}),
  }));

  useEffect(() => {
    visit(STEPS[step]?.id ?? STEPS[0]!.id, 12);
  }, [step, visit]);

  function autoFit() {
    const fit = fitSynth(
      target.pm.slice(0, PRE_LEN),
      donors.map((d) => d.pm.slice(0, PRE_LEN)),
      4000,
    );
    const next: Record<string, number> = {};
    donors.forEach((d, i) => {
      next[d.key] = Math.round((fit.weights[i] ?? 0) * 1000) / 1000;
    });
    setWeights(next);
    track("分配权重", "自动拟合", `改气前误差降到 ${fmt(fit.rmse, 2)}`);
  }

  const hints: string[] = [];
  if (!donors.length)
    hints.push("篮子里一座城市都没有。回到「挑选城市」，亲自挑几座没被同类政策处理过的城市进来。");
  if (badIncluded.length)
    hints.push(`供体里还留着 ${badIncluded.map((c) => c.name).join("、")}，它们自己就被同类政策处理过，必须拿掉。`);
  if (step === 2 && preFit > 3) hints.push(`改气前的拟合误差是 ${fmt(preFit, 2)}，还偏大，试试自动拟合或调高贴合的城市权重。`);
  if (step === 2 && preFit <= 3) hints.push(`改气前误差 ${fmt(preFit, 2)}，合成岚城已经贴住改气前的轨迹了。`);
  if (step === 3) hints.push("缺口是负数表示空气变好，别把负号读成效果变差。");
  if (step === 4 && placeboFit)
    hints.push(
      `${placeboCity!.name} 假装改气后的缺口是 ${fmt(placeboFit.gap, 1)}，跟岚城的 ${fmt(gapNow, 1)} 比一比谁更突出。`,
    );
  if (step === 4 && !ranAll) hints.push("单个安慰剂不算数，点“跑全部安慰剂”，看岚城在整群假改气城市里排第几。");
  if (step === 4 && ranAll && approxP !== null)
    hints.push(
      `岚城的缺口比 ${placeboAll.length - moreExtreme}/${placeboAll.length} 个安慰剂更极端；按拟合误差校正后近似 p 值是 ${fmt(approxP, 2)}，${approxP <= 0.2 ? "勉强说得过去" : "挡不住巧合的解释"}。`,
    );

  useCompanionSnapshot({
    lesson: "岚城煤改气（合成控制）",
    page: STEPS[step]?.title ?? "",
    facts: {
      政策年份: SC_TREAT_YEAR,
      供体城市: donors.map((d) => d.name).join("、") || "没有",
      被处理过却仍在篮子里的城市: badIncluded.map((c) => c.name).join("、") || "无",
      权重: norm.map((n) => `${n.city.name} ${fmt(n.w, 2)}`).join("，"),
      "改气前拟合误差（越小越贴）": fmt(preFit, 2),
      "最后一年缺口（μg/m³）": fmt(gapNow, 1),
      安慰剂城市: placeboCity?.name ?? "还没跑",
      安慰剂缺口: placeboFit ? fmt(placeboFit.gap, 1) : "—",
      全部安慰剂: ranAll ? `已跑 ${placeboAll.length} 个` : "还没跑",
      "岚城极端程度排名（共几座城市）": ranAll ? `第 ${moreExtreme + 1} 名，共 ${totalUnits} 座` : "—",
      "校正后近似 p 值": approxP !== null ? fmt(approxP, 2) : "—",
    },
    hints: hints.length ? hints : ["先把已被同类政策处理过的城市从篮子里拿掉。"],
  });

  return (
    <LessonShell
      lesson="岚城煤改气"
      subtitle="合成控制：拿一篮子城市的加权平均，拼一个没改气的岚城"
      steps={STEPS}
      step={step}
      onStep={setStep}
    >
      {step === 0 && (
        <Panel title="情况" hint="2014 年只有岚城强制煤改气。结果是年均 PM2.5（μg/m³）。">
          <p className="text-sm leading-relaxed">
            只有一座城被处理，任何单个城市都可能碰巧不像岚城。办法是：
            <span className="text-copper">给一篮子未处理城市配非负权重、加总为 1</span>
            ，让改气前的轨迹贴住岚城，再把这条合成路径当成岚城若不改气的路。
          </p>
          <div className="mt-3">
            <Callout>只能在篮子里插值，不能出现负权重，也不能硬外推到篮子之外。</Callout>
          </div>
        </Panel>
      )}

      {step === 1 && (
        <Panel title="开关供体城市" hint="一开始篮子是空的，由你来挑。被同类政策处理过的城市不能进篮子。">
          {!donors.length && (
            <div className="mb-3">
              <Callout>还没选任何城市。点下面的城市卡片把它放进篮子，至少挑两三座没被处理过的。</Callout>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {donorsAll.map((c) => {
              const active = on.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setOn((p) => (p.includes(c.key) ? p.filter((x) => x !== c.key) : [...p, c.key]));
                    track("挑选城市", "供体开关", `${c.name} ${active ? "移出" : "加入"}`);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? c.alreadyTreated
                        ? "border-rose bg-rose/10"
                        : "border-copper bg-copper/10"
                      : "border-border hover:border-copper/60"
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{c.name}</span>
                    <span className="num text-muted-foreground">改气前 PM2.5 {fmt(c.pm[PRE_LEN - 1] ?? 0, 1)}</span>
                  </div>
                  {c.note && <div className="mt-1 text-[11px] text-rose">{c.note}</div>}
                </button>
              );
            })}
          </div>
          {badIncluded.length > 0 && (
            <div className="mt-3">
              <Callout tone="rose">
                篮子里还有被处理过的城市，合成路径会把它们的政策效果带进来，先拿掉再进下一页。
              </Callout>
            </div>
          )}
        </Panel>
      )}

      {(step === 2 || step === 3 || step === 4) && (
        <Panel title="岚城与合成岚城" hint="竖线是 2014 年改气。两线之间的缺口就是估计。">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                <ReferenceLine
                  x={String(SC_TREAT_YEAR)}
                  stroke="var(--copper)"
                  label={{ value: "改气", fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <Line type="monotone" dataKey="岚城" stroke="var(--copper)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="合成岚城" stroke="var(--teal)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                {placeboFit && (
                  <Line
                    type="monotone"
                    dataKey={`安慰剂 ${placeboCity!.name}`}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
                {showAllPaths &&
                  placeboAll.map((r) => (
                    <Line
                      key={r.city.key}
                      type="monotone"
                      dataKey={`安慰剂·${r.city.name}`}
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.35}
                      strokeWidth={1}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="改气前拟合误差" value={preFit} tone={preFit > 3 ? "rose" : "teal"} />
            <Tile label="最后一年缺口" value={gapNow} unit="μg/m³" tone="copper" />
            <Tile label="供体个数" value={donors.length} />
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel
          title="分配权重"
          hint="权重会自动归一化到加总为 1。"
          right={
            <button
              type="button"
              onClick={autoFit}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              自动拟合
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {donors.map((d) => (
              <Dial
                key={d.key}
                label={`${d.name} 权重`}
                value={Math.round((weights[d.key] ?? 0) * 100) / 100}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => {
                  setWeights((p) => ({ ...p, [d.key]: v }));
                  track("分配权重", `${d.name} 权重`, fmt(v, 2));
                }}
              />
            ))}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            归一化后：{norm.map((n) => `${n.city.name} ${fmt(n.w, 2)}`).join("，")}
          </div>
        </Panel>
      )}

      {step === 3 && (
        <GuessBox
          question="先猜：改气让岚城最后一年的 PM2.5 变了多少？（变好是负数）"
          unit="μg/m³"
          truth={gapNow}
          tolerance={4}
          onResolve={(g, ok) => track("对照轨迹", "先猜再对照", `猜 ${fmt(g, 1)}，${ok ? "在容差内" : "偏了"}`)}
        />
      )}

      {step === 4 && !eligible.length && (
        <Panel title="安慰剂检验" hint="需要先有合格的供体城市。">
          <Callout tone="rose">
            篮子里还没有没被处理过的供体城市，没法跑安慰剂。回到「挑选城市」挑几座进来，并到「分配权重」点一次自动拟合。
          </Callout>
        </Panel>
      )}
      {step === 4 && eligible.length > 0 && (
        <>
          <Panel title="第一步：先拿一座城市试跑" hint="挑一座没改气的城市，假装它在 2014 年也改了气，用剩下的城市给它拼合成替身。">
            <p className="text-xs leading-relaxed text-muted-foreground">
              这座城市其实没改气，如果它也冒出大缺口，说明“缺口”这种事光靠巧合就能发生，岚城的缺口就没那么稀奇了。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {eligible.map((c) => (
                <Chip
                  key={c.key}
                  active={placebo === c.key}
                  onClick={() => {
                    setPlacebo(placebo === c.key ? null : c.key);
                    track("安慰剂检验", "第一步·试跑城市", c.name);
                  }}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Tile label="岚城缺口" value={gapNow} unit="μg/m³" tone="copper" />
              <Tile
                label={placeboCity ? `${placeboCity.name} 假装改气的缺口` : "还没选安慰剂"}
                value={placeboFit ? placeboFit.gap : "—"}
                unit={placeboFit ? "μg/m³" : ""}
                tone={placeboFit && Math.abs(placeboFit.gap) > Math.abs(gapNow) ? "rose" : "teal"}
              />
            </div>
            {placeboFit && Math.abs(placeboFit.gap) > Math.abs(gapNow) && (
              <div className="mt-3">
                <Callout tone="rose">
                  {placeboCity!.name} 没改气也掉出这么大的缺口——光看这一座城，岚城的结果就可能只是巧合。
                </Callout>
              </div>
            )}
          </Panel>

          <Panel
            title="第二步：让所有安慰剂一起跑"
            hint="一座城碰巧不算数，要看整群。把每座合格供体城市轮流当成“假岚城”，各跑一次。"
            right={
              <button
                type="button"
                onClick={() => {
                  setRanAll(true);
                  track("安慰剂检验", "第二步·跑全部安慰剂", `${eligible.length} 座城市`);
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                跑全部安慰剂
              </button>
            }
          >
            {!ranAll && (
              <p className="text-xs text-muted-foreground">
                点右上按钮，对 {eligible.length} 座没被处理过的供体城市各做一次完整合成，比较它们的缺口和岚城的 {fmt(gapNow, 1)}。
              </p>
            )}
            {ranAll && (
              <>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart
                      data={placeboAll
                        .map((r) => ({ name: r.city.name, 缺口: Math.round(r.gap * 10) / 10 }))
                        .concat([{ name: "岚城", 缺口: Math.round(gapNow * 10) / 10 }])
                        .sort((a, b) => a.缺口 - b.缺口)}
                    >
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <ReferenceLine y={0} stroke="var(--border)" />
                      <Bar dataKey="缺口" radius={[4, 4, 0, 0]}>
                        {placeboAll
                          .map((r) => ({ name: r.city.name, 缺口: r.gap }))
                          .concat([{ name: "岚城", 缺口: gapNow }])
                          .sort((a, b) => a.缺口 - b.缺口)
                          .map((e) => (
                            <Cell key={e.name} fill={e.name === "岚城" ? "var(--copper)" : "var(--muted-foreground)"} fillOpacity={e.name === "岚城" ? 1 : 0.45} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  注意：这里的柱子按 <span className="text-copper">缺口本身</span> 排队；第三步的表按 <span className="text-copper">|缺口| ÷ 改气前拟合误差</span> 排队。两处用的是同一批城市、同一组数字，但排序口径不同，所以顺序和排名不一样。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Tile label="岚城缺口" value={gapNow} unit="μg/m³" tone="copper" />
                  <Tile label="比岚城更极端的安慰剂" value={`${moreExtreme} / ${placeboAll.length}`} tone={moreExtreme === 0 ? "teal" : "rose"} />
                  <Tile label="岚城极端程度排名" value={`第 ${moreExtreme + 1} / ${totalUnits}`} tone={moreExtreme === 0 ? "teal" : "copper"} />
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showAllPaths}
                    onChange={(e) => {
                      setShowAllPaths(e.target.checked);
                      track("安慰剂检验", "把全部安慰剂路径画到图上", e.target.checked ? "开" : "关");
                    }}
                  />
                  把全部安慰剂路径画到上面的图里（灰色细线）
                </label>
              </>
            )}
          </Panel>

          {ranAll && (
            <Panel title="第三步：校正拟合质量，再下结论" hint="有的安慰剂城市根本拟合不好，大缺口可能是“拼不出来”而不是“真有效果”。">
              <p className="text-xs leading-relaxed text-muted-foreground">
                做法：把每座城市的 <span className="text-copper">|缺口| ÷ 改气前拟合误差</span> 算出来。
                拟合越差，同样的缺口越不可信；用这个比值排队，看岚城排在哪。
              </p>
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-card text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">城市</th>
                      <th className="px-3 py-2 text-right font-medium">缺口</th>
                      <th className="px-3 py-2 text-right font-medium">改气前误差</th>
                      <th className="px-3 py-2 text-right font-medium">|缺口|÷误差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[{ name: "岚城", gap: gapNow, preRmse: preFit, ratio: lanRatio, isLan: true }]
                      .concat(placeboAll.map((r) => ({ name: r.city.name, gap: r.gap, preRmse: r.preRmse, ratio: r.ratio, isLan: false })))
                      .sort((a, b) => b.ratio - a.ratio)
                      .map((r) => (
                        <tr key={r.name} className={r.isLan ? "bg-copper/10 text-copper" : "border-t border-border"}>
                          <td className="px-3 py-1.5">{r.name}{r.isLan ? "（真改气）" : ""}</td>
                          <td className="num px-3 py-1.5 text-right">{fmt(r.gap, 1)}</td>
                          <td className="num px-3 py-1.5 text-right">{fmt(r.preRmse, 2)}</td>
                          <td className="num px-3 py-1.5 text-right">{fmt(r.ratio, 1)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Tile label="岚城的校正比值排名" value={`第 ${ratioMoreExtreme + 1} / ${totalUnits}`} tone={ratioMoreExtreme === 0 ? "teal" : "rose"} />
                <Tile
                  label="近似 p 值"
                  value={approxP !== null ? fmt(approxP, 2) : "—"}
                  tone={approxP !== null && approxP <= 0.2 ? "teal" : "rose"}
                />
              </div>
              <div className="mt-3">
                {approxP !== null && approxP <= 0.2 ? (
                  <Callout>
                    结论：{totalUnits} 座城市里只有约 {fmt(approxP * 100, 0)}% 能碰巧掉出像岚城这么规整的缺口。
                    空气变好大概率不是巧合，煤改气的估计站得住——但前提仍是改气前拟合贴、供体池干净。
                  </Callout>
                ) : (
                  <Callout tone="rose">
                    结论：近似 p 值 {approxP !== null ? fmt(approxP, 2) : "—"}，没改气的城市里也有不少能掉出类似缺口。
                    岚城的下降还挡不住“只是巧合”的解释，先回去检查供体池和改气前拟合，再谈效果。
                  </Callout>
                )}
              </div>
            </Panel>
          )}
        </>
      )}

      {step === 5 && (
        <>
          <AutoReview />
          <Quiz
            question="合成控制的缺口能怎么读？"
            options={[
              "岚城相对这一篮子城市加权路径的差，负数表示空气变好",
              "任何城市煤改气都会得到的效果",
              "岚城和全国平均的差",
            ]}
            answer={0}
            onAnswer={(ok) => track("小结", "选择题", ok ? "答对" : "答错")}
          />
          <Callout>
            权重非负、加总为 1，所以合成岚城只能落在篮子里的城市之间。篮子外的情形不能硬外推。数据为教学合成。
          </Callout>
        </>
      )}
    </LessonShell>
  );
}
