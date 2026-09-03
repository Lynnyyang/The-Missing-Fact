import { useEffect, useRef, useState } from "react";
import { useApp } from "@/state/app";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

type Turn = { role: "user" | "assistant"; content: string };

export function Companion() {
  const { snapshot, actions, clearActions, companionWidth, setCompanionWidth, llm } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setCompanionWidth(window.innerWidth - e.clientX);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [setCompanionWidth]);

  async function send(mode: "review" | "chat", text?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next: Turn[] = text ? [...turns, { role: "user", content: text }] : turns;
    if (text) setTurns(next);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: next,
          snapshot,
          actions: actions.map((a) => ({ page: a.page, control: a.control, value: a.value })),
          llm,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) setError(data.error ?? "小果暂时没答上来。");
      else setTurns((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
    } catch {
      setError("网络没通，稍后再点。");
    } finally {
      setBusy(false);
    }
  }

  const recent = actions.slice(-6).reverse();

  return (
    <aside
      className="relative hidden shrink-0 self-start overflow-hidden border-l border-border bg-ink-2/60 lg:sticky lg:top-[45px] lg:flex lg:h-[calc(100vh-45px)] lg:flex-col"
      style={{ width: companionWidth }}
    >
      <div
        onMouseDown={() => (dragging.current = true)}
        className="absolute top-0 -left-1 h-full w-2 cursor-col-resize hover:bg-copper/40"
        title="拖动调整小果窗口宽度"
      />
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-copper text-xs font-bold text-primary-foreground">
            果
          </span>
          <div>
            <div className="text-sm font-semibold">小果</div>
            <div className="text-[11px] text-muted-foreground">看着你的操作说话</div>
          </div>
        </div>
      </header>

      <div className="max-h-40 shrink-0 overflow-y-auto border-b border-border px-4 py-3">
        <div className="text-[11px] tracking-wide text-muted-foreground">即时提醒</div>
        <div className="mt-2 space-y-2">
          {(snapshot?.hints?.length ? snapshot.hints : ["动一下控件，我就开口。"]).map((h) => (
            <p key={h} className="rounded-md border-l-2 border-copper bg-copper/10 px-2 py-1.5 text-xs leading-relaxed">
              {h}
            </p>
          ))}
        </div>
      </div>

      <div className="max-h-36 shrink-0 overflow-y-auto border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] tracking-wide text-muted-foreground">小果看着你的操作</div>
          {actions.length > 0 && (
            <button
              type="button"
              onClick={clearActions}
              className="text-[11px] text-muted-foreground hover:text-copper"
            >
              清除
            </button>
          )}
        </div>
        <ul className="mt-2 space-y-1">
          {recent.length === 0 && <li className="text-xs text-muted-foreground">还没有操作记录。</li>}
          {recent.map((a, i) => (
            <li key={a.at + a.control + i} className="num truncate text-[11px] text-muted-foreground">
              <span className="text-copper">{a.control}</span> → {a.value}
            </li>
          ))}
        </ul>
      </div>

      <div ref={feedRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 && !busy && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            点下面的按钮请我点评这一步，或者直接问我：这里比较的到底是谁？
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              t.role === "user" ? "ml-6 bg-secondary" : "mr-2 border border-border bg-card",
            )}
          >
            <RichText text={t.content} />
          </div>
        ))}
        {busy && <p className="text-xs text-copper">小果正在看你的界面…</p>}
        {error && <p className="text-xs text-rose">{error}</p>}
      </div>

      <div className="shrink-0 border-t border-border bg-ink-2/90 p-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => send("review")}
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          请小果点评这一步
        </button>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = input.trim();
            if (!t) return;
            setInput("");
            void send("chat", t);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问小果…"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-copper"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-copper px-3 py-2 text-xs text-copper disabled:opacity-40"
          >
            发送
          </button>
        </form>
      </div>
    </aside>
  );
}
