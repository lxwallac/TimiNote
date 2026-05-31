# -*- coding: utf-8 -*-
"""
Timi 控制台 —— 独立启停日记服务
仅绑定 127.0.0.1:5001，通过页面或 API 控制 app.py（:5000）

运行：python launcher.py
或双击 start_timi.bat
"""

import os
import webbrowser
from threading import Timer

import config
from flask import Flask, jsonify, render_template, request

from process_manager import get_status, start_diary_server, stop_diary_server

app = Flask(
    __name__,
    template_folder=os.path.join(config.BASE_DIR, "templates"),
    static_folder=os.path.join(config.BASE_DIR, "static"),
)
app.config["SECRET_KEY"] = config.SECRET_KEY


@app.route("/")
def control_page():
    return render_template("control.html", static_version=config.STATIC_VERSION)


@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({"ok": True, "data": get_status()})


@app.route("/api/start", methods=["POST"])
def api_start():
    ok, msg = start_diary_server()
    return jsonify({"ok": ok, "message": msg, "data": get_status()}), (200 if ok else 400)


@app.route("/api/stop", methods=["POST"])
def api_stop():
    ok, msg = stop_diary_server()
    return jsonify({"ok": ok, "message": msg, "data": get_status()}), (200 if ok else 400)


def _open_browser():
    webbrowser.open(f"http://127.0.0.1:{config.LAUNCHER_PORT}")


if __name__ == "__main__":
    print("Timi 控制台")
    print("地址: http://127.0.0.1:%s" % config.LAUNCHER_PORT)
    print("在此页面启动 / 停止日记服务（端口 %s）" % config.DIARY_PORT)
    if os.environ.get("TIMI_OPEN_BROWSER", "1") == "1":
        Timer(1.0, _open_browser).start()
    app.run(host="127.0.0.1", port=config.LAUNCHER_PORT, debug=False, use_reloader=False)
