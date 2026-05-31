// ===== Plants — PNG illustrations =====
// Each plant grows from a tiny sprout to full size over the task duration.
// The kawaii illustrations include the pot, so no separate pot SVG needed.

const _PLANT_LIST = [
  'sunflower','tulip','rose','daisy','lavender','cactus','succulent',
  'fern','monstera','snake_plant','pothos','bonsai','cherry_blossom','lily',
  'poppy','clover','strawberry','lotus','bluebell','marigold',
];

const PLANTS = _PLANT_LIST.map(file => ({
  name: file.replace(/_/g, ' '),
  file,
  draw(p) {
    // p: 0 (just started) → 1 (complete)
    // The image is always full-size. We reveal it from the bottom up using
    // clip-path: at p=0 only the bottom 35% shows (the pot), at p=1 the
    // full plant is visible. clipTop shrinks from 65% → 0% as p goes 0 → 1.
    p = Math.max(0, Math.min(1, p));
    const clipTop = (0.65 * (1 - p) * 100).toFixed(1);
    return `<image href="assets/plants/${file}.png"
      x="0" y="0" width="48" height="48"
      clip-path="inset(${clipTop}% 0 0 0)"
      preserveAspectRatio="xMidYMid meet"/>`;
  }
}));

// pot is now part of the PNG — expose empty string so app.js concat still works
window.SPROUT_PLANTS = { pot: '', list: PLANTS };
