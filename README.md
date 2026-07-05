# junzou — フードワゴン PR動画 & LINEスタンプ

## LINEスタンプ「カプくんのまいにちスタンプ」

コーヒーカップのキャラクター「カプくん」の販売用LINEスタンプ(全16種)。
フードワゴンカフェの世界観とつながるマスコットで、あいさつ・返事・気持ちなど毎日使えるフレーズを揃えています。

### 生成方法

```bash
npm install
npm run stamps    # stamps/output/ に全画像を出力
```

### 出力ファイル(LINE Creators Market 規格準拠)

| ファイル | サイズ | 用途 |
|---|---|---|
| `stamps/output/01.png`〜`16.png` | 370×320px 透過PNG | スタンプ画像(16個) |
| `stamps/output/main.png` | 240×240px 透過PNG | メイン画像 |
| `stamps/output/tab.png` | 96×74px 透過PNG | トークルームタブ画像 |
| `stamps/output/preview.png` | — | 一覧確認用(申請には使わない) |

スクリプトが寸法・偶数ピクセル・1MB以下を自動検証します。

### 収録フレーズ

おはよう! / こんにちは / おつかれさま! / ありがとう! / OK! / 了解です! / ごめんね… / おやすみ〜 /
おねがい! / やったー! / がんばれ! / うんうん / ちょっとまって! / だいすき / ぴえん… / またね〜

### 販売手順(LINE Creators Market)

1. https://creator.line.me/ja/ にLINEアカウントでログインし、クリエイター登録(無料)
2. 「新規登録」→ スタンプ → 販売情報を入力
   - タイトル案: `カプくんのまいにちスタンプ`(英: `Cupkun's Everyday Stamps`)
   - 説明文案: `コーヒーカップの「カプくん」が毎日のあいさつと気持ちをお届け。ほっとひと息つきたくなる、ゆるかわスタンプです。`
   - テイストカテゴリ: ゆるかわ / キャラクター: オリジナル
3. スタンプ画像タブで `main.png`・`tab.png`・`01.png`〜`16.png` をアップロード
4. 価格ティアは最低価格(120円)推奨 — 個人クリエイターのスタンプは低価格帯が最も売れやすい
5. リクエスト(審査申請)→ 審査は通常数日〜1週間。承認後「リリース」で販売開始

### 審査の注意点

- 背景は透過済み・余白約10px確保済み(本ジェネレーターで対応)
- フォントはIPAゴシック(IPAフォントライセンス: 商用利用・埋め込み可)
- 販売開始後はLINE STOREのURLをSNSやPR動画の概要欄で宣伝すると初動が伸びます

---

# フードワゴン PR動画

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
