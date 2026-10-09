$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$appRoot = Join-Path $workspace "demo-app"

if (-not $env:JAVA_HOME) {
    $bundledJbr = Get-ChildItem -LiteralPath "C:\Program Files\JetBrains" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName "jbr" } |
        Where-Object { Test-Path -LiteralPath (Join-Path $_ "bin\java.exe") } |
        Select-Object -First 1
    if ($bundledJbr) { $env:JAVA_HOME = $bundledJbr }
}

if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    throw "A JDK was not found. Set JAVA_HOME to Android Studio/PyCharm's jbr directory."
}

Push-Location $appRoot
try {
    & (Join-Path $appRoot "gradlew.bat") --no-daemon assembleUserDebug assembleAgentDebug
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle build failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

Write-Host "Built APKs:"
Get-ChildItem -LiteralPath (Join-Path $appRoot "app\build\outputs\apk") -Recurse -Filter "*.apk" | Select-Object -ExpandProperty FullName
