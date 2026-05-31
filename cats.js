// ===== Cats — PNG illustrations =====
// Three poses per colour: walk, sit, stretch.
// The build functions return <img> HTML strings; app.js sets cat.innerHTML.

const CAT_PALETTES = [
  { name: 'orange tabby', file: 'orange_tabby' },
  { name: 'gray tabby',   file: 'gray_tabby'   },
  { name: 'black',        file: 'black'         },
  { name: 'white',        file: 'white'         },
  { name: 'cream',        file: 'cream'         },
  { name: 'brown',        file: 'brown'         },
  { name: 'calico',       file: 'calico'        },
  { name: 'tuxedo',       file: 'tuxedo'        },
];

function _catImg(file, pose) {
  return `<img src="assets/cats/${file}_${pose}.png" class="cat-svg" draggable="false" alt="">`;
}

function buildCatWalking(p)   { return _catImg(p.file, 'walk');    }
function buildCatSitting(p)   { return _catImg(p.file, 'sit');     }
function buildCatStretching(p){ return _catImg(p.file, 'stretch'); }

window.SPROUT_CATS = {
  palettes: CAT_PALETTES,
  buildWalking:   buildCatWalking,
  buildSitting:   buildCatSitting,
  buildStretching: buildCatStretching,
};
