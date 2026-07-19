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

import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, "../assets/fonts");
const THIS_FILE = fileURLToPath(import.meta.url);

// The actual brand mark (public/gutcheck-mark.png), loaded once and reused
// for every image this module draws. Previously this drew a hand-coded
// approximation of a fork+knife via canvas paths (drawUtensilsMark, now
// removed) -- close enough at a glance but visibly not the real logo once
// you compare them side by side, which is exactly what showed up in a
// live share-preview screenshot. Loading the real asset guarantees pixel
// fidelity with the actual brand mark instead of a lookalike.
let logoImage = null;
try {
  logoImage = await loadImage(path.resolve(__dirname, "../public/gutcheck-mark.png"));
} catch (err) {
  console.warn(`[generate-og-images] Could not load public/gutcheck-mark.png (${err.message}); OG images will omit the mark this build.`);
}

// Draws the real logo at (x, y) sized to `size` square. The source PNG is
// square (42x42) with transparency, so a simple square draw preserves its
// proportions at any target size.
function drawLogoMark(ctx, x, y, size) {
  if (!logoImage) return;
  ctx.drawImage(logoImage, x, y, size, size);
}

// Bump this whenever the visual design changes OR the underlying data
// pipeline changes in a way that could make a cached image show
// incorrect information (e.g. the restaurant-grouping fix that changed
// some restaurants' grade/violation data -- those slugs' cached images
// needed to regenerate against the corrected data, not just future
// design tweaks). The build cache persists public/og/*.webp between
// deploys, and generateAllOgImages skips any file that already exists --
// without a version check, either kind of change would otherwise
// silently never apply to a restaurant that already had an image,
// forever. fetch-data.mjs reads this to decide whether to wipe the cache
// before regenerating.
export const OG_DESIGN_VERSION = 4;

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

// Icon drawing for the grade badge is done entirely with canvas primitives
// (arcs/paths), not emoji glyphs or custom fonts -- @napi-rs/canvas on
// Vercel's build machines has no color-emoji font available, so any emoji
// character (grade smileys) silently renders as a missing-glyph box no
// matter what font is registered. Vector-drawn icons render identically
// everywhere with zero font/glyph dependency. The brand mark itself is now
// the real logo image (see drawLogoMark above) rather than a hand-drawn
// approximation.

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

function wrapText(ctx, text, maxWidth, maxLines = 2) {
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
  return lines.slice(0, maxLines);
}

function drawWarningTriangle(ctx, cx, cy, size, color) {
  // Matches the lucide AlertTriangle silhouette used next to each
  // violation on the live site: a rounded triangle outline with a
  // vertical bar and a dot for the exclamation mark.
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const h = size * 0.92;
  const top = { x: cx, y: cy - h * 0.55 };
  const left = { x: cx - size * 0.55, y: cy + h * 0.45 };
  const right = { x: cx + size * 0.55, y: cy + h * 0.45 };
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.14);
  ctx.lineTo(cx, cy + size * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.32, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

  // headerInk still governs the wordmark color for the (currently unused)
  // photo-background variant, but the logo mark itself is a fixed dark-ink
  // PNG now rather than a stroke-colored path drawing -- if the photo
  // layer gets wired in later, this mark would need a white variant asset
  // to stay legible on a dark photo background.
  const headerInk = photoBuffer ? "#FFFFFF" : "#1C2333";
  drawLogoMark(ctx, 64, 60, 52);
  ctx.fillStyle = headerInk;
  ctx.font = "bold 60px 'IBM Plex Mono Bold', 'Courier New', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("GUTCHECK", 138, 64);

  // Short, single-word label at large scale -- this badge is the entire
  // point of the card (a stranger should be able to read PASS/FAIL from a
  // thumbnail-sized preview), so it gets real visual weight instead of
  // being a small corner detail. Full "Pass w/ Conditions" phrasing lives
  // on the page itself.
  const stampText = grade === "CONDITIONAL" ? "CONDITIONAL" : grade;
  ctx.font = "900 64px 'IBM Plex Mono Bold', 'Courier New', monospace";
  const stampTextWidth = ctx.measureText(stampText).width;
  const iconD = 84, stampPadX = 40, stampPadY = 30, gap = 20;
  const stampW = iconD + gap + stampTextWidth + stampPadX * 2;
  const stampH = iconD + stampPadY * 2;
  const stampX = SIZE - 64 - stampW;
  const stampY = 190;
  ctx.fillStyle = "#F5F5EF";
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(stampX, stampY, stampW, stampH, 24);
  ctx.fill();
  ctx.stroke();
  drawGradeIcon(ctx, stampX + stampPadX + iconD / 2, stampY + stampH / 2, iconD / 2, grade, colors.fg);
  ctx.fillStyle = colors.fg;
  ctx.textBaseline = "middle";
  ctx.fillText(stampText, stampX + stampPadX + iconD + gap, stampY + stampH / 2 + 4);

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

  drawLogoMark(ctx, 64, 61, 44);
  ctx.fillStyle = "#1C2333";
  ctx.font = "bold 52px 'IBM Plex Mono Bold', 'Courier New', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("GUTCHECK", 126, 64);

  ctx.font = "900 96px 'Archivo Black', Impact, 'Arial Narrow Bold', sans-serif";
  ctx.fillText("KNOW BEFORE", 64, 220);
  ctx.fillText("YOU EAT.", 64, 322);

  ctx.font = "30px 'IBM Plex Mono Medium', 'Courier New', monospace";
  ctx.fillStyle = "#4B5566";
  ctx.fillText("CHICAGO HEALTH INSPECTION RECORDS \u00B7 OFFICIAL PUBLIC DATA", 64, 460);

  return canvas.toBuffer("image/webp", 88);
}

// A "screenshot" of a single violation, styled to match the on-site
// .violation.critical / .violation.noncritical treatment exactly (same
// tint colors, same left accent bar concept, same severity label), plus a
// GUTCHECK watermark. This is the share target for individual violations
// -- landscape so it reads well both as a link preview and, later, as a
// Story background.
export function generateViolationOgImage({ name, neighborhood, violationText, severity }) {
  registerFonts();
  const W = 1200, H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const isCritical = severity === "c";
  const accent = isCritical ? "#B7362F" : "#B4841D";
  // Matches --stamp-red-tint for critical; noncritical violations on-site
  // sit on --paper-light rather than a colored tint, so the accent bar and
  // badge carry all the color signal in that case.
  const bg = isCritical ? "#F3E1DF" : "#F5F5EF";
  const padX = 72;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, H);

  drawLogoMark(ctx, padX, 43, 34);
  ctx.fillStyle = "#1C2333";
  ctx.font = "bold 40px 'IBM Plex Mono Bold', 'Courier New', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("GUTCHECK", padX + 62, 46);

  const sevLabel = isCritical ? "PRIORITY VIOLATION" : "CORE VIOLATION";
  ctx.font = "bold 26px 'IBM Plex Mono Bold', 'Courier New', monospace";
  const sevW = ctx.measureText(sevLabel).width;
  const badgePadX = 22;
  const badgeH = 50;
  const badgeW = sevW + badgePadX * 2;
  const badgeX = W - padX - badgeW;
  const badgeY = 42;
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.fillText(sevLabel, badgeX + badgePadX, badgeY + badgeH / 2 + 2);

  ctx.fillStyle = "#1C2333";
  ctx.font = "900 52px 'Archivo Black', Impact, 'Arial Narrow Bold', sans-serif";
  ctx.textBaseline = "alphabetic";
  const nameLines = wrapText(ctx, name.toUpperCase(), W - padX * 2, 2);
  let ny = 188;
  for (const line of nameLines) {
    ctx.fillText(line, padX, ny);
    ny += 58;
  }

  ctx.font = "26px 'IBM Plex Mono Medium', 'Courier New', monospace";
  ctx.fillStyle = "#4B5566";
  ctx.fillText(`${neighborhood.toUpperCase()} \u00B7 CHICAGO`, padX, ny + 6);
  ny += 56;

  ctx.strokeStyle = "rgba(28,35,51,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, ny);
  ctx.lineTo(W - padX, ny);
  ctx.stroke();
  ny += 54;

  drawWarningTriangle(ctx, padX + 20, ny + 18, 40, accent);
  const textX = padX + 68;
  const textMaxWidth = W - padX - textX;

  ctx.fillStyle = "#1C2333";
  ctx.font = "42px Georgia, 'Source Serif 4', serif";
  ctx.textBaseline = "alphabetic";
  const quoteLines = wrapText(ctx, `\u201C${violationText}\u201D`, textMaxWidth, 8);
  let qy = ny + 24;
  for (const line of quoteLines) {
    ctx.fillText(line, textX, qy);
    qy += 54;
  }

  ctx.font = "24px 'IBM Plex Mono Medium', 'Courier New', monospace";
  ctx.fillStyle = "#8A93A3";
  ctx.textBaseline = "bottom";
  ctx.fillText("gutcheckchicago.com", padX, H - 44);

  return canvas.toBuffer("image/webp", 88);
}
// When forked with IPC, this same file acts as the batch worker: it
// receives one small batch of restaurants, renders them, writes the PNGs,
// reports done, and exits -- releasing all leaked native memory with it.

if (process.send) {
  process.on("message", (msg) => {
    if (msg?.type !== "batch") return;
    registerFonts();
    if (msg.kind === "violation") {
      for (const item of msg.items) {
        const outPath = path.join(msg.outDir, `${item.slug}-${item.index + 1}.webp`);
        if (msg.skipExisting && fs.existsSync(outPath)) continue;
        const buf = generateViolationOgImage({
          name: item.n,
          neighborhood: item.nb,
          violationText: item.text,
          severity: item.severity,
        });
        fs.writeFileSync(outPath, buf);
      }
    } else {
      for (const r of msg.items) {
        const outPath = path.join(msg.outDir, `${r.slug}.webp`);
        if (msg.skipExisting && fs.existsSync(outPath)) continue;
        const buf = generateOgImage({ name: r.n, neighborhood: r.nb, grade: r.g });
        fs.writeFileSync(outPath, buf);
      }
    }
    process.send({ type: "done", count: msg.items.length });
    process.exit(0);
  });
}

function runBatch(items, outDir, skipExisting, kind = "restaurant") {
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
    child.send({ type: "batch", items, outDir, skipExisting, kind });
  });
}

async function runAllBatches(pending, outDir, skipExisting, kind) {
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
      const count = await runBatch(batches[idx], outDir, skipExisting, kind);
      total += count;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

  return total;
}

export async function generateAllOgImages(restaurants, outDir, { skipExisting = false } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const pending = skipExisting
    ? restaurants.filter((r) => !fs.existsSync(path.join(outDir, `${r.slug}.webp`)))
    : restaurants;
  return runAllBatches(pending, outDir, skipExisting, "restaurant");
}

// Flattens every restaurant's violations into individual share-card jobs.
// Only restaurants with current violations produce anything -- PASS
// restaurants with a clean current inspection contribute zero images.
export async function generateAllViolationOgImages(restaurants, outDir, { skipExisting = false } = {}) {
  fs.mkdirSync(outDir, { recursive: true });

  const allItems = [];
  for (const r of restaurants) {
    (r.v || []).forEach((v, index) => {
      allItems.push({ slug: r.slug, n: r.n, nb: r.nb, index, text: v.t, severity: v.s });
    });
  }

  const pending = skipExisting
    ? allItems.filter((item) => !fs.existsSync(path.join(outDir, `${item.slug}-${item.index + 1}.webp`)))
    : allItems;

  return runAllBatches(pending, outDir, skipExisting, "violation");
}
