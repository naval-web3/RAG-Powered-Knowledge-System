# Export report-18-14.docx to report-18-14.pdf with Microsoft Word.
#
#   powershell -ExecutionPolicy Bypass -File export-pdf-18-14.ps1
#
# A literal copy of export-pdf.ps1 pointed at the large-print variant. It is a
# separate file rather than a parameter on that one because COMPUTED PATHS HANG
# ExportAsFixedFormat with no window and no error. Keep every path a literal
# string here, and keep one document per Word process.
#
# If it hangs: kill WINWORD, delete ~$port-18-14.docx, clear
# HKCU\Software\Microsoft\Office\16.0\Word\Resiliency\DocumentRecovery, rerun.

$ErrorActionPreference = 'Stop'

$docx = 'E:\rag-knowledge-system\report\report-18-14.docx'
$pdf = 'E:\rag-knowledge-system\report\report-18-14.pdf'
$lock = 'E:\rag-knowledge-system\report\~$port-18-14.docx'

function Log($m) { Write-Output ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

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
