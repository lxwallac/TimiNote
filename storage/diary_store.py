# -*- coding: utf-8 -*-
"""日记与元数据的 JSON 本地读写、加密字段处理、统计与分页。"""

import json
import os
import uuid
from datetime import datetime

import config
from .crypto_util import CryptoHelper


def _count_words(text: str) -> int:
    """统计字数：中文按字符，英文按单词近似。"""
    text = (text or "").strip()
    if not text:
        return 0
    # 去除空白后的字符数，适合中文日记场景
    return len(text.replace("\n", "").replace("\r", ""))


class DiaryStore:
    """统一管理 meta.json（密码、标签库、主题）与 diaries.json（日记条目）。"""

    def __init__(self, fernet_key: bytes | None = None):
        os.makedirs(config.DATA_DIR, exist_ok=True)
        self.fernet_key = fernet_key
        self._meta = self._load_meta()
        self._diaries = self._load_diaries()

    # ----- 元数据 -----

    def _load_meta(self) -> dict:
        if not os.path.isfile(config.META_FILE):
            return self._default_meta()
        try:
            with open(config.META_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {**self._default_meta(), **data}
        except (json.JSONDecodeError, OSError):
            return self._default_meta()

    def _default_meta(self) -> dict:
        return {
            "password_enabled": False,
            "salt": "",
            "password_hash": "",
            "tags_catalog": list(config.DEFAULT_TAGS),
            "theme": "light",
        }

    def save_meta(self) -> None:
        with open(config.META_FILE, "w", encoding="utf-8") as f:
            json.dump(self._meta, f, ensure_ascii=False, indent=2)

    @property
    def meta(self) -> dict:
        return self._meta

    def is_password_enabled(self) -> bool:
        return bool(self._meta.get("password_enabled"))

    def setup_password(self, password: str) -> None:
        """首次设置密码：写入哈希，并将已有明文日记批量加密。"""
        salt = CryptoHelper.generate_salt()
        self._meta["salt"] = salt
        self._meta["password_hash"] = CryptoHelper.hash_password(password, salt)
        self._meta["password_enabled"] = True
        key = CryptoHelper.derive_fernet_key(password, salt)
        self.fernet_key = key
        for entry in self._diaries.get("entries", []):
            if "content" in entry and "content_enc" not in entry:
                plain = entry.pop("content", "")
                entry["content_enc"] = CryptoHelper.encrypt_text(plain, key)
        self._save_diaries()
        self.save_meta()

    def change_password(self, old_password: str, new_password: str) -> bool:
        if not self.verify_password(old_password):
            return False
        key_old = CryptoHelper.derive_fernet_key(old_password, self._meta["salt"])
        key_new = CryptoHelper.derive_fernet_key(new_password, self._meta["salt"])
        for entry in self._diaries.get("entries", []):
            plain = self._read_entry_content(entry, key_old)
            entry.pop("content", None)
            entry["content_enc"] = CryptoHelper.encrypt_text(plain, key_new)
        self._meta["password_hash"] = CryptoHelper.hash_password(
            new_password, self._meta["salt"]
        )
        self.fernet_key = key_new
        self._save_diaries()
        self.save_meta()
        return True

    def verify_password(self, password: str) -> bool:
        if not self.is_password_enabled():
            return True
        return CryptoHelper.verify_password(
            password, self._meta["salt"], self._meta["password_hash"]
        )

    def unlock(self, password: str) -> bytes | None:
        if not self.verify_password(password):
            return None
        if not self.is_password_enabled():
            return None
        key = CryptoHelper.derive_fernet_key(password, self._meta["salt"])
        self.fernet_key = key
        return key

    def get_tags_catalog(self) -> list[str]:
        return list(self._meta.get("tags_catalog", []))

    def add_tag_to_catalog(self, tag: str) -> list[str]:
        tag = tag.strip()
        if not tag:
            return self.get_tags_catalog()
        catalog = self.get_tags_catalog()
        if tag not in catalog:
            catalog.append(tag)
            self._meta["tags_catalog"] = catalog
            self.save_meta()
        return catalog

    def remove_tag_from_catalog(self, tag: str) -> list[str]:
        catalog = [t for t in self.get_tags_catalog() if t != tag]
        self._meta["tags_catalog"] = catalog
        self.save_meta()
        return catalog

    def get_theme(self) -> str:
        return self._meta.get("theme", "light")

    def set_theme(self, theme: str) -> None:
        if theme in ("light", "dark"):
            self._meta["theme"] = theme
            self.save_meta()

    # ----- 日记数据 -----

    def _load_diaries(self) -> dict:
        if not os.path.isfile(config.DIARY_FILE):
            return {"version": 1, "entries": []}
        try:
            with open(config.DIARY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return {"version": 1, "entries": []}
            data.setdefault("entries", [])
            return data
        except (json.JSONDecodeError, OSError):
            return {"version": 1, "entries": []}

    def _save_diaries(self) -> None:
        with open(config.DIARY_FILE, "w", encoding="utf-8") as f:
            json.dump(self._diaries, f, ensure_ascii=False, indent=2)

    def _read_entry_content(self, entry: dict, key: bytes | None = None) -> str:
        key = key or self.fernet_key
        if entry.get("content_enc"):
            if not key:
                return ""
            return CryptoHelper.decrypt_text(entry["content_enc"], key)
        return entry.get("content", "") or ""

    def _write_entry_content(self, entry: dict, plain: str) -> None:
        entry.pop("content", None)
        entry.pop("content_enc", None)
        if self.is_password_enabled() and self.fernet_key:
            entry["content_enc"] = CryptoHelper.encrypt_text(plain, self.fernet_key)
        else:
            entry["content"] = plain

    def _entry_to_public(self, entry: dict) -> dict:
        """返回可给前端的条目（含解密正文）。"""
        content = ""
        try:
            content = self._read_entry_content(entry)
        except ValueError:
            content = ""
        return {
            "id": entry["id"],
            "date": entry["date"],
            "title": entry.get("title", ""),
            "content": content,
            "mood": entry.get("mood", ""),
            "tags": list(entry.get("tags", [])),
            "word_count": entry.get("word_count", 0),
            "created_at": entry.get("created_at", ""),
            "updated_at": entry.get("updated_at", ""),
        }

    def list_entries(
        self,
        page: int = 1,
        per_page: int = config.DEFAULT_PAGE_SIZE,
        tag: str | None = None,
        mood: str | None = None,
        keyword: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        """按更新时间倒序分页，支持标签/心情/关键词/日期筛选。"""
        items = list(self._diaries.get("entries", []))
        items.sort(key=lambda e: e.get("updated_at", e.get("created_at", "")), reverse=True)

        if tag:
            items = [e for e in items if tag in e.get("tags", [])]
        if mood:
            items = [e for e in items if e.get("mood") == mood]
        if date_from:
            items = [e for e in items if e.get("date", "") >= date_from]
        if date_to:
            items = [e for e in items if e.get("date", "") <= date_to]
        if keyword:
            kw = keyword.lower()
            filtered = []
            for e in items:
                try:
                    body = self._read_entry_content(e).lower()
                except ValueError:
                    body = ""
                title = (e.get("title") or "").lower()
                if kw in body or kw in title:
                    filtered.append(e)
            items = filtered

        total = len(items)
        per_page = min(max(1, per_page), config.MAX_PAGE_SIZE)
        page = max(1, page)
        start = (page - 1) * per_page
        chunk = items[start : start + per_page]

        return {
            "items": [self._entry_to_public(e) for e in chunk],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": max(1, (total + per_page - 1) // per_page),
        }

    def get_entry(self, entry_id: str) -> dict | None:
        for e in self._diaries.get("entries", []):
            if e["id"] == entry_id:
                return self._entry_to_public(e)
        return None

    def create_entry(
        self,
        date_str: str,
        content: str,
        title: str = "",
        mood: str = "",
        tags: list | None = None,
    ) -> dict:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = {
            "id": str(uuid.uuid4()),
            "date": date_str,
            "title": (title or "").strip(),
            "mood": mood or "",
            "tags": list(tags or []),
            "word_count": _count_words(content),
            "created_at": now,
            "updated_at": now,
        }
        self._write_entry_content(entry, content)
        for t in entry["tags"]:
            self.add_tag_to_catalog(t)
        self._diaries.setdefault("entries", []).append(entry)
        self._save_diaries()
        return self._entry_to_public(entry)

    def update_entry(
        self,
        entry_id: str,
        date_str: str | None = None,
        content: str | None = None,
        title: str | None = None,
        mood: str | None = None,
        tags: list | None = None,
    ) -> dict | None:
        for entry in self._diaries.get("entries", []):
            if entry["id"] != entry_id:
                continue
            if date_str is not None:
                entry["date"] = date_str
            if title is not None:
                entry["title"] = title.strip()
            if mood is not None:
                entry["mood"] = mood
            if tags is not None:
                entry["tags"] = list(tags)
                for t in tags:
                    self.add_tag_to_catalog(t)
            if content is not None:
                self._write_entry_content(entry, content)
                entry["word_count"] = _count_words(content)
            entry["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self._save_diaries()
            return self._entry_to_public(entry)
        return None

    def delete_entry(self, entry_id: str) -> bool:
        entries = self._diaries.get("entries", [])
        for i, e in enumerate(entries):
            if e["id"] == entry_id:
                entries.pop(i)
                self._save_diaries()
                return True
        return False

    def get_stats(self) -> dict:
        """统计总字数、篇数、书写天数（按 date 去重）。"""
        entries = self._diaries.get("entries", [])
        total_words = 0
        dates = set()
        for e in entries:
            total_words += e.get("word_count", 0)
            if e.get("date"):
                dates.add(e["date"])
        return {
            "total_words": total_words,
            "total_entries": len(entries),
            "writing_days": len(dates),
        }

    def export_all_txt(self) -> str:
        """导出全部日记为纯文本。"""
        lines = ["======== 私密日记导出 ========", ""]
        items = sorted(
            self._diaries.get("entries", []),
            key=lambda e: e.get("date", ""),
            reverse=True,
        )
        for e in items:
            pub = self._entry_to_public(e)
            lines.append(f"日期：{pub['date']}")
            if pub["title"]:
                lines.append(f"标题：{pub['title']}")
            if pub["mood"]:
                lines.append(f"心情：{pub['mood']}")
            if pub["tags"]:
                lines.append(f"标签：{', '.join(pub['tags'])}")
            lines.append(f"字数：{pub['word_count']}")
            lines.append("-" * 40)
            lines.append(pub["content"])
            lines.append("")
            lines.append("=" * 40)
            lines.append("")
        return "\n".join(lines)

    def export_one_txt(self, entry_id: str) -> str | None:
        pub = self.get_entry(entry_id)
        if not pub:
            return None
        lines = [
            f"日期：{pub['date']}",
            f"标题：{pub['title'] or '（无）'}",
            f"心情：{pub['mood'] or '（无）'}",
            f"标签：{', '.join(pub['tags']) if pub['tags'] else '（无）'}",
            f"字数：{pub['word_count']}",
            "-" * 40,
            pub["content"],
        ]
        return "\n".join(lines)
