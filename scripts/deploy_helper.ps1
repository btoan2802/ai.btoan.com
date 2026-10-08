# Script ho tro build va publish tu dong cho BtoanAiNet
param(
    [string]$Target = "Release",
    [string]$OutputDir = "./publish"
)

Write-Host "=== [1/3] Kiem tra moi truong .NET ===" -ForegroundColor Cyan
dotnet --version

Write-Host "`n=== [2/3] Build & Publish ung dung sang thu muc: $OutputDir ===" -ForegroundColor Cyan
dotnet publish ./BtoanAiNet.csproj -c $Target -o $OutputDir --nologo

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== [3/3] Publish thanh cong! ===" -ForegroundColor Green
    Write-Host "File san sang de upload / deploy tai: $OutputDir"
} else {
    Write-Host "`n[LOI] Build that bai voi ma loi $LASTEXITCODE" -ForegroundColor Red
}
