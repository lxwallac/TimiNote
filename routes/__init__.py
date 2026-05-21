# -*- coding: utf-8 -*-
"""路由蓝图注册。"""

from .auth import auth_bp
from .diary import diary_bp
from .pages import pages_bp


def register_blueprints(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(diary_bp, url_prefix="/api")
