# =====================================================================
#  RAG Powered Knowledge System - database backup
#
#  Dumps PostgreSQL, the Chroma vector index and the upload directory
#  into one timestamped folder under backups\, then prunes anything
#  older than the retention window.
#
#    powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
#    powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1 -KeepDays 30
#
#  The three have to be taken together. A database dump on its own is
#  not a restorable backup of this system: the rows reference vectors in
#  the Chroma index and files in the upload directory, and a restore that
#  brings back only the rows leaves every document unanswerable.
#
#  Run it from Task Scheduler for the nightly schedule the project
#  proposal asks for; INSTALL.md gives the one-line registration command.
# =====================================================================

param(
    [int]$KeepDays = 14,
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Destination) { $Destination = Join-Path $root 'backups' }

function Say([string]$m, [string]$c = 'Gray') { Write-Host $m -ForegroundColor $c }

# ---- settings come from .env so the backup and the app cannot disagree
$envFile = Join-Path $root 'backend\.env'
$conf = @{ POSTGRES_USER = 'postgres'; POSTGRES_PASSWORD = 'rag'
           POSTGRES_HOST = 'localhost'; POSTGRES_PORT = '5432'
           POSTGRES_DB = 'rag_knowledge' }
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') {
            if ($conf.ContainsKey($Matches[1])) { $conf[$Matches[1]] = $Matches[2] }
        }
    }
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$outDir = Join-Path $Destination $stamp
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Say "backing up to $outDir" Cyan

# ---- 1. the relational database
$pgDump = 'pg_dump'
if (-not (Get-Command $pgDump -ErrorAction SilentlyContinue)) {
    $guess = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $guess) { throw "pg_dump not found. Add PostgreSQL's bin directory to PATH." }
    $pgDump = $guess.FullName
}
$env:PGPASSWORD = $conf.POSTGRES_PASSWORD
$dump = Join-Path $outDir 'database.dump'
& $pgDump -h $conf.POSTGRES_HOST -p $conf.POSTGRES_PORT -U $conf.POSTGRES_USER `
          -d $conf.POSTGRES_DB -Fc -f $dump
Remove-Item Env:\PGPASSWORD
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
Say ("  database  {0:N1} MB" -f ((Get-Item $dump).Length / 1MB)) Green

# ---- 2. the vector index
$chroma = Join-Path $root 'backend\chroma_db'
if (Test-Path $chroma) {
    $zip = Join-Path $outDir 'chroma_db.zip'
    Compress-Archive -Path (Join-Path $chroma '*') -DestinationPath $zip -Force
    Say ("  vectors   {0:N1} MB" -f ((Get-Item $zip).Length / 1MB)) Green
} else {
    Say '  vectors   not present, skipped' DarkYellow
}

# ---- 3. the uploaded files
$uploads = Join-Path $root 'backend\uploads'
if ((Test-Path $uploads) -and (Get-ChildItem $uploads -Recurse -File -ErrorAction SilentlyContinue)) {
    $zip = Join-Path $outDir 'uploads.zip'
    Compress-Archive -Path (Join-Path $uploads '*') -DestinationPath $zip -Force
    Say ("  uploads   {0:N1} MB" -f ((Get-Item $zip).Length / 1MB)) Green
} else {
    Say '  uploads   empty, skipped' DarkYellow
}

# ---- 4. what this backup is, so a restore does not have to guess
@"
RAG Powered Knowledge System backup
taken      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
database   : $($conf.POSTGRES_DB) on $($conf.POSTGRES_HOST):$($conf.POSTGRES_PORT)
contents   : database.dump (pg_dump -Fc), chroma_db.zip, uploads.zip

To restore, with the application stopped:
  createdb -U $($conf.POSTGRES_USER) $($conf.POSTGRES_DB)
  pg_restore -U $($conf.POSTGRES_USER) -d $($conf.POSTGRES_DB) database.dump
  Expand-Archive chroma_db.zip -DestinationPath backend\chroma_db -Force
  Expand-Archive uploads.zip   -DestinationPath backend\uploads   -Force

Restore all three or none. The rows reference vectors and files by id, and
a database restored on its own leaves every document unanswerable.
"@ | Set-Content -Path (Join-Path $outDir 'MANIFEST.txt') -Encoding utf8

# ---- 5. retention
$cut = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem $Destination -Directory -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' -and $_.CreationTime -lt $cut }
foreach ($d in $old) {
    Remove-Item $d.FullName -Recurse -Force
    Say "  pruned    $($d.Name)" DarkGray
}

$total = (Get-ChildItem $outDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Say ("done. {0:N1} MB, keeping {1} days" -f $total, $KeepDays) Cyan
