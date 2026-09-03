/**
 * 把小果回答里的 **重点** 渲染成铜色高亮；按空行/换行切成段落，
 * 每段首行缩进两格，段间留出间距。
 */
function renderInline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <mark key={i} className="rounded bg-copper/20 px-1 font-semibold text-copper">
        {p.slice(2, -2)}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const paras = text
    .split(/\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className={`space-y-2 leading-relaxed ${className}`}>
      {paras.map((para, i) => (
        <p key={i} style={{ textIndent: "2em" }}>
          {renderInline(para)}
        </p>
      ))}
    </div>
  );
}
