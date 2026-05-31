# -*- coding: utf-8 -*-
"""Timi 日记服务进程管理：启动、停止、状态查询。"""

import json
import os
import socket
import subprocess
import sys
import time
from datetime import datetime

import config

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def _read_state() -> dict | None:
    path = config.SERVER_STATE_FILE
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, OSError):
        return None


def _write_state(data: dict) -> None:
    os.makedirs(config.DATA_DIR, exist_ok=True)
    with open(config.SERVER_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _clear_state() -> None:
    if os.path.isfile(config.SERVER_STATE_FILE):
        try:
            os.remove(config.SERVER_STATE_FILE)
        except OSError:
            pass


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle:
                kernel32.CloseHandle(handle)
                return True
            return False
        except Exception:
            return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def _wait_for_port(port: int, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _port_in_use(port):
            return True
        time.sleep(0.3)
    return False


def get_status() -> dict:
    """返回日记服务运行状态。"""
    state = _read_state()
    pid = state.get("pid") if state else None
    running = bool(pid and _pid_alive(pid))
    port_open = _port_in_use(config.DIARY_PORT)

    if not running and state:
        _clear_state()
        state = None

    return {
        "running": running and port_open,
        "pid": pid if running else None,
        "port": config.DIARY_PORT,
        "diary_url": f"http://127.0.0.1:{config.DIARY_PORT}",
        "started_at": state.get("started_at") if state and running else None,
        "ui_version": config.STATIC_VERSION,
        "data_dir": config.DATA_DIR,
        "port_busy": port_open and not running,
    }


def start_diary_server() -> tuple[bool, str]:
    """启动 app.py 子进程。"""
    st = get_status()
    if st["running"]:
        return False, "日记服务已在运行中"

    if st["port_busy"]:
        return False, f"端口 {config.DIARY_PORT} 已被占用，请先停止其它程序或重启电脑"

    app_path = os.path.join(config.BASE_DIR, "app.py")
    if not os.path.isfile(app_path):
        return False, "找不到 app.py"

    env = os.environ.copy()
    env["TIMI_LAUNCHED_BY"] = "launcher"

    kwargs = {
        "cwd": config.BASE_DIR,
        "env": env,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = CREATE_NO_WINDOW

    try:
        proc = subprocess.Popen([sys.executable, app_path], **kwargs)
    except OSError as e:
        return False, f"启动失败：{e}"

    _write_state(
        {
            "pid": proc.pid,
            "port": config.DIARY_PORT,
            "started_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    )

    if not _wait_for_port(config.DIARY_PORT):
        _kill_pid(proc.pid)
        _clear_state()
        return False, "服务启动超时，请检查 Python 环境或终端日志"

    return True, "日记服务已启动"


def _kill_pid(pid: int) -> None:
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            creationflags=CREATE_NO_WINDOW,
        )
    else:
        import signal

        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass


def stop_diary_server() -> tuple[bool, str]:
    """停止日记服务。"""
    state = _read_state()
    st = get_status()

    if not st["running"] and not state:
        if st["port_busy"]:
            return False, f"端口 {config.DIARY_PORT} 被占用但无法识别进程，请手动结束占用程序"
        _clear_state()
        return True, "日记服务未在运行"

    pid = state.get("pid") if state else None
    if pid and _pid_alive(pid):
        _kill_pid(pid)
        time.sleep(0.5)

    _clear_state()

    if _port_in_use(config.DIARY_PORT):
        return False, "停止指令已发送，但端口仍被占用，请稍后重试"

    return True, "日记服务已停止"
