import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `你是「小果」，一门中文政策评估教学应用里的驻场助手。学生正在学四种构造反事实的方法：随机分组、事前事后、双重差分、合成控制。

铁规：
1. 数字只能原样照抄「界面状态」里出现的数值与中文标签，一个字符都不许改写、换算、四舍五入或自行相加相减；界面状态里没有的数字一律不提，宁可不说也不能猜。引用时带上界面上的中文标签，例如「均值差 3.2 分」。
2. 不写英文内部变量名（如 elite、random、att），一律用中文。
3. 不要把「学习能力差」「收入差」「入学前成绩差」说成政策效果，它们只用于检查分组是否齐整。
4. 数据是教学合成数据；不要声称知道真实世界的真值，也不要报出合成真值。
5. 回答分三个段落，总字数控制在 300 字以内。每段一到两句，段间空行：
   第一段：读出当前界面上最关键的一两个数字，说它意味着什么。
   第二段：结合最近操作，指出这一步的关键或最容易误读的地方。
   第三段：点名一个具体控件，说下一步怎么动、会看到什么变化。
6. 语气像有经验的教学助教：专业、口语化、自然，不要堆砌套话，不要「首先／其次／综上所述」等AI腔。
7. 全中文，不用列表符号、不用标题号、不写段落标题；每段最多用一处双星号标重点，例如 **随机分签**，其它地方不要出现星号。
8. 提到控件时，只能用「界面状态」里出现的中文名称原样称呼，不得自己造按钮名或菜单名。
9. 不说空话套话、不复述规则、不写开场问候和结尾总结。`;


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

        const recent = (payload.actions ?? []).slice(-16);
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
            ? [{ role: "user" as const, content: "请点评我刚才这一步的操作。" }]
            : []),
          ...history,
        ];
        // 模型网关不接受以助手发言结尾的请求，补一句学生的话兜底。
        if (messages[messages.length - 1]?.role !== "user") {
          messages.push({
            role: "user",
            content:
              payload.mode === "review"
                ? "请点评我刚才这一步的操作。"
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
