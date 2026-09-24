// shared/chibi-figure-source.js
// Programmatic low-poly cartoon chibi character generator for Three.js.
// Exports buildChibiFigure(side, variant) returning { group, leftArm, rightArm, defaultActionName, mixer, actions }.

import * as THREE from 'three';

/**
 * Build a chibi character.
 * @param {string} side - 'ally' or 'enemy'.
 * @param {string} variant - Identifier for enemy variants (E01-E05, EL01, B01) or ally variants.
 * @returns {{group: THREE.Group, leftArm: THREE.Group, rightArm: THREE.Group, defaultActionName: string|null, mixer: THREE.AnimationMixer|null, actions: Object}}
 */
export function buildChibiFigure(side, variant = 'default') {
  variant = String(variant).replace(/^A[23]_/, '');
  if (side === 'enemy' && Object.prototype.hasOwnProperty.call(ENEMY_LOOKS, variant)) {
    return buildEnemyLook(variant);
  }
  if (side === 'npc') {
    // Friendly shop NPCs; unknown NPC variants fall back to the transfer agent.
    const look = Object.prototype.hasOwnProperty.call(NPC_LOOKS, variant) ? variant : 'agent';
    return buildLook(NPC_LOOKS[look], `Chibi_npc_${look}`);
  }
  const group = new THREE.Group();
  group.name = `Chibi_${side}_${variant}`;

  const materials = createMaterials(side, variant);
  const body = createBody(materials, side, variant);
  group.add(body.group);

  const weapon = createWeapon(side);
  weapon.position.set(0, -0.28, 0.12);
  body.rightArm.add(weapon);

  // Adjust total height to about 1.7 units
  // We'll scale the whole group if needed after construction
  const bbox = new THREE.Box3().setFromObject(group);
  const size = bbox.getSize(new THREE.Vector3());
  const targetHeight = 1.7;
  const currentHeight = size.y;
  if (currentHeight > 0) {
    const scale = targetHeight / currentHeight;
    group.scale.setScalar(scale);
  }
  group.traverse(obj => { if (obj.isMesh) obj.userData.stageOwned = true; });

  // Create animation mixer and actions (no skeletal animations, but we provide empty structures)
  const mixer = null; // No animations, will rely on transform animations in stage
  const actions = {};
  const defaultActionName = null;

  return {
    group,
    leftArm: body.leftArm,
    rightArm: body.rightArm,
    defaultActionName,
    mixer,
    actions,
  };
}

/**
 * Create material set based on side and variant.
 * @param {string} side
 * @param {string} variant
 * @returns {Object} Map of material names to THREE.Material instances.
 */
function createMaterials(side, variant) {
  const materials = {};

  if (side === 'ally') {
    // Ally: cool cyan/deep blue with white face mask
    materials.skin = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8, flatShading: true });
    materials.mask = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, flatShading: true });
    materials.suit = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.7, flatShading: true });
    materials.accent = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.5, flatShading: true });
    materials.weapon = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, flatShading: true });
    materials.visor = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x004455, roughness: 0.2, flatShading: true });
  } else {
    // Enemy: orange/red/purple systems, variant specifics
    let mainColor, accentColor, helmetColor, visorColor;
    switch (variant) {
      case 'E01':
        mainColor = 0xd35400;
        accentColor = 0xe67e22;
        helmetColor = 0xc0392b;
        visorColor = 0xffcc00;
        break;
      case 'E02':
        mainColor = 0x8e44ad;
        accentColor = 0x9b59b6;
        helmetColor = 0x6c3483;
        visorColor = 0x00ffcc;
        break;
      case 'E03':
        mainColor = 0xc0392b;
        accentColor = 0xe74c3c;
        helmetColor = 0x922b21;
        visorColor = 0xffee00;
        break;
      case 'E04':
        mainColor = 0x7d3c98;
        accentColor = 0x8e44ad;
        helmetColor = 0x5b2c6f;
        visorColor = 0xff00ff;
        break;
      case 'E05':
        mainColor = 0xb03a2e;
        accentColor = 0xc0392b;
        helmetColor = 0x7b241c;
        visorColor = 0x00ffff;
        break;
      case 'EL01':
        mainColor = 0x9b59b6;
        accentColor = 0x8e44ad;
        helmetColor = 0x6c3483;
        visorColor = 0x00ff00;
        break;
      case 'B01':
        mainColor = 0x943126;
        accentColor = 0xa93226;
        helmetColor = 0x6e2c00;
        visorColor = 0xff3300;
        break;
      default:
        mainColor = 0xd35400;
        accentColor = 0xe67e22;
        helmetColor = 0xc0392b;
        visorColor = 0xffcc00;
    }
    materials.skin = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8, flatShading: true });
    materials.mask = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.4, flatShading: true });
    materials.suit = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.7, flatShading: true });
    materials.accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, flatShading: true });
    materials.weapon = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, flatShading: true });
    materials.visor = new THREE.MeshStandardMaterial({ color: visorColor, emissive: visorColor, roughness: 0.2, flatShading: true });
    materials.helmet = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.6, flatShading: true });
  }

  return materials;
}

/**
 * Create body parts and assemble into group.
 * @param {Object} materials
 * @returns {{group: THREE.Group}} object with group property
 */
function createBody(materials, side, variant) {
  const group = new THREE.Group();
  group.name = 'Body';

  // Head: large sphere (chibi proportion)
  const headGeo = new THREE.SphereGeometry(0.35, 12, 10);
  const head = new THREE.Mesh(headGeo, materials.skin);
  head.position.y = 1.0;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // Headgear changes the opponent silhouette while keeping the same compact body rig.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.14, 0.57), materials.helmet || materials.suit);
  cap.position.set(0, 1.31, -0.01);
  group.add(cap);
  if (side === 'enemy') {
    if (['E02','E04'].includes(variant)) {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.47, 0.43), materials.helmet);
      hood.position.set(0, 1.12, -0.18);
      group.add(hood);
    }
    if (['E03','E05','EL01','B01'].includes(variant)) {
      for (const x of [-0.52, 0.52]) {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, variant==='B01'?0.28:0.18, 0.45), materials.helmet);
        guard.position.set(x, 0.85, 0);
        group.add(guard);
      }
    }
    if (['EL01','B01'].includes(variant)) {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.18, variant==='B01'?0.24:0.16, 0.45), materials.accent);
      crest.position.set(0, 1.42, 0);
      group.add(crest);
    }
  }

  // Face mask/visor: white for ally, colored for enemy
  const maskGeo = new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const mask = new THREE.Mesh(maskGeo, materials.mask);
  mask.position.y = 1.0;
  mask.position.z = 0.12;
  mask.scale.set(0.8, 0.8, 0.6);
  mask.castShadow = true;
  mask.receiveShadow = true;
  group.add(mask);

  // Visor: small glowing rectangle or strip for eyes
  const visorGeo = new THREE.BoxGeometry(0.3, 0.08, 0.08);
  const visor = new THREE.Mesh(visorGeo, materials.visor);
  visor.position.set(0, 1.05, 0.28);
  visor.castShadow = true;
  group.add(visor);

  // Torso: wide box (chibi short torso)
  const torsoGeo = new THREE.BoxGeometry(0.7, 0.55, 0.45);
  const torso = new THREE.Mesh(torsoGeo, materials.suit);
  torso.position.y = 0.55;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // Accent stripe on torso
  const stripeGeo = new THREE.BoxGeometry(0.1, 0.3, 0.46);
  const stripe = new THREE.Mesh(stripeGeo, materials.accent);
  stripe.position.set(0, 0.55, 0);
  stripe.castShadow = true;
  group.add(stripe);

  // Shoulder pads
  const shoulderGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const leftShoulder = new THREE.Mesh(shoulderGeo, materials.accent);
  leftShoulder.position.set(-0.45, 0.85, 0);
  leftShoulder.scale.set(1, 0.6, 1);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeo, materials.accent);
  rightShoulder.position.set(0.45, 0.85, 0);
  rightShoulder.scale.set(1, 0.6, 1);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // Arms: separate groups for animation
  const leftArm = new THREE.Group();
  leftArm.name = 'LeftArm';
  leftArm.position.set(-0.35, 0.65, 0);
  const leftArmMesh = createArmMesh(materials, true);
  leftArm.add(leftArmMesh);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.name = 'RightArm';
  rightArm.position.set(0.35, 0.65, 0);
  const rightArmMesh = createArmMesh(materials, false);
  rightArm.add(rightArmMesh);
  group.add(rightArm);

  // Legs: separate meshes (short)
  const legGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
  const leftLeg = new THREE.Mesh(legGeo, materials.suit);
  leftLeg.position.set(-0.18, 0.15, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, materials.suit);
  rightLeg.position.set(0.18, 0.15, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Feet: slightly larger boxes
  const footGeo = new THREE.BoxGeometry(0.25, 0.1, 0.28);
  const leftFoot = new THREE.Mesh(footGeo, materials.suit);
  leftFoot.position.set(-0.18, 0.0, 0.03);
  leftFoot.castShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeo, materials.suit);
  rightFoot.position.set(0.18, 0.0, 0.03);
  rightFoot.castShadow = true;
  group.add(rightFoot);

  return { group, leftArm, rightArm };
}

/**
 * Create an arm mesh within its own group.
 * @param {Object} materials
 * @param {boolean} isLeft
 * @returns {THREE.Group}
 */
function createArmMesh(materials, isLeft) {
  const armGroup = new THREE.Group();
  const upperArmGeo = new THREE.BoxGeometry(0.16, 0.3, 0.16);
  const upperArm = new THREE.Mesh(upperArmGeo, materials.suit);
  upperArm.position.y = -0.08;
  upperArm.castShadow = true;
  armGroup.add(upperArm);

  const handGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const hand = new THREE.Mesh(handGeo, materials.skin);
  hand.position.y = -0.28;
  hand.castShadow = true;
  armGroup.add(hand);

  return armGroup;
}

/**
 * Create a small weapon (pistol or SMG) appropriate for chibi character.
 * @param {string} side
 * @returns {THREE.Group} weapon group
 */
function createWeapon(side) {
  const weaponGroup = new THREE.Group();
  weaponGroup.name = 'Weapon';

  const materials = {
    body: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, flatShading: true }),
    accent: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, flatShading: true }),
  };

  // Pistol body
  const bodyGeo = new THREE.BoxGeometry(0.12, 0.08, 0.25);
  const body = new THREE.Mesh(bodyGeo, materials.body);
  body.position.z = 0.1;
  body.castShadow = true;
  weaponGroup.add(body);

  // Barrel
  const barrelGeo = new THREE.BoxGeometry(0.05, 0.05, 0.15);
  const barrel = new THREE.Mesh(barrelGeo, materials.body);
  barrel.position.set(0, 0.02, 0.25);
  barrel.castShadow = true;
  weaponGroup.add(barrel);

  // Grip
  const gripGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
  const grip = new THREE.Mesh(gripGeo, materials.accent);
  grip.position.set(0, -0.09, 0.1);
  grip.castShadow = true;
  weaponGroup.add(grip);

  // Magazine (for SMG-like appearance if enemy? small)
  if (side === 'enemy') {
    const magGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
    const mag = new THREE.Mesh(magGeo, materials.accent);
    mag.position.set(0, -0.03, 0.2);
    mag.castShadow = true;
    weaponGroup.add(mag);
  }

  return weaponGroup;
}

// -----------------------------------------------------------------------------
// Enemy archetype looks
// -----------------------------------------------------------------------------
// The UI passes one of these look keys as `variant` for enemies. Each look keeps
// the flat-shaded chibi rig (legs, torso, big head, two animated arm groups) but
// swaps headgear, build, stance, props and palette so archetypes read by
// silhouette alone. Unknown variants keep using the legacy builder above.

const flatMat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...extra });
const glowMat = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, flatShading: true });
const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylGeo = (rt, rb, h, seg = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Excludes a prop (halo, antenna, blade tip...) from the height normalization. */
function flair(obj) {
  obj.userData.skipMeasure = true;
  return obj;
}

const ENEMY_LOOKS = {
  rookie: {
    palette: { suit: 0xd35400, accent: 0xf39c12, helmet: 0xa04000, visor: 0xffcc00 },
    body: {},
    build: buildRookie,
  },
  sniper: {
    palette: { suit: 0x6c3483, accent: 0xa569bd, helmet: 0x4a235a, visor: 0xff7bff, glow: 0xff4fd8 },
    body: { torsoW: 0.54, torsoD: 0.36, torsoH: 0.56, legH: 0.38, legW: 0.17, armW: 0.13, headR: 0.33 },
    build: buildSniper,
  },
  rusher: {
    palette: { suit: 0xc0392b, accent: 0xff6b3d, helmet: 0x7b1a12, visor: 0xffe14d, glow: 0xff3b1f },
    body: { torsoW: 0.62, torsoH: 0.5, lean: 0.3, stride: 0.14 },
    build: buildRusher,
  },
  sentinel: {
    palette: { suit: 0x8a5a1c, accent: 0xc98b2b, helmet: 0x5e3d14, visor: 0xffb347, trim: 0xd9a441 },
    body: { torsoW: 0.96, torsoH: 0.6, torsoD: 0.56, legW: 0.27, legH: 0.28, armW: 0.22, headR: 0.32 },
    build: buildSentinel,
  },
  controller: {
    palette: { suit: 0x7a2e5c, accent: 0x2ec4b6, helmet: 0x4a1d3d, visor: 0x4dfff0, glow: 0x3ef0e0 },
    body: { torsoW: 0.66 },
    build: buildController,
  },
  recon: {
    palette: { suit: 0xc98a12, accent: 0xf2c14e, helmet: 0x7a5410, visor: 0xfff07a, trim: 0xe0761b, glow: 0xffe066 },
    body: { torsoW: 0.62, legH: 0.33 },
    build: buildRecon,
  },
  ace: {
    palette: { suit: 0xa01526, accent: 0xd4a73a, helmet: 0x5c0a14, visor: 0xffd35a, trim: 0xd4a73a, glow: 0xffc940 },
    body: { torsoW: 0.64, torsoH: 0.6, legH: 0.44, legW: 0.18, headR: 0.33 },
    heightMul: 1.06,
    build: buildAce,
  },
  igl: {
    palette: { suit: 0x6d1a2a, accent: 0xc9a24a, helmet: 0x3d0f19, visor: 0xffd27a, trim: 0xc9a24a, glow: 0xffb13d },
    body: { torsoW: 0.7, torsoH: 0.57 },
    build: buildIgl,
  },
  boss1: {
    palette: { suit: 0x7a1010, accent: 0xd4af37, helmet: 0x3a0808, visor: 0xff4a1a, trim: 0xd4af37, glow: 0xff5a1f },
    body: { torsoW: 0.96, torsoH: 0.64, torsoD: 0.56, legW: 0.27, legH: 0.32, armW: 0.22, headR: 0.33 },
    heightMul: 1.12,
    build: buildBoss1,
  },
  boss2: {
    palette: { suit: 0x4b1a6b, accent: 0xe0b43c, helmet: 0x2a0e3d, visor: 0xff5ad1, trim: 0xe0b43c, glow: 0xff7a2a },
    body: { torsoW: 1.0, torsoH: 0.62, torsoD: 0.58, legW: 0.28, legH: 0.3, armW: 0.23, headR: 0.32 },
    heightMul: 1.12,
    build: buildBoss2,
  },
  boss3: {
    palette: { suit: 0x1a161c, accent: 0xd4a73a, helmet: 0x0b0a0d, visor: 0xff6a1a, trim: 0xd4a73a, glow: 0xff6a1a },
    body: { torsoW: 0.68, torsoH: 0.62, legH: 0.42, legW: 0.19, headR: 0.33 },
    heightMul: 1.03,
    build: buildBoss3,
  },
  // Boss-pool variants (2026-09-24): existing archetype rigs in boss scale and
  // palettes, so each of the nine act bosses reads differently at a glance.
  bossWarden: {
    palette: { suit: 0x1f3a5f, accent: 0x9fd3ff, helmet: 0x0f1f33, visor: 0x6fe3ff, trim: 0xd4af37, glow: 0x6fe3ff },
    body: { torsoW: 1.0, torsoH: 0.62, torsoD: 0.6, legW: 0.28, legH: 0.3, armW: 0.23, headR: 0.32 },
    heightMul: 1.14,
    build: buildSentinel,
  },
  bossHunter: {
    palette: { suit: 0x2b2b2b, accent: 0xd4af37, helmet: 0x111111, visor: 0xff3355, glow: 0xff3355 },
    body: { torsoW: 0.6, torsoD: 0.38, torsoH: 0.6, legH: 0.42, legW: 0.19, armW: 0.14, headR: 0.34 },
    heightMul: 1.12,
    build: buildSniper,
  },
  bossBlitz: {
    palette: { suit: 0xe0561b, accent: 0x1b1b1b, helmet: 0x3a1206, visor: 0xfff04d, glow: 0xffd000 },
    body: { torsoW: 0.72, torsoH: 0.56, lean: 0.3, stride: 0.16 },
    heightMul: 1.12,
    build: buildRusher,
  },
  bossToxin: {
    palette: { suit: 0x1f4d2b, accent: 0x9cff57, helmet: 0x0d2614, visor: 0xb6ff3b, glow: 0x9cff57 },
    body: { torsoW: 0.74, torsoH: 0.6 },
    heightMul: 1.12,
    build: buildController,
  },
  bossOracle: {
    palette: { suit: 0x10304a, accent: 0xf2f2f2, helmet: 0x08182a, visor: 0x7affc8, trim: 0x7affc8, glow: 0x7affc8 },
    body: { torsoW: 0.68, legH: 0.36 },
    heightMul: 1.12,
    build: buildRecon,
  },
  bossMarshal: {
    palette: { suit: 0x2d2d3a, accent: 0xe8e8f0, helmet: 0x15151d, visor: 0xff2d2d, trim: 0xe8e8f0, glow: 0xff2d2d },
    body: { torsoW: 0.76, torsoH: 0.62 },
    heightMul: 1.14,
    build: buildIgl,
  },
};

function buildEnemyLook(look) {
  return buildLook(ENEMY_LOOKS[look], `Chibi_enemy_${look}`);
}

function buildLook(cfg, name) {
  const p = cfg.palette;
  const mat = {
    skin: flatMat(p.skin ?? 0x2a2630, { roughness: 0.8 }),
    suit: flatMat(p.suit, { roughness: 0.7 }),
    accent: flatMat(p.accent, { roughness: 0.5 }),
    helmet: flatMat(p.helmet),
    dark: flatMat(0x26232a, { roughness: 0.5 }),
    metal: flatMat(0x3c3b42, { roughness: 0.35, metalness: 0.3 }),
    trim: flatMat(p.trim ?? p.accent, { roughness: 0.35, metalness: 0.4 }),
    visor: glowMat(p.visor, 0.9),
    glow: glowMat(p.glow ?? p.visor, 1.2),
  };
  const rig = createLookRig(mat, cfg.body);
  rig.group.name = name;
  cfg.build(rig, mat);

  // Normalize height (ignoring flagged props so tall weapons do not shrink the body).
  const group = rig.group;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  group.traverse(obj => {
    if (!obj.isMesh) return;
    for (let o = obj; o; o = o.parent) if (o.userData.skipMeasure) return;
    box.expandByObject(obj);
  });
  const height = box.getSize(new THREE.Vector3()).y;
  if (height > 0) group.scale.setScalar((1.7 * (cfg.heightMul || 1)) / height);
  group.traverse(obj => { if (obj.isMesh) obj.userData.stageOwned = true; });

  return { group, leftArm: rig.leftArm, rightArm: rig.rightArm, defaultActionName: null, mixer: null, actions: {} };
}

/**
 * Parameterized chibi rig. Character faces +z; its right arm is at +x.
 * The upper body lives in `upper` (pivot at the hips) so a look can lean forward.
 */
function createLookRig(mat, opts) {
  const d = { torsoW: 0.7, torsoH: 0.55, torsoD: 0.45, headR: 0.35, legH: 0.3, legW: 0.2, armW: 0.16, armLen: 0.3, lean: 0, stride: 0, ...opts };
  const group = new THREE.Group();
  const legX = Math.max(0.15, d.torsoW * 0.26);
  for (const sx of [-1, 1]) {
    const z = sx * d.stride;
    addMesh(group, boxGeo(d.legW, d.legH, d.legW), mat.suit, sx * legX, d.legH / 2 + 0.05, z);
    addMesh(group, boxGeo(d.legW + 0.05, 0.1, d.legW + 0.1), mat.dark, sx * legX, 0.05, z + 0.03);
  }
  const upper = new THREE.Group();
  upper.position.y = d.legH + 0.05;
  upper.rotation.x = d.lean;
  group.add(upper);
  const torso = addMesh(upper, boxGeo(d.torsoW, d.torsoH, d.torsoD), mat.suit, 0, d.torsoH / 2, 0);
  addMesh(upper, boxGeo(d.torsoW + 0.02, 0.08, d.torsoD + 0.02), mat.dark, 0, 0.05, 0); // belt

  const head = new THREE.Group();
  head.position.y = d.torsoH + d.headR * 0.55;
  upper.add(head);
  addMesh(head, new THREE.SphereGeometry(d.headR, 12, 9), mat.skin);

  const shoulderY = d.torsoH - 0.14;
  const handY = 0.07 - d.armLen - 0.05;
  const makeArm = (sx) => {
    const arm = new THREE.Group();
    arm.name = sx < 0 ? 'LeftArm' : 'RightArm';
    arm.position.set(sx * (d.torsoW / 2 + d.armW * 0.35), shoulderY, 0);
    addMesh(arm, boxGeo(d.armW, d.armLen, d.armW), mat.suit, 0, 0.07 - d.armLen / 2, 0);
    addMesh(arm, new THREE.SphereGeometry(d.armW * 0.58, 6, 5), mat.skin, 0, handY, 0);
    upper.add(arm);
    return arm;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  return { group, upper, torso, head, leftArm, rightArm, d, handY, shoulderY };
}

/** Standard visor strip across the face. */
function addVisor(rig, mat, w = 0.34, h = 0.09, y = 0.04) {
  const r = rig.d.headR;
  return addMesh(rig.head, boxGeo(w, h, 0.1), mat.visor, 0, y, r * 0.88);
}

/**
 * Attach a prop to an arm so that, in the figure's upper-body frame, it sits at
 * hand + offset with the given orientation, regardless of the arm's rest pose.
 */
function mountAtHand(rig, arm, obj, offset = [0, 0, 0], euler = [0, 0, 0]) {
  const inv = arm.quaternion.clone().invert();
  const off = new THREE.Vector3(...offset).applyQuaternion(inv);
  obj.position.set(off.x, rig.handY + off.y, off.z);
  obj.quaternion.copy(inv).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler)));
  arm.add(obj);
  return obj;
}

function poseArm(arm, x, z = 0) {
  arm.rotation.set(x, 0, z);
}

// --- weapons (built pointing +z, grip at the origin) ---------------------------

function makeRifle(mat, length = 0.72, stripe = null) {
  const g = new THREE.Group();
  addMesh(g, boxGeo(0.1, 0.12, length * 0.55), mat.dark, 0, 0.03, length * 0.12);
  addMesh(g, boxGeo(0.05, 0.05, length * 0.4), mat.metal, 0, 0.05, length * 0.55);
  addMesh(g, boxGeo(0.08, 0.1, length * 0.25), mat.dark, 0, 0.0, -length * 0.25);
  addMesh(g, boxGeo(0.07, 0.14, 0.08), mat.metal, 0, -0.08, length * 0.2);
  addMesh(g, boxGeo(0.07, 0.1, 0.06), mat.dark, 0, -0.06, 0);
  if (stripe) addMesh(g, boxGeo(0.105, 0.03, length * 0.5), stripe, 0, 0.09, length * 0.12);
  return g;
}

function makeSmg(mat) {
  const g = new THREE.Group();
  addMesh(g, boxGeo(0.1, 0.12, 0.34), mat.dark, 0, 0.03, 0.1);
  addMesh(g, boxGeo(0.05, 0.05, 0.14), mat.metal, 0, 0.05, 0.32);
  addMesh(g, boxGeo(0.06, 0.2, 0.07), mat.metal, 0, -0.1, 0.16);
  addMesh(g, boxGeo(0.07, 0.1, 0.06), mat.dark, 0, -0.06, 0);
  addMesh(g, boxGeo(0.105, 0.03, 0.2), mat.accent, 0, 0.1, 0.1);
  return g;
}

function makePistol(mat) {
  const g = new THREE.Group();
  addMesh(g, boxGeo(0.09, 0.09, 0.26), mat.dark, 0, 0.03, 0.08);
  addMesh(g, boxGeo(0.07, 0.13, 0.07), mat.metal, 0, -0.06, 0);
  return g;
}

// --- looks -----------------------------------------------------------------------

function buildRookie(rig, mat) {
  const r = rig.d.headR;
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.08, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mat.helmet, 0, 0.04, -0.02);
  addMesh(rig.head, boxGeo(r * 2.1, 0.06, r * 2.2), mat.helmet, 0, 0.05, 0.02);
  addVisor(rig, mat);
  for (const sx of [-1, 1]) addMesh(rig.upper, new THREE.SphereGeometry(0.13, 8, 6), mat.accent, sx * 0.42, rig.d.torsoH - 0.05, 0).scale.set(1, 0.6, 1);
  addMesh(rig.upper, boxGeo(0.1, rig.d.torsoH * 0.6, rig.d.torsoD + 0.01), mat.accent, 0, rig.d.torsoH * 0.5, 0);
  poseArm(rig.rightArm, -0.55, 0.1);
  poseArm(rig.leftArm, -0.75, 0.45);
  mountAtHand(rig, rig.rightArm, makeRifle(mat, 0.75), [0, 0, 0.04]);
}

function buildSniper(rig, mat) {
  const { headR: r, torsoH } = rig.d;
  // Hood draped over the head and a tilted beret on top.
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mat.helmet, 0, 0.02, -0.06, -0.35);
  addMesh(rig.head, cylGeo(r * 0.95, r * 1.0, 0.1, 10), mat.accent, -0.08, r * 0.95, 0, 0, 0, 0.3);
  addMesh(rig.head, boxGeo(0.06, 0.06, 0.06), mat.accent, -0.1, r * 1.05, 0);
  addVisor(rig, mat, 0.2, 0.07, 0.04).position.x = 0.07; // single scope-eye
  // Short ghillie mantle over the shoulders.
  addMesh(rig.upper, cylGeo(0.22, 0.42, 0.22, 7), mat.helmet, 0, torsoH - 0.02, -0.02);
  // Long rifle held diagonally across the body, barrel up toward the left shoulder.
  poseArm(rig.rightArm, -0.45, -0.25);
  poseArm(rig.leftArm, -1.25, 0.55);
  const rifle = new THREE.Group();
  addMesh(rifle, boxGeo(0.09, 0.3, 0.12), mat.dark, 0, -0.18, 0);           // stock
  addMesh(rifle, boxGeo(0.1, 0.42, 0.12), mat.dark, 0, 0.16, 0);           // body
  addMesh(rifle, boxGeo(0.045, 0.72, 0.045), mat.metal, 0, 0.72, 0);       // long barrel
  addMesh(rifle, boxGeo(0.07, 0.08, 0.07), mat.metal, 0, 1.08, 0);         // muzzle brake
  addMesh(rifle, cylGeo(0.05, 0.05, 0.34, 8), mat.metal, 0, 0.2, 0.1);     // scope tube
  addMesh(rifle, cylGeo(0.07, 0.05, 0.06, 8), mat.metal, 0, 0.39, 0.1);
  const lens = addMesh(rifle, new THREE.SphereGeometry(0.055, 8, 6), mat.glow, 0, 0.42, 0.1);
  flair(lens);
  addMesh(rifle, boxGeo(0.02, 0.18, 0.02), mat.metal, 0.05, 0.52, 0.02, 0, 0, -0.5); // bipod leg
  addMesh(rifle, boxGeo(0.02, 0.18, 0.02), mat.metal, -0.05, 0.52, 0.02, 0, 0, 0.5);
  mountAtHand(rig, rig.rightArm, rifle, [0, 0.02, 0.2], [0.15, 0, 0.78]);
}

function buildRusher(rig, mat) {
  const { headR: r } = rig.d;
  // Bandana band with tails and a tall mohawk.
  addMesh(rig.head, cylGeo(r * 1.03, r * 1.03, 0.11, 10, true), mat.accent, 0, 0.12, 0);
  addMesh(rig.head, boxGeo(0.05, 0.28, 0.08), mat.accent, 0.08, 0.02, -r * 1.02, 0.3, 0, -0.4);
  addMesh(rig.head, boxGeo(0.05, 0.24, 0.08), mat.accent, -0.02, 0.0, -r * 1.02, 0.3, 0, 0.3);
  for (let i = 0; i < 5; i += 1) {
    const z = r * 0.7 - i * r * 0.36;
    const h = 0.34 - Math.abs(i - 1.5) * 0.05;
    addMesh(rig.head, new THREE.ConeGeometry(0.07, h, 4), mat.glow, 0, r * 0.82 + h / 2, z, -0.25 - i * 0.12);
  }
  addVisor(rig, mat, 0.34, 0.07, 0.02);
  // Akimbo SMGs, arms flared out.
  poseArm(rig.rightArm, -0.6, 1.0);
  poseArm(rig.leftArm, -0.6, -1.0);
  mountAtHand(rig, rig.rightArm, makeSmg(mat), [0, 0, 0.02], [0, 0.55, 0]);
  mountAtHand(rig, rig.leftArm, makeSmg(mat), [0, 0, 0.02], [0, -0.55, 0]);
  // Knife strapped across the chest.
  addMesh(rig.upper, boxGeo(0.06, 0.34, 0.03), mat.metal, -0.16, rig.d.torsoH * 0.55, rig.d.torsoD / 2 + 0.03, 0, 0, 0.35);
}

function buildSentinel(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD } = rig.d;
  // Full box helmet with a thin visor slit and ridge.
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.14, 8, 6), mat.helmet, 0, 0.03, 0);
  addMesh(rig.head, boxGeo(r * 1.6, r * 1.15, 0.14), mat.helmet, 0, -0.04, r * 0.98);
  addMesh(rig.head, boxGeo(r * 1.3, 0.07, 0.06), mat.visor, 0, 0.06, r * 1.06);
  addMesh(rig.head, boxGeo(0.1, 0.12, r * 2.1), mat.trim, 0, r * 1.1, 0);
  // Bulky layered shoulder pads.
  for (const sx of [-1, 1]) {
    addMesh(rig.upper, boxGeo(0.36, 0.16, torsoD + 0.08), mat.helmet, sx * (torsoW / 2 + 0.06), torsoH + 0.01, 0, 0, 0, -sx * 0.28);
    addMesh(rig.upper, boxGeo(0.3, 0.1, torsoD + 0.04), mat.trim, sx * (torsoW / 2 + 0.1), torsoH - 0.1, 0, 0, 0, -sx * 0.38);
  }
  addMesh(rig.upper, boxGeo(torsoW * 0.7, torsoH * 0.55, 0.06), mat.helmet, 0, torsoH * 0.55, torsoD / 2 + 0.02); // chest plate
  // Riot shield in the left hand covering the left side.
  poseArm(rig.leftArm, -0.5, 0.2);
  const shield = new THREE.Group();
  addMesh(shield, boxGeo(0.56, 0.84, 0.06), mat.helmet);
  addMesh(shield, boxGeo(0.4, 0.1, 0.07), mat.visor, 0, 0.26, 0.005);
  for (const [w, h, x, y] of [[0.6, 0.05, 0, 0.42], [0.6, 0.05, 0, -0.42], [0.05, 0.88, 0.29, 0], [0.05, 0.88, -0.29, 0]]) {
    addMesh(shield, boxGeo(w, h, 0.08), mat.trim, x, y, 0);
  }
  addMesh(shield, boxGeo(0.2, 0.2, 0.08), mat.trim, 0, -0.08, 0.01, 0, 0, Math.PI / 4);
  mountAtHand(rig, rig.leftArm, shield, [0.04, 0.16, 0.14], [0, -0.12, 0]);
  // Short shotgun in the right hand.
  poseArm(rig.rightArm, -0.35, 0.12);
  mountAtHand(rig, rig.rightArm, makeRifle(mat, 0.55), [0, 0, 0.04]);
}

function buildController(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD } = rig.d;
  // Beanie and gas mask with twin filters and round lenses.
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.06, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), mat.helmet, 0, 0.06, -0.02);
  addMesh(rig.head, boxGeo(r * 1.3, r * 0.8, 0.16), mat.dark, 0, -0.1, r * 0.82);
  for (const sx of [-1, 1]) {
    addMesh(rig.head, new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), mat.visor, sx * 0.12, 0.06, r * 0.9, Math.PI / 2);
    addMesh(rig.head, cylGeo(0.075, 0.09, 0.16, 8), mat.accent, sx * 0.19, -0.2, r * 0.8, 1.1, 0, -sx * 0.5);
  }
  // Backpack with three smoke canisters poking up over the shoulders.
  addMesh(rig.upper, boxGeo(torsoW * 0.8, torsoH * 0.85, 0.24), mat.helmet, 0, torsoH * 0.52, -torsoD / 2 - 0.1);
  [-0.4, 0, 0.4].forEach((x, i) => {
    const h = i === 1 ? 0.5 : 0.52;
    addMesh(rig.upper, cylGeo(0.075, 0.075, h, 8), mat.helmet, x, torsoH * 0.5 + h / 2, -torsoD / 2 - 0.16);
    addMesh(rig.upper, cylGeo(0.06, 0.06, 0.06, 8), mat.glow, x, torsoH * 0.5 + h + 0.03, -torsoD / 2 - 0.16);
  });
  // Floating orb drone beside the head.
  const drone = new THREE.Group();
  drone.position.set(-0.7, torsoH + r * 1.35, 0.15);
  addMesh(drone, new THREE.IcosahedronGeometry(0.13, 0), mat.glow);
  addMesh(drone, new THREE.TorusGeometry(0.2, 0.025, 4, 12), mat.accent, 0, 0, 0, Math.PI / 2.4);
  rig.upper.add(drone);
  // Left hand cradles a glowing smoke orb, right hand a sidearm.
  poseArm(rig.leftArm, -0.9, -0.15);
  mountAtHand(rig, rig.leftArm, new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat.glow), [0, 0.1, 0.02]);
  poseArm(rig.rightArm, -0.3, 0.12);
  mountAtHand(rig, rig.rightArm, makePistol(mat), [0, 0, 0.04]);
  // Teal accent straps.
  addMesh(rig.upper, boxGeo(0.08, torsoH, torsoD + 0.02), mat.accent, -0.18, torsoH / 2, 0);
  addMesh(rig.upper, boxGeo(0.08, torsoH, torsoD + 0.02), mat.accent, 0.18, torsoH / 2, 0);
}

function buildRecon(rig, mat) {
  const { headR: r, torsoH } = rig.d;
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.07, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mat.helmet, 0, 0.04, -0.02);
  addVisor(rig, mat, 0.36, 0.08, 0.04);
  // Tall antennae on the helmet.
  const ant = new THREE.Group();
  ant.position.set(r * 0.62, r * 0.6, -0.06);
  addMesh(ant, cylGeo(0.03, 0.04, 0.62, 5), mat.accent, 0, 0.31, 0);
  addMesh(ant, new THREE.SphereGeometry(0.07, 6, 5), mat.glow, 0, 0.64, 0);
  addMesh(ant, cylGeo(0.025, 0.03, 0.36, 5), mat.accent, 0.08, 0.18, 0.05, 0, 0, -0.25);
  ant.rotation.z = -0.18;
  rig.head.add(flair(ant));
  // Scarf wrapped at the neck with a long tail streaming sideways.
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 5, 10), mat.trim);
  scarf.position.set(0, torsoH + 0.02, 0);
  scarf.rotation.x = Math.PI / 2;
  rig.upper.add(scarf);
  addMesh(rig.upper, boxGeo(0.44, 0.14, 0.04), mat.trim, 0.42, torsoH - 0.02, -0.22, 0, 0.2, -0.25);
  addMesh(rig.upper, boxGeo(0.36, 0.12, 0.04), mat.trim, 0.76, torsoH - 0.14, -0.26, 0, 0.2, -0.45);
  addMesh(rig.upper, boxGeo(0.44, torsoH + 0.2, 0.04), mat.trim, 0, torsoH / 2 - 0.05, -rig.d.torsoD / 2 - 0.04); // short back cape
  // Recurve bow in the extended left hand, arrow nocked in the right.
  poseArm(rig.leftArm, -0.5, -0.6);
  const bow = new THREE.Group();
  addMesh(bow, new THREE.TorusGeometry(0.46, 0.045, 4, 14, Math.PI * 0.8), mat.trim, 0, 0, 0, 0, 0, Math.PI * 0.6);
  addMesh(bow, boxGeo(0.015, 0.74, 0.015), mat.glow, 0.2, 0, 0);
  addMesh(bow, boxGeo(0.08, 0.14, 0.08), mat.accent);
  mountAtHand(rig, rig.leftArm, bow, [-0.02, 0.08, 0.05], [0, 0, 0]);
  poseArm(rig.rightArm, -0.35, 0.15);
  const arrow = new THREE.Group();
  addMesh(arrow, boxGeo(0.02, 0.02, 0.5), mat.dark, 0, 0, 0.1);
  addMesh(arrow, new THREE.ConeGeometry(0.04, 0.1, 4), mat.glow, 0, 0, 0.4, Math.PI / 2);
  mountAtHand(rig, rig.rightArm, arrow, [0, 0, 0.02]);
}

function buildAce(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD, legH } = rig.d;
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.07, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.helmet, 0, 0.03, -0.03);
  addMesh(rig.head, boxGeo(r * 1.5, 0.08, 0.1), mat.visor, 0, 0.05, r * 0.9);
  addMesh(rig.head, boxGeo(0.06, 0.2, r * 1.4), mat.trim, 0, r * 0.95, -0.05, -0.3); // fin
  // High collar.
  addMesh(rig.upper, boxGeo(torsoW * 0.85, 0.2, 0.08), mat.helmet, 0, torsoH + 0.02, -torsoD / 2 + 0.02);
  // Long flared coat skirt with glowing hem and placket.
  const coatMat = flatMat(0xa01526, { roughness: 0.7, side: THREE.DoubleSide });
  addMesh(rig.group, cylGeo(torsoW * 0.55, torsoW * 0.78, legH * 0.9, 6, true), coatMat, 0, legH * 0.55, 0);
  addMesh(rig.group, cylGeo(torsoW * 0.79, torsoW * 0.79, 0.05, 6, true), mat.glow, 0, legH * 0.1 + 0.02, 0);
  addMesh(rig.upper, boxGeo(0.05, torsoH, 0.02), mat.glow, 0.06, torsoH / 2, torsoD / 2 + 0.01);
  // Half cape on the left shoulder.
  addMesh(rig.upper, boxGeo(0.36, torsoH + legH * 0.7, 0.04), mat.helmet, -0.2, torsoH * 0.5 - legH * 0.3, -torsoD / 2 - 0.04, 0.12, 0, 0.1);
  for (const sx of [-1, 1]) addMesh(rig.upper, boxGeo(0.22, 0.08, 0.32), mat.trim, sx * (torsoW / 2 + 0.04), torsoH - 0.01, 0);
  poseArm(rig.rightArm, -0.5, 0.05);
  poseArm(rig.leftArm, -0.8, 0.5);
  mountAtHand(rig, rig.rightArm, makeRifle(mat, 0.85, mat.glow), [0, 0, 0.04]);
}

function buildIgl(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD } = rig.d;
  // Peaked officer cap.
  addMesh(rig.head, cylGeo(r * 1.18, r * 0.98, 0.2, 12), mat.helmet, 0, r * 0.62, -0.02, -0.1);
  addMesh(rig.head, cylGeo(r * 1.0, r * 1.0, 0.07, 12), mat.trim, 0, r * 0.5, 0, -0.1);
  addMesh(rig.head, boxGeo(r * 1.4, 0.04, 0.2), mat.dark, 0, r * 0.45, r * 0.95, 0.25);
  addMesh(rig.head, boxGeo(0.12, 0.1, 0.04), mat.glow, 0, r * 0.7, r * 1.08, -0.1);
  addVisor(rig, mat, 0.3, 0.07, 0.04);
  // Headset: ear cup and boom mic.
  addMesh(rig.head, cylGeo(0.1, 0.1, 0.08, 8), mat.dark, r * 0.98, 0.0, 0, 0, 0, Math.PI / 2);
  addMesh(rig.head, boxGeo(0.03, 0.03, 0.32), mat.dark, r * 0.86, -0.16, r * 0.5, 0, -0.5, 0);
  addMesh(rig.head, new THREE.SphereGeometry(0.045, 6, 5), mat.glow, r * 0.62, -0.18, r * 0.9);
  // Gold epaulettes and sash.
  for (const sx of [-1, 1]) addMesh(rig.upper, boxGeo(0.26, 0.07, 0.3), mat.trim, sx * (torsoW / 2 + 0.02), torsoH + 0.01, 0);
  addMesh(rig.upper, boxGeo(0.1, torsoH * 1.15, torsoD + 0.02), mat.trim, 0, torsoH / 2, 0, 0, 0, 0.7);
  // Tablet raised in the left hand, pistol in the right.
  poseArm(rig.leftArm, -1.1, 0.35);
  const tablet = new THREE.Group();
  addMesh(tablet, boxGeo(0.4, 0.5, 0.04), mat.dark);
  addMesh(tablet, boxGeo(0.34, 0.42, 0.02), mat.glow, 0, 0, 0.022);
  mountAtHand(rig, rig.leftArm, tablet, [0.02, 0.2, 0.08], [-0.25, 0.35, 0]);
  poseArm(rig.rightArm, -0.25, 0.2);
  mountAtHand(rig, rig.rightArm, makePistol(mat), [0, 0, 0.04]);
}

function buildBoss1(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD, legH } = rig.d;
  // Full helm with a crown crest.
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.12, 10, 8), mat.helmet, 0, 0.02, -0.02);
  addMesh(rig.head, boxGeo(r * 1.4, 0.08, 0.1), mat.visor, 0, 0.02, r * 1.02);
  addMesh(rig.head, cylGeo(r * 0.95, r * 1.05, 0.12, 10), mat.trim, 0, r * 0.78, 0);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    addMesh(rig.head, new THREE.ConeGeometry(0.07, i === 0 ? 0.34 : 0.24, 4), mat.trim, Math.sin(a) * r * 0.85, r * 0.95 + (i === 0 ? 0.15 : 0.1), Math.cos(a) * r * 0.85);
  }
  // Heavy gold-rimmed pauldrons and chest plate.
  for (const sx of [-1, 1]) {
    addMesh(rig.upper, new THREE.SphereGeometry(0.24, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), mat.helmet, sx * (torsoW / 2 + 0.05), torsoH - 0.06, 0).scale.set(1.1, 0.9, 1.2);
    addMesh(rig.upper, cylGeo(0.26, 0.26, 0.05, 8, true), mat.trim, sx * (torsoW / 2 + 0.05), torsoH - 0.06, 0).scale.set(1.1, 1, 1.2);
  }
  addMesh(rig.upper, boxGeo(torsoW * 0.6, torsoH * 0.5, 0.06), mat.trim, 0, torsoH * 0.6, torsoD / 2 + 0.02);
  // Red cape to the ground.
  addMesh(rig.upper, boxGeo(torsoW * 0.95, torsoH + legH + 0.02, 0.05), mat.suit, 0, (torsoH - legH) / 2 - 0.02, -torsoD / 2 - 0.05, 0.08);
  // Two-handed greatsword raised beside the head.
  poseArm(rig.rightArm, -0.95, 0.15);
  poseArm(rig.leftArm, -1.0, 0.75);
  const sword = new THREE.Group();
  addMesh(sword, boxGeo(0.07, 0.34, 0.07), mat.dark, 0, -0.05, 0);            // grip
  addMesh(sword, new THREE.OctahedronGeometry(0.07, 0), mat.trim, 0, -0.24, 0);  // pommel
  addMesh(sword, boxGeo(0.52, 0.08, 0.1), mat.trim, 0, 0.14, 0);             // crossguard
  const blade = new THREE.Group();
  addMesh(blade, boxGeo(0.2, 0.9, 0.04), mat.metal, 0, 0.63, 0);
  addMesh(blade, new THREE.ConeGeometry(0.14, 0.2, 4), mat.metal, 0, 1.18, 0, 0, Math.PI / 4).scale.set(1, 1, 0.3);
  addMesh(blade, boxGeo(0.05, 0.8, 0.05), mat.glow, 0, 0.6, 0.01);
  sword.add(flair(blade));
  mountAtHand(rig, rig.rightArm, sword, [0, 0.02, 0.04], [0, 0, -0.35]);
}

function buildBoss2(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD } = rig.d;
  // Full helm with big curved horns.
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.12, 10, 8), mat.helmet, 0, 0.02, -0.02);
  addMesh(rig.head, boxGeo(r * 1.2, 0.08, 0.1), mat.visor, 0, 0.0, r * 1.03);
  for (const sx of [-1, 1]) {
    const horn = new THREE.Group();
    horn.position.set(sx * r * 0.9, r * 0.35, 0);
    addMesh(horn, new THREE.CylinderGeometry(0.08, 0.12, 0.3, 6), mat.trim, sx * 0.12, 0.08, 0.05, 0, 0, -sx * 0.9);
    addMesh(horn, new THREE.ConeGeometry(0.08, 0.42, 6), mat.trim, sx * 0.22, 0.38, 0.05, 0, 0, sx * 0.15);
    rig.head.add(flair(horn));
  }
  // Twin shoulder cannons.
  for (const sx of [-1, 1]) {
    const x = sx * (torsoW / 2 + 0.1);
    addMesh(rig.upper, boxGeo(0.3, 0.2, 0.36), mat.helmet, x, torsoH + 0.1, -0.05);
    addMesh(rig.upper, cylGeo(0.12, 0.13, 0.62, 8), mat.helmet, x, torsoH + 0.4, 0.02, 0.35, 0, -sx * 0.4);
    addMesh(rig.upper, cylGeo(0.14, 0.14, 0.08, 8), mat.glow, x + sx * 0.12, torsoH + 0.68, 0.12, 0.35, 0, -sx * 0.4);
  }
  addMesh(rig.upper, boxGeo(torsoW * 0.7, torsoH * 0.5, 0.06), mat.trim, 0, torsoH * 0.55, torsoD / 2 + 0.02);
  // Heavy LMG with drum magazine held low in both hands.
  poseArm(rig.rightArm, -0.45, 0.1);
  poseArm(rig.leftArm, -0.9, 0.55);
  const lmg = new THREE.Group();
  addMesh(lmg, boxGeo(0.16, 0.18, 0.6), mat.dark, 0, 0.04, 0.15);
  addMesh(lmg, boxGeo(0.08, 0.08, 0.5), mat.metal, 0, 0.07, 0.68);
  addMesh(lmg, cylGeo(0.14, 0.14, 0.1, 10), mat.trim, 0, -0.14, 0.18, 0, 0, Math.PI / 2);
  addMesh(lmg, boxGeo(0.12, 0.14, 0.24), mat.dark, 0, 0, -0.22);
  addMesh(lmg, boxGeo(0.17, 0.04, 0.3), mat.glow, 0, 0.14, 0.15);
  mountAtHand(rig, rig.rightArm, lmg, [0, 0, 0.04], [0, -0.1, 0]);
}

function buildBoss3(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD, legH } = rig.d;
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.08, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mat.helmet, 0, 0.02, -0.03);
  addMesh(rig.head, boxGeo(r * 1.1, 0.07, 0.1), mat.visor, 0, 0.04, r * 0.95);
  addMesh(rig.head, boxGeo(0.05, 0.3, 0.05), mat.trim, 0, -0.02, r * 0.99); // gold face line
  // Halo ring behind the head.
  const halo = new THREE.Mesh(new THREE.TorusGeometry(r * 1.22, 0.07, 5, 24), glowMat(0xffc940, 1.4));
  halo.position.set(0, r * 0.3, -r * 0.85);
  halo.rotation.x = 0;
  rig.head.add(flair(halo));
  // Wings of blade-feathers fanned from the upper back.
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.14, torsoH - 0.05, -torsoD / 2 - 0.08);
    const feathers = [[0.95, 0.35], [0.82, 0.8], [0.66, 1.2], [0.5, 1.6]];
    feathers.forEach(([len, ang], i) => {
      const f = new THREE.Group();
      f.rotation.z = -sx * ang;
      addMesh(f, boxGeo(0.14, len, 0.04), i % 2 ? mat.helmet : mat.dark, 0, len / 2, 0);
      addMesh(f, boxGeo(0.04, len * 0.9, 0.05), mat.glow, sx * 0.06, len * 0.5, 0.005);
      wing.add(f);
    });
    rig.upper.add(flair(wing));
  }
  // Banner cape with gold border.
  addMesh(rig.upper, boxGeo(torsoW * 0.8, torsoH + legH, 0.04), mat.dark, 0, (torsoH - legH) / 2, -torsoD / 2 - 0.04, 0.06);
  addMesh(rig.upper, boxGeo(torsoW * 0.82, 0.05, 0.05), mat.trim, 0, -legH + 0.02, -torsoD / 2 - 0.1, 0.06);
  // Gold chest sigil with ember core.
  addMesh(rig.upper, boxGeo(0.24, 0.24, 0.05), mat.trim, 0, torsoH * 0.6, torsoD / 2 + 0.02, 0, 0, Math.PI / 4);
  addMesh(rig.upper, boxGeo(0.12, 0.12, 0.06), mat.glow, 0, torsoH * 0.6, torsoD / 2 + 0.03, 0, 0, Math.PI / 4);
  for (const sx of [-1, 1]) addMesh(rig.upper, boxGeo(0.24, 0.08, 0.34), mat.trim, sx * (torsoW / 2 + 0.04), torsoH, 0, 0, 0, -sx * 0.25);
  poseArm(rig.rightArm, -0.5, 0.05);
  poseArm(rig.leftArm, -0.25, -0.25);
  mountAtHand(rig, rig.rightArm, makeRifle(mat, 0.8, mat.glow), [0, 0, 0.04]);
  mountAtHand(rig, rig.leftArm, new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat.glow), [0, -0.04, 0.02]);
}

// -----------------------------------------------------------------------------
// Friendly shop NPC looks (side === 'npc')
// -----------------------------------------------------------------------------

const NPC_LOOKS = {
  agent: {
    palette: { skin: 0xe2a87c, suit: 0x33343c, accent: 0xd4af37, helmet: 0x1c1512, visor: 0xffe08a, trim: 0xd4af37, glow: 0xffe08a },
    body: { torsoW: 0.62, torsoH: 0.58, torsoD: 0.4, legH: 0.36, legW: 0.18, armW: 0.14, headR: 0.34 },
    build: buildAgent,
  },
  quartermaster: {
    palette: { skin: 0xd9996a, suit: 0xb9a371, accent: 0xff7a1a, helmet: 0x55642b, visor: 0xffb04d, trim: 0xff7a1a, glow: 0xffb04d },
    body: { torsoW: 0.74, torsoH: 0.56, torsoD: 0.48, legH: 0.3, legW: 0.21, headR: 0.34 },
    heightMul: 0.95,
    build: buildQuartermaster,
  },
};

/** Simple friendly face: two dark eyes and a small smile. */
function addFriendlyFace(rig, mat, eyes = true) {
  const r = rig.d.headR;
  if (eyes) for (const sx of [-1, 1]) addMesh(rig.head, boxGeo(0.06, 0.08, 0.04), mat.dark, sx * 0.11, 0.03, r * 0.95);
  addMesh(rig.head, boxGeo(0.12, 0.03, 0.04), mat.dark, 0, -0.13, r * 0.92, -0.2);
}

function buildAgent(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD } = rig.d;
  // Slicked-back hair with a swept quiff.
  addMesh(rig.head, new THREE.SphereGeometry(r * 1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), mat.helmet, 0, 0.03, -0.04, -0.25);
  addMesh(rig.head, boxGeo(r * 1.5, 0.12, 0.22), mat.helmet, 0.04, r * 0.78, r * 0.45, -0.35, 0, -0.1);
  // Sunglasses with a gold glint.
  const shades = flatMat(0x0d0d10, { roughness: 0.2, metalness: 0.5 });
  for (const sx of [-1, 1]) addMesh(rig.head, boxGeo(0.2, 0.12, 0.05), shades, sx * 0.12, 0.05, r * 0.92);
  addMesh(rig.head, boxGeo(0.5, 0.03, 0.04), shades, 0, 0.1, r * 0.9);
  addMesh(rig.head, boxGeo(0.05, 0.03, 0.02), mat.glow, 0.17, 0.08, r * 0.95 + 0.02);
  addFriendlyFace(rig, mat, false);
  // White shirt front, gold tie, dark lapels and pocket square.
  const shirt = flatMat(0xf1ece2, { roughness: 0.6 });
  addMesh(rig.upper, boxGeo(0.22, torsoH * 0.62, 0.02), shirt, 0, torsoH * 0.68, torsoD / 2 + 0.005);
  addMesh(rig.upper, boxGeo(0.08, torsoH * 0.5, 0.03), mat.trim, 0, torsoH * 0.62, torsoD / 2 + 0.02);
  addMesh(rig.upper, boxGeo(0.1, 0.07, 0.035), mat.trim, 0, torsoH * 0.92, torsoD / 2 + 0.02, 0, 0, Math.PI / 4);
  for (const sx of [-1, 1]) {
    addMesh(rig.upper, boxGeo(0.09, torsoH * 0.62, 0.03), mat.dark, sx * 0.13, torsoH * 0.7, torsoD / 2 + 0.02, 0, 0, sx * 0.35);
    addMesh(rig.upper, boxGeo(0.2, 0.07, torsoD + 0.04), mat.suit, sx * (torsoW / 2 + 0.02), torsoH - 0.02, 0); // squared shoulders
  }
  addMesh(rig.upper, boxGeo(0.1, 0.06, 0.02), mat.trim, -0.2, torsoH * 0.72, torsoD / 2 + 0.02);
  // Right arm raised in greeting, waving a contract on a clipboard.
  poseArm(rig.rightArm, -0.35, 1.45);
  const board = new THREE.Group();
  addMesh(board, boxGeo(0.28, 0.36, 0.03), flatMat(0x8a5a2b));
  addMesh(board, boxGeo(0.24, 0.3, 0.02), shirt, 0, -0.01, 0.02);
  addMesh(board, boxGeo(0.12, 0.05, 0.04), mat.trim, 0, 0.17, 0.02);
  for (let i = 0; i < 3; i += 1) addMesh(board, boxGeo(0.16, 0.02, 0.01), mat.dark, -0.02, 0.06 - i * 0.07, 0.035);
  addMesh(board, boxGeo(0.08, 0.02, 0.01), mat.trim, 0.04, -0.12, 0.035);
  mountAtHand(rig, rig.rightArm, board, [0.02, 0.18, 0.06], [0, -0.1, -0.15]);
  // Left arm down, carrying a briefcase.
  poseArm(rig.leftArm, 0, -0.12);
  const bag = new THREE.Group();
  addMesh(bag, boxGeo(0.44, 0.32, 0.12), flatMat(0x1e1a18, { roughness: 0.4 }), 0, -0.24, 0);
  addMesh(bag, boxGeo(0.44, 0.03, 0.13), mat.trim, 0, -0.14, 0);
  addMesh(bag, boxGeo(0.06, 0.05, 0.14), mat.trim, 0, -0.18, 0);
  addMesh(bag, boxGeo(0.16, 0.04, 0.04), mat.dark, 0, -0.06, 0);
  for (const sx of [-1, 1]) addMesh(bag, boxGeo(0.03, 0.07, 0.04), mat.dark, sx * 0.07, -0.09, 0);
  mountAtHand(rig, rig.leftArm, bag, [0, 0.02, 0.02], [0, 0.1, 0]);
}

function buildQuartermaster(rig, mat) {
  const { headR: r, torsoW, torsoH, torsoD } = rig.d;
  // Patrol cap with a flat crown and a forward brim.
  addMesh(rig.head, cylGeo(r * 1.02, r * 1.06, 0.26, 10), mat.helmet, 0, r * 0.55, -0.02, -0.08);
  addMesh(rig.head, boxGeo(r * 1.5, 0.04, 0.24), mat.helmet, 0, r * 0.4, r * 0.95, 0.2);
  addMesh(rig.head, boxGeo(0.1, 0.07, 0.03), mat.accent, 0, r * 0.62, r * 1.04, -0.08);
  addFriendlyFace(rig, mat);
  // Moustache for a warm, veteran look.
  addMesh(rig.head, boxGeo(0.2, 0.05, 0.05), flatMat(0x4a3322), 0, -0.07, r * 0.95);
  // Headset: ear cup and boom mic.
  addMesh(rig.head, cylGeo(0.1, 0.1, 0.08, 8), mat.dark, -r * 0.98, 0.02, 0, 0, 0, Math.PI / 2);
  addMesh(rig.head, boxGeo(0.03, 0.03, 0.3), mat.dark, -r * 0.86, -0.14, r * 0.5, 0, 0.5, 0);
  addMesh(rig.head, new THREE.SphereGeometry(0.045, 6, 5), mat.accent, -r * 0.62, -0.17, r * 0.9);
  // Olive utility vest with pouches and orange safety stripes.
  addMesh(rig.upper, boxGeo(torsoW + 0.04, torsoH * 0.85, torsoD + 0.05), mat.helmet, 0, torsoH * 0.5, 0);
  addMesh(rig.upper, boxGeo(torsoW + 0.06, 0.06, torsoD + 0.07), mat.accent, 0, torsoH * 0.62, 0);
  const pouch = flatMat(0x434f22);
  for (const x of [-0.22, 0, 0.22]) addMesh(rig.upper, boxGeo(0.16, 0.16, 0.08), pouch, x, torsoH * 0.3, torsoD / 2 + 0.05);
  addMesh(rig.upper, boxGeo(0.14, 0.12, 0.06), pouch, -0.2, torsoH * 0.8, torsoD / 2 + 0.04);
  addMesh(rig.upper, boxGeo(0.12, 0.08, 0.03), mat.accent, -0.2, torsoH * 0.82, torsoD / 2 + 0.08); // name tag
  // Left hand gives a friendly raised wave.
  poseArm(rig.leftArm, -0.15, -2.1);
  // Ammo crate on the ground by the right side, right hand resting on its lid.
  poseArm(rig.rightArm, -0.25, 0.35);
  const crate = new THREE.Group();
  crate.position.set(torsoW / 2 + 0.22, 0, 0.08);
  crate.rotation.y = -0.35;
  addMesh(crate, boxGeo(0.46, 0.4, 0.34), mat.helmet, 0, 0.2, 0);
  addMesh(crate, boxGeo(0.5, 0.06, 0.38), pouch, 0, 0.42, 0);
  addMesh(crate, boxGeo(0.47, 0.07, 0.35), mat.accent, 0, 0.2, 0);
  addMesh(crate, boxGeo(0.14, 0.03, 0.06), mat.dark, 0, 0.47, 0);
  for (const sx of [-1, 1]) addMesh(crate, boxGeo(0.04, 0.4, 0.36), pouch, sx * 0.21, 0.2, 0);
  rig.group.add(crate);
}
