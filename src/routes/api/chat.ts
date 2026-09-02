import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `你是「小果」，一门中文政策评估教学应用里的驻场助手。学生正在学四种构造反事实的方法：随机分组、事前事后、双重差分、合成控制。

铁规：
1. 只使用界面状态里给出的中文名称与数字，不得编造任何界面上没有的数字。
2. 不写英文内部变量名（如 elite、random、att），一律用中文。
3. 不要把「学习能力差」「收入差」「入学前成绩差」说成政策效果，它们只用于检查分组是否齐整。
4. 数据是教学合成数据，需要时提醒学生；不要声称知道真实世界的真值，也不要报出合成真值。
5. 回答分三段，每段一到两句，中间空行：做对了什么；容易错的一点；下一步点哪里。
6. 全中文，不用 Markdown 符号、不用列表符号、不用标题号。
7. 结合「最近操作」推断学生刚在试什么，点名具体控件。`;

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

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return Response.json({ error: "服务端缺少 AI 密钥，无法请小果说话。" }, { status: 500 });
        }
        let payload: {
          messages?: Msg[];
          snapshot?: unknown;
          actions?: Array<{ page: string; control: string; value: string }>;
          mode?: "review" | "chat";
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ error: "请求格式不对。" }, { status: 400 });
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
          const res = await callGateway(
            { model: "google/gemini-3.6-flash", messages, temperature: 0.4 },
            key,
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
            .replace(/[*#`>]/g, "")
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
