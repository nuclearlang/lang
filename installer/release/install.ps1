# NuclearLang installer for Windows (PowerShell 5.1 or 7):
#
#   irm https://nuclearlang.github.io/install.ps1 | iex
#   & ([scriptblock]::Create((irm https://nuclearlang.github.io/install.ps1))) -Version 0.2.0
#   & ([scriptblock]::Create((irm https://nuclearlang.github.io/install.ps1))) -Uninstall
#
# It downloads the release of this architecture (x86_64 or arm64) from
# GitHub, checks its SHA-256, installs it in %LOCALAPPDATA%\nuclearlang, puts its bin folder in your user PATH, gives the
# AI agents the `nuclear` skill and installs the editor extension in every VS Code family editor on the PATH. No administrator rights. Then
# the required Smart Graph and MCP server: their archive (a Python of their own with the Smart Graph, the MCP server
# and the Nuclear Developer; nothing is needed on the machine) and their set-up (`nuclear-builder setup`: the graph's
# own embeddings model, the MCP server in the AI clients, the services at every login; it asks whether to add local
# agents, `remote` by default, no local model). A machine already set up keeps its profile. -AiProfile
# remote|lite|medium|hard takes that profile without questions; -NoAi (tests only) skips the required services and
# the install ends incomplete. Run it again at any time: what the same version installed is kept (-Reinstall
# replaces it). A platform's toolchain (Flutter, Node.js) is never installed here: the summary says where to get it.
#
# One install runs at a time. `nuclear update` runs it with NUCLEAR_UPDATE=1, which keeps the choices of the last
# install (-NoVSCode, -NoAgent, -NoModifyPath).
#
# Environment: NUCLEAR_VERSION, NUCLEAR_INSTALL (the folder), NUCLEAR_REPO (owner/name), NUCLEAR_DOWNLOAD (a mirror),
# NUCLEAR_AI_PROFILE.
param(
  [string]$Version = $(if ($env:NUCLEAR_VERSION) { $env:NUCLEAR_VERSION } else { 'latest' }),
  [switch]$NoModifyPath,
  [switch]$NoVSCode,
  [switch]$NoAgent,
  [switch]$NoAi,
  [string]$AiProfile = $env:NUCLEAR_AI_PROFILE,
  [switch]$Uninstall,
  [switch]$Reinstall
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = if ($env:NUCLEAR_REPO) { $env:NUCLEAR_REPO } else { 'nuclearlang/lang' }
$Install = if ($env:NUCLEAR_INSTALL) { $env:NUCLEAR_INSTALL } else { Join-Path $env:LOCALAPPDATA 'nuclearlang' }
$Bin = Join-Path $Install 'bin'
# an update (`nuclear update`, NUCLEAR_UPDATE=1) keeps the choices of the last install
$Options = Join-Path $Install '.options'
if ($env:NUCLEAR_UPDATE -eq '1' -and (Test-Path $Options)) {
  foreach ($line in Get-Content $Options) {
    switch ($line) {
      'NoVSCode=1' { $NoVSCode = [switch]$true }
      'NoAgent=1' { $NoAgent = [switch]$true }
      'NoModifyPath=1' { $NoModifyPath = [switch]$true }
    }
  }
}
$SkillDirs = @('.claude\skills', '.agents\skills', '.codex\skills') | ForEach-Object { Join-Path $HOME $_ }

function Set-UserPath([string[]]$Parts) {
  [Environment]::SetEnvironmentVariable('Path', ($Parts | Where-Object { $_ }) -join ';', 'User')
}
$UserPath = @(([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') | Where-Object { $_ })

# --- the look: the colors and the sign of `nuclear`'s own header (tools/cli/src/framework/landing.rs) ---
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
# the symbols from their code points: Windows PowerShell 5.1 may read this file in another encoding
function Chars([int[]]$Codes) { -join ($Codes | ForEach-Object { [char]$_ }) }
$Dia = Chars 0x25C6; $Tick = Chars 0x2713; $Cross = Chars 0x2717; $Dot = Chars 0x00B7
$H = Chars 0x2500; $V = Chars 0x2502; $TL = Chars 0x256D; $TR = Chars 0x256E; $BL = Chars 0x2570; $BR = Chars 0x256F
$Up = Chars 0x2580; $Down = Chars 0x2584; $Full = Chars 0x2588; $Light = Chars 0x2591
# Moving pictures only in a console of its own (not in CI or a redirected output)
$Animate = -not $env:CI -and -not [Console]::IsOutputRedirected -and $Host.Name -eq 'ConsoleHost'
$BoxW = 74
try { $BoxW = [Math]::Max(40, [Math]::Min(74, [Console]::WindowWidth - 6)) } catch { }

function Ok([string]$Text) { Write-Host "  $Tick " -ForegroundColor Green -NoNewline; Write-Host $Text }
function Warn([string]$Text) { Write-Host '  ! ' -ForegroundColor Yellow -NoNewline; Write-Host $Text }
function Section([string]$Title) {
  Write-Host ''; Write-Host "  $Dia " -ForegroundColor Yellow -NoNewline; Write-Host "$Title " -NoNewline
  Write-Host ($H * [Math]::Max(4, $BoxW - $Title.Length - 2)) -ForegroundColor DarkGray
}
# A box: a title, plain lines (wrapped to its width) and a color for its border.
function Box([string]$Title, [string[]]$Lines, [string]$Color = 'DarkGray') {
  Write-Host "  $TL$H " -ForegroundColor $Color -NoNewline; Write-Host $Title -NoNewline
  Write-Host (" " + ($H * [Math]::Max(2, $BoxW - $Title.Length - 5)) + $TR) -ForegroundColor $Color
  foreach ($line in $Lines) {
    $rest = "$line"
    do {
      $part = if ($rest.Length -gt $BoxW - 4) { $cut = $rest.LastIndexOf(' ', $BoxW - 4); if ($cut -lt 1) { $cut = $BoxW - 4 }; $rest.Substring(0, $cut) } else { $rest }
      $rest = $rest.Substring($part.Length).TrimStart()
      Write-Host "  $V " -ForegroundColor $Color -NoNewline; Write-Host $part.PadRight($BoxW - 4) -NoNewline; Write-Host " $V" -ForegroundColor $Color
    } while ($rest.Length -gt 0)
  }
  Write-Host ("  $BL" + ($H * ($BoxW - 2)) + $BR) -ForegroundColor $Color
}

# The radiation trefoil as `nuclear` draws it (16 x 12 pixels, two per cell): y yellow, s slate, . nothing; and the
# title in pixel letters (4 x 5).
$Sign = @('.....yyyyyy.....', '...yyyssssyyy...', '..yyyssssssyyyy.', '.yyyyyssssyyyyy.', 'yyyyyyyyyyyyyyyy', 'yyyyyyssssyyyyyy',
  'yyssssssssssssyy', 'yysssssyysssssyy', '.yysssyyyysssyy.', '..yysyyyyyysyyy.', '...yyyyyyyyyy...', '.....yyyyyy.....')
$Glyphs = @{ 'A' = '.##. #..# #### #..# #..#'; 'E' = '#### #... ###. #... ####'; 'I' = '#### .##. .##. .##. ####'; 'L' = '#... #... #... #... ####'
  'N' = '#..# ##.# #.## #..# #..#'; 'R' = '###. #..# ###. #.#. #..#'; 'S' = '.### #... .##. ...# ###.'; 'T' = '#### .##. .##. .##. .##.'; 'U' = '#..# #..# #..# #..# .##.' }
function Banner([string]$Word, [string]$Detail) {
  $Color = @{ 'y' = [ConsoleColor]::Yellow; 's' = [ConsoleColor]::DarkGray }
  $Rows = @('', '', '', '', '', '')
  foreach ($ch in $Word.ToCharArray()) { $g = $Glyphs["$ch"] -split ' '; for ($r = 0; $r -lt 5; $r++) { $Rows[$r] += $g[$r] + '.' } }
  $Rows[5] = '.' * $Rows[0].Length
  Write-Host ''
  Write-Host "  $TL$H " -ForegroundColor DarkCyan -NoNewline; Write-Host 'NuclearLang' -NoNewline; Write-Host (' ' + ($H * ($BoxW - 16)) + $TR) -ForegroundColor DarkCyan
  for ($row = 0; $row -lt 6; $row++) {
    Write-Host "  $V " -ForegroundColor DarkCyan -NoNewline
    for ($i = 0; $i -lt 16; $i++) {
      $t = $Sign[$row * 2][$i]; $b = $Sign[$row * 2 + 1][$i]
      if ($t -eq '.' -and $b -eq '.') { Write-Host ' ' -NoNewline }
      elseif ($t -ne '.' -and $b -ne '.') { Write-Host $Up -ForegroundColor $Color["$t"] -BackgroundColor $Color["$b"] -NoNewline }
      elseif ($t -ne '.') { Write-Host $Up -ForegroundColor $Color["$t"] -NoNewline }
      else { Write-Host $Down -ForegroundColor $Color["$b"] -NoNewline }
    }
    Write-Host '    ' -NoNewline
    $used = 20
    if ($row -lt 3) {
      $top = $Rows[$row * 2]; $bot = $Rows[$row * 2 + 1]
      for ($i = 0; $i -lt $top.Length; $i++) {
        $c = if ($top[$i] -eq '#' -and $bot[$i] -eq '#') { $Full } elseif ($top[$i] -eq '#') { $Up } elseif ($bot[$i] -eq '#') { $Down } else { ' ' }
        Write-Host $c -ForegroundColor Yellow -NoNewline
      }
      $used += $top.Length
    } elseif ($row -eq 3) {
      Write-Host 'NuclearLang' -ForegroundColor Yellow -NoNewline; Write-Host "  $Dot  " -ForegroundColor DarkGray -NoNewline; Write-Host 'Synapsis' -ForegroundColor Magenta -NoNewline; $used += 24
    } else {
      $text = if ($row -eq 4) { 'Write only the logic; transpilers do the rest.' } else { $Detail }
      Write-Host $text -ForegroundColor DarkGray -NoNewline; $used += $text.Length
    }
    Write-Host (' ' * [Math]::Max(0, $BoxW - 2 - $used)) -NoNewline; Write-Host $V -ForegroundColor DarkCyan
  }
  Write-Host ("  $BL" + ($H * ($BoxW - 2)) + $BR) -ForegroundColor DarkCyan
}

# The loading icon: the sign turning, in braille (12 frames of 10 degrees), each line as offsets from U+2800.
$Spin1 = @(@(0,0,59,255,31,0,0), @(0,0,24,255,127,2,0), @(0,0,0,191,255,6,0), @(128,64,0,184,255,102,0), @(128,196,0,128,255,230,64), @(128,228,64,0,252,230,64), @(128,244,196,0,224,230,64), @(128,244,231,0,128,228,64), @(128,244,255,64,0,224,64), @(0,180,255,71,0,128,64), @(0,48,255,127,0,0,0), @(0,16,191,255,3,0,0))
$Spin2 = @(@(160,228,196,54,224,228,68), @(176,246,196,54,224,192,64), @(184,247,70,54,193,64,0), @(184,255,6,54,201,0,0), @(184,127,7,54,73,1,0), @(56,63,11,54,25,9,1), @(24,27,11,54,25,27,3), @(8,9,11,54,25,63,7), @(0,8,137,54,56,191,71), @(0,0,201,54,48,255,71), @(0,128,200,54,176,254,71), @(128,192,196,54,224,246,70))
$Spin3 = @(@(8,59,11,0,25,31,1), @(8,27,1,0,187,31,1), @(8,11,0,8,255,31,1), @(8,1,0,184,255,23,0), @(0,0,0,254,255,6,0), @(0,0,160,255,247,4,0), @(0,0,244,255,230,0,0), @(0,32,254,255,68,0,0), @(0,48,255,247,0,0,0), @(0,58,255,71,0,8,1), @(8,59,255,1,0,25,1), @(8,59,95,0,8,27,1))
$Frames = @(0..11 | ForEach-Object { , @((Chars ($Spin1[$_] | ForEach-Object { 0x2800 + $_ })), (Chars ($Spin2[$_] | ForEach-Object { 0x2800 + $_ })), (Chars ($Spin3[$_] | ForEach-Object { 0x2800 + $_ }))) })
function Human([long]$Bytes) { if ($Bytes -ge 1MB) { '{0:N1} MB' -f ($Bytes / 1MB) } else { '{0:N0} KB' -f ($Bytes / 1KB) } }
function Draw-Card([int]$Frame, [string]$Title, [string]$About, [long]$Have, [long]$Total, [double]$Secs) {
  $f = $Frames[$Frame % 12]; $width = [Math]::Max(20, [Console]::WindowWidth - 1)
  [Console]::SetCursorPosition(0, $script:CardTop)
  Write-Host ("  " + $f[0] + "   ") -ForegroundColor Yellow -NoNewline; Write-Host $Title.PadRight($width - 12).Substring(0, $width - 12)
  Write-Host ("  " + $f[1] + "   ") -ForegroundColor Yellow -NoNewline; Write-Host $About.PadRight($width - 12).Substring(0, $width - 12) -ForegroundColor DarkGray
  Write-Host ("  " + $f[2] + "   ") -ForegroundColor Yellow -NoNewline
  if ($Total -gt 0) {
    $pct = [Math]::Min(100, [int]($Have * 100 / $Total)); $full = [int]($pct * 24 / 100)
    Write-Host ($Full * $full) -ForegroundColor Yellow -NoNewline; Write-Host ($Light * (24 - $full)) -ForegroundColor DarkGray -NoNewline
    $tail = "  $pct%  $(Human $Have) of $(Human $Total) $Dot $([int]$Secs) s"
  } else { $tail = "$(Human $Have) $Dot $([int]$Secs) s" }
  Write-Host $tail.PadRight($width - 36) -ForegroundColor DarkGray
}
# Downloads a file with the sign turning beside what it is, and a bar of the bytes against the size the server says.
function Save-Url([string]$Url, [string]$Out, [string]$Title, [string]$About) {
  $req = [Net.HttpWebRequest]::Create($Url); $req.UserAgent = 'nuclearlang-installer'
  $res = $req.GetResponse(); $total = $res.ContentLength
  $in = $res.GetResponseStream(); $file = [IO.File]::Create($Out)
  $buf = New-Object byte[] 65536; $have = 0; $clock = [Diagnostics.Stopwatch]::StartNew(); $tick = [Diagnostics.Stopwatch]::StartNew(); $frame = 0
  if ($Animate) { Write-Host ''; Write-Host ''; Write-Host ''; $script:CardTop = [Console]::CursorTop - 3; [Console]::CursorVisible = $false }
  else { Write-Host "  ... $Title" }
  try {
    while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
      $file.Write($buf, 0, $n); $have += $n
      if ($Animate -and $tick.ElapsedMilliseconds -ge 100) { Draw-Card $frame $Title $About $have $total $clock.Elapsed.TotalSeconds; $frame++; $tick.Restart() }
    }
  } finally {
    $file.Close(); $in.Close(); $res.Close()
    if ($Animate) {
      [Console]::SetCursorPosition(0, $script:CardTop); $blank = ' ' * ([Console]::WindowWidth - 1)
      Write-Host $blank; Write-Host $blank; Write-Host $blank
      [Console]::SetCursorPosition(0, $script:CardTop); [Console]::CursorVisible = $true
    }
  }
}
# The SHA-256 a release publishes beside a file, as text: GitHub serves `.sha256` as bytes, which
# Invoke-WebRequest's Content would give as `System.Byte[]`.
function Get-Sum([string]$Url) {
  $client = New-Object Net.WebClient
  $client.Headers['User-Agent'] = 'nuclearlang-installer'
  (($client.DownloadString($Url)).Trim() -split '\s+')[0].ToLower()
}
# What failed, in a red box with what to do; then the installer stops.
# Ends the installer with an error code. Run as a file (-File, CI) it exits; run by `irm | iex` it is the user's own
# PowerShell, which `exit` would close with the error still unread: `break` stops the script and the window stays.
function Quit([int]$Code) {
  $global:LASTEXITCODE = $Code
  if ($PSCommandPath) { exit $Code }
  break
}
function Fail([string]$Title, [string]$Why, [string]$Todo) {
  Write-Host ''
  Box "Could not finish: $Title" @($Why, '', $Todo) 'Red'
  Write-Host ''
  Quit 1
}

# the set-up is the AI archive's own nuclear-builder: it needs nothing on the machine
$Builder = Join-Path $Install 'ai\bin\nuclear-builder.cmd'
# Windows starts the services as processes of the installation (no service manager): they hold its files until
# stopped, so nothing under $Under can be replaced or removed while they run (their set-up starts them again)
function Stop-Under([string]$Under) {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Under, [StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
}
# the version a run installed (.version): a new run of the same version keeps what is there (-Reinstall replaces it)
function Same-Version([string]$Folder) { (-not $Reinstall) -and ((Get-Content (Join-Path $Folder '.version') -ErrorAction SilentlyContinue) -eq $Version) }
$env:NUCLEAR_INSTALL = $Install

if ($Uninstall) {
  Banner 'UNINSTALL' 'Takes away everything NuclearLang installed and made'
  Section 'Uninstalling'
  # the AI services first (what starts them at login, the graph's tool): their set-up takes them away
  if (Test-Path $Builder) { & $Builder setup --remove --all | Out-Null; Ok 'The AI services, with the models and data their set-up made' }
  Stop-Under $Install
  Remove-Item -Recurse -Force $Install -ErrorAction SilentlyContinue
  Remove-Item -Force (Join-Path (Split-Path $Install) 'nuclearlang-install.lock') -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $env:APPDATA 'nuclearlang') -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $env:USERPROFILE '.cache\nuclearlang') -ErrorAction SilentlyContinue
  foreach ($d in $SkillDirs) { Remove-Item -Recurse -Force (Join-Path $d 'nuclear') -ErrorAction SilentlyContinue }
  Set-UserPath ($UserPath | Where-Object { $_ -ne $Bin })
  foreach ($e in @('code', 'code-insiders', 'cursor', 'codium', 'windsurf')) {
    if (Get-Command $e -ErrorAction SilentlyContinue) { & $e --uninstall-extension nuclearlang.nuclearlang *> $null; Ok "Editor extension removed from $e" }
  }
  if (Test-Path $Install) { Warn "$Install could not be removed (a program still uses it): close it, then remove the folder by hand" }
  else { Ok 'The commands, the installation, the skill, the caches and the PATH entry' }
  Write-Host ''
  Box 'Uninstalled' @('NuclearLang is uninstalled.', 'What was on this machine before the install stays.') 'Green'
  Write-Host ''
  return
}

# one install at a time: the lock is a file held open until this run ends (a run that died lets it go by itself)
$LockFile = Join-Path (Split-Path $Install) 'nuclearlang-install.lock'
try { $Lock = [IO.File]::Open($LockFile, 'OpenOrCreate', 'ReadWrite', 'None') }
catch { Write-Host 'Another NuclearLang install is running: wait for it to end, then run this again.'; Quit 1 }

# --- this system ---
$Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
  'AMD64' { 'x86_64' }
  'ARM64' { 'aarch64' }
  default { Write-Host "This processor is not supported: $env:PROCESSOR_ARCHITECTURE (x86_64 and arm64 are)."; Quit 1 }
}

# --- which release ---
if ($Version -eq 'latest') {
  if ($env:NUCLEAR_DOWNLOAD) {
    $Version = (Invoke-RestMethod "$($env:NUCLEAR_DOWNLOAD)/latest").ToString().Trim()
  } else {
    $Version = (Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'nuclearlang-installer' }).tag_name
  }
}
$Version = $Version.TrimStart('v')
$Name = "nuclearlang-$Version-windows-$Arch.zip"
$Base = if ($env:NUCLEAR_DOWNLOAD) { $env:NUCLEAR_DOWNLOAD } else { "https://github.com/$Repo/releases/download/v$Version" }

Banner 'INSTALLER' "Version $Version for Windows $Dot $Arch"

# --- download and check ---
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("nuclearlang-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
  Section "NuclearLang $Version"
  $NuclearHere = (Same-Version $Install) -and (Test-Path (Join-Path $Bin 'nuclear.exe'))
  if ($NuclearHere) { & (Join-Path $Bin 'nuclear.exe') dialect list | Out-Null; $NuclearHere = $LASTEXITCODE -eq 0 }
  if ($NuclearHere) { Ok "NuclearLang $Version is already installed in $Install (kept: nothing downloaded)" } else {
  $Zip = Join-Path $Tmp $Name
  try { Save-Url "$Base/$Name" $Zip "Downloading NuclearLang $Version" "The compiler, the language server and the standard library, for Windows $Dot $Arch" }
  catch { Fail "Downloading NuclearLang $Version" "$($_.Exception.Message)" 'Check your connection and run the installer again. The releases: https://github.com/nuclearlang/lang/releases' }
  Ok "Downloaded NuclearLang $Version"
  $Want = (Get-Sum "$Base/$Name.sha256")
  $Got = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLower()
  if ($Want -ne $Got) { Fail 'Verifying the download' 'The file does not match the release''s checksum (SHA-256): it was damaged on the way.' 'Run the installer again: the file is downloaded anew.' }
  Ok 'Verified (SHA-256)'

  # --- install ---
  Expand-Archive $Zip -DestinationPath $Tmp -Force
  # the AI services already there are kept (a new version of them replaces them later); their processes let go first
  Stop-Under $Install
  $OldAi = Join-Path $Install 'ai'
  if (Test-Path $OldAi) { Move-Item $OldAi (Join-Path $Tmp 'nuclearlang\ai') }
  Remove-Item -Recurse -Force $Install -ErrorAction SilentlyContinue
  if (Test-Path $Install) { Fail 'Installing' "$Install could not be replaced: a program still uses it." 'Close the editors and terminals that use NuclearLang, then run the installer again.' }
  New-Item -ItemType Directory -Path (Split-Path $Install) -Force | Out-Null
  Move-Item (Join-Path $Tmp 'nuclearlang') $Install
  & (Join-Path $Bin 'nuclear.exe') dialect list | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'Installing' 'The installed nuclear does not run on this system.' 'Check that your antivirus let it in, then run the installer again.' }
  Set-Content -Path (Join-Path $Install '.version') -Value $Version -Encoding ascii
  Ok "Installed in $Install"
  }
  # the choices of this install, kept by the next update
  Set-Content -Path $Options -Encoding ascii -Value @("NoVSCode=$([int][bool]$NoVSCode)", "NoAgent=$([int][bool]$NoAgent)", "NoModifyPath=$([int][bool]$NoModifyPath)")

  if (-not $NoAgent) {
    foreach ($d in $SkillDirs) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
      Remove-Item -Recurse -Force (Join-Path $d 'nuclear') -ErrorAction SilentlyContinue
      Copy-Item -Recurse (Join-Path $Install 'agents\skills\nuclear') $d
    }
    Ok 'The nuclear skill for Claude Code, Codex, Cursor, Grok Build and OpenCode (what Nuclear is, for your agent)'
  }

  # every editor of the VS Code family on the PATH
  $Installed = @()
  $Editors = @('code', 'code-insiders', 'cursor', 'codium', 'windsurf') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue }
  if (-not $NoVSCode -and $Editors) {
    $Vsix = Join-Path $Tmp "nuclearlang-$Version.vsix"
    try {
      Section 'Editors'
      Save-Url "$Base/nuclearlang-$Version.vsix" $Vsix 'Downloading the editor extension' 'Syntax, diagnostics, the device, the AI panels: one extension for every editor'
      foreach ($e in $Editors) {
        & $e --install-extension $Vsix --force *> $null
        if ($LASTEXITCODE -eq 0) { Ok "Editor extension in $e"; $Installed += $e }
        else { Warn "The editor extension did not install in ${e}: $e --install-extension $Base/nuclearlang-$Version.vsix" }
      }
    } catch { }
  }
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}

# --- the PATH ---
if (-not $NoModifyPath -and -not ($UserPath -contains $Bin)) {
  Set-UserPath (@($Bin) + $UserPath)
  $env:Path = "$Bin;$env:Path"
  Ok "$Bin in your user PATH (a new terminal sees it)"
}

# --- the Smart Graph and the MCP server: required (ADR-installer-0006, ADR-installer-0003) ---
# Always installed, no question: only the local agents are asked, by the set-up (`remote`, the default, adds no local
# model). A machine already set up keeps its profile; without a terminal the profile is `remote`. -NoAi (tests)
# skips them and the install ends incomplete.
$Machine = Join-Path $env:APPDATA 'nuclearlang\ai.env'
if (-not $AiProfile -and (Test-Path $Machine)) {
  $AiProfile = (Get-Content $Machine | Where-Object { $_ -like 'NUCLEAR_AI_PROFILE=*' } | Select-Object -First 1) -replace '^NUCLEAR_AI_PROFILE=', ''
}
$AiNote = ''
$Interactive = -not $env:CI -and [Environment]::UserInteractive
if ($NoAi) { $AiNote = '-NoAi: the Smart Graph and the MCP server, which are required, were not installed. Run the installer without it.' }
else {
  Section 'The Smart Graph and the MCP server'
  if (-not $AiProfile -and -not $Interactive) { $AiProfile = 'remote' }
}
$AiDir = Join-Path $Install 'ai'
if (-not $NoAi -and (Same-Version $AiDir) -and (Test-Path $Builder)) {
  Set-Content -Path (Join-Path $Bin 'nuclear-builder.cmd') -Value "@`"$Builder`" %*" -Encoding ascii
  Ok "The AI services of $Version are already here (kept: nothing downloaded)"
} elseif (-not $NoAi) {
  # their archive (ADR-installer-0003): a Python of their own with the services in it, unpacked as the installation's ai\
  # Windows on ARM runs the x64 archive (its emulation of x64): onnxruntime publishes no wheel for Windows ARM64
  $AiName = "nuclearlang-ai-$Version-windows-x86_64.zip"
  $Tmp = Join-Path ([IO.Path]::GetTempPath()) ("nuclearlang-ai-" + [Guid]::NewGuid())
  New-Item -ItemType Directory -Path $Tmp | Out-Null
  try {
    $AiZip = Join-Path $Tmp $AiName
    $Want = ''
    try {
      Save-Url "$Base/$AiName" $AiZip 'Downloading the AI services' 'A Python of their own with the Smart Graph, the MCP server and the local agents'
      Ok 'Downloaded the AI services'
      $Want = (Get-Sum "$Base/$AiName.sha256")
    } catch {
      $NoAi = $true
      $AiNote = "The Smart Graph and the MCP server of $Version could not be downloaded for Windows $Arch`: check the connection and run the installer again."
    }
    if (-not $NoAi) {
      if ($Want -ne (Get-FileHash $AiZip -Algorithm SHA256).Hash.ToLower()) { Fail 'Verifying the AI services' 'The file does not match the release''s checksum (SHA-256).' 'Run the installer again: the file is downloaded anew.' }
      Stop-Under $AiDir
      Remove-Item -Recurse -Force $AiDir -ErrorAction SilentlyContinue
      Expand-Archive $AiZip -DestinationPath $Install -Force
      Set-Content -Path (Join-Path $AiDir '.version') -Value $Version -Encoding ascii
      # nuclear-builder is the archive's from now on: `nuclear-builder setup` works before the set-up ran
      Set-Content -Path (Join-Path $Bin 'nuclear-builder.cmd') -Value "@`"$Builder`" %*" -Encoding ascii
      Ok 'The AI services, unpacked (their own Python: nothing else is needed on this machine)'
    }
  } finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
  }
}
if (-not $NoAi) {
  # the set-up's heavy part (the knowledge base's first load, the models) below normal priority, inherited by its
  # processes: a busy machine stays usable, the set-up only goes slower (spec 018 K1)
  try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch { }
  if (-not (Test-Path $Builder)) {
    $AiNote = 'The AI archive has no set-up: run this installer again (-Reinstall).'
  } elseif ($AiProfile) {
    Section "Set-up $Dot profile $AiProfile"
    & $Builder setup --profile $AiProfile --yes
    if ($LASTEXITCODE -ne 0) { $AiNote = 'The Smart Graph and the MCP server are not fully set up: run the installer again; it goes on from the step that failed.' }
  } elseif ($Interactive) {
    Section 'Set-up'
    & $Builder setup
    if ($LASTEXITCODE -ne 0) { $AiNote = 'The Smart Graph and the MCP server are not fully set up: run the installer again; it goes on from the step that failed.' }
  } else {
    $AiNote = 'The Smart Graph and the MCP server are not set up: run `nuclear-builder setup --profile remote --yes`.'
  }
}

# --- the end: nuclear's own intro (the mushroom cloud), then the summary (a release before 0.1.6 has no `intro`) ---
$NuclearExe = Join-Path $Bin 'nuclear.exe'
if ($Animate -and [Console]::WindowWidth -ge 80 -and ((& $NuclearExe help 2>&1 | Out-String) -match '(?m)^  intro ')) {
  Write-Host ''
  cmd /c "`"$NuclearExe`" intro < NUL"
}
Write-Host ''
$Summary = @("Command       $NuclearExe", '', 'Required', "  $Tick NuclearLang (the compiler, the language server, the standard library)")
if (-not $NoAi -and -not $AiNote) { $Summary += @("  $Tick The Smart Graph (its own embeddings model, started at every login)", "  $Tick The MCP server in your AI clients (nuclear-builder setup --status)") }
else { $Summary += '  x The Smart Graph and the MCP server (below)' }
if (-not $NoAgent) { $Summary += "  $Tick The nuclear skill (Claude Code, Codex, Cursor, Grok Build, OpenCode)" }
$Summary += 'Added when possible'
if ($Installed) { $Summary += "  $Tick The editor extension: $($Installed -join ', ')" }
elseif ($NoVSCode) { $Summary += '  o The editor extension: not asked (-NoVSCode)' }
else { $Summary += '  o The editor extension: no VS Code, Cursor, VSCodium or Windsurf here; search NuclearLang in its extensions' }
$Summary += 'Optional, asked'
$Chosen = if (Test-Path $Machine) { (Get-Content $Machine | Where-Object { $_ -like 'NUCLEAR_AI_PROFILE=*' } | Select-Object -First 1) -replace '^NUCLEAR_AI_PROFILE=', '' } else { '' }
if ($Chosen -in @('lite', 'medium', 'hard')) { $Summary += "  $Tick Local agents: profile $Chosen (Ollama's models on this machine)" }
else { $Summary += '  o Local agents: not chosen (remote: no local model); nuclear-builder setup to add them' }
# each platform's toolchain is never installed here: found, or how to get it (the editor guides too)
$Summary += "Each platform's own (only for the platforms you build; the editor guides you)"
$Tools = $null
try { $Tools = ((& $NuclearExe doctor --json 2>$null | Out-String) | ConvertFrom-Json).toolchains } catch { }
foreach ($t in @(@('flutter', 'Flutter', 'mobile', 'docs.flutter.dev/get-started/install/windows'), @('node', 'Node.js', 'web, NestJS', 'winget install OpenJS.NodeJS.LTS'), @('python', 'Python ', 'FastAPI', 'it comes with the AI services, or winget install Python.Python.3.12'))) {
  $f = if ($Tools) { $Tools.($t[0]) } else { $null }
  if ($f -and $f.found -and $f.found -ne 'missing' -and $f.found -ne 'broken') { $Summary += "  $Tick $($t[1])  $($t[2]) $Dot $($f.path)" }
  else { $Summary += "  o $($t[1])  $($t[2]): not found $Dot $($t[3])" }
}
$Summary += @('', "Start with    nuclear new my_app  $Dot  nuclear doctor  $Dot  nuclear help", 'Docs          https://nuclearlang.github.io')
Box "NuclearLang $Version is installed" $Summary 'Green'
Warn 'Open a new terminal so the PATH includes NuclearLang.'
if ($AiNote) {
  # a required part is missing: the installer ends with an error (NuclearLang itself stays installed)
  Write-Host ''
  Box 'Not complete' @($AiNote) 'Red'
  Write-Host ''
  Quit 1
}
Write-Host ''
