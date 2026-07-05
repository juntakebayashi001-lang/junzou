"""AIエージェントの中核ロジック。

Claude API の「ツール使用 (tool use)」を使ったエージェントループを実装しています。

エージェントループの流れ:
  1. 会話履歴を Claude に送る(ストリーミング)
  2. Claude がツールを使いたい場合、stop_reason が "tool_use" になる
  3. こちら(Python側)でツールを実行し、結果を tool_result として履歴に追加
  4. 結果を踏まえて Claude が続きを生成 → ツールが不要になるまで 1〜3 を繰り返す
"""

import ast
import datetime
import json
import operator
import os
from pathlib import Path
from typing import Any, Callable, Generator

from anthropic import Anthropic

MODEL = "claude-opus-4-8"
MAX_TOKENS = 16000

SYSTEM_PROMPT = """\
あなたは親切なAIアシスタントです。日本語で丁寧に、かつ簡潔に回答してください。

利用できるツール:
- get_current_time: 現在の日時を取得
- calculate: 数式を計算
- save_memo / list_memos: メモの保存と一覧表示

計算や日時の質問には、自分の知識で推測せず必ずツールを使ってください。
"""

client = Anthropic()  # ANTHROPIC_API_KEY 環境変数から自動でキーを読み込む

# ---------------------------------------------------------------------------
# ツールの実装
# ---------------------------------------------------------------------------

MEMO_FILE = Path(os.environ.get("MEMO_FILE", Path(__file__).parent / "memos.json"))

# 安全な数式評価: eval() は任意コード実行の危険があるため、
# ast で構文木を解析して四則演算などだけを許可する
_ALLOWED_OPS: dict[type, Callable] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _safe_eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.operand))
    raise ValueError(f"許可されていない式です: {ast.dump(node)}")


def tool_get_current_time(_: dict) -> str:
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    return now.strftime("%Y年%m月%d日 %H:%M:%S (JST)")


def tool_calculate(inputs: dict) -> str:
    expression = inputs["expression"]
    result = _safe_eval(ast.parse(expression, mode="eval"))
    return f"{expression} = {result}"


def tool_save_memo(inputs: dict) -> str:
    memos = json.loads(MEMO_FILE.read_text()) if MEMO_FILE.exists() else []
    memos.append({
        "text": inputs["text"],
        "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
    })
    MEMO_FILE.write_text(json.dumps(memos, ensure_ascii=False, indent=2))
    return f"メモを保存しました(合計 {len(memos)} 件)"


def tool_list_memos(_: dict) -> str:
    if not MEMO_FILE.exists():
        return "メモはまだありません"
    memos = json.loads(MEMO_FILE.read_text())
    if not memos:
        return "メモはまだありません"
    lines = [f"{i + 1}. {m['text']} ({m['created_at']})" for i, m in enumerate(memos)]
    return "\n".join(lines)


# ツール定義: Claude に「どんなツールがあるか」を伝えるスキーマ。
# description は Claude がツールを使うタイミングの判断材料になるため、
# 「いつ使うべきか」を書くのがコツ。
TOOLS = [
    {
        "name": "get_current_time",
        "description": "現在の日時(日本時間)を取得します。「今何時?」「今日は何日?」など日時に関する質問のときに呼び出してください。",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "calculate",
        "description": "数式を計算します。足し算・引き算・掛け算・割り算・べき乗(**)・剰余(%)に対応。計算が必要なときは暗算せず必ずこのツールを使ってください。",
        "input_schema": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Python形式の数式。例: '(120 + 80) * 1.1'",
                }
            },
            "required": ["expression"],
        },
    },
    {
        "name": "save_memo",
        "description": "ユーザーのメモを保存します。「覚えておいて」「メモして」と言われたときに呼び出してください。",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "保存するメモの内容"}
            },
            "required": ["text"],
        },
    },
    {
        "name": "list_memos",
        "description": "保存済みのメモを一覧表示します。「メモを見せて」と言われたときに呼び出してください。",
        "input_schema": {"type": "object", "properties": {}},
    },
]

TOOL_FUNCTIONS: dict[str, Callable[[dict], str]] = {
    "get_current_time": tool_get_current_time,
    "calculate": tool_calculate,
    "save_memo": tool_save_memo,
    "list_memos": tool_list_memos,
}


def execute_tool(name: str, inputs: dict) -> tuple[str, bool]:
    """ツールを実行して (結果テキスト, エラーかどうか) を返す。"""
    try:
        return TOOL_FUNCTIONS[name](inputs), False
    except Exception as e:  # エラーも Claude に返すと、言い換えや再試行をしてくれる
        return f"ツール実行エラー: {e}", True


# ---------------------------------------------------------------------------
# エージェントループ
# ---------------------------------------------------------------------------

def run_agent(messages: list[dict[str, Any]]) -> Generator[dict, None, None]:
    """エージェントループを回し、進捗をイベント(dict)として yield する。

    messages はこの関数の中で更新される(assistant の応答や tool_result が追記される)。

    yield するイベント:
      {"type": "text",        "text": "..."}          — 応答テキストの断片
      {"type": "tool_use",    "name": "...", "input": {...}} — ツール呼び出し
      {"type": "tool_result", "name": "...", "result": "..."} — ツールの実行結果
      {"type": "done"}                                  — 完了
    """
    while True:
        # ストリーミングでリクエスト。テキストは届いた端から yield する
        with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            tools=TOOLS,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield {"type": "text", "text": text}
            response = stream.get_final_message()

        # 応答全体(thinking / text / tool_use ブロックすべて)を履歴に追加。
        # tool_use ブロックを欠くと次のリクエストがエラーになるので content 丸ごと必須
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            # ツール不要 = 応答完了
            yield {"type": "done"}
            return

        # ツールを実行して結果を返す。複数ツールの結果は 1 つの user メッセージにまとめる
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            yield {"type": "tool_use", "name": block.name, "input": block.input}
            result, is_error = execute_tool(block.name, block.input)
            yield {"type": "tool_result", "name": block.name, "result": result}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
                "is_error": is_error,
            })
        messages.append({"role": "user", "content": tool_results})
        # ループ先頭に戻り、ツール結果を踏まえた続きを Claude に生成させる
