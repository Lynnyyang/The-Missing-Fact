import { createFileRoute, Link } from "@tanstack/react-router";
import { LoginGate, TopBar } from "@/components/Shell";
import { Companion } from "@/components/Companion";
import { useApp, useCompanionSnapshot, rankOf } from "@/state/app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "寻找缺失的事实 · 四课工作台" },
      {
        name: "description",
        content: "从随机分组到合成控制，四课交互练习自己动手构造反事实，助手小果实时看着你的操作给指导。",
      },
      { property: "og:title", content: "寻找缺失的事实 · 四课工作台" },
      {
        property: "og:description",
        content: "四种构造反事实的方法，全部可动手：拖滑杆、点表格、换对照、先猜后对照。",
      },
    ],
  }),
  component: Hub,
});

const LESSONS = [
  {
    to: "/rct" as const,
    name: "青藤抽签",
    method: "随机分组",
    story: "实验班学位只够一半申请者，按成绩录取还是随机抽签？",
    key: "rct",
  },
  {
    to: "/prepost" as const,
    name: "碧石渡免票",
    method: "事前事后",
    story: "2018 年 7 月渡轮免票，用这座岛自己的过去当对照。",
    key: "prepost",
  },
  {
    to: "/did" as const,
    name: "银线通车",
    method: "双重差分与匹配",
    story: "地铁银线穿过四个街区，房价涨了多少是通车带来的？",
    key: "did",
  },
  {
    to: "/synth" as const,
    name: "安城煤改气",
    method: "合成控制",
    story: "只有一座城被处理，用一篮子城市加权拼一个安城。",
    key: "synth",
  },
];

function Hub() {
  const { profile } = useApp();
  const doneCount = LESSONS.filter((l) => profile.visited.includes(`${l.key}-6`)).length;

  useCompanionSnapshot({
    lesson: "首页",
    page: "四课入口",
    facts: {
      经验值: profile.xp,
      职级: rankOf(profile.xp),
      已完成课数: doneCount,
      走过的页数: profile.visited.length,
    },
    hints:
      doneCount === 0
        ? ["先从青藤抽签开始：随机分组是最干净的反事实。"]
        : doneCount < 4
          ? [`已经结了 ${doneCount} 课，剩下的方法用在随机化做不到的时候。`]
          : ["四课都走完了，顶栏可以领证书。"],
  });

  return (
    <LoginGate>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 px-4 py-8 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <h1 className="text-3xl leading-tight font-semibold">寻找缺失的事实</h1>
              <h2 className="text-3xl leading-tight font-semibold text-copper">探究政策的真实效应</h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                同一个人不能同时被处理又不被处理。缺的那个世界要你自己造出来。四课里的每个控件都会改图或改数：
                拖名额、重抽签、点学生换组、换对照街区、调供体权重、把政策年份改成假的。小果一直看着你刚点过什么。
              </p>

              <Link
                to="/basics"
                className="panel group mt-6 block p-4 transition-colors hover:border-copper"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-copper">预备课 · 先玩这个</span>
                  <span className={profile.visited.includes("basics-6") ? "text-xs text-teal" : "text-xs text-muted-foreground"}>
                    {profile.visited.includes("basics-6")
                      ? "已结课"
                      : `${profile.visited.filter((v) => v.startsWith("basics-")).length}/6 页`}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold group-hover:text-copper">两个世界</h3>
                <p className="text-xs text-copper">潜在结果与因果效应</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  翻牌看每个人的两格结果、掷硬币分组、拖自选倾向，把「观测差 ＝ ATT ＋ 选择偏差」玩出来，再进案例。
                </p>
              </Link>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {LESSONS.map((l, i) => {
                  const done = profile.visited.includes(`${l.key}-6`);
                  const pages = profile.visited.filter((v) => v.startsWith(`${l.key}-`)).length;
                  return (
                    <Link
                      key={l.key}
                      to={l.to}
                      className="panel group p-4 transition-colors hover:border-copper"
                    >
                      <div className="flex items-center justify-between">
                        <span className="num text-xs text-muted-foreground">第 {i + 1} 课</span>
                        <span className={done ? "text-xs text-teal" : "text-xs text-muted-foreground"}>
                          {done ? "已结课" : `${pages}/6 页`}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold group-hover:text-copper">{l.name}</h3>
                      <p className="text-xs text-copper">{l.method}</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{l.story}</p>
                    </Link>
                  );
                })}
              </div>

              <p className="mt-6 text-[11px] text-muted-foreground">
                房价、成绩、客流、PM2.5 全部是教学合成数据，用于练习方法，不代表任何真实政策结论。
              </p>
            </div>
          </main>
          <Companion />
        </div>
      </div>
    </LoginGate>
  );
}
