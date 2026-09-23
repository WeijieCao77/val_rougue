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
