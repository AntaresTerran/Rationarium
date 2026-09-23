$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RationariumConsole {
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
}
'@
$consoleWindow = [RationariumConsole]::GetConsoleWindow()
if ($consoleWindow -ne [IntPtr]::Zero) { [void][RationariumConsole]::ShowWindow($consoleWindow, 0) }
[System.Windows.Forms.Application]::EnableVisualStyles()

function Ink([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function Add-Text($parent, [string]$value, [int]$x, [int]$y, [int]$width, [int]$height, [int]$size, [string]$color, [bool]$bold = $false) {
  $control = New-Object System.Windows.Forms.Label
  $control.Text = $value
  $control.Location = [System.Drawing.Point]::new($x, $y)
  $control.Size = [System.Drawing.Size]::new($width, $height)
  $control.ForeColor = Ink $color
  $control.Font = [System.Drawing.Font]::new('Segoe UI', [float]$size, $(if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }))
  $parent.Controls.Add($control)
  return $control
}
function Make-Button($parent, [string]$value, [int]$x, [int]$y, [int]$width, [int]$height, [string]$background, [string]$foreground) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $value
  $button.Location = [System.Drawing.Point]::new($x, $y)
  $button.Size = [System.Drawing.Size]::new($width, $height)
  $button.BackColor = Ink $background
  $button.ForeColor = Ink $foreground
  $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $button.FlatAppearance.BorderColor = Ink '#6d5b50'
  $button.Font = [System.Drawing.Font]::new('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
  $parent.Controls.Add($button)
  return $button
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Rationarium · Steuerzentrale'
$form.ClientSize = [System.Drawing.Size]::new(450, 608)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor = Ink '#1b2028'
$form.ForeColor = Ink '#eee8dc'
$form.Icon = [System.Drawing.SystemIcons]::Application

$title = Add-Text $form 'RATIONARIUM' 18 15 400 38 20 '#e7d5af' $true
$title.Font = [System.Drawing.Font]::new('Georgia', 19, [System.Drawing.FontStyle]::Regular)
$null = Add-Text $form 'DAS KAISERLICHE RECHENBUCH  ·  STEUERZENTRALE' 20 56 414 22 8 '#9ca5af'

$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = [System.Drawing.Point]::new(18, 92)
$statusCard.Size = [System.Drawing.Size]::new(414, 88)
$statusCard.BackColor = Ink '#252b34'
$statusCard.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$form.Controls.Add($statusCard)
$null = Add-Text $statusCard 'STATUS' 14 10 280 18 8 '#c6aa77' $true
$serviceText = Add-Text $statusCard 'Rationarium läuft' 14 30 345 24 11 '#f0e9da' $true
$gameText = Add-Text $statusCard 'Verbinde mit dem Spiel …' 14 58 375 20 9 '#aab3bc'
$statusDot = New-Object System.Windows.Forms.Panel
$statusDot.Location = [System.Drawing.Point]::new(380, 28)
$statusDot.Size = [System.Drawing.Size]::new(12, 12)
$statusDot.BackColor = Ink '#c9a467'
$statusCard.Controls.Add($statusDot)

$networkCard = New-Object System.Windows.Forms.Panel
$networkCard.Location = [System.Drawing.Point]::new(18, 196)
$networkCard.Size = [System.Drawing.Size]::new(414, 326)
$networkCard.BackColor = Ink '#252b34'
$networkCard.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$form.Controls.Add($networkCard)

$tabletBox = New-Object System.Windows.Forms.CheckBox
$tabletBox.Text = 'Tablet- / Smartphone-Modus'
$tabletBox.Location = [System.Drawing.Point]::new(14, 14)
$tabletBox.Size = [System.Drawing.Size]::new(380, 24)
$tabletBox.ForeColor = Ink '#e7d5af'
$tabletBox.Font = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$tabletBox.UseVisualStyleBackColor = $false
$networkCard.Controls.Add($tabletBox)
$null = Add-Text $networkCard 'Freigabe im lokalen Netzwerk (PC und Gerät im selben WLAN/LAN).' 16 42 380 29 8 '#aab3bc'
$null = Add-Text $networkCard 'HTTP-PORT' 16 76 180 20 8 '#c6aa77' $true
$portBox = New-Object System.Windows.Forms.NumericUpDown
$portBox.Location = [System.Drawing.Point]::new(16, 99)
$portBox.Size = [System.Drawing.Size]::new(161, 28)
$portBox.Minimum = 1024
$portBox.Maximum = 65535
$portBox.Value = $RationariumPort
$portBox.BackColor = Ink '#181d25'
$portBox.ForeColor = Ink '#eee8dc'
$portBox.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$networkCard.Controls.Add($portBox)
$applyButton = Make-Button $networkCard 'Port übernehmen' 189 96 207 32 '#39342f' '#e7d5af'
$null = Add-Text $networkCard 'LAN-ADRESSE' 16 145 370 20 8 '#c6aa77' $true
$addressBox = New-Object System.Windows.Forms.ComboBox
$addressBox.Location = [System.Drawing.Point]::new(16, 166)
$addressBox.Size = [System.Drawing.Size]::new(380, 26)
$addressBox.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
$addressBox.BackColor = Ink '#181d25'
$addressBox.ForeColor = Ink '#eee8dc'
$networkCard.Controls.Add($addressBox)
$qr = New-Object System.Windows.Forms.PictureBox
$qr.Location = [System.Drawing.Point]::new(16, 203)
$qr.Size = [System.Drawing.Size]::new(120, 120)
$qr.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
$qr.BackColor = Ink '#fffaf1'
$networkCard.Controls.Add($qr)
$urlBox = New-Object System.Windows.Forms.TextBox
$urlBox.Location = [System.Drawing.Point]::new(151, 205)
$urlBox.Size = [System.Drawing.Size]::new(245, 46)
$urlBox.Multiline = $true
$urlBox.ReadOnly = $true
$urlBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$urlBox.BackColor = Ink '#252b34'
$urlBox.ForeColor = Ink '#eee8dc'
$urlBox.Font = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$networkCard.Controls.Add($urlBox)
$hintText = Add-Text $networkCard 'Tablet-Modus aktivieren, um den QR-Code anzuzeigen.' 151 260 245 57 9 '#aab3bc'

$browserButton = Make-Button $form 'Browser öffnen' 18 539 201 43 '#39342f' '#e7d5af'
$quitButton = Make-Button $form 'Beenden' 231 539 201 43 '#813e4b' '#fff0e7'
$null = Add-Text $form 'Der QR-Code wird lokal erzeugt. Eventuell ist eine Firewall-Freigabe nötig.' 20 589 414 17 8 '#838d98'

$script:port = [int]$RationariumPort
$script:fallbackPort = 0
$script:addresses = @()
$script:addressSignature = ''
$script:qrUrl = ''
$script:updating = $false
$script:closing = $false

function Base-Url { "http://127.0.0.1:$script:port" }
function Post-Action([string]$path, $payload = @{}) {
  Invoke-RestMethod -Uri "$(Base-Url)$path" -Method Post -Body ($payload | ConvertTo-Json -Compress) -ContentType 'application/json' -TimeoutSec 5
}
function Clear-Qr {
  $script:qrUrl = ''
  if ($qr.Image) { $old = $qr.Image; $qr.Image = $null; $old.Dispose() }
  $urlBox.Text = ''
}
function Update-Qr {
  if (-not $tabletBox.Checked -or $addressBox.SelectedIndex -lt 0 -or $addressBox.SelectedIndex -ge $script:addresses.Count) {
    Clear-Qr
    $hintText.Text = $(if ($tabletBox.Checked) { 'Keine nutzbare LAN-IP erkannt.' } else { 'Tablet-Modus aktivieren, um den QR-Code anzuzeigen.' })
    return
  }
  $selected = $script:addresses[$addressBox.SelectedIndex]
  $urlBox.Text = [string]$selected.url
  if ($script:qrUrl -eq $selected.url) { return }
  try {
    $client = New-Object System.Net.WebClient
    try { $bytes = $client.DownloadData("$(Base-Url)/api/widget/qr?address=$([uri]::EscapeDataString([string]$selected.address))") }
    finally { $client.Dispose() }
    $stream = [System.IO.MemoryStream]::new([byte[]]$bytes)
    try { $source = [System.Drawing.Image]::FromStream($stream); try { $next = [System.Drawing.Bitmap]::new($source) } finally { $source.Dispose() } }
    finally { $stream.Dispose() }
    if ($qr.Image) { $old = $qr.Image; $qr.Image = $null; $old.Dispose() }
    $qr.Image = $next
    $script:qrUrl = [string]$selected.url
    $hintText.Text = 'Mit dem Smartphone scannen oder die Adresse im Browser öffnen.'
  } catch { Clear-Qr; $hintText.Text = 'QR-Code konnte nicht geladen werden.' }
}
function Refresh-State {
  $data = $null
  try { $data = Invoke-RestMethod -Uri "$(Base-Url)/api/widget" -TimeoutSec 2 }
  catch {
    if ($script:fallbackPort -gt 0) {
      try {
        $script:port = $script:fallbackPort
        $data = Invoke-RestMethod -Uri "$(Base-Url)/api/widget" -TimeoutSec 2
      } catch { }
    }
  }
  if (-not $data) {
    $serviceText.Text = 'Rationarium nicht erreichbar'
    $gameText.Text = 'Verbindung wird geprüft …'
    $statusDot.BackColor = Ink '#bc6570'
    if (-not (Get-Process -Id $RationariumParentPid -ErrorAction SilentlyContinue)) { $form.Close() }
    return
  }
  $script:port = [int]$data.port
  $script:fallbackPort = 0
  $serviceText.Text = 'Rationarium läuft'
  switch ([string]$data.connection) {
    'connected' { $gameText.Text = "Spiel verbunden  ·  $($data.islands) Inseln"; $statusDot.BackColor = Ink '#79b294' }
    'connecting' { $gameText.Text = 'Verbinde mit dem Spiel …'; $statusDot.BackColor = Ink '#c9a467' }
    default { $gameText.Text = 'Spiel nicht verbunden'; $statusDot.BackColor = Ink '#bc6570' }
  }
  if ($data.mode -eq 'demo') { $gameText.Text = "Simulation aktiv  ·  $($data.islands) Inseln"; $statusDot.BackColor = Ink '#c9a467' }
  $script:updating = $true
  try {
    $tabletBox.Checked = [bool]$data.tablet
    if (-not $portBox.Focused) { $portBox.Value = [decimal]$data.port }
    $script:addresses = @($data.addresses)
    $signature = ($script:addresses | ForEach-Object { "$($_.name)|$($_.address)" }) -join ';'
    if ($signature -ne $script:addressSignature) {
      $selectedIp = if ($addressBox.SelectedIndex -ge 0 -and $addressBox.SelectedIndex -lt $addressBox.Items.Count) { [string]$addressBox.SelectedItem } else { '' }
      $addressBox.Items.Clear()
      foreach ($item in $script:addresses) { $null = $addressBox.Items.Add("$($item.address)  ·  $($item.name)") }
      if ($addressBox.Items.Count -gt 0) {
        $index = $addressBox.Items.IndexOf($selectedIp)
        $addressBox.SelectedIndex = $(if ($index -ge 0) { $index } else { 0 })
      }
      $script:addressSignature = $signature
    }
    $addressBox.Enabled = [bool]$data.tablet -and $addressBox.Items.Count -gt 0
  } finally { $script:updating = $false }
  Update-Qr
  if ($data.error) { $hintText.Text = [string]$data.error }
  if ($data.configError) { $hintText.Text = [string]$data.configError }
}

$tabletBox.Add_CheckedChanged({
  if ($script:updating) { return }
  try {
    $oldPort = $script:port
    $null = Post-Action '/api/config' @{ tablet = [bool]$tabletBox.Checked }
    $script:fallbackPort = $oldPort
    $hintText.Text = 'Netzwerkzugriff wird umgestellt …'
  } catch { $hintText.Text = "Umstellung fehlgeschlagen: $($_.Exception.Message)"; Refresh-State }
})
$applyButton.Add_Click({
  try {
    $oldPort = $script:port
    $script:fallbackPort = $oldPort
    $null = Post-Action '/api/config' @{ port = [int]$portBox.Value }
    $script:port = [int]$portBox.Value
    $hintText.Text = 'Port wird umgestellt …'
  } catch { $script:port = $oldPort; $hintText.Text = "Portwechsel fehlgeschlagen: $($_.Exception.Message)" }
})
$addressBox.Add_SelectedIndexChanged({ if (-not $script:updating) { Update-Qr } })
$browserButton.Add_Click({
  try { $null = Post-Action '/api/browser'; $hintText.Text = 'Browser wird geöffnet.' }
  catch { $hintText.Text = "Browser konnte nicht geöffnet werden: $($_.Exception.Message)" }
})
$quitButton.Add_Click({ $form.Close() })
$form.Add_FormClosing({
  if (-not $script:closing) {
    $script:closing = $true
    $stopping = $false
    try { $null = Post-Action '/api/shutdown'; $stopping = $true } catch { }
    if (-not $stopping -and $script:fallbackPort -gt 0) {
      $script:port = $script:fallbackPort
      try { $null = Post-Action '/api/shutdown'; $stopping = $true } catch { }
    }
    if (-not $stopping) {
      try { Stop-Process -Id $RationariumParentPid -ErrorAction Stop } catch { }
    }
  }
})
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({ Refresh-State })
Refresh-State
$timer.Start()
$form.Add_Shown({ $form.Activate() })
try { [void]$form.ShowDialog() }
finally { $timer.Stop(); Clear-Qr; $timer.Dispose(); $form.Dispose() }
