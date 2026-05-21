# -*- coding: utf-8 -*-
"""页面路由：主界面与登录页。"""

from flask import Blueprint, render_template

from routes.helpers import get_meta_store, is_unlocked

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def index():
    store = get_meta_store()
    password_enabled = store.is_password_enabled()
    need_login = password_enabled and not is_unlocked()
    # 未设密码时显示欢迎/设密引导；已设密码未解锁则显示登录
    show_setup = not password_enabled
    return render_template(
        "index.html",
        need_login=need_login,
        show_setup=show_setup,
        theme=store.get_theme(),
        password_enabled=password_enabled,
    )
