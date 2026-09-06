# Export ONE report variant to PDF, the same way export-pdf.ps1 exports the real
# report.
#
#   powershell -ExecutionPolicy Bypass -File export-variants.ps1 -Name D-pointer-only
#
# Two rules, both learned the hard way and both already written down at the top
# of export-pdf.ps1:
#
#   * ONE document per Word process. A loop that opens several documents in one
#     Word instance hangs inside ExportAsFixedFormat with the window invisible.
#
#   * PLAIN STRING PATHS. Join-Path is what export-pdf.ps1 means by "computed
#     paths", and passing its result to ExportAsFixedFormat hangs Word in exactly
#     the same way. String interpolation is fine; the cmdlet's output object is
#     not.
#
# If it hangs anyway: kill WINWORD, delete the "~$" owner file beside the .docx
# (Word drops the first two characters of a long name, so report-D-x.docx leaves
# ~$port-D-x.docx), clear
# HKCU\Software\Microsoft\Office\16.0\Word\Resiliency\DocumentRecovery, and run
# it again. A Word that was killed rather than quitted comes back with an
# invisible Document Recovery pane and blocks on the next Open.

param([Parameter(Mandatory = $true)][string]$Name)

$ErrorActionPreference = 'Stop'

$docx = "E:\rag-knowledge-system\report\variants\report-$Name.docx"
$pdf  = "E:\rag-knowledge-system\report\variants\report-$Name.pdf"
$lock = "E:\rag-knowledge-system\report\variants\~`$port-$Name.docx"

function Log($m) { Write-Output ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

if (Test-Path -LiteralPath $lock) { Remove-Item -LiteralPath $lock -Force }

Log "starting Word for $Name"
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
