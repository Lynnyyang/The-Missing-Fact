# The Missing Fact

[English](README.md) | **中文**

政策评估交互工作台。界面标题为「寻找缺失的事实 · 探究政策的真实效应」：同一个人不能同时被处理又不被处理，缺的那个世界要你自己造出来。

英文名 *The Missing Fact* 即「寻找缺失的事实」。界面为中文。驻场助教叫 **小果**，看着你刚点过的控件给指导。

GitHub 仓库：<https://github.com/Lynnyyang/proactive-assist-bot>  
在线演示：<https://proactive-assist-bot.lovable.app>

---

## 这是什么

TanStack Start 应用：一个总入口加五课。每个控件都会改图或改数：拖名额、重抽签、点学生换组、换对照街区、调供体权重、把政策年份改成假的。设计要求是比静态讲义多很多交互，并且让 AI 助手随时看到用户的操作和界面数据。

房价、成绩、客流、PM2.5 **全部是教学合成数据**，不代表任何真实政策结论。

---

## 课程

| 路由 | 课名 | 方法 | 故事 |
| --- | --- | --- | --- |
| `/basics` | 两个世界 | 潜在结果 | 翻牌、掷硬币分组，把「观测差 ＝ ATT ＋ 选择偏差」玩出来 |
| `/rct` | 青藤抽签 | 随机分组 | 实验班学位只够一半申请者，按成绩录取还是随机抽签？ |
| `/prepost` | 碧石渡免票 | 事前事后 | 2018 年 7 月渡轮免票，用这座岛自己的过去当对照 |
| `/did` | 银线通车 | 双重差分与匹配 | 地铁银线穿过四个街区，房价涨了多少是通车带来的？ |
| `/synth` | 安城煤改气 | 合成控制 | 只有一座城被处理，用一篮子城市加权拼一个安城 |

每课六页。顶栏有经验值与职级。四门正课都结完可领证书。

---

## 助教小果

侧栏助教。回答只依据 **界面上的中文标签与数字** 和 **最近操作**。可选大模型：

- 设置留空：服务器若配置了 `LOVABLE_API_KEY`，走 Lovable 网关
- 或在应用内填写 OpenAI 兼容接口（通义千问 / Ollama / 自建）。密钥只存在 **本机浏览器**，不进仓库

没有密钥时课程仍可做，只是对话助教不可用。

---

## 技术栈

TanStack Start、React 19、TypeScript、Tailwind CSS 4、Vite 8、Recharts。

---

## 本地运行

需要 Node.js 与 npm（也可用 bun）。

```bash
git clone https://github.com/Lynnyyang/proactive-assist-bot.git
cd proactive-assist-bot
npm install
npm run dev
```

打开终端给出的地址。

```bash
npm run build
npm run preview
npm run lint
```

可选环境变量：`LOVABLE_API_KEY`（默认助教后端）。

---

## 目录

```
src/
  routes/
    index.tsx          # 总入口
    basics.tsx
    rct.tsx
    prepost.tsx
    did.tsx
    synth.tsx
    api/chat.ts        # 小果
  components/
    Shell.tsx          # 登录、经验、证书
    Companion.tsx
    LlmSettings.tsx
  lib/synth.ts
  state/app.tsx
```

文件路由约定见 `src/routes/README.md`。不要再建 Next.js 风格的 `src/pages/`。
