#!/usr/bin/env python3
"""Generate Fresh2GO Store PWA icons — business storefront, brand green/orange."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

GREEN = (22, 163, 74, 255)
GREEN_DARK = (21, 128, 61, 255)
GREEN_MID = (34, 197, 94, 255)
ORANGE = (242, 153, 18, 255)
WHITE = (255, 255, 255, 255)
WINDOW = (187, 247, 208, 255)

def make_hires(size: int) -> Image.Image:
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=GREEN)

    overlay = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(S // 2):
        alpha = int(28 * (1 - i / (S / 2)))
        od.line([(0, i), (S, i)], fill=(255, 255, 255, alpha))
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)

    cx, cy = S / 2, S / 2 + S * 0.03
    unit = S * 0.55

    bw, bh = unit * 0.78, unit * 0.50
    bx0, by0 = cx - bw / 2, cy - bh * 0.22
    bx1, by1 = cx + bw / 2, by0 + bh
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=S * 0.028, fill=WHITE)
    d.rectangle([bx0, by0, bx1, by0 + bh * 0.08], fill=(248, 250, 252, 255))

    aw_h = unit * 0.13
    aw_y0 = by0 - aw_h * 0.65
    aw_y1 = by0 + aw_h * 0.28
    margin = unit * 0.05
    d.rounded_rectangle([bx0 - margin, aw_y0, bx1 + margin, aw_y1], radius=S * 0.018, fill=ORANGE)
    n = 6
    span = bw + 2 * margin
    for i in range(n):
        sx0 = bx0 - margin + span * i / n
        sx1 = bx0 - margin + span * (i + 1) / n
        d.ellipse([sx0 + 2, aw_y1 - unit * 0.02, sx1 - 2, aw_y1 + unit * 0.09], fill=ORANGE)

    dw, dh = bw * 0.20, bh * 0.50
    dx0 = cx - dw / 2
    dy1 = by1 - bh * 0.05
    dy0 = dy1 - dh
    d.rounded_rectangle([dx0, dy0, dx0 + dw, dy1], radius=S * 0.012, fill=GREEN_DARK)
    hr = unit * 0.018
    d.ellipse(
        [dx0 + dw * 0.68, (dy0 + dy1) / 2 - hr, dx0 + dw * 0.68 + hr * 2, (dy0 + dy1) / 2 + hr],
        fill=ORANGE,
    )

    ww, wh = bw * 0.17, bh * 0.26
    wy0 = by0 + bh * 0.24
    for wx0 in (bx0 + bw * 0.10, bx1 - bw * 0.10 - ww):
        d.rounded_rectangle([wx0, wy0, wx0 + ww, wy0 + wh], radius=S * 0.01, fill=WINDOW)
        mid_x = wx0 + ww / 2
        mid_y = wy0 + wh / 2
        d.line([mid_x, wy0 + 2, mid_x, wy0 + wh - 2], fill=GREEN_MID, width=max(2, S // 120))
        d.line([wx0 + 2, mid_y, wx0 + ww - 2, mid_y], fill=GREEN_MID, width=max(2, S // 120))

    badge_r = unit * 0.13
    bx = bx1 - unit * 0.02
    by = by0 + unit * 0.02
    d.ellipse([bx - badge_r, by - badge_r, bx + badge_r, by + badge_r], fill=ORANGE)
    d.ellipse([bx - badge_r * 0.72, by - badge_r * 0.72, bx + badge_r * 0.72, by + badge_r * 0.72], fill=WHITE)
    d.line(
        [
            bx - badge_r * 0.32,
            by,
            bx - badge_r * 0.08,
            by + badge_r * 0.28,
            bx + badge_r * 0.38,
            by - badge_r * 0.28,
        ],
        fill=ORANGE,
        width=max(4, S // 70),
    )

    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([bx0 + bw * 0.1, by1 - unit * 0.02, bx1 - bw * 0.1, by1 + unit * 0.08], fill=(0, 0, 0, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=S * 0.02))
    img = Image.alpha_composite(img, shadow)
    return img.resize((size, size), Image.Resampling.LANCZOS)

def main():
    out = Path("public/icons")
    out.mkdir(parents=True, exist_ok=True)
    for size, name in [(512, "store-512.png"), (192, "store-192.png"), (180, "store-180.png")]:
        im = make_hires(size)
        path = out / name
        im.save(path, "PNG", optimize=True)
        print("wrote", path, path.stat().st_size)
    print("STORE_ICONS_OK")

if __name__ == "__main__":
    main()
