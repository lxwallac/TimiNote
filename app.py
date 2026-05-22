# -*- coding: utf-8 -*-
"""
Timi 私密日记 —— Flask 本地网页版
仅绑定 127.0.0.1，数据存于 data/ 目录，不上传网络。

运行：python app.py
浏览器访问：http://127.0.0.1:5000
"""

import os

import config
from flask import Flask, request
from routes import register_blueprints


def create_app() -> Flask:
    # 使用绝对路径，避免从其他目录启动时找不到 templates / static
    app = Flask(
        __name__,
        template_folder=os.path.join(config.BASE_DIR, "templates"),
        static_folder=os.path.join(config.BASE_DIR, "static"),
    )
    app.config.from_object(config)
    app.config["TEMPLATES_AUTO_RELOAD"] = True

    register_blueprints(app)

    @app.context_processor
    def inject_static_version():
        return {"static_version": config.STATIC_VERSION}

    @app.after_request
    def disable_cache(resp):
        """本地开发：避免浏览器长期使用旧页面/旧样式。"""
        if request.endpoint and (
            request.endpoint == "pages.index"
            or (request.endpoint or "").startswith("static")
        ):
            resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            resp.headers["Pragma"] = "no-cache"
        return resp

    return app


app = create_app()


if __name__ == "__main__":
    print("Timi 日记本 UI v%s" % config.STATIC_VERSION)
    print("项目目录:", config.BASE_DIR)
    print("请在浏览器打开: http://127.0.0.1:5000")
    print("若样式异常，请 Ctrl+F5 强制刷新")
    app.run(host="127.0.0.1", port=5000, debug=True)
