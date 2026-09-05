# =====================================================================
#  Assemble the MCSP-232 submission CD master folder.
#
#  Produces a numbered, examiner-readable tree containing the report,
#  the complete source, a database dump and the runtime data, then
#  refuses to finish if a secret slipped in.
#
#  Usage:   powershell -ExecutionPolicy Bypass -File scripts\make-cd.ps1
#           ... -OutDir "E:\MCSP-232-CD"   (default: <repo>\..\MCSP-232-CD)
# =====================================================================

param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $root) 'MCSP-232-CD' }

function Say([string]$m, [string]$c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Step([string]$m) { Write-Host ""; Write-Host "  $m" -ForegroundColor White }
function SizeMB([string]$p) {
    if (-not (Test-Path $p)) { return 0 }
    $s = Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
    return [math]::Round($s.Sum / 1MB, 1)
}

Clear-Host
Say "==============================================================" Cyan
Say "  Building the MCSP-232 submission CD master" Cyan
Say "  source : $root" DarkGray
Say "  output : $OutDir" DarkGray
Say "==============================================================" Cyan

# ---- 0. Fresh output folder ----------------------------------------
Step "[0/8] Preparing the output folder"
if (Test-Path $OutDir) {
    Remove-Item $OutDir -Recurse -Force
    Say "        removed the previous build" DarkGray
}
$dirs = @(
    '01-Project-Report',
    '02-Source-Code',
    '03-Application-Data\database',
    '04-Screenshots'
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Path (Join-Path $OutDir $d) -Force | Out-Null }
Say "        created" Green

# ---- 1. Source code, via git archive --------------------------------
# git archive emits ONLY tracked files, so .env, .venv, node_modules,
# uploads and chroma_db cannot leak in by accident. That is the point.
Step "[1/8] Exporting the source (tracked files only)"
$srcDir = Join-Path $OutDir '02-Source-Code\rag-knowledge-system'
New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
Push-Location $root
$tar = Join-Path $env:TEMP 'rag-src.tar'
& git archive --format=tar -o $tar HEAD
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "git archive failed" }
& tar -x -f $tar -C $srcDir
Remove-Item $tar -Force
$commit = (& git rev-parse --short HEAD).Trim()
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
Pop-Location
$srcFiles = (Get-ChildItem $srcDir -Recurse -File).Count
Say "        $srcFiles files at commit $commit ($branch)" Green

# ---- 2. Built frontend ----------------------------------------------
Step "[2/8] Building the frontend for production"
Push-Location (Join-Path $root 'frontend')
# Do NOT pipe npm through 2>&1: PowerShell 5.1 wraps a native command's
# stderr in ErrorRecords, which -ErrorAction Stop then treats as a failure
# even when the build exits 0. Let it write to the console and judge it by
# the exit code instead.
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& cmd /c 'npm run build' | Out-Null
$buildCode = $LASTEXITCODE
$ErrorActionPreference = $prev
Pop-Location
if ($buildCode -ne 0) { throw "frontend build failed (exit $buildCode)" }
$dist = Join-Path $root 'frontend\dist'
if (Test-Path $dist) {
    Copy-Item $dist (Join-Path $srcDir 'frontend\dist') -Recurse -Force
    Say ("        dist copied ({0} MB)" -f (SizeMB $dist)) Green
} else {
    Say "        WARNING: no dist produced" Yellow
}

# ---- 3. Database dump ------------------------------------------------
Step "[3/8] Dumping PostgreSQL"
$pgDump = 'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe'
$dumpOut = Join-Path $OutDir '03-Application-Data\database\rag_knowledge.sql'
if (Test-Path $pgDump) {
    $env:PGPASSWORD = 'rag'
    & $pgDump -U postgres -h localhost -d rag_knowledge --clean --if-exists -f $dumpOut
    Remove-Item Env:\PGPASSWORD
    if (Test-Path $dumpOut) {
        Say ("        rag_knowledge.sql ({0} MB)" -f ([math]::Round((Get-Item $dumpOut).Length/1MB, 2))) Green
    }
} else {
    Say "        SKIPPED: pg_dump.exe not found at $pgDump" Yellow
}

# ---- 4. Runtime data -------------------------------------------------
Step "[4/8] Copying uploaded documents and the vector store"
foreach ($pair in @(@('backend\uploads','uploads'), @('backend\chroma_db','chroma_db'))) {
    $from = Join-Path $root $pair[0]
    if (Test-Path $from) {
        Copy-Item $from (Join-Path $OutDir "03-Application-Data\$($pair[1])") -Recurse -Force
        Say ("        {0,-12} {1} MB" -f $pair[1], (SizeMB $from)) Green
    } else {
        Say "        $($pair[1]) not present - skipped" Yellow
    }
}

# ---- 5. Report + screenshots ----------------------------------------
Step "[5/8] Report and screenshots"
$reportSrc = Join-Path $root 'report'
if (Test-Path $reportSrc) {
    Get-ChildItem $reportSrc -Filter *.pdf | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $OutDir '01-Project-Report') -Force
        Say "        report: $($_.Name)" Green
    }
} else {
    Say "        no report\ folder yet - 01-Project-Report left empty" Yellow
}
$shotSrc = Join-Path $root 'docs\screenshots'
if (Test-Path $shotSrc) {
    Copy-Item "$shotSrc\*" (Join-Path $OutDir '04-Screenshots') -Recurse -Force
    Say ("        screenshots: {0} files" -f (Get-ChildItem (Join-Path $OutDir '04-Screenshots') -Recurse -File).Count) Green
} else {
    Say "        no docs\screenshots yet - 04-Screenshots left empty" Yellow
}

# ---- 6. Disc README --------------------------------------------------
Step "[6/8] Writing README.txt"
$built = Get-Date -Format 'dd MMMM yyyy, HH:mm'
$readme = @"
================================================================================
  RAG POWERED KNOWLEDGE SYSTEM
  IGNOU MCA - MCSP-232 Project Submission
================================================================================

  Student      : Naval Chaudhary
  Enrolment    : 2354558202
  Regional Ctr : Shimla
  Source commit: $commit ($branch)
  Disc built   : $built

--------------------------------------------------------------------------------
  WHAT IS ON THIS DISC
--------------------------------------------------------------------------------

  01-Project-Report\    The complete project report (PDF).

  02-Source-Code\       Full source of the application.
                        Backend : Python 3.12, FastAPI, SQLAlchemy, LangChain
                        Frontend: React 18, Vite, Tailwind CSS
                        frontend\dist\ is the pre-built production frontend.

  03-Application-Data\  database\rag_knowledge.sql
                            PostgreSQL dump - schema, users, chats, documents.
                        uploads\
                            The source documents that were ingested.
                        chroma_db\
                            The ChromaDB vector store built from those documents.

  04-Screenshots\       Screen layouts as reproduced in the project report.

--------------------------------------------------------------------------------
  RUNNING THE APPLICATION
--------------------------------------------------------------------------------

  Full instructions:  02-Source-Code\rag-knowledge-system\INSTALL.md

  In short, on a Windows machine with PostgreSQL 16, Python 3.12, Node.js 20
  and Ollama installed:

    1. Copy 02-Source-Code\rag-knowledge-system to a writable drive.
    2. Restore 03-Application-Data\ into the copied folder as described
       in INSTALL.md.
    3. Run the one-time setup in INSTALL.md (creates the Python virtual
       environment and installs dependencies - this needs an internet
       connection).
    4. Double-click start-app.bat.

  Sign in with:  admin@example.com  /  admin1234

  NOTE: no API keys or passwords are stored on this disc. backend\.env must
  be created from backend\.env.example during setup, as INSTALL.md explains.

================================================================================
"@
$readme | Out-File -FilePath (Join-Path $OutDir 'README.txt') -Encoding utf8
Copy-Item (Join-Path $root 'INSTALL.md') (Join-Path $OutDir 'INSTALL.md') -Force -ErrorAction SilentlyContinue
Say "        README.txt written" Green

# ---- 7. SECRET SCAN - the disc leaves the building, so this is a gate
Step "[7/8] Scanning for secrets (this can fail the build)"
$problems = @()

Get-ChildItem $OutDir -Recurse -Force -File | Where-Object {
    ($_.Name -eq '.env') -or (($_.Name -like '*.env') -and ($_.Name -notlike '*.env.example'))
} | ForEach-Object { $problems += "env file present: $($_.FullName)" }

# A placeholder is what a template or a doc is SUPPOSED to contain.
# Anything else assigned to a secret name is treated as a real leak.
$placeholder = '^(|change[-_ ]?me.*|your[-_ ].*|<.*>|paste.*|replace.*|x{3,}|\.\.\.|sk-xxx.*|-)$'

$textExt = @('.py','.js','.jsx','.json','.md','.txt','.yml','.yaml','.example','.sql','.ps1','.bat','.html','.css')
Get-ChildItem $OutDir -Recurse -File | Where-Object { $textExt -contains $_.Extension.ToLower() } | ForEach-Object {
    $file = $_.FullName
    $c = Get-Content $file -Raw -ErrorAction SilentlyContinue
    if ($null -eq $c) { return }

    # A real OpenAI key, in any file, in any context. No exceptions.
    foreach ($m in [regex]::Matches($c, 'sk-[A-Za-z0-9_\-]{20,}')) {
        $problems += "possible OpenAI key: $file"
        break
    }

    # Secret-shaped assignments, unless the value is an obvious placeholder.
    # POSTGRES_PASSWORD is deliberately absent: 'rag' is a local development
    # password that belongs in .env.example and docker-compose.yml.
    # [ \t]* not \s* - \s matches newlines, so a greedy \s* after '=' on an
    # empty assignment swallows the line break and captures the NEXT line.
    foreach ($m in [regex]::Matches($c, '(?m)^(SECRET_KEY|OPENAI_API_KEY)[ \t]*=[ \t]*(.*)$')) {
        $name = $m.Groups[1].Value
        $val  = $m.Groups[2].Value.Trim().Trim('"').Trim("'")
        if ($val -notmatch $placeholder) {
            $problems += "$name has a real-looking value: $file"
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host ""
    Say "  BUILD FAILED - secrets found. This disc must NOT be burned:" Red
    $problems | ForEach-Object { Say "    - $_" Red }
    Write-Host ""
    throw "Secret scan failed"
}
Say "        clean - no .env files, no API keys, no secret values" Green

# ---- 8. Size report --------------------------------------------------
Step "[8/8] Size"
$total = SizeMB $OutDir
foreach ($d in (Get-ChildItem $OutDir -Directory)) {
    Say ("        {0,-22} {1,7} MB" -f $d.Name, (SizeMB $d.FullName)) Gray
}
Write-Host ""
Say ("        TOTAL {0} MB" -f $total) White
if ($total -lt 700) {
    Say ("        Fits a 700 MB CD-R with {0} MB to spare." -f [math]::Round(700 - $total, 1)) Green
} elseif ($total -lt 4700) {
    Say "        Too big for a CD-R. Needs a DVD-R (4.7 GB)." Yellow
} else {
    Say "        Too big for a DVD-R. Trim it." Red
}

Write-Host ""
Say "==============================================================" Cyan
Say "  Master ready: $OutDir" Green
Say "  Burn the CONTENTS of that folder to the disc (not the folder)." Gray
Say "==============================================================" Cyan
Write-Host ""
