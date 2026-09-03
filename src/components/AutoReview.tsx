import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/state/app";
import { Panel } from "@/components/kit";
import { RichText } from "@/components/RichText";

/**
 * 小结页自动点评：进入本页时把界面状态与本课操作记录自动发给小果，
 * 学生不需要手动提交。
 */
export function AutoReview({ page = "小结" }: { page?: string } = {}) {
  const { snapshot, actions, llm } = useApp();
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  const ask = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "review",
          messages: [],
          snapshot,
          actions: actions.map((a) => ({ page: a.page, control: a.control, value: a.value })),
          llm,
        }),
      });
      const ct = res.headers.get("Content-Type") ?? "";
      if (!res.ok || !res.body || ct.includes("application/json")) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "小果暂时没答上来。");
        return;
      }
      setReply("");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setReply(acc);
      }
      if (!acc.trim()) setReply("小果没能整理出话来，可以点「重新点评」。");
    } catch {
      setError("网络没通，稍后可以重新生成。");
    } finally {
      setBusy(false);
    }
  }, [snapshot, actions, llm]);

  useEffect(() => {
    // 等到本页的界面状态真正就位后再自动发送，避免用上一页的数据点评。
    if (fired.current || !snapshot || snapshot.page !== page) return;
    fired.current = true;
    const t = setTimeout(() => void ask(), 300);
    return () => clearTimeout(t);
  }, [snapshot, ask, page]);

  const count = actions.length;

  return (
    <Panel
      title="小果给这一课的点评"
      hint={`已自动读取本课界面状态和 ${count} 条操作记录，无需手动提交。`}
      right={
        <button
          type="button"
          disabled={busy}
          onClick={() => void ask()}
          className="rounded-md border border-copper px-2 py-1 text-[11px] text-copper disabled:opacity-40"
        >
          重新点评
        </button>
      }
    >
      {busy && <p className="text-xs text-copper">小果正在回看你这一课的操作…</p>}
      {error && !busy && <p className="text-xs text-rose">{error}</p>}
      {reply && !busy && <RichText text={reply} className="text-sm text-foreground/90" />}
    </Panel>
  );
}
