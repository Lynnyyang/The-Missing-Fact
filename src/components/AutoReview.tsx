import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/state/app";
import { Panel } from "@/components/kit";

/**
 * 小结页自动点评：进入本页时把界面状态与本课操作记录自动发给小果，
 * 学生不需要手动提交。
 */
export function AutoReview({ lesson }: { lesson: string }) {
  const { snapshot, actions } = useApp();
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
          actions: actions
            .filter((a) => a.lesson === lesson || !a.lesson)
            .map((a) => ({ page: a.page, control: a.control, value: a.value })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) setError(data.error ?? "小果暂时没答上来。");
      else setReply(data.reply ?? "");
    } catch {
      setError("网络没通，稍后可以重新生成。");
    } finally {
      setBusy(false);
    }
  }, [snapshot, actions, lesson]);

  useEffect(() => {
    if (fired.current || !snapshot) return;
    fired.current = true;
    void ask();
  }, [snapshot, ask]);

  const count = actions.filter((a) => a.lesson === lesson || !a.lesson).length;

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
      {reply && !busy && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{reply}</p>
      )}
    </Panel>
  );
}
