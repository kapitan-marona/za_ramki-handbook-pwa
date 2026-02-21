$ErrorActionPreference = "Stop"

$files = @(
  "content\data\staff.json",
  "content\data\tasks.json",
  "content\data\tasks_archive.json"
)

git status --porcelain | Out-Null

# Добавим только data-файлы
git add -- $files

# Если нечего коммитить — выходим красиво
$staged = git diff --cached --name-only
if(-not $staged){
  Write-Host "Нет изменений в data-файлах. Нечего публиковать."
  exit 0
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Update data ($ts)"
git push

Write-Host "Готово: данные опубликованы."
