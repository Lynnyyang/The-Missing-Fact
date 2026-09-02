/**
 * 把小果回答里的 **重点** 标记渲染成铜色高亮，其余保持原样换行。
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <p className={`leading-relaxed whitespace-pre-wrap ${className}`}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <mark
            key={i}
            className="rounded bg-copper/20 px-1 font-semibold text-copper"
          >
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}
