@echo off
echo Starting Building Climber Local Server...
echo.
echo ===================================================
echo 1. Open Command Prompt (cmd) and type: ipconfig
echo    Look for "IPv4 Address" (e.g., 192.168.1.5)
echo.
echo 2. On your Android phone, connect to the same Wi-Fi.
echo 3. Open Chrome on Android.
echo 4. Type: http://<Your-IP-Address>:8000/building-climber.html
echo ===================================================
echo.
python -m http.server 8000
pause
