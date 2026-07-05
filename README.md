# junzou — フードワゴン PR動画

キッチンカー(フードワゴン)のイラストをアニメーション化した、縦型 9:16 の PR 動画プロジェクトです。

## 出力

- `output/food-wagon-pr.mp4` — 1080×1920 / 30fps / 10秒 / H.264

## 動画の内容

1. キッチンカーが車輪を回しながら左から走ってきて停車(サスペンションが沈む演出つき)
2. ヘッドライトが挨拶がわりに点滅
3. 窓のオーニング(黄色ストライプの日よけ)が開く
4. カウンターにコーヒーカップが登場し、湯気が立ちのぼる
5. MENU 看板が弾んで飛び出す
6. タイトル「FOOD WAGON CAFE」がフェードイン
7. 「OPEN」バッジがスタンプ演出で登場

## 構成

- `animation/index.html` — SVG + JavaScript のアニメーション本体。
  ブラウザで開くとループ再生でプレビューできます。
  `window.seek(t)` で任意の時刻(秒)の状態にシークでき、レンダラーはこれを使って1フレームずつ描画します。
- `render/render.mjs` — Playwright(Chromium)でフレームをキャプチャし、ffmpeg(libx264)で MP4 にエンコードするスクリプト。

## レンダリング方法

```bash
npm install
node render/render.mjs                # デフォルト: 30fps / 10秒 / output/food-wagon-pr.mp4
node render/render.mjs --fps 60 --duration 10 --out output/hq.mp4
```

環境変数:

- `CHROMIUM_PATH` — Chromium 実行ファイルのパス(デフォルト: `/opt/pw-browsers/chromium`)
- `FFMPEG_PATH` — ffmpeg のパス(デフォルト: `imageio-ffmpeg` 同梱バイナリを自動検出)
