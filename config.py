# -*- coding: utf-8 -*-
"""应用配置：路径、分页、默认选项等。"""

import os

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 本地数据目录（不上传网络，仅存本机）
DATA_DIR = os.path.join(BASE_DIR, "data")
META_FILE = os.path.join(DATA_DIR, "meta.json")
DIARY_FILE = os.path.join(DATA_DIR, "diaries.json")

# 静态资源版本号（改 UI 后递增，避免浏览器缓存旧 CSS/JS）
STATIC_VERSION = "8"

# 日记模板（块结构）
DIARY_TEMPLATES = {
    "daily": {
        "name": "每日日记",
        "icon": "📅",
        "blocks": [
            {"type": "h2", "content": "今日概要", "checked": False, "children": []},
            {"type": "text", "content": "", "checked": False, "children": []},
            {"type": "h2", "content": "心情与收获", "checked": False, "children": []},
            {"type": "bullet", "content": "", "checked": False, "children": []},
            {"type": "h2", "content": "待办", "checked": False, "children": []},
            {"type": "todo", "content": "", "checked": False, "children": []},
        ],
    },
    "weekly": {
        "name": "周复盘",
        "icon": "📊",
        "blocks": [
            {"type": "h1", "content": "本周复盘", "checked": False, "children": []},
            {"type": "h3", "content": "做得好的", "checked": False, "children": []},
            {"type": "text", "content": "", "checked": False, "children": []},
            {"type": "h3", "content": "待改进", "checked": False, "children": []},
            {"type": "text", "content": "", "checked": False, "children": []},
        ],
    },
    "free": {
        "name": "空白页",
        "icon": "📄",
        "blocks": [{"type": "text", "content": "", "checked": False, "children": []}],
    },
}

# Flask
SECRET_KEY = os.environ.get("TIMI_SECRET_KEY", "timi-local-diary-change-in-production")
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

# 分页
DEFAULT_PAGE_SIZE = 8
MAX_PAGE_SIZE = 50

# 预设心情（前端可扩展自选）
DEFAULT_MOODS = ["😊", "😌", "😢", "😤", "🤔", "😴", "🌸", "☀️", "🌧️", "✨"]

# 默认分类标签
DEFAULT_TAGS = ["生活", "工作", "随笔", "旅行", "阅读"]
