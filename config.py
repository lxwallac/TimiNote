# -*- coding: utf-8 -*-
"""应用配置：路径、分页、默认选项等。"""

import os

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 本地数据目录（不上传网络，仅存本机）
DATA_DIR = os.path.join(BASE_DIR, "data")
META_FILE = os.path.join(DATA_DIR, "meta.json")
DIARY_FILE = os.path.join(DATA_DIR, "diaries.json")

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
