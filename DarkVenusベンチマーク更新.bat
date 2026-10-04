@echo off
chcp 65001 > NUL
title Dark Venus Benchmark Update Tool
echo ==================================================
echo  Dark Venus 公式ベンチマーク更新ツール
echo ==================================================
echo.
cd /d "%~dp0"
python scripts\update_darkvenus_benchmark.py %*
echo.
echo ==================================================
echo 処理が完了しました。
pause
