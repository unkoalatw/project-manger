Add-Type -AssemblyName System.Drawing

$projectRoot = "c:\Users\timothy\Desktop\app files\project"

function Pt([float]$x, [float]$y) {
    return New-Object System.Drawing.PointF($x, $y)
}

function Draw-VercelVdoIcon {
    param([int]$sz)
    $s = [float]$sz
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Base Squircle (Pure Obsidian Black)
    $radius = $s * 0.22
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2.0
    $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $path.AddArc($s - $d, 0.0, $d, $d, 270.0, 90.0)
    $path.AddArc($s - $d, $s - $d, $d, $d, 0.0, 90.0)
    $path.AddArc(0.0, $s - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()

    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
    $g.FillPath($bgBrush, $path)

    # Subtle 1px Border (#27272a)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 39, 39, 42), [float]($s * 0.015))
    $g.DrawPath($borderPen, $path)

    # 2. Outer Pure White Inverted Geometric Triangle
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    [System.Drawing.PointF[]]$outerTri = @(
        (Pt ($s * 0.50) ($s * 0.82)),
        (Pt ($s * 0.18) ($s * 0.27)),
        (Pt ($s * 0.82) ($s * 0.27))
    )
    $g.FillPolygon($whiteBrush, $outerTri)

    # 3. Inner Black Cutout (Forming crisp geometric 'V' monolith)
    $blackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
    [System.Drawing.PointF[]]$innerTri = @(
        (Pt ($s * 0.50) ($s * 0.66)),
        (Pt ($s * 0.31) ($s * 0.33)),
        (Pt ($s * 0.69) ($s * 0.33))
    )
    $g.FillPolygon($blackBrush, $innerTri)

    # 4. Origin Dot (Top Center Core)
    $g.FillEllipse($whiteBrush, [float]($s * 0.46), [float]($s * 0.18), [float]($s * 0.08), [float]($s * 0.08))

    $g.Dispose()
    return $bmp
}

$icon512 = Draw-VercelVdoIcon -sz 512
$icon192 = Draw-VercelVdoIcon -sz 192
$icon144 = Draw-VercelVdoIcon -sz 144
$icon96  = Draw-VercelVdoIcon -sz 96
$icon72  = Draw-VercelVdoIcon -sz 72
$icon48  = Draw-VercelVdoIcon -sz 48

$paths512 = @(
    "$projectRoot\icon-512.png",
    "$projectRoot\public\icon-512.png",
    "$projectRoot\public\assets\icon-512.png",
    "$projectRoot\dist\icon-512.png",
    "$projectRoot\dist\assets\icon-512.png",
    "$projectRoot\android\app\src\main\assets\www\icon-512.png",
    "$projectRoot\android\app\src\main\assets\www\assets\icon-512.png"
)

$paths192 = @(
    "$projectRoot\icon-192.png",
    "$projectRoot\public\icon-192.png",
    "$projectRoot\public\assets\icon-192.png",
    "$projectRoot\dist\icon-192.png",
    "$projectRoot\dist\assets\icon-192.png",
    "$projectRoot\android\app\src\main\assets\www\icon-192.png",
    "$projectRoot\android\app\src\main\assets\www\assets\icon-192.png"
)

foreach ($p in $paths512) {
    $dir = Split-Path $p
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $icon512.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
}

foreach ($p in $paths192) {
    $dir = Split-Path $p
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $icon192.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
}

$resDir = "$projectRoot\android\app\src\main\res"
if (Test-Path $resDir) {
    $icon48.Save("$resDir\mipmap-mdpi\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon48.Save("$resDir\mipmap-mdpi\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon72.Save("$resDir\mipmap-hdpi\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon72.Save("$resDir\mipmap-hdpi\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon96.Save("$resDir\mipmap-xhdpi\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon96.Save("$resDir\mipmap-xhdpi\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon144.Save("$resDir\mipmap-xxhdpi\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon144.Save("$resDir\mipmap-xxhdpi\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon192.Save("$resDir\mipmap-xxxhdpi\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon192.Save("$resDir\mipmap-xxxhdpi\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
}

Write-Output "✅ ALL VERCEL BLACK & WHITE PNG ICONS (512, 192, mipmaps) GENERATED CLEANLY!"
