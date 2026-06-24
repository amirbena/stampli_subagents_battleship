@REM Maven wrapper script for Windows
@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0

set MAVEN_WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar
set MAVEN_WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties

@REM %~dp0 always ends with \. Strip it AFTER the JAR/PROPERTIES paths are set,
@REM so the -D value doesn't end with \ — \" inside a cmd quoted token is an
@REM escaped quote and breaks Java's argument parsing.
if "%MAVEN_PROJECTBASEDIR:~-1%"=="\" set MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%

@REM Download the wrapper JAR if missing.
@REM Use PowerShell Invoke-WebRequest — the original for/f+curl approach fails on
@REM some Windows setups because cmd's for/f returns a blank URL (CRLF/encoding).
if not exist "%MAVEN_WRAPPER_JAR%" (
    powershell -NoProfile -Command "& { $url = (Get-Content '%MAVEN_WRAPPER_PROPERTIES%' | Where-Object { $_ -match '^wrapperUrl=' } | Select-Object -First 1) -replace '^wrapperUrl=',''; Invoke-WebRequest -Uri $url.Trim() -OutFile '%MAVEN_WRAPPER_JAR%' -UseBasicParsing }"
)

@REM maven-wrapper-3.2.0.jar has no Main-Class in its manifest, so `java -jar`
@REM always fails with "no main manifest attribute". Use -classpath instead.
@REM Quote the entire -D=value token so spaces in the path are handled safely.
java "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" -classpath "%MAVEN_WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
endlocal
