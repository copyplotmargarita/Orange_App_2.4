$path = 'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\refactor_sales.js'
$text = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
$text = $text.Replace('\`', '`')
$text = $text.Replace('\${', '${')
[IO.File]::WriteAllText($path, $text, [Text.Encoding]::UTF8)
