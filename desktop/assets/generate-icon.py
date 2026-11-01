"""Rasterize Momentum's existing geometric favicon for the Windows app icon."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent
scale = 32
image = Image.new('RGBA', (32 * scale, 32 * scale), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, 32 * scale - 1, 32 * scale - 1), radius=9 * scale, fill='#c0ee82')
for points in [[(7, 23), (7, 10), (16, 20), (25, 10), (25, 23)], [(7, 10), (16, 6), (25, 10)]]:
    draw.line([(int(x * scale), int(y * scale)) for x, y in points], fill='#101b10', width=int(2.5 * scale), joint='curve')
image = image.resize((256, 256), Image.Resampling.LANCZOS)
image.save(root / 'momentum.ico', format='ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
