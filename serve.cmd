@echo off
title Pitch deck server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
pause
