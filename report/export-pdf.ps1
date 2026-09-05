# Export report.docx to report.pdf with Microsoft Word, and report the page count.
#
#   powershell -ExecutionPolicy Bypass -File export-pdf.ps1
#
# Word does the export rather than a plain converter because the document
# carries a TOC field and one PAGEREF field per figure and table. Those are
# empty markers until an application with a layout engine paginates the
# document and fills them in.
#
# This script is deliberately flat and literal. Richer versions of it - with a
# try/finally, a log file, computed paths, a second field pass - hung Word
# inside ExportAsFixedFormat with its window invisible and no way to answer
# whatever it was asking. This sequence runs in about three seconds every time.
# If you edit it and it hangs, kill WINWORD, delete the ~$report.docx owner
# file, and put back what you removed.
#
# Two rules worth keeping whatever else changes:
#   * Update the fields ONCE. A second pass finds a table of contents that has
#     results already, and Word asks "page numbers only, or the entire table?"
#     - a dialog DisplayAlerts does not suppress.
#   * Never call SaveAs2 or TablesOfContents.Update(); both prompt as well.

$ErrorActionPreference = 'Stop'

$docx = 'E:\rag-knowledge-system\report\report.docx'
$pdf = 'E:\rag-knowledge-system\report\report.pdf'
$lock = 'E:\rag-knowledge-system\report\~$report.docx'

function Log($m) { Write-Output ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

# A Word that was killed rather than quitted leaves its owner file behind, and
# the next Open then blocks on an invisible "file in use" dialog forever.
if (Test-Path -LiteralPath $lock) { Remove-Item -LiteralPath $lock -Force }

Log 'starting Word'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
$w.AutomationSecurity = 3

$d = $w.Documents.Open($docx, $false, $false, $false)
Log 'opened'

$d.Fields.Update() | Out-Null
$d.Repaginate()
Log ("pages : {0}" -f $d.ComputeStatistics(2))
Log ("words : {0}" -f $d.ComputeStatistics(0))

$d.ExportAsFixedFormat($pdf, 17)
Log ("pdf   : {0}" -f $pdf)

$d.Close($false)
$w.Quit()
Log 'done'
