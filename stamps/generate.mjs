#!/usr/bin/env node
// LINEスタンプ「カプくん」ジェネレーター
// LINE Creators Market 規格:
//   スタンプ画像: W370×H320px 以内 / PNG / 背景透過 / 1MB以下 / 余白約10px
//   メイン画像:   W240×H240px
//   タブ画像:     W96×H74px
// 使い方: node stamps/generate.mjs   → stamps/output/ に main.png / tab.png / 01.png〜16.png / preview.png を出力

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output');
mkdirSync(OUT, { recursive: true });

const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

// ---------- パレット ----------
const C = {
  line: '#5D4037',      // 主線(こげ茶)
  body: '#FFF7EA',      // カップ(クリーム)
  band: '#FF8A70',      // バンド(コーラル)
  coffee: '#8D6E63',    // コーヒー
  blush: '#FFB9AB',     // ほっぺ
  steam: '#C9BBB0',     // 湯気
  accent: '#FF6F52',    // 文字メイン
  blue: '#5C9DFF',
  gold: '#FFC94D',
  green: '#63B860',
  purple: '#9A7BDF',
};

// ---------- パーツ ----------
const eyes = {
  normal: `
    <circle cx="-26" cy="-8" r="7" fill="${C.line}"/><circle cx="-23.5" cy="-10.5" r="2.4" fill="#fff"/>
    <circle cx="26" cy="-8" r="7" fill="${C.line}"/><circle cx="28.5" cy="-10.5" r="2.4" fill="#fff"/>`,
  happy: `
    <path d="M-34,-6 Q-26,-16 -18,-6" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>
    <path d="M18,-6 Q26,-16 34,-6" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>`,
  wink: `
    <circle cx="-26" cy="-8" r="7" fill="${C.line}"/><circle cx="-23.5" cy="-10.5" r="2.4" fill="#fff"/>
    <path d="M18,-8 Q26,-14 34,-8" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>`,
  sad: `
    <path d="M-34,-12 Q-26,-4 -18,-10" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>
    <path d="M18,-10 Q26,-4 34,-12" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>`,
  sleep: `
    <path d="M-34,-8 Q-26,-2 -18,-8" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>
    <path d="M18,-8 Q26,-2 34,-8" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>`,
  sparkle: `
    <g fill="${C.gold}" stroke="${C.line}" stroke-width="2" stroke-linejoin="round">
      <path d="M-26,-18 L-22,-10 L-14,-8 L-22,-6 L-26,2 L-30,-6 L-38,-8 L-30,-10 Z"/>
      <path d="M26,-18 L30,-10 L38,-8 L30,-6 L26,2 L22,-6 L14,-8 L22,-10 Z"/>
    </g>`,
  pien: `
    <g>
      <circle cx="-26" cy="-7" r="10" fill="${C.line}"/>
      <circle cx="-22.5" cy="-11" r="3.6" fill="#fff"/><circle cx="-29" cy="-4" r="2" fill="#fff" opacity="0.9"/>
      <circle cx="26" cy="-7" r="10" fill="${C.line}"/>
      <circle cx="29.5" cy="-11" r="3.6" fill="#fff"/><circle cx="23" cy="-4" r="2" fill="#fff" opacity="0.9"/>
      <path d="M-38,-16 Q-26,-22 -14,-16" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
      <path d="M14,-16 Q26,-22 38,-16" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
    </g>`,
  heart: `
    <g fill="#FF5C7A" stroke="${C.line}" stroke-width="2.5" stroke-linejoin="round">
      <path d="M-26,0 C-33,-8 -41,-6 -40,-13 C-39,-19 -32,-19 -26,-13 C-20,-19 -13,-19 -12,-13 C-11,-6 -19,-8 -26,0 Z"/>
      <path d="M26,0 C19,-8 11,-6 12,-13 C13,-19 20,-19 26,-13 C32,-19 39,-19 40,-13 C41,-6 33,-8 26,0 Z"/>
    </g>`,
};

const mouths = {
  smile: `<path d="M-10,10 Q0,20 10,10" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>`,
  open: `<path d="M-12,8 Q0,26 12,8 Z" fill="${C.line}"/><path d="M-6,15 Q0,20 6,15 Q0,22 -6,15 Z" fill="#FF7B8E"/>`,
  bigopen: `<ellipse cx="0" cy="14" rx="13" ry="11" fill="${C.line}"/><ellipse cx="0" cy="18" rx="7" ry="5" fill="#FF7B8E"/>`,
  wavy: `<path d="M-12,12 Q-6,8 0,12 Q6,16 12,12" fill="none" stroke="${C.line}" stroke-width="4.5" stroke-linecap="round"/>`,
  small: `<circle cx="0" cy="12" r="4" fill="${C.line}"/>`,
  pout: `<path d="M-8,14 Q0,8 8,14" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>`,
};

// 腕: 背面レイヤー(back)はカップの後ろ、前面レイヤー(front)は顔の上に描く。
// カップ幅(±62〜70)を大きくはみ出させてポーズを読み取りやすくする。
function limb(d, hand = null, handR = 10) {
  return `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="16" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${C.body}" stroke-width="9" stroke-linecap="round"/>
    ${hand ? `<circle cx="${hand[0]}" cy="${hand[1]}" r="${handR}" fill="${C.body}" stroke="${C.line}" stroke-width="5"/>` : ''}`;
}
const stubL = limb('M-56,32 Q-76,40 -82,54', [-84, 57, 9]);
const stubR = limb('M56,32 Q76,40 82,54', [84, 57, 9]);

const armPose = {
  down: { back: stubL + stubR },
  up: {
    back:
      limb('M-58,-2 Q-86,-22 -92,-50', [-93, -54, 11]) +
      limb('M58,-2 Q86,-22 92,-50', [93, -54, 11]),
  },
  wave: {
    back:
      stubL +
      limb('M58,-4 Q92,-16 104,-42', [107, -46, 11]) +
      `<g fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round" opacity="0.55">
        <path d="M122,-52 q10,10 8,22"/><path d="M132,-64 q14,14 11,30"/></g>`,
  },
  salute: {
    back: stubR,
    front: limb('M-66,18 Q-94,-2 -60,-20', [-53, -22, 9]),
  },
  pray: {
    back: '',
    front:
      limb('M-64,22 Q-38,46 -13,50', [-8, 52, 10]) +
      limb('M64,22 Q38,46 13,50', [8, 52, 10]),
  },
  stop: {
    back:
      stubR +
      limb('M-58,8 Q-88,6 -102,4', [-108, 2, 13]) +
      `<g stroke="${C.line}" stroke-width="4" stroke-linecap="round" opacity="0.55">
        <line x1="-128" y1="-10" x2="-138" y2="-14"/>
        <line x1="-130" y1="2" x2="-142" y2="2"/>
        <line x1="-128" y1="14" x2="-138" y2="18"/></g>`,
  },
  fist: {
    back: stubL + limb('M58,-4 Q80,-28 76,-58', [75, -63, 12]),
  },
};

// 湯気(2本のゆらゆら)
const steam = (op = 0.85) => `
  <g fill="none" stroke="${C.steam}" stroke-width="7" stroke-linecap="round" opacity="${op}">
    <path d="M-22,-78 q10,-12 0,-24 q-10,-12 0,-22"/>
    <path d="M22,-78 q-10,-12 0,-24 q10,-12 0,-22"/>
  </g>`;

// キャラ本体。cx,cy はカップ中心、scale で拡縮
function capkun({ eye = 'normal', mouth = 'smile', arms = 'down', tilt = 0, showSteam = true, extra = '' } = {}) {
  const pose = armPose[arms] || armPose.down;
  return `
  <g transform="rotate(${tilt})">
    ${showSteam ? steam() : ''}
    ${pose.back || ''}
    <!-- カップ -->
    <path d="M-70,-52 L70,-52 L62,58 Q60,70 46,70 L-46,70 Q-60,70 -62,58 Z"
      fill="${C.body}" stroke="${C.line}" stroke-width="6" stroke-linejoin="round"/>
    <!-- 取っ手 -->
    <path d="M66,-18 q34,-2 32,26 q-2,26 -34,22" fill="none" stroke="${C.line}" stroke-width="6"/>
    <path d="M66,-18 q34,-2 32,26 q-2,26 -34,22" fill="none" stroke="${C.body}" stroke-width="0"/>
    <!-- コーヒー(縁) -->
    <path d="M-70,-52 L70,-52 L68,-38 L-68,-38 Z" fill="${C.coffee}" stroke="${C.line}" stroke-width="6" stroke-linejoin="round"/>
    <!-- バンド -->
    <path d="M-66,-30 L66,-30 L64,-12 L-64,-12 Z" fill="${C.band}"/>
    <!-- 顔 -->
    <g transform="translate(0,22)">
      <circle cx="-44" cy="6" r="9" fill="${C.blush}"/>
      <circle cx="44" cy="6" r="9" fill="${C.blush}"/>
      ${eyes[eye] || eyes.normal}
      ${mouths[mouth] || mouths.smile}
    </g>
    ${pose.front || ''}
    ${extra}
  </g>`;
}

// 文字(白フチ+色)。IPAPGothic はコンテナ内蔵の日本語フォント
function label(text, { x = 185, y = 64, size = 52, color = C.accent, rot = -3, spacing = 0 } = {}) {
  const lines = Array.isArray(text) ? text : [text];
  const tspans = lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * 1.08}">${l}</tspan>`)
    .join('');
  return `
  <text transform="rotate(${rot} ${x} ${y})" x="${x}" y="${y}"
    font-family="'IPAPGothic','IPAGothic',sans-serif" font-weight="bold"
    font-size="${size}" letter-spacing="${spacing}" fill="${color}"
    stroke="#fff" stroke-width="10" paint-order="stroke" stroke-linejoin="round"
    text-anchor="middle">${tspans}</text>`;
}

// 小物
const props = {
  sun: `<g transform="translate(46,118)">
    <circle r="20" fill="${C.gold}" stroke="${C.line}" stroke-width="4"/>
    <g stroke="${C.gold}" stroke-width="5" stroke-linecap="round">
      <line x1="0" y1="-28" x2="0" y2="-36"/><line x1="0" y1="28" x2="0" y2="36"/>
      <line x1="-28" y1="0" x2="-36" y2="0"/><line x1="28" y1="0" x2="36" y2="0"/>
      <line x1="-20" y1="-20" x2="-26" y2="-26"/><line x1="20" y1="20" x2="26" y2="26"/>
      <line x1="20" y1="-20" x2="26" y2="-26"/><line x1="-20" y1="20" x2="-26" y2="26"/>
    </g></g>`,
  moon: `<path transform="translate(300,66) rotate(-24)" d="M0,-24 A24,24 0 1,0 0,24 A18,18 0 1,1 0,-24 Z"
    fill="${C.gold}" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>`,
  zzz: `<g font-family="'IPAPGothic',sans-serif" font-weight="bold" fill="${C.blue}"
      stroke="#fff" stroke-width="6" paint-order="stroke">
    <text x="268" y="140" font-size="34" transform="rotate(12 268 140)">Z</text>
    <text x="296" y="112" font-size="26" transform="rotate(18 296 112)">z</text>
    <text x="316" y="92" font-size="20" transform="rotate(24 316 92)">z</text></g>`,
  hearts: `<g fill="#FF5C7A" stroke="#fff" stroke-width="4" paint-order="stroke">
    <path transform="translate(66,120) scale(1.1) rotate(-14)" d="M0,6 C-7,-2 -15,0 -14,-7 C-13,-13 -6,-13 0,-7 C6,-13 13,-13 14,-7 C15,0 7,-2 0,6 Z"/>
    <path transform="translate(304,96) scale(0.8) rotate(12)" d="M0,6 C-7,-2 -15,0 -14,-7 C-13,-13 -6,-13 0,-7 C6,-13 13,-13 14,-7 C15,0 7,-2 0,6 Z"/>
    <path transform="translate(320,170) scale(0.6) rotate(-8)" d="M0,6 C-7,-2 -15,0 -14,-7 C-13,-13 -6,-13 0,-7 C6,-13 13,-13 14,-7 C15,0 7,-2 0,6 Z"/></g>`,
  confetti: `<g stroke-width="0">
    <rect x="52" y="96" width="12" height="12" rx="3" fill="${C.gold}" transform="rotate(20 58 102)"/>
    <rect x="88" y="66" width="10" height="10" rx="3" fill="${C.blue}" transform="rotate(-16 93 71)"/>
    <rect x="272" y="72" width="12" height="12" rx="3" fill="${C.green}" transform="rotate(30 278 78)"/>
    <rect x="306" y="112" width="10" height="10" rx="3" fill="#FF5C7A" transform="rotate(-24 311 117)"/>
    <circle cx="70" cy="150" r="6" fill="${C.purple}"/>
    <circle cx="300" cy="156" r="6" fill="${C.gold}"/></g>`,
  sparkles: `<g fill="${C.gold}" stroke="#fff" stroke-width="3" paint-order="stroke">
    <path transform="translate(70,104) scale(1.1)" d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z"/>
    <path transform="translate(300,88) scale(0.9)" d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z"/>
    <path transform="translate(316,160) scale(0.7)" d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z"/></g>`,
  sweat: `<path transform="translate(88,110)" d="M0,-14 Q10,2 6,10 Q2,17 -4,14 Q-11,10 -6,0 Q-3,-6 0,-14 Z"
    fill="${C.blue}" stroke="#fff" stroke-width="3" paint-order="stroke"/>`,
  tears: `<g fill="${C.blue}" opacity="0.9">
    <path transform="translate(142,208)" d="M0,-10 Q8,2 5,8 Q1,14 -4,10 Q-9,6 -4,-2 Z"/>
    <path transform="translate(228,208)" d="M0,-10 Q8,2 5,8 Q1,14 -4,10 Q-9,6 -4,-2 Z"/></g>`,
  nodlines: `<g stroke="${C.line}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.7">
    <path d="M76,120 q-10,14 -2,28"/><path d="M296,120 q10,14 2,28"/></g>`,
  flag: `<g transform="translate(282,84)">
    <line x1="0" y1="0" x2="0" y2="86" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>
    <path d="M0,2 L52,14 L0,30 Z" fill="${C.band}" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/></g>`,
  okring: `<g transform="translate(185,120)">
    <circle r="34" fill="none" stroke="${C.green}" stroke-width="10" opacity="0.001"/></g>`,
};

// ---------- 16スタンプ定義 ----------
// pos: キャラ位置 [x, y, scale]
const STAMPS = [
  { file: '01', title: 'おはよう!', text: 'おはよう!', color: C.gold,
    char: { eye: 'happy', mouth: 'bigopen', arms: 'up' }, extra: props.sun },
  { file: '02', title: 'こんにちは', text: 'こんにちは', color: C.accent,
    char: { eye: 'normal', mouth: 'smile', arms: 'wave' } },
  { file: '03', title: 'おつかれさま!', text: ['おつかれ', 'さま!'], color: C.green, textOpt: { size: 46, y: 58 },
    char: { eye: 'happy', mouth: 'open', arms: 'down' }, extra: props.sparkles, pos: [185, 210, 0.92] },
  { file: '04', title: 'ありがとう!', text: 'ありがとう!', color: '#FF5C7A',
    char: { eye: 'happy', mouth: 'open', arms: 'pray', tilt: -4 }, extra: props.hearts },
  { file: '05', title: 'OK!', text: 'OK!', color: C.green, textOpt: { size: 74, y: 78, rot: -4 },
    char: { eye: 'wink', mouth: 'open', arms: 'fist' } },
  { file: '06', title: '了解です!', text: '了解です!', color: C.blue,
    char: { eye: 'normal', mouth: 'smile', arms: 'salute' } },
  { file: '07', title: 'ごめんね…', text: 'ごめんね…', color: C.purple,
    char: { eye: 'sad', mouth: 'wavy', arms: 'down', tilt: 5, showSteam: false }, extra: props.sweat },
  { file: '08', title: 'おやすみ〜', text: 'おやすみ〜', color: C.blue,
    char: { eye: 'sleep', mouth: 'small', arms: 'down', showSteam: false }, extra: props.moon + props.zzz },
  { file: '09', title: 'おねがい!', text: 'おねがい!', color: C.purple,
    char: { eye: 'sparkle', mouth: 'wavy', arms: 'pray', tilt: -3 } },
  { file: '10', title: 'やったー!', text: 'やったー!', color: C.gold,
    char: { eye: 'happy', mouth: 'bigopen', arms: 'up', tilt: -5 }, extra: props.confetti },
  { file: '11', title: 'がんばれ!', text: 'がんばれ!', color: C.accent,
    char: { eye: 'normal', mouth: 'bigopen', arms: 'fist' }, extra: props.flag },
  { file: '12', title: 'うんうん', text: 'うんうん', color: C.green,
    char: { eye: 'sleep', mouth: 'smile', arms: 'down', tilt: 3 }, extra: props.nodlines },
  { file: '13', title: 'ちょっとまって!', text: ['ちょっと', 'まって!'], color: C.blue, textOpt: { size: 44, y: 56 },
    char: { eye: 'normal', mouth: 'wavy', arms: 'stop' }, extra: props.sweat, pos: [185, 212, 0.9] },
  { file: '14', title: 'だいすき', text: 'だいすき', color: '#FF5C7A',
    char: { eye: 'heart', mouth: 'open', arms: 'up', tilt: -3 }, extra: props.hearts },
  { file: '15', title: 'ぴえん…', text: 'ぴえん…', color: C.purple,
    char: { eye: 'pien', mouth: 'pout', arms: 'down', showSteam: false }, extra: props.tears },
  { file: '16', title: 'またね〜', text: 'またね〜', color: C.accent,
    char: { eye: 'happy', mouth: 'open', arms: 'wave', tilt: 4 } },
];

// ---------- SVG組み立て ----------
function stampSVG(def) {
  const [cx, cy, sc] = def.pos || [185, 205, 1.0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="370" height="320" viewBox="0 0 370 320">
    <g transform="translate(${cx},${cy}) scale(${sc})">${capkun(def.char)}</g>
    ${def.extra || ''}
    ${label(def.text, { color: def.color, ...(def.textOpt || {}) })}
  </svg>`;
}

function mainSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <g transform="translate(120,148) scale(0.82)">${capkun({ eye: 'happy', mouth: 'open', arms: 'wave' })}</g>
    <g fill="#FF5C7A" stroke="#fff" stroke-width="3" paint-order="stroke">
      <path transform="translate(38,64) rotate(-14)" d="M0,6 C-7,-2 -15,0 -14,-7 C-13,-13 -6,-13 0,-7 C6,-13 13,-13 14,-7 C15,0 7,-2 0,6 Z"/>
      <path transform="translate(206,52) scale(0.75) rotate(12)" d="M0,6 C-7,-2 -15,0 -14,-7 C-13,-13 -6,-13 0,-7 C6,-13 13,-13 14,-7 C15,0 7,-2 0,6 Z"/>
    </g>
  </svg>`;
}

function tabSVG() {
  // タブは小さいので顔まわりをアップに
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="74" viewBox="0 0 96 74">
    <g transform="translate(48,34) scale(0.42)">${capkun({ eye: 'happy', mouth: 'open', arms: 'down', showSteam: false })}</g>
  </svg>`;
}

// プレビューシート(販売ページ確認用・透過不要)
function previewSVG() {
  const cell = 200, cols = 4, pad = 20, header = 120;
  const w = cols * cell + pad * 2, h = Math.ceil(STAMPS.length / cols) * cell + pad * 2 + header;
  const items = STAMPS.map((d, i) => {
    const x = pad + (i % cols) * cell, y = header + pad + Math.floor(i / cols) * cell;
    return `<g transform="translate(${x + 8},${y + 14}) scale(0.5)">
      <g transform="translate(${(d.pos || [185, 205, 1])[0]},${(d.pos || [185, 205, 1])[1]}) scale(${(d.pos || [0, 0, 1])[2]})">${capkun(d.char)}</g>
      ${d.extra || ''}${label(d.text, { color: d.color, ...(d.textOpt || {}) })}
    </g>
    <rect x="${x + 4}" y="${y + 4}" width="${cell - 8}" height="${cell - 8}" rx="16" fill="none" stroke="#EADFD3" stroke-width="2"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#FFFDF8"/>
    <text x="${w / 2}" y="64" text-anchor="middle" font-family="'IPAPGothic',sans-serif" font-weight="bold"
      font-size="40" fill="${C.line}">カプくんのまいにちスタンプ</text>
    <text x="${w / 2}" y="100" text-anchor="middle" font-family="'IPAPGothic',sans-serif"
      font-size="22" fill="#9C8B7C">コーヒーカップの「カプくん」/ 全16種</text>
    ${items}
  </svg>`;
}

// ---------- レンダリング ----------
async function render() {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage();

  async function shot(svg, w, h, file, transparent = true) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<!doctype html><style>*{margin:0;padding:0}body{background:transparent}</style>${svg}`,
      { waitUntil: 'networkidle' },
    );
    await page.screenshot({ path: join(OUT, file), omitBackground: transparent });
    const kb = (statSync(join(OUT, file)).size / 1024).toFixed(1);
    console.log(`  ${file}  ${w}x${h}  ${kb}KB`);
  }

  console.log('スタンプ画像 (370x320, 透過PNG):');
  for (const def of STAMPS) await shot(stampSVG(def), 370, 320, `${def.file}.png`);

  console.log('メイン画像 (240x240):');
  await shot(mainSVG(), 240, 240, 'main.png');

  console.log('タブ画像 (96x74):');
  await shot(tabSVG(), 96, 74, 'tab.png');

  console.log('プレビューシート:');
  const pv = previewSVG();
  const m = pv.match(/width="(\d+)" height="(\d+)"/);
  await shot(pv, Number(m[1]), Number(m[2]), 'preview.png', false);

  await browser.close();
}

// PNG寸法チェック(IHDR読み取り)
function verify() {
  console.log('\n検証:');
  let ok = true;
  for (const f of readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()) {
    const buf = readFileSync(join(OUT, f));
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const sizeOK = buf.length <= 1024 * 1024;
    const dimOK =
      f === 'main.png' ? w === 240 && h === 240 :
      f === 'tab.png' ? w === 96 && h === 74 :
      f === 'preview.png' ? true :
      w === 370 && h === 320;
    const evenOK = f === 'preview.png' || (w % 2 === 0 && h % 2 === 0);
    if (!(sizeOK && dimOK && evenOK)) { ok = false; console.log(`  NG: ${f} ${w}x${h} ${buf.length}B`); }
  }
  console.log(ok ? '  すべて LINE Creators Market の規格内です ✔' : '  規格外のファイルがあります!');
  return ok;
}

await render();
process.exit(verify() ? 0 : 1);
