import { useState } from "react";
import { useApp, type LlmSettings as LlmConfig } from "@/state/app";

const PRESETS: Array<{ label: string; baseUrl: string; model: string }> = [
  {
    label: "通义千问 Qwen（阿里云百炼）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  { label: "Ollama 本地", baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" },
  { label: "OpenAI 兼容自建", baseUrl: "", model: "" },
];

export function LlmSettingsModal({ onClose }: { onClose: () => void }) {
  const { llm, setLlm } = useApp();
  const [form, setForm] = useState<LlmConfig>(llm);

  const field = (k: keyof LlmConfig, label: string, placeholder: string, password = false) => (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        value={String(form[k] ?? "")}
        type={password ? "password" : "text"}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-copper"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold">设置小果使用的大模型</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          填写任意 OpenAI 兼容接口（如通义千问 Qwen）。填好后小果就用你自己的模型说话，密钥只存在本机浏览器里；留空则继续用平台自带模型。
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setForm({ ...form, baseUrl: p.baseUrl, model: p.model })}
              className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-copper hover:text-copper"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          {field("baseUrl", "接口地址 base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")}
          {field("model", "模型名称", "qwen-plus")}
          {field("apiKey", "API Key", "sk-...", true)}
        </div>

        <div className="mt-4 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setLlm({ baseUrl: "", model: "", apiKey: "" });
              onClose();
            }}
            className="rounded-md border border-border px-3 py-2 text-muted-foreground hover:border-rose hover:text-rose"
          >
            清空并用平台模型
          </button>
          <button
            type="button"
            onClick={() => {
              setLlm({
                baseUrl: form.baseUrl.trim(),
                model: form.model.trim(),
                apiKey: form.apiKey.trim(),
              });
              onClose();
            }}
            className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
