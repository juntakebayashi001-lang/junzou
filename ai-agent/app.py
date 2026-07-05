"""チャットWebアプリのサーバー (Flask)。

- GET  /            : チャット画面 (static/index.html)
- POST /api/chat    : メッセージを送るとエージェントの応答を SSE でストリーミング返却
- POST /api/reset   : 会話履歴のリセット

会話履歴はプロセス内メモリに保持します(学習用のシンプルな構成)。
本番用途ではセッション管理や永続化(Redis, DB など)に置き換えてください。
"""

import json
import uuid

from flask import Flask, Response, request, send_from_directory

from agent import run_agent

app = Flask(__name__, static_folder="static")

# 会話履歴ストア: {session_id: messages}
sessions: dict[str, list] = {}


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.post("/api/chat")
def chat():
    data = request.get_json(force=True)
    user_message = (data.get("message") or "").strip()
    session_id = data.get("session_id") or str(uuid.uuid4())

    if not user_message:
        return {"error": "message が空です"}, 400

    messages = sessions.setdefault(session_id, [])
    messages.append({"role": "user", "content": user_message})

    def event_stream():
        # session_id を最初に通知(初回アクセス時にクライアントが保存する)
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
        try:
            for event in run_agent(messages):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            # 失敗したユーザー入力は履歴から取り除く(次回リクエストを壊さないため)
            if messages and messages[-1].get("role") == "user":
                messages.pop()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")


@app.post("/api/reset")
def reset():
    data = request.get_json(force=True)
    sessions.pop(data.get("session_id"), None)
    return {"ok": True}


if __name__ == "__main__":
    # threaded=True でストリーミング中も他のリクエストを処理できる
    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)
