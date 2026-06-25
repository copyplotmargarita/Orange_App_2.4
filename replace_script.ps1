$salesPath = "c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\sales.js"
$refactorPath = "c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\refactor_sales.js"

# Read all lines
$lines = Get-Content -Path $salesPath -Encoding UTF8

# Find indices
$startIndex = -1
$endIndex = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^    function render\(\) \{") {
        $startIndex = $i
        break
    }
}

for ($i = $startIndex; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^    function showNewClientModal\(initialName, onCreated\) \{") {
        $endIndex = $i - 1
        break
    }
}

if ($startIndex -eq -1 -or $endIndex -eq -1) {
    Write-Host "Could not find start or end indices."
    exit 1
}

$refactorLines = Get-Content -Path $refactorPath -Encoding UTF8
# The refactor lines might not have the correct indentation (4 spaces).
# But wait, refactor_sales.js already has `function render()` at root level, so I'll just indent them by 4 spaces.
$indentedRefactorLines = $refactorLines | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) {
        $_
    } else {
        "    " + $_
    }
}

$newLines = @()
for ($i = 0; $i -lt $startIndex; $i++) {
    $newLines += $lines[$i]
}

$newLines += $indentedRefactorLines

for ($i = $endIndex + 1; $i -lt $lines.Count; $i++) {
    $newLines += $lines[$i]
}

$newLines | Set-Content -Path $salesPath -Encoding UTF8
Write-Host "Replaced content successfully."
