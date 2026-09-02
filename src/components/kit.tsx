import { useState, type ReactNode } from "react";
import { fmt } from "@/lib/stats";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  hint,
  children,
  className,
  right,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section className={cn("panel p-4", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide">{title}</h3>}
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Tile({
  label,
  value,
  unit,
  tone = "neutral",
  sub,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "neutral" | "copper" | "teal" | "rose";
  sub?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "copper"
      ? "text-copper"
      : tone === "teal"
        ? "text-teal"
        : tone === "rose"
          ? "text-rose"
          : "text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "panel min-w-0 px-3 py-2 text-left transition-colors",
        onClick && "hover:border-copper cursor-pointer",
        active && "copper-glow",
      )}
    >
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 text-xl leading-tight", toneClass)}>
        {typeof value === "number" ? fmt(value) : value}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </button>
  );
}

export function Chip({
  children,
  active,
  onClick,
  tone = "copper",
  disabled,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: "copper" | "rose" | "teal";
  disabled?: boolean;
}) {
  const on =
    tone === "rose"
      ? "border-rose text-rose bg-rose/10"
      : tone === "teal"
        ? "border-teal text-teal bg-teal/10"
        : "border-copper text-copper bg-copper/10";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs transition-all",
        active ? on : "border-border text-muted-foreground hover:border-copper/60 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

export function Dial({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="num text-sm text-copper">
          {step < 1 ? fmt(value) : value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-copper"
        style={{ accentColor: "var(--copper)" }}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        checked ? "border-copper bg-copper/10" : "border-border hover:border-copper/50",
      )}
    >
      <span
        className={cn(
          "relative h-4 w-8 shrink-0 rounded-full transition-colors",
          checked ? "bg-copper" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all",
            checked ? "left-4.5" : "left-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

/** 先猜再对照 */
export function GuessBox({
  question,
  unit,
  truth,
  tolerance,
  onResolve,
  onReveal,
}: {
  question: string;
  unit: string;
  truth: number;
  tolerance: number;
  onResolve?: (guess: number, ok: boolean) => void;
  onReveal?: () => void;
}) {
  const [guess, setGuess] = useState("");
  const [shown, setShown] = useState(false);
  const g = Number(guess);
  const ok = Math.abs(g - truth) <= tolerance;
  return (
    <div className="panel p-4">
      <p className="text-sm">{question}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          inputMode="decimal"
          placeholder="写下你的猜测"
          className="num w-40 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-copper"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
        <button
          type="button"
          disabled={guess === "" || Number.isNaN(g)}
          onClick={() => {
            setShown(true);
            onReveal?.();
            onResolve?.(g, ok);
          }}
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          对照答案
        </button>
      </div>
      {shown && (
        <p className={cn("num mt-3 text-sm", ok ? "text-teal" : "text-rose")}>
          页面算出来是 {fmt(truth)} {unit}，你猜 {fmt(g)}。
          <span className="ml-1 font-sans text-xs">
            {ok ? "在容差内，读图方向对了。" : "偏了，回到上一步看看对照是怎么来的。"}
          </span>
        </p>
      )}
    </div>
  );
}

export function Quiz({
  question,
  options,
  answer,
  onAnswer,
}: {
  question: string;
  options: string[];
  answer: number;
  onAnswer?: (ok: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="panel p-4">
      <p className="text-sm">{question}</p>
      <div className="mt-3 space-y-2">
        {options.map((o, i) => {
          const state = picked === null ? "idle" : i === answer ? "right" : picked === i ? "wrong" : "idle";
          return (
            <button
              key={o}
              type="button"
              onClick={() => {
                setPicked(i);
                onAnswer?.(i === answer);
              }}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                state === "right" && "border-teal bg-teal/10 text-teal",
                state === "wrong" && "border-rose bg-rose/10 text-rose",
                state === "idle" && "border-border hover:border-copper/60",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Callout({ children, tone = "copper" }: { children: ReactNode; tone?: "copper" | "rose" }) {
  return (
    <div
      className={cn(
        "rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed",
        tone === "rose" ? "border-rose bg-rose/10 text-rose" : "border-copper bg-copper/10 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

export function NoteBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      placeholder="用两句话写下：比较的是谁？对照是怎么来的？"
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-copper"
    />
  );
}
