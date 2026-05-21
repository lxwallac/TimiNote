# -*- coding: utf-8 -*-
"""
Timi 私密日记 —— Flask 本地网页版
仅绑定 127.0.0.1，数据存于 data/ 目录，不上传网络。

运行：python app.py
浏览器访问：http://127.0.0.1:5000
"""

import config
from flask import Flask
from routes import register_blueprints


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(config)
    register_blueprints(app)
    return app


app = create_app()


if __name__ == "__main__":
    # host 固定本机，避免局域网暴露
    app.run(host="127.0.0.1", port=5000, debug=False)
