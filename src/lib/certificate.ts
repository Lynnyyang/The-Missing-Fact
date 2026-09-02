export function drawCertificate(canvas: HTMLCanvasElement, name: string, rank: string) {
  const w = 1200;
  const h = 840;
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.fillStyle = "#12161c";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#c47a2c";
  c.lineWidth = 3;
  c.strokeRect(36, 36, w - 72, h - 72);
  c.strokeStyle = "rgba(196,122,44,0.35)";
  c.lineWidth = 1;
  c.strokeRect(52, 52, w - 104, h - 104);

  c.fillStyle = "#ebe6d6";
  c.textAlign = "center";
  c.font = "bold 46px 'Noto Sans SC', sans-serif";
  c.fillText("寻找缺失的事实", w / 2, 170);
  c.fillText("探究政策的真实效应", w / 2, 232);

  c.fillStyle = "#c47a2c";
  c.font = "22px 'Noto Sans SC', sans-serif";
  c.fillText("结业证书", w / 2, 292);

  c.fillStyle = "#ebe6d6";
  c.font = "bold 64px 'Noto Sans SC', sans-serif";
  c.fillText(name, w / 2, 400);

  c.font = "24px 'Noto Sans SC', sans-serif";
  c.fillStyle = "rgba(235,230,214,0.85)";
  c.fillText(`职级：${rank}`, w / 2, 452);
  c.fillText("已完成四种构造反事实的方法：", w / 2, 520);
  c.fillStyle = "#c47a2c";
  c.fillText("随机分组 · 事前事后 · 双重差分 · 合成控制", w / 2, 562);

  c.fillStyle = "rgba(235,230,214,0.6)";
  c.font = "18px 'Noto Sans SC', sans-serif";
  c.fillText("本课全部数据为教学合成数据，不代表任何真实政策评估结论。", w / 2, 668);
  c.fillText(
    `签发日期 ${new Date().toLocaleDateString("zh-CN")}`,
    w / 2,
    706,
  );
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
