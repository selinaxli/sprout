"""
Crops individual plant and cat PNGs from the reference grid images.
Removes card backgrounds and saves transparent PNGs to assets/plants/ and assets/cats/.
"""
from PIL import Image, ImageDraw
import numpy as np
import os

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
PLANTS_DIR = os.path.join(ASSETS, 'plants')
CATS_DIR   = os.path.join(ASSETS, 'cats')
os.makedirs(PLANTS_DIR, exist_ok=True)
os.makedirs(CATS_DIR, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────────────

def remove_bg(img, tolerance=38):
    """Replace near-white/near-light card background with transparency."""
    img = img.convert('RGBA')
    data = np.array(img, dtype=np.float32)
    r, g, b, a = data[...,0], data[...,1], data[...,2], data[...,3]
    # Sample background colour from the four corners
    corners = [(0,0),(0,-1),(-1,0),(-1,-1)]
    bg_samples = np.array([[data[y,x,:3] for x,y in corners]]).reshape(-1,3)
    bg = bg_samples.mean(axis=0)          # e.g. [240, 245, 250]
    dist = np.sqrt(((data[..., :3] - bg)**2).sum(axis=-1))
    mask = dist < tolerance
    # Soft edge: ramp the alpha around the threshold
    alpha = np.clip((dist - tolerance * 0.6) / (tolerance * 0.4), 0, 1) * 255
    alpha[mask] = 0
    data[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(data.astype(np.uint8), 'RGBA')

def crop_and_save(src_img, box, out_path, size=160):
    """Crop a cell, strip background, resize to `size`×`size`, save PNG."""
    cell = src_img.crop(box)
    cell = remove_bg(cell, tolerance=42)
    # Auto-trim transparent padding
    bbox = cell.getbbox()
    if bbox:
        cell = cell.crop(bbox)
    cell = cell.resize((size, size), Image.LANCZOS)
    cell.save(out_path, 'PNG')
    print(f'  saved {os.path.basename(out_path)}')


def crop_plant_and_save(src_img, box, out_path, size=160):
    """Crop a plant cell, drop the text label below the pot, keep the WHOLE pot.

    The card holds: [plant + pot]  (gap)  [text label].
    After stripping the background we look at how much ink is in each row,
    find the biggest empty gap, and cut there — so the full pot stays and the
    word is removed. Then we pad to a square so the pot isn't squished.
    """
    cell = src_img.crop(box)
    cell = remove_bg(cell, tolerance=42)
    arr = np.array(cell)
    alpha = arr[..., 3].astype(np.float32)

    row_ink = alpha.sum(axis=1)
    thresh = row_ink.max() * 0.04
    content = row_ink > thresh
    rows = np.where(content)[0]
    if len(rows) == 0:
        return crop_and_save(src_img, box, out_path, size)
    top, bottom = int(rows[0]), int(rows[-1])

    # Find runs of empty rows between top and bottom (gaps).
    gaps = []  # (start, end_exclusive, length)
    r = top
    while r <= bottom:
        if not content[r]:
            s = r
            while r <= bottom and not content[r]:
                r += 1
            gaps.append((s, r, r - s))
        else:
            r += 1
    # The label sits below the biggest vertical gap. Cut at that gap.
    cut = bottom + 1
    if gaps:
        biggest = max(gaps, key=lambda g: g[2])
        if biggest[2] >= 6:           # a real gap, not a leaf seam
            cut = biggest[0]
    plant = cell.crop((0, top, cell.width, cut))

    # Trim transparent left/right padding, keep full height (pot included).
    bbox = plant.getbbox()
    if bbox:
        plant = plant.crop((bbox[0], 0, bbox[2], plant.height))

    # Pad to a square, anchoring the plant to the BOTTOM so the pot rests on
    # the bottom edge. This makes the "grow from the pot up" reveal work — the
    # clip-path reveals from the bottom, showing the pot first.
    w, h = plant.size
    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(plant, ((side - w) // 2, side - h), plant)
    sq = sq.resize((size, size), Image.LANCZOS)
    sq.save(out_path, 'PNG')
    print(f'  saved {os.path.basename(out_path)}')

# ── PLANTS  1598 × 984 ───────────────────────────────────────────────────────
# Grid: 3 rows × 7 cols (last row has 6).
# Rough layout (measured visually):
#   top header: ~80px
#   left margin: ~10px
#   right margin: ~10px
#   each cell: ~(1598-20)/7 ≈ 225 wide, (984-80-20)/3 ≈ 295 tall

plant_names = [
    'sunflower','tulip','rose','daisy','lavender','cactus','succulent',
    'fern','monstera','snake_plant','pothos','bonsai','cherry_blossom','lily',
    'poppy','clover','strawberry','lotus','bluebell','marigold',
]

PI = Image.open(os.path.join(ASSETS, 'plants-reference.png'))
PW, PH = PI.size          # 1598 × 984

# Row / column boundaries (tweak by a few pixels if needed)
p_header = 72             # pixels of title text at top
p_left   = 8
p_right  = PW - 8
p_bottom = PH - 8

cols = 7
rows = 3
cell_w = (p_right - p_left) / cols
cell_h = (p_bottom - p_header) / rows

print('\n── Plants ──')
idx = 0
for row in range(rows):
    n_cols = 6 if row == 2 else 7   # last row only has 6
    for col in range(n_cols):
        if idx >= len(plant_names): break
        x0 = int(p_left  + col * cell_w)
        y0 = int(p_header + row * cell_h)
        x1 = int(x0 + cell_w)
        y1 = int(y0 + cell_h)
        # Trim a few px inset to avoid card borders
        pad = 6
        # Keep the full card (including the label band); the gap-detector in
        # crop_plant_and_save removes the word while preserving the whole pot.
        box = (x0+pad, y0+pad, x1-pad, y1-pad)
        out = os.path.join(PLANTS_DIR, f'{plant_names[idx]}.png')
        crop_plant_and_save(PI, box, out)
        idx += 1

# ── CATS  918 × 1714 ─────────────────────────────────────────────────────────
# Grid: 8 rows × 3 cols.
# Layout:
#   header: ~110px
#   left label column: ~118px
#   each cell: (918-118)/3 ≈ 267 wide
#   each row: (1714-110)/8 ≈ 200 tall

cat_names = [
    'orange_tabby','gray_tabby','black','white',
    'cream','brown','calico','tuxedo',
]
pose_names = ['walk','sit','stretch']

CI = Image.open(os.path.join(ASSETS, 'cats-reference.png'))


def _runs(mask):
    """Return list of (start, end_exclusive) runs where mask is True."""
    runs, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            s = i
            while i < n and mask[i]:
                i += 1
            runs.append((s, i))
        else:
            i += 1
    return runs


def _finalize_cat(sub, out_path, size=160):
    """sub: a background-removed image holding ONE cat with its pose-label text
    below it. Drop ONLY the small label blob at the very bottom (a raised tail
    is also separated by a gap, so we must keep everything except a short,
    bottom-most run). Then trim, pad to a centered square, and save."""
    arr = np.array(sub)
    alpha = arr[..., 3].astype(np.float32)
    row_ink = alpha.sum(axis=1)
    if row_ink.max() == 0:
        return
    content = row_ink > row_ink.max() * 0.04
    blobs = _runs(content)          # vertical runs of content (tail, body, label…)
    top = blobs[0][0]
    bottom = blobs[-1][1]
    # If the bottom-most blob is short and clearly separated, it's the word.
    if len(blobs) >= 2:
        last_s, last_e = blobs[-1]
        prev_e = blobs[-2][1]
        main_h = bottom - top
        if (last_s - prev_e) >= 8 and (last_e - last_s) <= max(30, 0.35 * main_h):
            bottom = prev_e         # drop the label, keep tail + body
    cat = sub.crop((0, top, sub.width, bottom))
    bbox = cat.getbbox()
    if bbox:
        cat = cat.crop(bbox)
    w, h = cat.size
    side = int(max(w, h) * 1.12)              # a little breathing room
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(cat, ((side - w) // 2, (side - h) // 2), cat)
    sq = sq.resize((size, size), Image.LANCZOS)
    sq.save(out_path, 'PNG')
    print(f'  saved {os.path.basename(out_path)}')


# Generous vertical bands per colour (midpoints between rows) so raised tails
# are never clipped. x is limited to the art area (past the colour label and
# clear of the page's subtitle text at the very top).
cat_bands = [
    (115,  330),  # orange tabby  (top clears the subtitle line)
    (330,  540),  # gray tabby
    (540,  748),  # black
    (748,  958),  # white
    (958,  1162), # cream
    (1162, 1360), # brown
    (1360, 1545), # calico
    (1545, 1712), # tuxedo
]
ART_X0, ART_X1 = 150, 916   # skip the left colour-name label column

print('\n── Cats ──')
for row, (ytop, ybot) in enumerate(cat_bands):
    cat = cat_names[row]
    strip = CI.crop((ART_X0, ytop, ART_X1, ybot))
    strip = remove_bg(strip, tolerance=42)
    arr = np.array(strip)
    alpha = arr[..., 3].astype(np.float32)
    col_ink = alpha.sum(axis=0)
    content = col_ink > col_ink.max() * 0.04
    # Each cat is a wide block of columns. Keep only runs wide enough to be a
    # cat (ignores stray antialiasing/text fragments), then take the 3 widest.
    blocks = [(s, e) for (s, e) in _runs(content) if e - s >= 70]
    blocks.sort(key=lambda b: b[1] - b[0], reverse=True)
    blocks = sorted(blocks[:3])                 # leftmost → rightmost
    if len(blocks) != 3:                        # safety fallback: equal thirds
        span = ART_X1 - ART_X0
        blocks = [(int(i * span / 3), int((i + 1) * span / 3)) for i in range(3)]
    for col, pose in enumerate(pose_names):
        cx0, cx1 = blocks[col]
        sub = strip.crop((max(0, cx0 - 6), 0, min(strip.width, cx1 + 6), strip.height))
        out = os.path.join(CATS_DIR, f'{cat}_{pose}.png')
        _finalize_cat(sub, out)

print('\n✓ Done')
print(f'  Plants → {PLANTS_DIR}')
print(f'  Cats   → {CATS_DIR}')
