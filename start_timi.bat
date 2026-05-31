@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Timi 控制台启动中...
echo 若浏览器未自动打开，请访问 http://127.0.0.1:5001
echo.
echo 关闭此窗口将停止「控制台」，但不会自动停止已启动的日记服务。
echo 要停止日记请在控制台页面点击「停止」。
echo.

python launcher.py
if errorlevel 1 (
    echo.
    echo 启动失败，请确认已安装 Python 并执行过: pip install -r requirements.txt
    pause
)
