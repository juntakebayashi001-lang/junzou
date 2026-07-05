# AIエージェント チャットアプリ(学習用)

Claude API の **ツール使用(tool use)** と **ストリーミング** を使った、
Python 製のチャット型 AI エージェント Web アプリです。

## できること

ブラウザのチャット画面から話しかけると、AI が必要に応じてツールを自分で選んで実行します。

| ツール | 説明 | 試し方の例 |
|---|---|---|
| `get_current_time` | 現在日時の取得(JST) | 「今何時?」 |
| `calculate` | 数式の計算(安全なパーサー使用) | 「1980円の3割引はいくら?」 |
| `save_memo` | メモの保存(JSONファイル) | 「明日ゴミ出しってメモして」 |
| `list_memos` | メモの一覧表示 | 「メモを見せて」 |

## セットアップ

```bash
cd ai-agent
pip install -r requirements.txt

# Anthropic の APIキーを設定(https://platform.claude.com で取得)
export ANTHROPIC_API_KEY="sk-ant-..."

python app.py
```

ブラウザで http://127.0.0.1:5000 を開くとチャット画面が表示されます。

## 仕組み(学習ポイント)

### 1. エージェントループ(`agent.py`)

AI エージェントの本質は「**LLM にツールを渡し、ツールが不要になるまでループを回す**」ことです。

```
ユーザーの質問
   ↓
Claude に送信(ツール定義付き)
   ↓
Claude「calculate ツールを使いたい」(stop_reason: "tool_use")
   ↓
Python側でツールを実行 → 結果を履歴に追加して再送信
   ↓
Claude「計算結果は 1386円 です」(stop_reason: "end_turn") → 完了
```

### 2. ストリーミング(`app.py`)

`client.messages.stream()` でテキストを受信した端からブラウザに
SSE(Server-Sent Events)で送り、ChatGPT のような逐次表示を実現しています。

### 3. ツール定義のコツ

`agent.py` の `TOOLS` を見てください。`description` には
「何をするか」だけでなく「**いつ使うべきか**」を書くと、
Claude がツールを呼ぶタイミングの精度が上がります。

## カスタマイズのアイデア

- **ツールを追加する**: `agent.py` に関数を書き、`TOOLS` と `TOOL_FUNCTIONS` に登録するだけ
  - 例: 天気API呼び出し、Web検索、ファイル読み書き、社内DBの検索など
- **Web検索を足す**: `tools` に `{"type": "web_search_20260209", "name": "web_search"}` を
  追加するとサーバーサイド実行のWeb検索が使えます(自前の実装は不要)
- **会話履歴の永続化**: 現在はメモリ保持なので、再起動すると消えます。SQLite などに保存してみましょう

## 構成

```
ai-agent/
├── app.py             # Flask サーバー(SSE ストリーミング)
├── agent.py           # エージェントループ + ツール実装
├── static/index.html  # チャット UI
└── requirements.txt
```

使用モデル: `claude-opus-4-8`(適応思考 `thinking: adaptive` 有効)
