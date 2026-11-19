# NuclearLang installer for Windows (PowerShell 5.1 or 7):
#
#   irm https://nuclearlang.github.io/install.ps1 | iex
#   & ([scriptblock]::Create((irm https://nuclearlang.github.io/install.ps1))) -Version 0.2.0
#   & ([scriptblock]::Create((irm https://nuclearlang.github.io/install.ps1))) -Uninstall
#
# It downloads the release of this architecture (x86_64 or arm64) from
# GitHub, checks its SHA-256, installs it in %LOCALAPPDATA%\nuclearlang, puts its bin folder in your user PATH, gives the
# AI agents the `nuclear` skill and installs the editor extension in every VS Code family editor on the PATH. No administrator rights. Then,
# asked, the AI services: their archive (a Python of their own with the Smart Graph, the MCP server and the Nuclear
# Developer; nothing is needed on the machine) and their set-up (`nuclear-builder setup`: it reads this machine,
# suggests a profile and asks before anything else is downloaded; a machine already set up is brought up to date
# without questions). -NoAi skips them; -AiProfile remote|lite|medium|hard takes that profile without questions.
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
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = if ($env:NUCLEAR_REPO) { $env:NUCLEAR_REPO } else { 'nuclearlang/lang' }
$Install = if ($env:NUCLEAR_INSTALL) { $env:NUCLEAR_INSTALL } else { Join-Path $env:LOCALAPPDATA 'nuclearlang' }
$Bin = Join-Path $Install 'bin'
$SkillDirs = @('.claude\skills', '.agents\skills', '.codex\skills') | ForEach-Object { Join-Path $HOME $_ }

function Set-UserPath([string[]]$Parts) {
  [Environment]::SetEnvironmentVariable('Path', ($Parts | Where-Object { $_ }) -join ';', 'User')
}
$UserPath = @(([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') | Where-Object { $_ })

# --- the look: the colors and the sign of `nuclear`'s own header (tools/cli/src/framework/landing.rs) ---
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
# the symbols from their code points: Windows PowerShell 5.1 may read this file in another encoding
$Dia = [string][char]0x25C6; $Tick = [string][char]0x2713; $Rule = [string][char]0x2500; $Up = [string][char]0x2580; $Down = [string][char]0x2584; $Dot = [string][char]0x00B7
function Step([string]$Text) { Write-Host "  $Dia " -ForegroundColor Yellow -NoNewline; Write-Host $Text }
function Ok([string]$Text) { Write-Host "  $Tick " -ForegroundColor Green -NoNewline; Write-Host $Text }
function Warn([string]$Text) { Write-Host '  ! ' -ForegroundColor Yellow -NoNewline; Write-Host $Text }
function Section([string]$Title) {
  Write-Host ''; Write-Host "  $Title " -NoNewline; Write-Host ($Rule * [Math]::Max(4, 60 - $Title.Length)) -ForegroundColor DarkGray
}
# The radiation trefoil as `nuclear` draws it (16 x 12 pixels, two per cell): y yellow, s slate, . nothing.
$Sign = @('.....yyyyyy.....', '...yyyssssyyy...', '..yyyssssssyyyy.', '.yyyyyssssyyyyy.', 'yyyyyyyyyyyyyyyy', 'yyyyyyssssyyyyyy',
  'yyssssssssssssyy', 'yysssssyysssssyy', '.yysssyyyysssyy.', '..yysyyyyyysyyy.', '...yyyyyyyyyy...', '.....yyyyyy.....')
function Banner([string]$Title) {
  $Color = @{ 'y' = [ConsoleColor]::Yellow; 's' = [ConsoleColor]::DarkGray }
  $Text = @(@('NuclearLang', 'Yellow'), @('Write only the logic; transpilers do the rest.', 'DarkGray'),
    @('Mobile, web and backend in Nuclear', 'Gray'), @('', 'Gray'), @($Title, 'DarkGray'), @('', 'Gray'))
  Write-Host ''
  for ($row = 0; $row -lt 6; $row++) {
    Write-Host '  ' -NoNewline
    for ($i = 0; $i -lt 16; $i++) {
      $t = $Sign[$row * 2][$i]; $b = $Sign[$row * 2 + 1][$i]
      if ($t -eq '.' -and $b -eq '.') { Write-Host ' ' -NoNewline }
      elseif ($t -ne '.' -and $b -ne '.') { Write-Host $Up -ForegroundColor $Color["$t"] -BackgroundColor $Color["$b"] -NoNewline }
      elseif ($t -ne '.') { Write-Host $Up -ForegroundColor $Color["$t"] -NoNewline }
      else { Write-Host $Down -ForegroundColor $Color["$b"] -NoNewline }
    }
    Write-Host '    ' -NoNewline
    Write-Host $Text[$row][0] -ForegroundColor $Text[$row][1] -NoNewline
    if ($row -eq 0) { Write-Host "   $Dot   " -ForegroundColor DarkGray -NoNewline; Write-Host 'Synapsis' -ForegroundColor Magenta -NoNewline }
    Write-Host ''
  }
}

# the set-up is the AI archive's own nuclear-builder: it needs nothing on the machine
$Builder = Join-Path $Install 'ai\bin\nuclear-builder.cmd'
$env:NUCLEAR_INSTALL = $Install

Banner $(if ($Uninstall) { 'Uninstaller' } else { 'Installer' })

if ($Uninstall) {
  # the AI services first (what starts them at login, the graph's tool): their set-up takes them away
  if (Test-Path $Builder) { & $Builder setup --remove --all }
  Remove-Item -Recurse -Force $Install -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $env:APPDATA 'nuclearlang') -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $env:USERPROFILE '.cache\nuclearlang') -ErrorAction SilentlyContinue
  foreach ($d in $SkillDirs) { Remove-Item -Recurse -Force (Join-Path $d 'nuclear') -ErrorAction SilentlyContinue }
  Set-UserPath ($UserPath | Where-Object { $_ -ne $Bin })
  foreach ($e in @('code', 'code-insiders', 'cursor', 'codium', 'windsurf')) {
    if (Get-Command $e -ErrorAction SilentlyContinue) { & $e --uninstall-extension nuclearlang.nuclearlang *> $null }
  }
  Write-Host ''
  Write-Host '  NuclearLang is uninstalled. ' -ForegroundColor Green -NoNewline; Write-Host 'What was on this machine before stays.' -ForegroundColor DarkGray
  Write-Host ''
  return
}

# --- this system ---
$Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
  'AMD64' { 'x86_64' }
  'ARM64' { 'aarch64' }
  default { throw "unsupported architecture: $env:PROCESSOR_ARCHITECTURE (x86_64 and arm64 are)" }
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

# --- download and check ---
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("nuclearlang-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
  Section "NuclearLang $Version"
  Step "Downloading for Windows $Dot $Arch"
  $Zip = Join-Path $Tmp $Name
  Invoke-WebRequest "$Base/$Name" -OutFile $Zip -UseBasicParsing
  $Want = ((Invoke-WebRequest "$Base/$Name.sha256" -UseBasicParsing).Content.ToString() -split '\s+')[0].ToLower()
  $Got = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLower()
  if ($Want -ne $Got) { throw 'the download is damaged (SHA-256 does not match); try again' }
  Ok 'Checked (SHA-256)'

  # --- install ---
  Expand-Archive $Zip -DestinationPath $Tmp -Force
  Remove-Item -Recurse -Force $Install -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path (Split-Path $Install) -Force | Out-Null
  Move-Item (Join-Path $Tmp 'nuclearlang') $Install
  & (Join-Path $Bin 'nuclear.exe') dialect list | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'the installed nuclear does not run on this system' }
  Ok "Installed: nuclear and nuclear-lsp in $Bin"

  if (-not $NoAgent) {
    foreach ($d in $SkillDirs) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
      Remove-Item -Recurse -Force (Join-Path $d 'nuclear') -ErrorAction SilentlyContinue
      Copy-Item -Recurse (Join-Path $Install 'agents\skills\nuclear') $d
    }
  }

  # every editor of the VS Code family on the PATH
  $Installed = @()
  $Editors = @('code', 'code-insiders', 'cursor', 'codium', 'windsurf') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue }
  if (-not $NoVSCode -and $Editors) {
    $Vsix = Join-Path $Tmp "nuclearlang-$Version.vsix"
    try {
      Invoke-WebRequest "$Base/nuclearlang-$Version.vsix" -OutFile $Vsix -UseBasicParsing
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
}

# --- the AI services (ADR-installer-0002, ADR-installer-0003) ---
# Their environments live inside the installation: a machine already set up gets them again for this version, with
# the profile it had. A new one is asked; nothing is downloaded before the user chooses.
$Machine = Join-Path $env:APPDATA 'nuclearlang\ai.env'
if (-not $AiProfile -and (Test-Path $Machine)) {
  $AiProfile = (Get-Content $Machine | Where-Object { $_ -like 'NUCLEAR_AI_PROFILE=*' } | Select-Object -First 1) -replace '^NUCLEAR_AI_PROFILE=', ''
}
$AiNote = ''
$Interactive = -not $env:CI -and [Environment]::UserInteractive
if (-not $NoAi -and -not $AiProfile) {
  if ($Interactive) {
    Section 'The AI services'
    Write-Host '  The Smart Graph (what agents know of NuclearLang), the MCP server and the local agents that write code.'
    Write-Host '  Nothing else is downloaded before you choose.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  Download them (about 160 MB)? ' -NoNewline; Write-Host '[Y/n] ' -ForegroundColor Yellow -NoNewline
    $Answer = Read-Host
    if ($Answer -match '^[nN]') { $NoAi = $true; $AiNote = 'The AI services are not installed: run this installer again when you want them.' }
  } else {
    $NoAi = $true
    $AiNote = 'The AI services are not installed (no terminal here): run this installer in a terminal, or with -AiProfile.'
  }
}
if (-not $NoAi) {
  # their archive (ADR-installer-0003): a Python of their own with the services in it, unpacked as the installation's ai\
  $AiName = "nuclearlang-ai-$Version-windows-$Arch.zip"
  $Tmp = Join-Path ([IO.Path]::GetTempPath()) ("nuclearlang-ai-" + [Guid]::NewGuid())
  New-Item -ItemType Directory -Path $Tmp | Out-Null
  try {
    Step 'Downloading the AI services'
    $AiZip = Join-Path $Tmp $AiName
    $Want = ''
    try {
      Invoke-WebRequest "$Base/$AiName" -OutFile $AiZip -UseBasicParsing
      $Want = ((Invoke-WebRequest "$Base/$AiName.sha256" -UseBasicParsing).Content.ToString() -split '\s+')[0].ToLower()
    } catch {
      $NoAi = $true
      $AiNote = "The AI services of $Version are not published for Windows $Arch."
    }
    if (-not $NoAi) {
      if ($Want -ne (Get-FileHash $AiZip -Algorithm SHA256).Hash.ToLower()) { throw "the AI services' download is damaged (SHA-256 does not match); try again" }
      Remove-Item -Recurse -Force (Join-Path $Install 'ai') -ErrorAction SilentlyContinue
      Expand-Archive $AiZip -DestinationPath $Install -Force
      # nuclear-builder is the archive's from now on: `nuclear-builder setup` works before the set-up ran
      Set-Content -Path (Join-Path $Bin 'nuclear-builder.cmd') -Value "@`"$Builder`" %*" -Encoding ascii
    }
  } finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
  }
}
if (-not $NoAi) {
  if (-not (Test-Path $Builder)) {
    $AiNote = 'The AI archive has no set-up: run this installer again.'
  } elseif ($AiProfile) {
    Step "Setting them up with the profile $AiProfile"
    & $Builder setup --profile $AiProfile --yes
    if ($LASTEXITCODE -ne 0) { $AiNote = 'The AI services are not set up: run `nuclear-builder setup`.' }
  } elseif ($Interactive) {
    Section 'Set-up'
    & $Builder setup
    if ($LASTEXITCODE -ne 0) { $AiNote = 'The AI services are not set up: run `nuclear-builder setup` when you want them.' }
  } else {
    $AiNote = 'The AI services are not set up (no terminal here): run `nuclear-builder setup`.'
  }
}

Section 'Ready'
Write-Host "  $Tick NuclearLang $Version is installed" -ForegroundColor Green
Write-Host ''
Write-Host '    Command       ' -ForegroundColor DarkGray -NoNewline; Write-Host (Join-Path $Bin 'nuclear.exe')
if ($Installed) { Write-Host '    Editors       ' -ForegroundColor DarkGray -NoNewline; Write-Host ($Installed -join ', ') }
if ($AiNote) { Write-Host ''; Warn $AiNote }
Write-Host ''
Warn 'Open a new terminal so the PATH includes NuclearLang.'
Write-Host ''
Write-Host '  Start with    ' -NoNewline
Write-Host 'nuclear new my_app' -ForegroundColor Yellow -NoNewline; Write-Host "   $Dot   " -ForegroundColor DarkGray -NoNewline
Write-Host 'nuclear doctor' -ForegroundColor Yellow -NoNewline; Write-Host "   $Dot   " -ForegroundColor DarkGray -NoNewline
Write-Host 'nuclear help' -ForegroundColor Yellow
Write-Host '  Docs          https://nuclearlang.github.io' -ForegroundColor DarkGray
Write-Host ''
