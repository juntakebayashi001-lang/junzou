"""いちばんシンプルなAIエージェント(ターミナルで動く練習用)

このファイル1つだけで動きます。Webアプリ版(app.py)の前に、
まずこれで「AIエージェントの基本」を体験してください。

動かし方:
  1. pip install anthropic
  2. export ANTHROPIC_API_KEY="あなたのAPIキー"
  3. python simple_agent.py

AIエージェントとは:
  ただ答えるだけのAIではなく、「道具(ツール)を自分で選んで使えるAI」のこと。
  このサンプルでは「サイコロを振る」という道具を1つだけ渡しています。
  AIは自分ではサイコロを振れないので、「サイコロ振って」と頼むと
  Python側の関数を呼び出してきます。これがエージェントの基本です。
"""

import random

from anthropic import Anthropic

client = Anthropic()  # APIキーは環境変数 ANTHROPIC_API_KEY から自動で読まれる

# --- 道具(ツール)を1つだけ用意 -------------------------------------

def roll_dice() -> str:
    """サイコロを振る(これはただのPython関数)"""
    return f"サイコロの目は {random.randint(1, 6)} でした"


# AIに「こういう道具があるよ」と伝えるための説明書
TOOLS = [
    {
        "name": "roll_dice",
        "description": "サイコロを振って1〜6の目を出します。「サイコロ振って」「運試しして」などと言われたら使ってください。",
        "input_schema": {"type": "object", "properties": {}},
    }
]

# --- 会話ループ -------------------------------------------------------

messages = []  # 会話の履歴(AIは毎回これを全部読んで返事する)

print("AIエージェントと話せます。「サイコロ振って」と頼んでみてください。")
print("(やめるときは Ctrl+C)")

while True:
    user_input = input("\nあなた > ")
    messages.append({"role": "user", "content": user_input})

    # AIがツールを使い終わるまで繰り返す(これが「エージェントループ」)
    while True:
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system="あなたは親切なアシスタントです。日本語で簡潔に答えてください。",
            tools=TOOLS,
            messages=messages,
        )

        # AIの返事(ツール呼び出し情報も含む)を履歴に追加
        messages.append({"role": "assistant", "content": response.content})

        # テキスト部分を表示
        for block in response.content:
            if block.type == "text":
                print(f"AI > {block.text}")

        # ツールを使わないなら、この会話ターンは終わり
        if response.stop_reason != "tool_use":
            break

        # AIが「ツールを使いたい」と言ってきたので、Python側で実行して結果を渡す
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  🎲 (AIがツール {block.name} を実行しました)")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": roll_dice(),
                })
        messages.append({"role": "user", "content": tool_results})
        # → ループの先頭に戻り、サイコロの結果を見たAIが続きの返事をする
