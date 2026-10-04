@echo off
chcp 65001 >nul
echo ========================================================
echo  AdSense合格後用: VPSリンクを元のA8アフィリエイトへ復元
echo ========================================================
cd /d "%~dp0_local_assets\tools"
python toggle_vps_links.py --mode affiliate
echo.
pause
