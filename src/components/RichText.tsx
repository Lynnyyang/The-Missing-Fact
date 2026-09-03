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

/**
 * 分段规则：空行一定分段；单个换行只有在上一行以句末标点收尾时才分段，
 * 否则视为模型流式输出里的软换行，直接接回同一段，避免句子中间莫名断行。
 */
function toParagraphs(text: string) {
  const paras: string[] = [];
  for (const block of text.split(/\n[ \t]*\n+/)) {
    let cur = "";
    for (const raw of block.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (!cur) {
        cur = line;
      } else if (/[。！？；：!?]["”』）)]?$/.test(cur)) {
        paras.push(cur);
        cur = line;
      } else {
        cur += line;
      }
    }
    if (cur) paras.push(cur);
  }
  return paras;
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const paras = toParagraphs(text);

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
