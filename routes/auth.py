# -*- coding: utf-8 -*-
"""认证相关 API：设置密码、登录、登出、改密、状态查询。"""

from flask import Blueprint, jsonify, request

from routes.helpers import (
    clear_session_unlock,
    get_diary_store,
    get_meta_store,
    is_unlocked,
    set_session_unlock,
)
from storage import CryptoHelper

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/status", methods=["GET"])
def status():
    """返回是否已设密码、是否已解锁、主题等。"""
    store = get_meta_store()
    return jsonify(
        {
            "ok": True,
            "password_enabled": store.is_password_enabled(),
            "unlocked": is_unlocked(),
            "theme": store.get_theme(),
            "tags_catalog": store.get_tags_catalog(),
            "moods": __import__("config").DEFAULT_MOODS,
        }
    )


@auth_bp.route("/setup", methods=["POST"])
def setup_password():
    """首次设置访问密码。"""
    store = get_meta_store()
    if store.is_password_enabled():
        return jsonify({"ok": False, "message": "密码已设置，请使用登录"}), 400
    data = request.get_json(silent=True) or {}
    password = (data.get("password") or "").strip()
    confirm = (data.get("confirm") or "").strip()
    if len(password) < 4:
        return jsonify({"ok": False, "message": "密码至少 4 位"}), 400
    if password != confirm:
        return jsonify({"ok": False, "message": "两次密码不一致"}), 400
    store.setup_password(password)
    key = CryptoHelper.derive_fernet_key(password, store.meta["salt"])
    set_session_unlock(key)
    return jsonify({"ok": True, "message": "密码设置成功，日记已加密保存"})


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    password = (data.get("password") or "").strip()
    store = get_meta_store()
    if not store.is_password_enabled():
        return jsonify({"ok": True, "message": "未启用密码保护"})
    key = store.unlock(password)
    if not key:
        return jsonify({"ok": False, "message": "密码错误"}), 401
    set_session_unlock(key)
    return jsonify({"ok": True, "message": "解锁成功"})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    clear_session_unlock()
    return jsonify({"ok": True, "message": "已锁定"})


@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    from routes.helpers import require_unlocked

    ok, msg = require_unlocked()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    data = request.get_json(silent=True) or {}
    old_p = (data.get("old_password") or "").strip()
    new_p = (data.get("new_password") or "").strip()
    confirm = (data.get("confirm") or "").strip()
    if len(new_p) < 4:
        return jsonify({"ok": False, "message": "新密码至少 4 位"}), 400
    if new_p != confirm:
        return jsonify({"ok": False, "message": "两次新密码不一致"}), 400
    store = get_diary_store()
    if not store.change_password(old_p, new_p):
        return jsonify({"ok": False, "message": "原密码错误"}), 400
    set_session_unlock(store.fernet_key)
    return jsonify({"ok": True, "message": "密码已更新"})
