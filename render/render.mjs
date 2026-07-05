// Renders animation/index.html to a 1080x1920 (9:16) H.264 MP4.
// Usage: node render/render.mjs [--fps 30] [--duration 10] [--out output/food-wagon-pr.mp4]
import { chromium } from "playwright-core";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const FPS = Number(opt("fps", 30));
const DURATION = Number(opt("duration", 10));
const OUT = path.resolve(root, opt("out", "output/food-wagon-pr.mp4"));
const WIDTH = 1080, HEIGHT = 1920;
const FRAMES = Math.round(FPS * DURATION);
const framesDir = path.join(root, "render", ".frames");

const CHROMIUM = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const FFMPEG =
  process.env.FFMPEG_PATH ||
  execFileSync("python3", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"])
    .toString().trim();

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.goto("file://" + path.join(root, "animation", "index.html"));
await page.waitForFunction("typeof window.seek === 'function'");

console.log(`Rendering ${FRAMES} frames at ${FPS}fps (${WIDTH}x${HEIGHT})...`);
for (let f = 0; f < FRAMES; f++) {
  await page.evaluate(t => window.seek(t), f / FPS);
  await page.screenshot({ path: path.join(framesDir, `f${String(f).padStart(4, "0")}.png`) });
  if (f % 30 === 0) console.log(`  frame ${f}/${FRAMES}`);
}
await browser.close();

console.log("Encoding MP4 with libx264...");
const enc = spawnSync(FFMPEG, [
  "-y", "-framerate", String(FPS),
  "-i", path.join(framesDir, "f%04d.png"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  OUT,
], { stdio: ["ignore", "inherit", "inherit"] });
if (enc.status !== 0) {
  console.error("ffmpeg failed");
  process.exit(1);
}

rmSync(framesDir, { recursive: true, force: true });
console.log(`Done: ${OUT} (${readdirSync(path.dirname(OUT)).join(", ")})`);
