# The Missing Fact

**English** | [中文](README.zh-CN.md)

Interactive policy-evaluation workbench. The on-screen title is「寻找缺失的事实 · 探究政策的真实效应」: the same person cannot be treated and untreated at once, so you have to **build the missing world** yourself.

*The Missing Fact* is the English name of that title. The UI is in Chinese. A companion tutor named 小果 (Little Guo) watches what you click and comments.

GitHub repository: <https://github.com/Lynnyyang/The-Missing-Fact>  
Live app: <https://proactive-assist-bot.lovable.app>

---

## What this is

A TanStack Start app with a hub plus five lessons. Controls change charts and numbers: drag quotas, redraw lots, reassign students, swap comparison neighborhoods, reweight donor cities, or fake the policy year. The original brief was to add far more interaction than a static guide, and to let the AI tutor see the user’s actions and on-screen data.

All house prices, scores, ridership, and PM2.5 series are **synthetic teaching data**. They are not real policy results.

---

## Lessons

| Route | In-app name | Method | Story |
| --- | --- | --- | --- |
| `/basics` | 两个世界 | Potential outcomes | Flip cards, coin-flip assignment, selection bias = observed gap − ATT |
| `/rct` | 青藤抽签 | Randomized assignment | Elite-class seats for only half the applicants: admit by score or by lottery? |
| `/prepost` | 碧石渡免票 | Before–after | Ferry fares dropped to zero in July 2018; the island’s own past is the control |
| `/did` | 银线通车 | Difference-in-differences and matching | Silver Line subway through four blocks: how much of the house-price rise is the line? |
| `/synth` | 安城煤改气 | Synthetic control | Only one city is treated; a weighted basket of cities becomes “Ancheng” |

Each case is six pages. XP and rank live in the top bar. Finish all four main lessons to download a certificate.

---

## Companion (小果)

Sidebar tutor. It only uses **on-screen labels/numbers** and your **recent clicks**. Optional LLM:

- Empty settings: Lovable gateway if `LOVABLE_API_KEY` is set on the server
- Or an OpenAI-compatible endpoint in the in-app settings (Qwen / Ollama / custom). The key stays in the **browser**, not in this repo

Without a key, lessons still run; only the chat tutor is offline.

---

## Stack

TanStack Start, React 19, TypeScript, Tailwind CSS 4, Vite 8, Recharts.

---

## Run locally

Node.js and npm (or bun).

```bash
git clone https://github.com/Lynnyyang/The-Missing-Fact.git
cd The-Missing-Fact
npm install
npm run dev
```

Open the URL printed in the terminal.

```bash
npm run build
npm run preview
npm run lint
```

Optional: `LOVABLE_API_KEY` for the default tutor backend.

---

## Layout

```
src/
  routes/
    index.tsx          # hub
    basics.tsx
    rct.tsx
    prepost.tsx
    did.tsx
    synth.tsx
    api/chat.ts        # 小果
  components/
    Shell.tsx          # login, XP, certificate
    Companion.tsx
    LlmSettings.tsx
  lib/synth.ts         # synthetic-control weights
  state/app.tsx        # progress, users, LLM config
```

File-based routing: see `src/routes/README.md`. Do not add a Next.js-style `src/pages/`.
