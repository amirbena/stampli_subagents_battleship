@REM Maven wrapper script for Windows
@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0

set MAVEN_WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar
set MAVEN_WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties

if not exist "%MAVEN_WRAPPER_JAR%" (
    for /f "tokens=2 delims==" %%i in ('findstr /i "wrapperUrl" "%MAVEN_WRAPPER_PROPERTIES%"') do set WRAPPER_URL=%%i
    curl -o "%MAVEN_WRAPPER_JAR%" "%WRAPPER_URL%" -s
)

java -jar "%MAVEN_WRAPPER_JAR%" %*
endlocal
