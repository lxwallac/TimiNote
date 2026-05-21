# -*- coding: utf-8 -*-
"""密码哈希与日记内容加密（Fernet + PBKDF2）。"""

import base64
import hashlib
import secrets

from cryptography.fernet import Fernet, InvalidToken


class CryptoHelper:
    """本地私密日记的加解密与密码校验工具。"""

    PBKDF2_ITERATIONS = 260_000
    SALT_BYTES = 16

    @staticmethod
    def generate_salt() -> str:
        return secrets.token_hex(CryptoHelper.SALT_BYTES)

    @staticmethod
    def hash_password(password: str, salt_hex: str) -> str:
        """将密码与盐做 PBKDF2，返回十六进制哈希（仅存哈希，不存明文）。"""
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            CryptoHelper.PBKDF2_ITERATIONS,
        )
        return dk.hex()

    @staticmethod
    def verify_password(password: str, salt_hex: str, password_hash: str) -> bool:
        return secrets.compare_digest(
            CryptoHelper.hash_password(password, salt_hex),
            password_hash,
        )

    @staticmethod
    def derive_fernet_key(password: str, salt_hex: str) -> bytes:
        """由密码派生 Fernet 密钥，用于加密日记正文。"""
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            CryptoHelper.PBKDF2_ITERATIONS,
            dklen=32,
        )
        return base64.urlsafe_b64encode(dk)

    @staticmethod
    def encrypt_text(plain: str, fernet_key: bytes) -> str:
        f = Fernet(fernet_key)
        token = f.encrypt(plain.encode("utf-8"))
        return token.decode("ascii")

    @staticmethod
    def decrypt_text(cipher: str, fernet_key: bytes) -> str:
        f = Fernet(fernet_key)
        try:
            return f.decrypt(cipher.encode("ascii")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("解密失败，密码可能已更改或数据损坏") from exc

    @staticmethod
    def key_to_session_str(fernet_key: bytes) -> str:
        return base64.urlsafe_b64encode(fernet_key).decode("ascii")

    @staticmethod
    def key_from_session_str(session_str: str) -> bytes:
        return base64.urlsafe_b64decode(session_str.encode("ascii"))
