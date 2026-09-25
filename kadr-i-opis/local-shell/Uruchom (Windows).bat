@echo off
rem Kadr i Opis: otwiera aplikacje w osobnym oknie Microsoft Edge.
set "DIR=%~dp0"
set "URL=file:///%DIR:\=/%kadr-i-opis.html"
start "" msedge --app="%URL%"
