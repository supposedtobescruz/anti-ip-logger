import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LANG_SHOTS = ROOT / "verify-output"
ICON = ROOT / "assets/icons/icon-128.png"

PAPER = (251, 248, 241)
INK = (23, 21, 18)
FAINT = (107, 97, 82)
ACCENT = (165, 31, 31)

FONTS = {
    "sans": "C:/Windows/Fonts/arial.ttf",
    "mono": "C:/Windows/Fonts/consola.ttf",
    "mono_bold": "C:/Windows/Fonts/consolab.ttf",
}

def font(kind, size):
    path = FONTS.get(kind, FONTS["sans"])
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(FONTS["sans"], size)

def crop_top_resize(src, dest, width=1280, height=800):
    image = Image.open(src).convert("RGB")
    src_w, src_h = image.size
    target_ratio = width / height
    crop_h = int(src_w / target_ratio)
    image = image.crop((0, 0, src_w, min(crop_h, src_h)))
    image = image.resize((width, height), Image.LANCZOS)
    image.save(dest, "PNG", optimize=True)
    print("wrote", dest.relative_to(ROOT), image.size)

def popup_canvas(src, dest, width=1280, height=800):
    popup = Image.open(src).convert("RGB")
    pad = 32
    target_h = height - pad * 2
    scale = target_h / popup.height
    new_size = (int(popup.width * scale), target_h)
    popup = popup.resize(new_size, Image.LANCZOS)
    canvas = Image.new("RGB", (width, height), PAPER)
    canvas.paste(popup, ((width - popup.width) // 2, pad))
    canvas.save(dest, "PNG", optimize=True)
    print("wrote", dest.relative_to(ROOT), canvas.size)

def promo(dest, width, height, icon_px, title_size, tag_size, sub_size):
    canvas = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(canvas)
    pad = int(width * 0.05)
    icon = Image.open(ICON).convert("RGBA").resize((icon_px, icon_px), Image.LANCZOS)
    canvas.paste(icon, (pad, (height - icon_px) // 2), icon)
    text_x = pad + icon_px + int(width * 0.05)
    title_font = font("mono_bold", title_size)
    tag_font = font("sans", tag_size)
    sub_font = font("mono", sub_size)
    block_h = int(title_size * 1.6 + tag_size * 2.4 + sub_size * 2.2)
    y = (height - block_h) // 2
    draw.rectangle([text_x, y, text_x + int(width * 0.05), y + 6], fill=ACCENT)
    y += int(title_size * 0.45)
    draw.text((text_x, y), "ANTI IP LOGGER", font=title_font, fill=INK)
    y += int(title_size * 1.35)
    draw.text((text_x, y), "Blocks IP logger links before they open.", font=tag_font, fill=INK)
    y += int(tag_size * 1.5)
    draw.text((text_x, y), "Not a VPN - no telemetry - English and Turkish", font=sub_font, fill=FAINT)
    canvas.save(dest, "PNG", optimize=True)
    print("wrote", dest.relative_to(ROOT), canvas.size)

def shots(out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    crop_top_resize(LANG_SHOTS / "dashboard-light.png", out_dir / "store-1-overview.png")
    crop_top_resize(LANG_SHOTS / "dashboard-lists.png", out_dir / "store-2-lists.png")
    crop_top_resize(LANG_SHOTS / "blocked.png", out_dir / "store-3-blocked.png")
    popup_canvas(LANG_SHOTS / "popup-light.png", out_dir / "store-4-popup.png")
    crop_top_resize(LANG_SHOTS / "dashboard-dark.png", out_dir / "store-5-dark.png")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: make-store-assets.py shots <out-dir> | promo <out-dir>")
    mode = sys.argv[1]
    out = ROOT / sys.argv[2]
    if mode == "shots":
        shots(out)
    elif mode == "promo":
        out.mkdir(parents=True, exist_ok=True)
        promo(out / "promo-440x280.png", 440, 280, 110, 24, 14, 10)
        promo(out / "marquee-1400x560.png", 1400, 560, 300, 72, 34, 15)
    else:
        raise SystemExit(f"unknown mode: {mode}")
