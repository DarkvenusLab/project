@echo off
chcp 65001 > NUL
title DVLab EA一括月次データ更新ツール
echo ==================================================
echo  DVLab EA一括月次データ更新ツール を起動しています...
echo ==================================================
echo.
cd /d "%~dp0_local_assets\tools"
python local_server.py --page batch_update.html
pause
