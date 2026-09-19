Add-Type -AssemblyName System.Drawing

$projectRoot = "c:\Users\timothy\Desktop\app files\project"

function Pt([float]$x, [float]$y) {
    return New-Object System.Drawing.PointF($x, $y)
}

function Draw-BlueprintVdoIcon {
    param([int]$sz)
    $s = [float]$sz
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Base Squircle Container (Obsidian Dark Navy)
    $radius = $s * 0.22
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2.0
    $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $path.AddArc($s - $d, 0.0, $d, $d, 270.0, 90.0)
    $path.AddArc($s - $d, $s - $d, $d, $d, 0.0, 90.0)
    $path.AddArc(0.0, $s - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()

    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, $s, $s)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 3, 7, 18),
        [System.Drawing.Color]::FromArgb(255, 5, 14, 36),
        90.0
    )
    $g.FillPath($bgBrush, $path)

    # 2. Engineering CAD Grid Lines inside icon
    $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 0, 229, 255), [float]1.0)
    $gridStep = $s / 8.0
    for ($i = 1; $i -lt 8; $i++) {
        $pos = [float]($i * $gridStep)
        $g.DrawLine($gridPen, $pos, [float]0.0, $pos, $s)
        $g.DrawLine($gridPen, [float]0.0, $pos, $s, $pos)
    }

    # 3. Outer Laser Cyan Blueprint Border & Corner Calibration Ticks
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 0, 242, 254), [float]($s * 0.025))
    $g.DrawPath($borderPen, $path)

    # 4. Blueprint Coordinate Circles
    $circlePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 0, 242, 254), [float]($s * 0.012))
    $circlePen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawEllipse($circlePen, [float]($s * 0.12), [float]($s * 0.12), [float]($s * 0.76), [float]($s * 0.76))

    # 5. Wireframe Isometric Polyhedron
    $wirePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 0, 192, 255), [float]($s * 0.015))
    [System.Drawing.PointF[]]$polyPoints = @(
        (Pt ($s * 0.50) ($s * 0.15)),
        (Pt ($s * 0.80) ($s * 0.32)),
        (Pt ($s * 0.80) ($s * 0.68)),
        (Pt ($s * 0.50) ($s * 0.85)),
        (Pt ($s * 0.20) ($s * 0.68)),
        (Pt ($s * 0.20) ($s * 0.32))
    )
    $g.DrawPolygon($wirePen, $polyPoints)

    # 6. Laser Blueprint V Facets (Left & Right Wings)
    $facetBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (Pt 0.0 0.0),
        (Pt $s $s),
        [System.Drawing.Color]::FromArgb(220, 0, 229, 255),
        [System.Drawing.Color]::FromArgb(220, 30, 64, 175)
    )
    $laserPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 242, 254), [float]($s * 0.035))

    # Left Wing
    [System.Drawing.PointF[]]$leftWing = @(
        (Pt ($s * 0.50) ($s * 0.78)),
        (Pt ($s * 0.22) ($s * 0.30)),
        (Pt ($s * 0.36) ($s * 0.24)),
        (Pt ($s * 0.50) ($s * 0.55))
    )
    $g.FillPolygon($facetBrush, $leftWing)
    $g.DrawPolygon($laserPen, $leftWing)

    # Right Wing
    [System.Drawing.PointF[]]$rightWing = @(
        (Pt ($s * 0.50) ($s * 0.78)),
        (Pt ($s * 0.78) ($s * 0.30)),
        (Pt ($s * 0.64) ($s * 0.24)),
        (Pt ($s * 0.50) ($s * 0.55))
    )
    $g.FillPolygon($facetBrush, $rightWing)
    $g.DrawPolygon($laserPen, $rightWing)

    # 7. Laser Origin Convergence Point & Nodes
    $nodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $cyanNodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 242, 254))
    
    # Origin Node (Bottom)
    $g.FillEllipse($nodeBrush, [float]($s * 0.46), [float]($s * 0.74), [float]($s * 0.08), [float]($s * 0.08))
    $g.DrawEllipse($laserPen, [float]($s * 0.45), [float]($s * 0.73), [float]($s * 0.10), [float]($s * 0.10))
    
    # Top Nodes
    $g.FillEllipse($cyanNodeBrush, [float]($s * 0.20), [float]($s * 0.28), [float]($s * 0.05), [float]($s * 0.05))
    $g.FillEllipse($cyanNodeBrush, [float]($s * 0.75), [float]($s * 0.28), [float]($s * 0.05), [float]($s * 0.05))
    $g.FillEllipse($cyanNodeBrush, [float]($s * 0.475), [float]($s * 0.18), [float]($s * 0.05), [float]($s * 0.05))

    # 8. Monospace Tech Annotation for large icons
    if ($sz -ge 128) {
        $font = New-Object System.Drawing.Font("Consolas", [float]($s * 0.08), [System.Drawing.FontStyle]::Bold)
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 0, 229, 255))
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect = New-Object System.Drawing.RectangleF([float]0.0, [float]($s * 0.85), [float]$s, [float]($s * 0.12))
        $g.DrawString("VDO::ORIGIN", $font, $textBrush, $textRect, $sf)
    }

    $g.Dispose()
    return $bmp
}

$icon512 = Draw-BlueprintVdoIcon -sz 512
$icon192 = Draw-BlueprintVdoIcon -sz 192
$icon144 = Draw-BlueprintVdoIcon -sz 144
$icon96  = Draw-BlueprintVdoIcon -sz 96
$icon72  = Draw-BlueprintVdoIcon -sz 72
$icon48  = Draw-BlueprintVdoIcon -sz 48

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

Write-Output "✅ ALL BLUEPRINT PNG ICONS (512, 192, mipmaps) GENERATED CLEANLY!"
