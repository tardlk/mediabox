@echo off
cd /d "%~dp0"
if not exist "build\classes" mkdir build\classes
echo Building CatVod Tool...
javac -encoding UTF-8 -cp "lib/*" -d build\classes src\main\java\com\catvod\tool\*.java
if %errorlevel% neq 0 (echo Build failed & pause & exit /b 1)
if not exist "build\classes\com\catvod\tool\Test.class" (echo Build failed: no class files & pause & exit /b 1)
echo Build successful.
echo.
echo Usage: build.bat "<url|name>"
echo        build.bat ikanbot.js       ^(auto load from ..\js\^)
echo        build.bat "https://..."
if "%1"=="" pause
if "%1"=="run" java -cp "build/classes;lib/*;src/main/resources" com.catvod.tool.Test %2
if not "%1"=="" if not "%1"=="run" java -cp "build/classes;lib/*;src/main/resources" com.catvod.tool.Test %1
