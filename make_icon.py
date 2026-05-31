"""Generate Sprout's app icon: a cute flat-vector sprout on a soft mint squircle."""
from PIL import Image, ImageDraw

SS = 2                      # supersample for smooth edges
S = 1024
W = S * SS
cx = W // 2

# everything is drawn on `scene`, then clipped to the squircle at the very end
scene = Image.new("RGBA", (W, W), (0, 0, 0, 0))

# ---- soft vertical gradient background ----
top, bot = (235, 248, 240), (196, 234, 214)
grad = Image.new("RGB", (1, W))
for y in range(W):
    t = y / (W - 1)
    grad.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
scene.paste(grad.resize((W, W)), (0, 0))

draw = ImageDraw.Draw(scene)

LEAF = (108, 194, 142)
LEAF_DK = (88, 170, 118)
STEM = (74, 152, 104)
HILL = (150, 212, 174)
HILL_TOP = (171, 224, 191)

# ---- soft green hill the sprout grows from ----
draw.ellipse([cx - 560, int(W * 0.72), cx + 560, int(W * 1.18)], fill=HILL)
draw.ellipse([cx - 560, int(W * 0.70), cx + 560, int(W * 0.80)], fill=HILL_TOP)

# ---- stem (rounded) ----
base_y, top_y, sw = int(W * 0.76), int(W * 0.45), 50
draw.line([(cx, base_y), (cx, top_y)], fill=STEM, width=sw)
draw.ellipse([cx - sw // 2, base_y - sw // 2, cx + sw // 2, base_y + sw // 2], fill=STEM)
draw.ellipse([cx - sw // 2, top_y - sw // 2, cx + sw // 2, top_y + sw // 2], fill=STEM)


def leaf(center_x, center_y, lw, lh, angle, color):
    pad = max(lw, lh)
    layer = Image.new("RGBA", (lw + pad, lh + pad), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([pad // 2, pad // 2, pad // 2 + lw, pad // 2 + lh], fill=color)
    layer = layer.rotate(angle, expand=True, resample=Image.BICUBIC)
    scene.alpha_composite(layer, (center_x - layer.width // 2, center_y - layer.height // 2))


# two plump leaves spreading upward from the stem top (back leaf darker)
leaf(cx - 165, int(W * 0.40), 360, 235, -42, LEAF_DK)
leaf(cx + 165, int(W * 0.40), 360, 235, 42, LEAF)
# little highlight where the leaves meet
draw.ellipse([cx - 28, top_y - 28, cx + 28, top_y + 28], fill=(165, 220, 185))

# ---- clip the whole scene to a rounded square ----
mask = Image.new("L", (W, W), 0)
m = int(W * 0.045)
ImageDraw.Draw(mask).rounded_rectangle([m, m, W - m, W - m], radius=int(W * 0.235), fill=255)
final = Image.composite(scene, Image.new("RGBA", (W, W), (0, 0, 0, 0)), mask)

final = final.resize((S, S), Image.LANCZOS)
final.save("assets/icon.png")
print("wrote assets/icon.png", final.size)
