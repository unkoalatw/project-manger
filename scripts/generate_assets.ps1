Add-Type -AssemblyName System.Drawing

$projectRoot = "c:\Users\timothy\Desktop\app files\project"

function Draw-VdoIcon {
    param([int]$sz)
    $s = [float]$sz
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Clear transparent
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded squircle container
    $radius = $s * 0.22
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2.0
    $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $path.AddArc($s - $d, 0.0, $d, $d, 270.0, 90.0)
    $path.AddArc($s - $d, $s - $d, $d, $d, 0.0, 90.0)
    $path.AddArc(0.0, $s - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()

    # Background gradient: Deep Space Slate/Obsidian to Royal Blue
    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, $s, $s)
    $color1 = [System.Drawing.Color]::FromArgb(255, 10, 15, 30)
    $color2 = [System.Drawing.Color]::FromArgb(255, 2, 6, 23)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $color1, $color2, 45.0)
    $g.FillPath($bgBrush, $path)

    # Outer neon border
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 59, 130, 246), ($s * 0.025))
    $g.DrawPath($borderPen, $path)

    # Document layer 1: Backing document tilt (Indigo glow)
    $doc1Brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 99, 102, 241))
    $p1 = New-Object System.Drawing.PointF(($s * 0.26), ($s * 0.18))
    $p2 = New-Object System.Drawing.PointF(($s * 0.80), ($s * 0.14))
    $p3 = New-Object System.Drawing.PointF(($s * 0.74), ($s * 0.68))
    $p4 = New-Object System.Drawing.PointF(($s * 0.20), ($s * 0.72))
    [System.Drawing.PointF[]]$doc1Points = @($p1, $p2, $p3, $p4)
    $g.FillPolygon($doc1Brush, $doc1Points)

    # Document layer 2: Cyan tilt
    $doc2Brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 6, 182, 212))
    $q1 = New-Object System.Drawing.PointF(($s * 0.22), ($s * 0.24))
    $q2 = New-Object System.Drawing.PointF(($s * 0.76), ($s * 0.20))
    $q3 = New-Object System.Drawing.PointF(($s * 0.70), ($s * 0.74))
    $q4 = New-Object System.Drawing.PointF(($s * 0.16), ($s * 0.78))
    [System.Drawing.PointF[]]$doc2Points = @($q1, $q2, $q3, $q4)
    $g.FillPolygon($doc2Brush, $doc2Points)

    # Front Chevron / Origami "V" - Holographic Blue to Purple gradient
    $ptA = New-Object System.Drawing.PointF(0.0, 0.0)
    $ptB = New-Object System.Drawing.PointF($s, $s)
    $vGradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $ptA, $ptB,
        [System.Drawing.Color]::FromArgb(255, 37, 99, 235),
        [System.Drawing.Color]::FromArgb(255, 147, 51, 234)
    )

    $v1 = New-Object System.Drawing.PointF(($s * 0.20), ($s * 0.28))
    $v2 = New-Object System.Drawing.PointF(($s * 0.35), ($s * 0.28))
    $v3 = New-Object System.Drawing.PointF(($s * 0.50), ($s * 0.62))
    $v4 = New-Object System.Drawing.PointF(($s * 0.65), ($s * 0.28))
    $v5 = New-Object System.Drawing.PointF(($s * 0.80), ($s * 0.28))
    $v6 = New-Object System.Drawing.PointF(($s * 0.56), ($s * 0.78))
    $v7 = New-Object System.Drawing.PointF(($s * 0.44), ($s * 0.78))
    [System.Drawing.PointF[]]$vPoints = @($v1, $v2, $v3, $v4, $v5, $v6, $v7)
    $g.FillPolygon($vGradBrush, $vPoints)

    # Origin Orb (Glowing Center core)
    $orbA = New-Object System.Drawing.PointF(($s * 0.42), ($s * 0.34))
    $orbB = New-Object System.Drawing.PointF(($s * 0.58), ($s * 0.50))
    $orbBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $orbA, $orbB,
        [System.Drawing.Color]::FromArgb(255, 56, 189, 248),
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
    )
    $g.FillEllipse($orbBrush, ($s * 0.43), ($s * 0.35), ($s * 0.14), ($s * 0.14))

    # Bold VDO text for large icons
    if ($sz -ge 128) {
        $font = New-Object System.Drawing.Font("Arial", ($s * 0.11), [System.Drawing.FontStyle]::Bold)
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect = New-Object System.Drawing.RectangleF(0.0, ($s * 0.80), $s, ($s * 0.16))
        $g.DrawString("V D O", $font, $textBrush, $textRect, $sf)
    }

    $g.Dispose()
    return $bmp
}

# Generate 512, 192, mipmaps
$icon512 = Draw-VdoIcon -sz 512
$icon192 = Draw-VdoIcon -sz 192
$icon144 = Draw-VdoIcon -sz 144
$icon96  = Draw-VdoIcon -sz 96
$icon72  = Draw-VdoIcon -sz 72
$icon48  = Draw-VdoIcon -sz 48

# Save paths
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

# Android launcher icons
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

Write-Output "✅ ALL PNG ICONS (512, 192, mipmaps) GENERATED SUCCESSFULLY!"
