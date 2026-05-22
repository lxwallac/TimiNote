# -*- coding: utf-8 -*-
"""日记 CRUD、统计、导出、主题与标签 API。"""

from flask import Blueprint, Response, jsonify, request

import config
from routes.helpers import get_diary_store, get_meta_store, is_unlocked, require_unlocked

diary_bp = Blueprint("diary", __name__)


def _guard():
    return require_unlocked()


@diary_bp.route("/stats", methods=["GET"])
def stats():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_diary_store()
    return jsonify({"ok": True, "data": store.get_stats()})


@diary_bp.route("/diaries/all", methods=["GET"])
def list_all_diaries():
    """侧栏：返回全部日记（不分页）。"""
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    tag = request.args.get("tag") or None
    mood = request.args.get("mood") or None
    keyword = request.args.get("q") or None
    store = get_diary_store()
    items = store.list_all_entries(tag=tag, mood=mood, keyword=keyword)
    return jsonify({"ok": True, "data": items})


@diary_bp.route("/diaries", methods=["GET"])
def list_diaries():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", config.DEFAULT_PAGE_SIZE, type=int)
    tag = request.args.get("tag") or None
    mood = request.args.get("mood") or None
    keyword = request.args.get("q") or None
    date_from = request.args.get("date_from") or None
    date_to = request.args.get("date_to") or None
    store = get_diary_store()
    data = store.list_entries(
        page=page,
        per_page=per_page,
        tag=tag,
        mood=mood,
        keyword=keyword,
        date_from=date_from,
        date_to=date_to,
    )
    return jsonify({"ok": True, "data": data})


@diary_bp.route("/diaries/<entry_id>", methods=["GET"])
def get_diary(entry_id):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_diary_store()
    entry = store.get_entry(entry_id)
    if not entry:
        return jsonify({"ok": False, "message": "日记不存在"}), 404
    return jsonify({"ok": True, "data": entry})


@diary_bp.route("/diaries", methods=["POST"])
def create_diary():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    data = request.get_json(silent=True) or {}
    date_str = (data.get("date") or "").strip()
    if not date_str:
        return jsonify({"ok": False, "message": "请填写日期"}), 400
    store = get_diary_store()
    entry = store.create_entry(
        date_str=date_str,
        content=data.get("content") or "",
        title=data.get("title", ""),
        mood=data.get("mood", ""),
        tags=data.get("tags", []),
        blocks=data.get("blocks"),
        parent_id=data.get("parent_id", ""),
        folder_id=data.get("folder_id", ""),
        icon=data.get("icon", ""),
    )
    return jsonify({"ok": True, "data": entry, "stats": store.get_stats()})


@diary_bp.route("/diaries/<entry_id>", methods=["PUT"])
def update_diary(entry_id):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    data = request.get_json(silent=True) or {}
    store = get_diary_store()
    entry = store.update_entry(
        entry_id,
        date_str=data.get("date"),
        content=data.get("content"),
        title=data.get("title"),
        mood=data.get("mood"),
        tags=data.get("tags"),
        blocks=data.get("blocks"),
        parent_id=data.get("parent_id"),
        folder_id=data.get("folder_id"),
        icon=data.get("icon"),
    )
    if not entry:
        return jsonify({"ok": False, "message": "日记不存在"}), 404
    return jsonify({"ok": True, "data": entry, "stats": store.get_stats()})


@diary_bp.route("/diaries/<entry_id>", methods=["DELETE"])
def delete_diary(entry_id):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_diary_store()
    if not store.delete_entry(entry_id):
        return jsonify({"ok": False, "message": "日记不存在"}), 404
    return jsonify({"ok": True, "message": "已删除", "stats": store.get_stats()})


@diary_bp.route("/tags", methods=["GET"])
def get_tags():
    store = get_meta_store()
    return jsonify({"ok": True, "data": store.get_tags_catalog()})


@diary_bp.route("/tags", methods=["POST"])
def add_tag():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    data = request.get_json(silent=True) or {}
    tag = (data.get("tag") or "").strip()
    store = get_meta_store()
    catalog = store.add_tag_to_catalog(tag)
    return jsonify({"ok": True, "data": catalog})


@diary_bp.route("/tags/<tag_name>", methods=["DELETE"])
def remove_tag(tag_name):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_meta_store()
    catalog = store.remove_tag_from_catalog(tag_name)
    return jsonify({"ok": True, "data": catalog})


@diary_bp.route("/theme", methods=["GET", "PUT"])
def theme():
    store = get_meta_store()
    if request.method == "GET":
        return jsonify({"ok": True, "theme": store.get_theme()})
    if not is_unlocked() and store.is_password_enabled():
        return jsonify({"ok": False, "message": "请先登录"}), 403
    data = request.get_json(silent=True) or {}
    t = data.get("theme", "light")
    store.set_theme(t)
    return jsonify({"ok": True, "theme": store.get_theme()})


@diary_bp.route("/folders", methods=["GET"])
def list_folders():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_meta_store()
    return jsonify({"ok": True, "data": store.get_folders()})


@diary_bp.route("/folders", methods=["POST"])
def create_folder():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    data = request.get_json(silent=True) or {}
    store = get_meta_store()
    folder = store.create_folder(
        name=data.get("name", "新文件夹"),
        icon=data.get("icon", "📁"),
        parent_id=data.get("parent_id", ""),
    )
    return jsonify({"ok": True, "data": folder})


@diary_bp.route("/folders/<folder_id>", methods=["DELETE"])
def delete_folder(folder_id):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_meta_store()
    if not store.delete_folder(folder_id):
        return jsonify({"ok": False, "message": "文件夹不存在"}), 404
    return jsonify({"ok": True})


@diary_bp.route("/search", methods=["GET"])
def search():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    q = request.args.get("q", "")
    store = get_diary_store()
    return jsonify({"ok": True, "data": store.search_entries(q)})


@diary_bp.route("/templates", methods=["GET"])
def templates():
    import config

    return jsonify({"ok": True, "data": config.DIARY_TEMPLATES})


@diary_bp.route("/export/<entry_id>/md", methods=["GET"])
def export_md(entry_id):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_diary_store()
    text = store.export_one_md(entry_id)
    if text is None:
        return jsonify({"ok": False, "message": "日记不存在"}), 404
    return Response(
        text,
        mimetype="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=diary_{entry_id[:8]}.md"},
    )


@diary_bp.route("/export/all", methods=["GET"])
def export_all():
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_diary_store()
    text = store.export_all_txt()
    return Response(
        text,
        mimetype="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=diary_export_all.txt"
        },
    )


@diary_bp.route("/export/<entry_id>", methods=["GET"])
def export_one(entry_id):
    ok, msg = _guard()
    if not ok:
        return jsonify({"ok": False, "message": msg}), 403
    store = get_diary_store()
    text = store.export_one_txt(entry_id)
    if text is None:
        return jsonify({"ok": False, "message": "日记不存在"}), 404
    return Response(
        text,
        mimetype="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=diary_{entry_id[:8]}.txt"
        },
    )
