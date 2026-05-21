# -*- coding: utf-8 -*-
"""路由层公共辅助：会话、权限、Store 实例。"""

from flask import session

import config
from storage import CryptoHelper, DiaryStore

SESSION_KEY = "fernet_key_b64"
SESSION_UNLOCKED = "unlocked"


def is_unlocked() -> bool:
    store = get_meta_store()
    if not store.is_password_enabled():
        return True
    return bool(session.get(SESSION_UNLOCKED))


def require_unlocked():
    """未解锁时返回 (False, message)。"""
    if is_unlocked():
        return True, ""
    return False, "请先登录解锁日记"


def get_fernet_key_from_session() -> bytes | None:
    b64 = session.get(SESSION_KEY)
    if not b64:
        return None
    return CryptoHelper.key_from_session_str(b64)


def set_session_unlock(fernet_key: bytes) -> None:
    session[SESSION_KEY] = CryptoHelper.key_to_session_str(fernet_key)
    session[SESSION_UNLOCKED] = True


def clear_session_unlock() -> None:
    session.pop(SESSION_KEY, None)
    session.pop(SESSION_UNLOCKED, None)


def get_meta_store() -> DiaryStore:
    """仅读写 meta，不解密正文。"""
    return DiaryStore()


def get_diary_store() -> DiaryStore:
    """带解密密钥的 Store。"""
    key = get_fernet_key_from_session()
    store = DiaryStore(fernet_key=key)
    if store.is_password_enabled() and not key:
        store.fernet_key = None
    return store
