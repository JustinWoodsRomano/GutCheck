// Generates one branded 1200x1200 Open Graph image per restaurant at BUILD
// time (not on-demand), consistent with this site's fully-static
// architecture (output: "export" has no serverless/edge runtime available).
//
// Design: paper background + a soft radial wash in the restaurant's current
// grade color, GUTCHECK wordmark, a stamp-styled grade badge (matches the
// on-site Stamp component), and the restaurant name + neighborhood.
//
// Photo layer: not wired in yet. Restaurant photos require the Google
// Places API (Places Details + Photo), which needs a paid API key that
// hasn't been provisioned. The `photoBuffer` parameter and the bottom
// gradient-fade-for-legibility are already built so a real photo can be
// composited in later with no redesign.
//
// IMPORTANT -- memory: @napi-rs/canvas 1.0.2 leaks native (non-V8-heap)
// memory per canvas that neither GC nor its own clearAllCache() reclaims
// (confirmed by direct testing: RSS grows ~5.8MB/image unboundedly
// regardless of dereferencing, forced gc(), or clearAllCache()). Running
// this in a single long-lived process OOM-kills partway through the
// 9,700+ restaurant set. The fix here is process-level isolation: each
// batch of restaurants runs in its own short-lived child process, which
// the OS fully reclaims on exit, then the next batch gets a clean process.
// worker_threads would NOT fix this since threads share one process's
// memory space; child_process is required.

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, "../assets/fonts");
const THIS_FILE = fileURLToPath(import.meta.url);

const GRADE_META = {
  PASS: { fg: "#2E6B4F", tint: "#E2ECE5", emoji: "\u{1F642}", label: "PASS" },
  CONDITIONAL: { fg: "#B4841D", tint: "#F2E8D3", emoji: "\u{1F62C}", label: "PASS W/ CONDITIONS" },
  FAIL: { fg: "#B7362F", tint: "#F3E1DF", emoji: "\u{1F922}", label: "FAIL" },
};

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  // Registering local fonts is a nice-to-have for on-brand OG images, not a
  // build-correctness requirement -- if the font files aren't present (e.g.
  // a lean deploy payload that intentionally omits large binary assets),
  // canvas falls back to its default sans-serif rather than crashing the
  // entire site build over a social-preview-image detail.
  try {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "ArchivoBlack.ttf"), "Archivo Black");
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "IBMPlexMono-Bold.ttf"), "IBM Plex Mono Bold");
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "IBMPlexMono-Medium.ttf"), "IBM Plex Mono Medium");
  } catch (err) {
    console.warn(`[generate-og-images] Local fonts unavailable (${err.message}); OG images will use the system default font this build.`);
  }
  fontsRegistered = true;
}

// Icon drawing is done entirely with canvas primitives (arcs/paths), not
// emoji glyphs or custom fonts -- @napi-rs/canvas on Vercel's build
// machines has no color-emoji font available, so any emoji character
// (fork/knife, grade smileys) silently renders as a missing-glyph box no
// matter what font is registered. Vector-drawn icons render identically
// everywhere with zero font/glyph dependency.

function drawUtensilsMark(ctx, x, y, size, color) {
  // Small fork+knife glyph matching the site's nav icon silhouette.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Fork: three tines merging into a handle.
  const forkX = size * 0.18;
  ctx.beginPath();
  for (const dx of [-1, 0, 1]) {
    ctx.moveTo(forkX + dx * size * 0.11, 0);
    ctx.lineTo(forkX + dx * size * 0.11, size * 0.32);
  }
  ctx.moveTo(forkX - size * 0.11, size * 0.32);
  ctx.lineTo(forkX + size * 0.11, size * 0.32);
  ctx.lineTo(forkX, size * 0.46);
  ctx.lineTo(forkX, size);
  ctx.stroke();

  // Knife: blade tapering to a straight handle.
  const knifeX = size * 0.82;
  ctx.beginPath();
  ctx.moveTo(knifeX, 0);
  ctx.quadraticCurveTo(knifeX + size * 0.16, size * 0.22, knifeX, size * 0.5);
  ctx.lineTo(knifeX, size);
  ctx.stroke();

  ctx.restore();
}

function drawGradeIcon(ctx, cx, cy, r, grade, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.18;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (grade === "PASS") {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx - r * 0.12, cy + r * 0.38);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.42);
    ctx.stroke();
  } else if (grade === "FAIL") {
    const d = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.moveTo(cx + d, cy - d);
    ctx.lineTo(cx - d, cy + d);
    ctx.stroke();
  } else {
    // CONDITIONAL: exclamation mark.
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.lineTo(cx, cy + r * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.42, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function generateOgImage({ name, neighborhood, grade, photoBuffer = null }) {
  const SIZE = 1200;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  const colors = GRADE_META[grade] || GRADE_META.PASS;
  const FOOTER_H = SIZE * 0.42;

  if (photoBuffer) {
    // Reserved for future Google Places photo compositing. Only in this
    // branch does the photo need a legibility fade under the text.
    const fade = ctx.createLinearGradient(0, SIZE - FOOTER_H, 0, SIZE);
    fade.addColorStop(0, "rgba(28,35,51,0)");
    fade.addColorStop(1, "rgba(28,35,51,0.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else {
    // No photo yet: a clearly-designed two-part card instead of a faded
    // wash over nothing -- a tinted paper top and a solid ink footer band,
    // so the brand tint is actually visible and the name/stamp sit on a
    // deliberate dark panel rather than a barely-there gradient.
    ctx.fillStyle = "#EDEDE6";
    ctx.fillRect(0, 0, SIZE, SIZE - FOOTER_H);
    const radial = ctx.createRadialGradient(SIZE * 0.5, (SIZE - FOOTER_H) * 0.55, 60, SIZE * 0.5, (SIZE - FOOTER_H) * 0.55, SIZE * 0.75);
    radial.addColorStop(0, colors.tint);
    radial.addColorStop(1, "#EDEDE6");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, SIZE, SIZE - FOOTER_H);

    ctx.fillStyle = "#1C2333";
    ctx.fillRect(0, SIZE - FOOTER_H, SIZE, FOOTER_H);
  }

  const headerInk = photoBuffer ? "#FFFFFF" : "#1C2333";
  drawUtensilsMark(ctx, 56, 60, 30, headerInk);
  ctx.fillStyle = headerInk;
  ctx.font = "bold 44px 'IBM Plex Mono Bold', 'Courier New', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("GUTCHECK", 100, 56);

  const stampText = colors.label;
  ctx.font = "bold 38px 'IBM Plex Mono Bold', 'Courier New', monospace";
  const stampTextWidth = ctx.measureText(stampText).width;
  const iconW = 52, stampPadX = 28, stampPadY = 20;
  const stampW = iconW + stampTextWidth + stampPadX * 2 + 12;
  const stampH = 38 + stampPadY * 2;
  const stampX = SIZE - 56 - stampW;
  const stampY = 56;
  ctx.fillStyle = "#F5F5EF";
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(stampX, stampY, stampW, stampH, 16);
  ctx.fill();
  ctx.stroke();
  drawGradeIcon(ctx, stampX + stampPadX + iconW / 2 - 8, stampY + stampH / 2, 17, grade, colors.fg);
  ctx.fillStyle = colors.fg;
  ctx.fillText(stampText, stampX + stampPadX + iconW, stampY + stampPadY + 2);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 84px 'Archivo Black', Impact, 'Arial Narrow Bold', sans-serif";
  ctx.textBaseline = "alphabetic";
  const nameLines = wrapText(ctx, name.toUpperCase(), SIZE - 112);
  let ny = SIZE - 96 - (nameLines.length - 1) * 92;
  for (const line of nameLines) {
    ctx.fillText(line, 56, ny);
    ny += 92;
  }

  ctx.font = "32px 'IBM Plex Mono Medium', 'Courier New', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  return canvas.toBuffer("image/webp", 88);
}

export function generateGenericOgImage() {
  registerFonts();
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#EDEDE6";
  ctx.fillRect(0, 0, W, H);
  const radial = ctx.createRadialGradient(W * 0.28, H * 0.4, 60, W * 0.28, H * 0.4, W * 0.7);
  radial.addColorStop(0, "#E2ECE5");
  radial.addColorStop(1, "#EDEDE6");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  drawUtensilsMark(ctx, 64, 68, 28, "#1C2333");
  ctx.fillStyle = "#1C2333";
  ctx.font = "bold 40px 'IBM Plex Mono Bold', 'Courier New', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("GUTCHECK", 106, 64);

  ctx.font = "900 96px 'Archivo Black', Impact, 'Arial Narrow Bold', sans-serif";
  ctx.fillText("KNOW BEFORE", 64, 220);
  ctx.fillText("YOU EAT.", 64, 322);

  ctx.font = "30px 'IBM Plex Mono Medium', 'Courier New', monospace";
  ctx.fillStyle = "#4B5566";
  ctx.fillText("CHICAGO HEALTH INSPECTION RECORDS \u00B7 OFFICIAL PUBLIC DATA", 64, 460);

  return canvas.toBuffer("image/webp", 88);
}

// --- Child-process batch worker mode ---
// When forked with IPC, this same file acts as the batch worker: it
// receives one small batch of restaurants, renders them, writes the PNGs,
// reports done, and exits -- releasing all leaked native memory with it.

if (process.send) {
  process.on("message", (msg) => {
    if (msg?.type !== "batch") return;
    registerFonts();
    for (const r of msg.items) {
      const outPath = path.join(msg.outDir, `${r.slug}.webp`);
      if (msg.skipExisting && fs.existsSync(outPath)) continue;
      const buf = generateOgImage({ name: r.n, neighborhood: r.nb, grade: r.g });
      fs.writeFileSync(outPath, buf);
    }
    process.send({ type: "done", count: msg.items.length });
    process.exit(0);
  });
}

function runBatch(items, outDir, skipExisting) {
  return new Promise((resolve, reject) => {
    const child = fork(THIS_FILE, [], { stdio: "ignore" });
    let settled = false;
    child.on("message", (msg) => {
      if (msg?.type === "done") {
        settled = true;
        resolve(msg.count);
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!settled) {
        if (code === 0) resolve(items.length);
        else reject(new Error(`OG batch worker exited with code ${code}`));
      }
    });
    child.send({ type: "batch", items, outDir, skipExisting });
  });
}

export async function generateAllOgImages(restaurants, outDir, { skipExisting = false } = {}) {
  fs.mkdirSync(outDir, { recursive: true });

  const pending = skipExisting
    ? restaurants.filter((r) => !fs.existsSync(path.join(outDir, `${r.slug}.webp`)))
    : restaurants;

  if (pending.length === 0) return 0;

  // Small batch size keeps each child process's peak RSS well within safe
  // bounds even given the ~5.8MB/image native leak (batch of 250 -> ~1.5GB
  // peak, well inside a typical build machine's memory).
  const BATCH_SIZE = 300;
  const CONCURRENCY = 2;

  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  let total = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const idx = cursor++;
      const count = await runBatch(batches[idx], outDir);
      total += count;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

  return total;
}
