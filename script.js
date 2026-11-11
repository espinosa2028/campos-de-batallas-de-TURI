import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess } from 'chess.js';

const container = document.querySelector('#scene-container');
const loading = document.querySelector('#loading');
const game = new Chess();

let mode = 'local';
let selected = null;
let legalMoves = [];
let cpuBusy = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9d7cf');
scene.fog = new THREE.Fog('#b9d7cf', 17, 30);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 10.5, 12.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.2, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 7;
controls.maxDistance = 22;

scene.add(new THREE.HemisphereLight(0xffffff, 0x667b50, 2));

const sun = new THREE.DirectionalLight(0xfff1d5, 2.7);
sun.position.set(-5, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x9bd9e0, 1.1);
fill.position.set(8, 5, -7);
scene.add(fill);

const boardGroup = new THREE.Group();
const piecesGroup = new THREE.Group();
const marksGroup = new THREE.Group();

scene.add(boardGroup, piecesGroup, marksGroup);

const tiles = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const material = (color, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness });

const mats = {
  grass1: material('#759d5c'),
  grass2: material('#9b8053'),
  sand1: material('#ead39d'),
  sand2: material('#d9b978'),
  sea1: material('#4b9eaa', 0.55),
  sea2: material('#347d91', 0.55),
  greenSkin: material('#9dbb70'),
  greenShell: material('#4f8750'),
  greenRim: material('#9a8050'),
  blueSkin: material('#7bc9c7'),
  blueShell: material('#218c9d'),
  blueRim: material('#48c0bb'),
  gold: material('#e8bd60', 0.35),
  white: material('#fff6d8'),
  black: material('#183b38'),
  crab: material('#d66e50'),
  star: material('#f0a04d'),
  leaf: material('#4e884b')
};

function addMesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const obj = new THREE.Mesh(geometry, mat);
  obj.position.set(x, y, z);
  obj.castShadow = true;
  obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}

function box(parent, x, y, z, sx, sy, sz, mat) {
  return addMesh(
    parent,
    new THREE.BoxGeometry(sx, sy, sz),
    mat,
    x, y, z
  );
}

function ball(parent, x, y, z, sx, sy, sz, mat) {
  const obj = addMesh(
    parent,
    new THREE.SphereGeometry(1, 20, 14),
    mat,
    x, y, z
  );

  obj.scale.set(sx, sy, sz);
  return obj;
}

function coord(c, r) {
  return {
    x: c - 3.5,
    z: 3.5 - r
  };
}

function squareName(c, r) {
  return String.fromCharCode(97 + c) + (8 - r);
}

function labelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff0ce';
  ctx.strokeStyle = '#70563b';
  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.roundRect(12, 12, 104, 104, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#304b3a';
  ctx.font = 'bold 68px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 67);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthWrite: false
    })
  );

  sprite.scale.set(0.34, 0.34, 1);
  return sprite;
}

function makeCrab(x, z) {
  ball(boardGroup, x, 0.13, z, 0.12, 0.06, 0.09, mats.crab);

  for (const side of [-1, 1]) {
    ball(
      boardGroup,
      x + side * 0.17,
      0.17,
      z - 0.04,
      0.05,
      0.045,
      0.05,
      mats.crab
    );

    for (let i = 0; i < 3; i++) {
      const leg = addMesh(
        boardGroup,
        new THREE.CylinderGeometry(0.012, 0.018, 0.11, 6),
        mats.crab,
        x + side * 0.09,
        0.08,
        z + (i - 1) * 0.055
      );

      leg.rotation.z = side * 0.8;
    }
  }
}

function makeStar(x, z) {
  ball(boardGroup, x, 0.12, z, 0.1, 0.035, 0.1, mats.star);

  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;

    const arm = addMesh(
      boardGroup,
      new THREE.ConeGeometry(0.065, 0.22, 5),
      mats.star,
      x + Math.cos(a) * 0.11,
      0.12,
      z + Math.sin(a) * 0.11
    );

    arm.rotation.x = Math.PI / 2;
    arm.rotation.z = -a;
  }
}

// TABLERO
function makeBoard() {
  box(
    boardGroup,
    0, -0.17, 0,
    8.35, 0.32, 8.35,
    material('#80694b')
  );

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {

      // DISTRIBUCIÓN DE LAS ZONAS
      const zone =
        r < 2 ? 'sea' :
        r < 6 ? 'sand' :
        'land';

      const alternate = (r + c) % 2 === 0;

      const tileMat =
        zone === 'land'
          ? (alternate ? mats.grass1 : mats.grass2)
          : zone === 'sand'
          ? (alternate ? mats.sand1 : mats.sand2)
          : (alternate ? mats.sea1 : mats.sea2);

      const tile = box(
        boardGroup,
        c - 3.5,
        0.015,
        3.5 - r,
        0.99,
        0.12,
        0.99,
        tileMat
      );

      tile.userData.square = squareName(c, r);
      tiles.set(tile.userData.square, tile);

      if (zone === 'land' && (r + c) % 3 === 0) {
        for (let k = 0; k < 3; k++) {
          const blade = addMesh(
            boardGroup,
            new THREE.ConeGeometry(0.025, 0.13, 5),
            mats.leaf,
            c - 3.55 + k * 0.05,
            0.13,
            3.48 - r
          );

          blade.rotation.z = (k - 1) * 0.2;
        }
      }

      if (zone === 'sand' && (r * 5 + c) % 9 === 0) {
        makeCrab(c - 3.25, 3.25 - r);
      }

      if (zone === 'sea' && (r + c) % 3 === 0) {
        makeStar(c - 3.75, 3.25 - r);
      }

      if (zone === 'sea' && r % 2 === 0) {
        const wave = addMesh(
          boardGroup,
          new THREE.TorusGeometry(0.18, 0.015, 5, 20),
          material('#b9eef0'),
          c - 3.5,
          0.10,
          3.5 - r
        );

        wave.rotation.x = Math.PI / 2;
        wave.scale.set(1.4, 0.7, 1);
      }
    }
  }

  // MARCO
  box(boardGroup, 0, -0.02, -4.08, 8.4, 0.15, 0.12, material('#755b3e'));
  box(boardGroup, 0, -0.02, 4.08, 8.4, 0.15, 0.12, material('#755b3e'));
  box(boardGroup, -4.08, -0.02, 0, 0.12, 0.15, 8.4, material('#755b3e'));
  box(boardGroup, 4.08, -0.02, 0, 0.12, 0.15, 8.4, material('#755b3e'));

  // LETRAS
  for (let c = 0; c < 8; c++) {
    for (const z of [-4.32, 4.32]) {
      const s = labelSprite(String.fromCharCode(65 + c));
      s.position.set(c - 3.5, 0.12, z);
      boardGroup.add(s);
    }
  }

  // NÚMEROS
  for (let r = 0; r < 8; r++) {
    for (const x of [-4.32, 4.32]) {
      const s = labelSprite(String(8 - r));
      s.position.set(x, 0.12, 3.5 - r);
      boardGroup.add(s);
    }
  }
}

// TORTUGAS
function createTurtle(piece) {
  const group = new THREE.Group();

  const land = piece.color === 'w';

  const skin = land ? mats.greenSkin : mats.blueSkin;
  const shell = land ? mats.greenShell : mats.blueShell;
  const rim = land ? mats.greenRim : mats.blueRim;

  // CUERPO
  ball(group, 0, 0.36, 0, 0.43, 0.2, 0.54, skin);

  // PATAS
  for (const [x, z] of [
    [-0.34, -0.32],
    [0.34, -0.32],
    [-0.34, 0.32],
    [0.34, 0.32]
  ]) {
    const leg = ball(
      group,
      x, 0.24, z,
      0.14, 0.12, 0.25,
      skin
    );

    leg.rotation.y = x * z * 0.8;
  }

  // CABEZA Y CUELLO
  ball(group, 0, 0.53, -0.48, 0.18, 0.16, 0.25, skin);
  ball(group, 0, 0.61, -0.67, 0.24, 0.19, 0.25, skin);

  // OJOS
  for (const x of [-0.09, 0.09]) {
    ball(group, x, 0.69, -0.86, 0.05, 0.055, 0.025, mats.white);
    ball(group, x, 0.695, -0.88, 0.022, 0.032, 0.012, mats.black);
  }

  // CAPARAZÓN
  ball(group, 0, 0.67, 0.02, 0.53, 0.34, 0.63, shell);

  const ring = addMesh(
    group,
    new THREE.TorusGeometry(0.48, 0.05, 8, 28),
    rim,
    0, 0.52, 0.02
  );

  ring.scale.set(1, 1.15, 1.25);

  ball(group, 0, 0.98, 0.02, 0.34, 0.04, 0.43, rim);

  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;

    const plate = ball(
      group,
      Math.cos(a) * 0.25,
      0.91,
      Math.sin(a) * 0.3,
      0.14, 0.025, 0.17,
      shell
    );

    plate.rotation.y = -a;
  }

  // COLORES DIFERENTES PARA CADA PIEZA
  const t = piece.type;

  const typeColors = {
    p: '#d7e5a0',
    r: '#d9a441',
    n: '#bd79d5',
    b: '#e9edf2',
    q: '#e75d91',
    k: '#f4d34f'
  };

  addMesh(
    group,
    new THREE.CylinderGeometry(0.105, 0.12, 0.055, 20),
    material(typeColors[t] || '#ffffff', 0.42),
    0, 1.015, 0.02
  );

  // TORRE
  if (t === 'r') {
    addMesh(
      group,
      new THREE.CylinderGeometry(0.2, 0.25, 0.38, 8),
      mats.gold,
      0, 1.18, 0
    );

    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;

      box(
        group,
        Math.cos(a) * 0.18,
        1.42,
        Math.sin(a) * 0.18,
        0.10, 0.12, 0.10,
        mats.gold
      );
    }
  }

  // CABALLO
  else if (t === 'n') {
    const neck = addMesh(
      group,
      new THREE.CylinderGeometry(0.12, 0.16, 0.42, 10),
      skin,
      0, 1.12, -0.18
    );

    neck.rotation.x = -0.35;

    ball(group, 0, 1.4, -0.37, 0.18, 0.22, 0.25, rim);
    ball(group, 0.1, 1.48, -0.55, 0.025, 0.03, 0.025, mats.white);
  }

  // ALFIL
  else if (t === 'b') {
    addMesh(
      group,
      new THREE.ConeGeometry(0.19, 0.52, 8),
      mats.gold,
      0, 1.34, 0
    );

    ball(group, 0, 1.63, 0, 0.08, 0.08, 0.08, rim);
  }

  // REINA
  else if (t === 'q') {
    addMesh(
      group,
      new THREE.CylinderGeometry(0.15, 0.23, 0.22, 8),
      mats.gold,
      0, 1.16, 0
    );

    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;

      ball(
        group,
        Math.cos(a) * 0.2,
        1.42,
        Math.sin(a) * 0.2,
        0.06, 0.1, 0.06,
        mats.gold
      );
    }

    ball(group, 0, 1.49, 0, 0.08, 0.08, 0.08, mats.gold);
  }

  // REY
  else if (t === 'k') {
    addMesh(
      group,
      new THREE.CylinderGeometry(0.16, 0.23, 0.22, 8),
      mats.gold,
      0, 1.16, 0
    );

    box(group, 0, 1.47, 0, 0.11, 0.38, 0.11, mats.gold);
    box(group, 0, 1.54, 0, 0.3, 0.09, 0.11, mats.gold);
  }

  // PEÓN
  else {
    ball(group, 0, 1.13, 0, 0.13, 0.13, 0.13, rim);
  }

  // BASE
  addMesh(
    group,
    new THREE.CylinderGeometry(0.34, 0.38, 0.12, 24),
    land ? material('#6d7549') : material('#347e88'),
    0, 0.13, 0
  );

  // REDUCIR TAMAÑO
  group.scale.setScalar(0.58);

  // ORIENTACIÓN: AMBOS EQUIPOS SE MIRAN
  // La cabeza está modelada hacia -Z.
  // Las verdes están abajo y giran hacia el centro.
  // Las azules están arriba y conservan su orientación.
  if (land) {
    group.rotation.y = Math.PI;
  }

  return group;
}

// DIBUJAR PIEZAS
function drawPieces() {
  piecesGroup.clear();

  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];

      if (!p) continue;

      const sq = squareName(c, r);
      const g = createTurtle(p);
      const pos = coord(c, r);

      g.position.set(pos.x, 0.08, pos.z);
      g.userData.square = sq;

      g.traverse(o => {
        if (o.isMesh) o.userData.square = sq;
      });

      piecesGroup.add(g);
    }
  }
}

// MARCAS DE MOVIMIENTOS
function clearMarks() {
  while (marksGroup.children.length) {
    marksGroup.remove(marksGroup.children[0]);
  }
}

function drawMarks() {
  clearMarks();

  if (!selected) return;

  const tile = tiles.get(selected);

  if (tile) {
    const glow = addMesh(
      marksGroup,
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({
        color: 0xffe99a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
      }),
      tile.position.x,
      0.09,
      tile.position.z
    );

    glow.rotation.x = -Math.PI / 2;
  }

  for (const m of legalMoves) {
    const p = coord(
      m.to.charCodeAt(0) - 97,
      8 - Number(m.to[1])
    );

    const ring = addMesh(
      marksGroup,
      new THREE.TorusGeometry(0.25, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffdc78 }),
      p.x,
      0.12,
      p.z
    );

    ring.rotation.x = Math.PI / 2;
  }
}

// INFORMACIÓN DE LA PARTIDA
function updatePanel() {
  const turn = game.turn() === 'w'
    ? 'terrestres (verdes)'
    : 'marinos (azules)';

  let msg = game.isCheckmate()
    ? `¡Jaque mate! Ganan ${game.turn() === 'w' ? 'los marinos' : 'los terrestres'}.`
    : game.isCheck()
    ? '¡Jaque! Protege a tu rey.'
    : game.isDraw()
    ? 'La partida terminó en tablas.'
    : `Turno: ${turn}`;

  if (cpuBusy) msg = 'La CPU está pensando…';

  document.querySelector('#status').textContent = msg;

  const hist = game.history();

  document.querySelector('#history').textContent = hist.length
    ? hist.map((m, i) =>
        `${i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : ''}${m}`
      ).join('   ')
    : 'Todavía no hay movimientos.';
}

function refresh() {
  drawPieces();
  drawMarks();
  updatePanel();
}

// SELECCIONAR Y MOVER
function chooseSquare(sq) {
  if (cpuBusy || game.isGameOver()) return;

  if (mode === 'cpu' && game.turn() === 'b') return;

  if (selected) {
    const move = legalMoves.find(m => m.to === sq);

    if (move) {
      game.move({
        from: selected,
        to: sq,
        promotion: move.promotion ? 'q' : undefined
      });

      selected = null;
      legalMoves = [];

      refresh();

      if (
        mode === 'cpu' &&
        game.turn() === 'b' &&
        !game.isGameOver()
      ) {
        setTimeout(cpuMove, 250);
      }

      return;
    }
  }

  const piece = game.get(sq);

  if (piece && piece.color === game.turn()) {
    selected = sq;
    legalMoves = game.moves({
      square: sq,
      verbose: true
    });
  } else {
    selected = null;
    legalMoves = [];
  }

  refresh();
}

// DETECTAR CLICS
function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const targets = [
    ...piecesGroup.children,
    ...tiles.values()
  ];

  const hits = raycaster.intersectObjects(targets, true);

  if (!hits.length) return;

  let obj = hits[0].object;
  let sq = null;

  while (obj && !sq) {
    sq = obj.userData.square;
    obj = obj.parent;
  }

  if (sq) chooseSquare(sq);
}

// INTELIGENCIA ARTIFICIAL
const values = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

function evaluate(position) {
  let score = 0;

  for (const row of position.board()) {
    for (const p of row) {
      if (!p) continue;

      const v = values[p.type];
      score += p.color === 'b' ? v : -v;
    }
  }

  return score;
}

function minimax(position, depth, alpha, beta, maximizing) {
  if (depth === 0 || position.isGameOver()) {
    return evaluate(position);
  }

  const moves = position.moves({ verbose: true });

  if (maximizing) {
    let best = -Infinity;

    for (const m of moves) {
      position.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion
      });

      best = Math.max(
        best,
        minimax(position, depth - 1, alpha, beta, false)
      );

      position.undo();
      alpha = Math.max(alpha, best);

      if (beta <= alpha) break;
    }

    return best;

  } else {
    let best = Infinity;

    for (const m of moves) {
      position.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion
      });

      best = Math.min(
        best,
        minimax(position, depth - 1, alpha, beta, true)
      );

      position.undo();
      beta = Math.min(beta, best);

      if (beta <= alpha) break;
    }

    return best;
  }
}

// TURNO DE LA CPU
function cpuMove() {
  if (
    mode !== 'cpu' ||
    game.turn() !== 'b' ||
    game.isGameOver()
  ) return;

  cpuBusy = true;
  updatePanel();

  setTimeout(() => {
    const depth = Number(
      document.querySelector('#difficulty').value
    );

    const moves = game.moves({ verbose: true });

    let best = -Infinity;
    let chosen = [];

    for (const m of moves) {
      game.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion
      });

      // La CPU azul maximiza su puntuación.
      // Después de su movimiento juega el equipo blanco.
      const score = minimax(
        game,
        depth - 1,
        -Infinity,
        Infinity,
        false
      );

      game.undo();

      if (score > best) {
        best = score;
        chosen = [m];
      } else if (score === best) {
        chosen.push(m);
      }
    }

    if (chosen.length) {
      const m = chosen[Math.floor(Math.random() * chosen.length)];

      game.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion
      });
    }

    cpuBusy = false;
    selected = null;
    legalMoves = [];

    refresh();
  }, 150);
}

// CAMBIAR MODO
function setMode(next) {
  mode = next;

  document.querySelectorAll('.mode').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  document.querySelector('#difficultyWrap').hidden = mode !== 'cpu';

  newGame();
}

// NUEVA PARTIDA
function newGame() {
  game.reset();

  selected = null;
  legalMoves = [];
  cpuBusy = false;

  refresh();
}

// BOTONES
document.querySelectorAll('.mode').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

document.querySelector('#newGame').addEventListener('click', newGame);

// DESHACER
document.querySelector('#undo').addEventListener('click', () => {
  if (cpuBusy || !game.history().length) return;

  game.undo();

  if (
    mode === 'cpu' &&
    game.turn() === 'b' &&
    game.history().length
  ) {
    game.undo();
  }

  selected = null;
  legalMoves = [];

  refresh();
});

// VISTA SUPERIOR
document.querySelector('#topView').addEventListener('click', () => {
  camera.position.set(0, 15, 0.01);
  controls.target.set(0, 0, 0);
  controls.update();
});

// CENTRAR CÁMARA
document.querySelector('#resetCamera').addEventListener('click', () => {
  camera.position.set(0, 10.5, 12.5);
  controls.target.set(0, 0.2, 0);
  controls.update();
});

renderer.domElement.addEventListener('pointerdown', onPointerDown);

// AJUSTAR TAMAÑO
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;

  if (!w || !h) return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

new ResizeObserver(resize).observe(container);

// ANIMACIÓN
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// INICIAR
makeBoard();
newGame();
resize();
animate();

setTimeout(() => {
  loading.classList.add('hide');
}, 500);