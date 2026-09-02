import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Companion } from "./Companion";
import { useApp, rankOf } from "@/state/app";
import { drawCertificate, downloadCanvas } from "@/lib/certificate";
import { cn } from "@/lib/utils";

export const LESSON_FINALS = ["rct-6", "prepost-6", "did-6", "synth-6"];

export function TopBar() {
  const { user, users, profile, login, logout, clearProgress } = useApp();
  const [showCert, setShowCert] = useState(false);
  const done = LESSON_FINALS.every((k) => profile.visited.includes(k));

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-ink/95 px-4 py-2 backdrop-blur">
      <Link to="/" className="text-sm font-semibold tracking-wide">
        寻找缺失的事实<span className="ml-2 text-xs text-muted-foreground">政策评估工作台</span>
      </Link>
      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
        <span className="num rounded-full border border-border px-2 py-1 text-muted-foreground">
          经验 {profile.xp} · {rankOf(profile.xp)}
        </span>
        {done && (
          <button
            type="button"
            onClick={() => setShowCert(true)}
            className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
          >
            领取证书
          </button>
        )}
        <select
          value={user ?? ""}
          onChange={(e) => login(e.target.value)}
          className="rounded-full border border-border bg-card px-2 py-1"
        >
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (confirm("只清空当前用户的学习进度，确定？")) clearProgress();
          }}
          className="rounded-full border border-border px-2 py-1 text-muted-foreground hover:border-rose hover:text-rose"
        >
          清空进度
        </button>
        <button
          type="button"
          onClick={() => setShowLlm(true)}
          className="rounded-full border border-border px-2 py-1 text-muted-foreground hover:border-copper hover:text-copper"
          title="设置小果使用的大模型"
        >
          设置{llm.baseUrl && llm.model ? `（${llm.model}）` : ""}
        </button>
      </div>
      {showCert && <CertificateModal onClose={() => setShowCert(false)} />}
      {showLlm && <LlmSettingsModal onClose={() => setShowLlm(false)} />}
    </header>
  );
}

function CertificateModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useApp();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawCertificate(ref.current, user ?? "同学", rankOf(profile.xp));
  }, [user, profile.xp]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel max-w-3xl p-4" onClick={(e) => e.stopPropagation()}>
        <canvas ref={ref} className="w-full rounded-lg" />
        <div className="mt-3 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => ref.current && downloadCanvas(ref.current, "结业证书.png")}
            className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground"
          >
            下载 PNG
          </button>
          <button
            type="button"
            onClick={() => {
              const w = window.open("");
              if (w && ref.current) {
                w.document.write(
                  `<img src="${ref.current.toDataURL("image/png")}" style="width:100%"/>`,
                );
                w.print();
              }
            }}
            className="rounded-md border border-copper px-3 py-2 text-copper"
          >
            打印 / 存为 PDF
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export function LoginGate({ children }: { children: ReactNode }) {
  const { ready, user, users, login } = useApp();
  const [name, setName] = useState("");
  if (!ready) return <div className="min-h-screen" />;
  if (user) return <>{children}</>;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="panel w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">寻找缺失的事实</h1>
        <h2 className="text-xl font-semibold text-copper">探究政策的真实效应</h2>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          写下你的名字就能开工。进度只存在这台浏览器里，不同名字互不影响。全部数据为教学合成数据。
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            login(name);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你的名字"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-copper"
          />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            进入
          </button>
        </form>
        {users.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {users.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => login(u)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-copper"
              >
                {u}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export type Step = { id: string; title: string };

export function LessonShell({
  lesson,
  subtitle,
  steps,
  step,
  onStep,
  children,
}: {
  lesson: string;
  subtitle: string;
  steps: Step[];
  step: number;
  onStep: (i: number) => void;
  children: ReactNode;
}) {
  const { profile } = useApp();
  return (
    <LoginGate>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 px-4 py-5 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl font-semibold">{lesson}</h1>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
              <nav className="mt-4 flex flex-wrap gap-1.5">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onStep(i)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      i === step
                        ? "border-copper bg-copper/15 text-copper"
                        : profile.visited.includes(s.id)
                          ? "border-teal/50 text-teal"
                          : "border-border text-muted-foreground hover:border-copper/60",
                    )}
                  >
                    {i + 1}. {s.title}
                  </button>
                ))}
              </nav>
              <div className="mt-5 space-y-4 pb-16">{children}</div>
              <div className="flex items-center justify-between border-t border-border pt-4 pb-10">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => onStep(step - 1)}
                  className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-30"
                >
                  上一页
                </button>
                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => onStep(step + 1)}
                    className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                  >
                    下一页
                  </button>
                ) : (
                  <Link to="/" className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                    回首页
                  </Link>
                )}
              </div>
            </div>
          </main>
          <Companion />
        </div>
      </div>
    </LoginGate>
  );
}
