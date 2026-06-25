$salesPath = "c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\sales.js"
$content = [System.IO.File]::ReadAllText($salesPath, [System.Text.Encoding]::UTF8)
$content = $content.Replace('\`', '`')
$content = $content.Replace('\${', '${')
[System.IO.File]::WriteAllText($salesPath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fixed escapes."
