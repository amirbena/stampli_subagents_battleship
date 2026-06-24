@REM Maven wrapper script for Windows
@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0

set MAVEN_WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar
set MAVEN_WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties

@REM Download the wrapper JAR if missing.
@REM Use PowerShell Invoke-WebRequest — the original for/f+curl approach fails on
@REM some Windows setups because cmd's for/f returns a blank URL (CRLF/encoding).
if not exist "%MAVEN_WRAPPER_JAR%" (
    powershell -NoProfile -Command "& { $url = (Get-Content '%MAVEN_WRAPPER_PROPERTIES%' | Where-Object { $_ -match '^wrapperUrl=' } | Select-Object -First 1) -replace '^wrapperUrl=',''; Invoke-WebRequest -Uri $url.Trim() -OutFile '%MAVEN_WRAPPER_JAR%' -UseBasicParsing }"
)

@REM maven-wrapper-3.2.0.jar has no Main-Class in its manifest, so `java -jar`
@REM always fails with "no main manifest attribute". Use -classpath instead.
java -classpath "%MAVEN_WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
endlocal
