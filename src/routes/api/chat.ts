import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `你是「小果」，一门计量经济学政策评估课程教学应用里的驻场助教。学生正在学四种构造反事实的方法：随机分组、事前事后、双重差分、合成控制。你的回答依据只有两样东西：当前「界面状态」（页面上的中文标签与数字）和「最近操作」记录，除此之外不要引入任何信息。

铁规：
1. 数字只能原样照抄「界面状态」里出现的数值与中文标签，一个字符都不许改写、换算、四舍五入或自行相加相减；界面状态里没有的数字一律不提，宁可不说也不能猜。引用时带上界面上的中文标签，例如「均值差 3.2 分」。
2. 不写英文内部变量名（如 elite、random、att），一律用中文。
3. 不要把「学习能力差」「收入差」「入学前成绩差」说成政策效果，它们只用于检查分组是否齐整。
4. 数据是教学合成数据；不要声称知道真实世界的真值，也不要报出合成真值。
5. 用计量经济学政策分析的专业框架回答：说清比较的双方是谁、识别假设是什么、当前结果在什么条件下才能解释为因果效应、哪些现实麻烦（不依从、缺考、溢出、趋势不平行等）会破坏这个解释。概念使用要准确严谨，但表达要像有经验的真人助教，自然、具体、不堆砌套话，不要「首先／其次／综上所述」等AI腔。
6. 问候、打招呼、道谢等日常寒暄要自然回应：用一两句简短亲切的话接住学生，然后顺势把话题带回当前课程页面，例如「你好呀，我在呢。先看看眼前这张图，要不要点一下再抽一次试试？」。除此之外与政策评估、计量经济学或当前课程内容无关的实质性问题（常识问答、编程、其它学科等）不予回答，只用一句话礼貌说明自己只陪学生上这门课，例如「这个问题超出咱们这门课的范围了，我还是陪你把眼前这个实验看懂吧。」然后停住，不要展开。
7. 课程问题的回答分三个段落，总字数控制在 300 字以内。每段一到两句，段间空行（问候、寒暄类回应不受此限，简短亲切即可，一两句话说完，不必分段）：
   第一段：读出当前界面上最关键的一两个数字，说它意味着什么。
   第二段：结合最近操作，指出这一步的关键或最容易误读的地方。
   第三段：点名一个具体控件，说下一步怎么动、会看到什么变化。
8. 全中文，不用列表符号、不用标题号、不写段落标题；每段最多用一处双星号标重点，例如 **随机分签**，其它地方不要出现星号。
9. 提到控件时，只能用「界面状态」里出现的中文名称原样称呼，不得自己造按钮名或菜单名。
10. 不说空话套话、不复述规则、不写开场问候和结尾总结。
11. 点评（学生请你点评这一步或进入小结页）时，三段要落在「操作—证据—知识是否到位」上：
    第一段：照着「最近操作」说学生实际动过哪些控件、界面上因此变成了哪几个数字。
    第二段：判断这一课该掌握的要点有没有真正做到——比较的双方是否说得清、识别假设有没有被检验过、该动的关键控件（例如反复抽签看波动、开关现实麻烦、挪安慰剂时间、换对照）是不是还没动过；没做到就直接点明缺口，做到了就明确肯定，不要含糊。
    第三段：针对这个缺口给一步具体动作，点名界面上真实存在的控件，并说清动完该看哪个数字怎么变。`;


const REVIEW_ASK =
  "请结合我刚才的操作点评一下：我动了哪些控件、界面上的数字变成了什么，这一课该掌握的要点我有没有真的做到，还差哪一步。";

type Llm = { baseUrl?: string; model?: string; apiKey?: string };

async function callGateway(body: unknown, key: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
}

/** 用户自备的 OpenAI 兼容接口（如通义千问 Qwen） */
async function callCustom(body: unknown, llm: Llm) {
  const base = (llm.baseUrl ?? "").trim().replace(/\/+$/, "");
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(llm.apiKey ? { Authorization: `Bearer ${llm.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        let payload: {
          messages?: Msg[];
          snapshot?: unknown;
          actions?: Array<{ page: string; control: string; value: string }>;
          mode?: "review" | "chat";
          llm?: Llm;
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ error: "请求格式不对。" }, { status: 400 });
        }
        const custom =
          payload.llm && payload.llm.baseUrl?.trim() && payload.llm.model?.trim()
            ? payload.llm
            : null;
        if (!custom && !key) {
          return Response.json(
            { error: "服务端缺少 AI 密钥，请在右上角「设置」里填写你自己的模型。" },
            { status: 500 },
          );
        }

        const recent = payload.actions ?? [];
        const stateText = [
          "【界面状态】",
          JSON.stringify(payload.snapshot ?? {}, null, 1),
          "",
          "【最近操作，越靠后越新】",
          recent.length
            ? recent.map((a) => `${a.page} · ${a.control} → ${a.value}`).join("\n")
            : "（学生还没动控件）",
        ].join("\n");

        const history = (payload.messages ?? []).slice(-12);
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: SYSTEM },
          { role: "system", content: stateText },
          ...(payload.mode === "review"
            ? [{ role: "user" as const, content: REVIEW_ASK }]
            : []),
          ...history,
        ];
        // 模型网关不接受以助手发言结尾的请求，补一句学生的话兜底。
        if (messages[messages.length - 1]?.role !== "user") {
          messages.push({
            role: "user",
            content:
              payload.mode === "review"
                ? REVIEW_ASK
                : "请结合我现在的界面状态继续说下去。",
          });
        }

        try {
          const res = custom
            ? await callCustom(
                { model: custom.model!.trim(), messages, temperature: 0.4 },
                custom,
              )
            : await callGateway(
                { model: "openai/gpt-5.6-sol", messages },
                key!,
              );
          if (!res.ok) {
            const text = await res.text();
            const msg =
              res.status === 402
                ? "工作区的 AI 额度用完了，请补充额度后再请小果点评。"
                : res.status === 429
                  ? "请求太密了，稍等几秒再点。"
                  : `小果这次没答上来（${res.status}）：${text.slice(0, 200)}`;
            return Response.json({ error: msg }, { status: res.status });
          }
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const raw = data.choices?.[0]?.message?.content ?? "";
          const reply = raw
            .replace(/<think>[\s\S]*?<\/think>/g, "")
            .replace(/[#`>]/g, "")
            .replace(/\*{3,}/g, "**")
            .trim();
          return Response.json({ reply: reply || "小果没能整理出话来，再点一次试试。" });
        } catch (e) {
          return Response.json(
            { error: `连不上模型网关：${e instanceof Error ? e.message : "未知错误"}` },
            { status: 502 },
          );
        }
      },
    },
  },
});
