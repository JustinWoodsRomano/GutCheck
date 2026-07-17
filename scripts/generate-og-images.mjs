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
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "ArchivoBlack.ttf"), "Archivo Black");
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "IBMPlexMono-Bold.ttf"), "IBM Plex Mono Bold");
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "IBMPlexMono-Medium.ttf"), "IBM Plex Mono Medium");
  fontsRegistered = true;
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

  if (photoBuffer) {
    // Reserved for future Google Places photo compositing.
  } else {
    ctx.fillStyle = "#EDEDE6";
    ctx.fillRect(0, 0, SIZE, SIZE);
    const radial = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.32, 80, SIZE * 0.5, SIZE * 0.32, SIZE * 0.9);
    radial.addColorStop(0, colors.tint);
    radial.addColorStop(1, "#EDEDE6");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  const fade = ctx.createLinearGradient(0, SIZE * 0.45, 0, SIZE);
  fade.addColorStop(0, "rgba(28,35,51,0)");
  fade.addColorStop(1, "rgba(28,35,51,0.92)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = photoBuffer ? "#FFFFFF" : "#1C2333";
  ctx.font = "44px 'IBM Plex Mono Bold'";
  ctx.textBaseline = "top";
  ctx.fillText("\u{1F374} GUTCHECK", 56, 56);

  const stampText = colors.label;
  ctx.font = "38px 'IBM Plex Mono Bold'";
  const stampTextWidth = ctx.measureText(stampText).width;
  const stampPadX = 28, stampPadY = 20, emojiW = 52;
  const stampW = emojiW + stampTextWidth + stampPadX * 2 + 12;
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
  ctx.font = "38px sans-serif";
  ctx.fillStyle = colors.fg;
  ctx.fillText(colors.emoji, stampX + stampPadX, stampY + stampPadY - 2);
  ctx.font = "38px 'IBM Plex Mono Bold'";
  ctx.fillText(stampText, stampX + stampPadX + emojiW, stampY + stampPadY + 2);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "84px 'Archivo Black'";
  ctx.textBaseline = "alphabetic";
  const nameLines = wrapText(ctx, name.toUpperCase(), SIZE - 112);
  let ny = SIZE - 96 - (nameLines.length - 1) * 92;
  for (const line of nameLines) {
    ctx.fillText(line, 56, ny);
    ny += 92;
  }

  ctx.font = "32px 'IBM Plex Mono Medium'";
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

  ctx.fillStyle = "#1C2333";
  ctx.font = "40px 'IBM Plex Mono Bold'";
  ctx.textBaseline = "top";
  ctx.fillText("\u{1F374} GUTCHECK", 64, 64);

  ctx.font = "96px 'Archivo Black'";
  ctx.fillText("KNOW BEFORE", 64, 220);
  ctx.fillText("YOU EAT.", 64, 322);

  ctx.font = "30px 'IBM Plex Mono Medium'";
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
