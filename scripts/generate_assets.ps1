Add-Type -AssemblyName System.Drawing

$projectRoot = "c:\Users\timothy\Desktop\app files\project"

function Pt([float]$x, [float]$y) {
    return New-Object System.Drawing.PointF($x, $y)
}

function Draw-AppleGlassVdoIcon {
    param([int]$sz)
    $s = [float]$sz
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Base Squircle Path
    $radius = $s * 0.225
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2.0
    $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $path.AddArc($s - $d, 0.0, $d, $d, 270.0, 90.0)
    $path.AddArc($s - $d, $s - $d, $d, $d, 0.0, 90.0)
    $path.AddArc(0.0, $s - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()

    # 2. Rich Deep Space Aura Background (Sapphire to Obsidian with ambient backlight)
    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, $s, $s)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (Pt 0.0 0.0),
        (Pt $s $s),
        [System.Drawing.Color]::FromArgb(255, 14, 20, 42),
        [System.Drawing.Color]::FromArgb(255, 3, 5, 12)
    )
    $g.FillPath($bgBrush, $path)

    # Ambient radial backlight aura
    $auraBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 59, 130, 246))
    $g.FillEllipse($auraBrush, [float]($s * 0.15), [float]($s * 0.10), [float]($s * 0.70), [float]($s * 0.60))
    $violetBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 139, 92, 246))
    $g.FillEllipse($violetBrush, [float]($s * 0.35), [float]($s * 0.35), [float]($s * 0.55), [float]($s * 0.55))

    # 3. Outer Glass Specular Border
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 255, 255, 255), [float]($s * 0.022))
    $g.DrawPath($borderPen, $path)

    # 4. Translucent Frosted Glass Document Sheet (Tilted)
    $docBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(55, 255, 255, 255))
    $docPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 255, 255, 255), [float]($s * 0.015))
    [System.Drawing.PointF[]]$docPoints = @(
        (Pt ($s * 0.24) ($s * 0.20)),
        (Pt ($s * 0.78) ($s * 0.15)),
        (Pt ($s * 0.74) ($s * 0.72)),
        (Pt ($s * 0.20) ($s * 0.77))
    )
    $g.FillPolygon($docBrush, $docPoints)
    $g.DrawPolygon($docPen, $docPoints)

    # Document 2 (Foreground Frosted Sheet)
    $doc2Brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
    $doc2Pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 255, 255, 255), [float]($s * 0.018))
    [System.Drawing.PointF[]]$doc2Points = @(
        (Pt ($s * 0.22) ($s * 0.26)),
        (Pt ($s * 0.78) ($s * 0.22)),
        (Pt ($s * 0.72) ($s * 0.78)),
        (Pt ($s * 0.16) ($s * 0.82))
    )
    $g.FillPolygon($doc2Brush, $doc2Points)
    $g.DrawPolygon($doc2Pen, $doc2Points)

    # 5. 3D Crystalline Glass Prism 'V' (Luminous Cyan / Royal Blue / Orchid Purple)
    $vBrushLeft = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (Pt 0.0 0.0),
        (Pt $s $s),
        [System.Drawing.Color]::FromArgb(240, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(220, 37, 99, 235)
    )
    $vBrushRight = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (Pt $s 0.0),
        (Pt 0.0 $s),
        [System.Drawing.Color]::FromArgb(240, 192, 132, 252),
        [System.Drawing.Color]::FromArgb(220, 29, 78, 216)
    )
    $vPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 255, 255), [float]($s * 0.02))

    # Left Arm
    [System.Drawing.PointF[]]$vLeft = @(
        (Pt ($s * 0.22) ($s * 0.30)),
        (Pt ($s * 0.38) ($s * 0.30)),
        (Pt ($s * 0.50) ($s * 0.65)),
        (Pt ($s * 0.40) ($s * 0.72))
    )
    $g.FillPolygon($vBrushLeft, $vLeft)
    $g.DrawPolygon($vPen, $vLeft)

    # Right Arm
    [System.Drawing.PointF[]]$vRight = @(
        (Pt ($s * 0.78) ($s * 0.30)),
        (Pt ($s * 0.62) ($s * 0.30)),
        (Pt ($s * 0.50) ($s * 0.65)),
        (Pt ($s * 0.60) ($s * 0.72))
    )
    $g.FillPolygon($vBrushRight, $vRight)
    $g.DrawPolygon($vPen, $vRight)

    # Vertex Cap
    [System.Drawing.PointF[]]$vCap = @(
        (Pt ($s * 0.40) ($s * 0.72)),
        (Pt ($s * 0.50) ($s * 0.65)),
        (Pt ($s * 0.60) ($s * 0.72)),
        (Pt ($s * 0.50) ($s * 0.82))
    )
    $g.FillPolygon($vBrushLeft, $vCap)
    $g.DrawPolygon($vPen, $vCap)

    # 6. Radiant Glowing Core Jewel (Center Glass Focus)
    $jewelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $jewelAura = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 56, 189, 248))
    $g.FillEllipse($jewelAura, [float]($s * 0.42), [float]($s * 0.40), [float]($s * 0.16), [float]($s * 0.16))
    $g.FillEllipse($jewelBrush, [float]($s * 0.46), [float]($s * 0.44), [float]($s * 0.08), [float]($s * 0.08))

    # 7. Apple Glass Specular Top Highlight Curved Arc
    $topPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $topPath.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $topPath.AddArc($s - $d, 0.0, $d, $d, 270.0, 90.0)
    $topPath.AddLine($s, ($s * 0.30), 0.0, ($s * 0.45))
    $topPath.CloseFigure()
    
    $specBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (Pt 0.0 0.0),
        (Pt 0.0 ($s * 0.45)),
        [System.Drawing.Color]::FromArgb(75, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(0, 255, 255, 255)
    )
    $g.FillPath($specBrush, $topPath)

    $g.Dispose()
    return $bmp
}

$icon512 = Draw-AppleGlassVdoIcon -sz 512
$icon192 = Draw-AppleGlassVdoIcon -sz 192
$icon144 = Draw-AppleGlassVdoIcon -sz 144
$icon96  = Draw-AppleGlassVdoIcon -sz 96
$icon72  = Draw-AppleGlassVdoIcon -sz 72
$icon48  = Draw-AppleGlassVdoIcon -sz 48

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

Write-Output "✅ ALL APPLE GLASSMORPHIC PNG ICONS (512, 192, mipmaps) GENERATED CLEANLY!"
