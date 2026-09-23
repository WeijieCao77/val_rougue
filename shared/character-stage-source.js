// shared/character-stage-source.js
// Three.js low-poly cartoon tactical squad: shared module for both demos.
// Exposes mountCharacterStage, playCharacterCue, clearCharacterStages.
// Handles WebGL fallback, reduced motion, resize, frequent re-renders, and disposal.

import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Internal state registry
// -----------------------------------------------------------------------------
const stages = new Map(); // container -> record
let fallbackActive = false;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Mount a 3D character stage into the given container.
 * @param {HTMLElement} container - DOM element to host the stage.
 * @param {Object} options
 * @param {'ally'|'enemy'} options.side - Which side the squad belongs to.
 * @param {string} options.variant - Visual variant string.
 * @param {boolean} [options.block] - If true, squad starts with armor visible.
 * @returns {() => void} Cleanup function.
 */
export function mountCharacterStage(container, { side = 'ally', variant = 'default', block = false } = {}) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('mountCharacterStage requires a valid DOM container.');
  }

  // Clean up any existing stage in this container and any stale stages
  if (stages.has(container)) {
    stages.get(container).cleanup();
  }
  // Remove any stages whose container is no longer in the document
  for (const [existingContainer, record] of stages.entries()) {
    if (!document.contains(existingContainer)) {
      record.cleanup();
    }
  }

  // Check WebGL support
  if (fallbackActive || !isWebGLAvailable()) {
    fallbackActive = true;
    showFallback(container, side, variant);
    const cleanup = () => {
      container.innerHTML = '';
      stages.delete(container);
    };
    const record = { cleanup, fallback: true, container };
    stages.set(container, record);
    return cleanup;
  }

  try {
    const record = createThreeStage(container, side, variant, block);
    stages.set(container, record);
    return record.cleanup;
  } catch (err) {
    console.error('Three.js character stage creation failed:', err);
    fallbackActive = true;
    // Cleanup partial record if any
    if (stages.has(container)) {
      stages.get(container).cleanup();
    }
    showFallback(container, side, variant);
    const cleanup = () => {
      container.innerHTML = '';
      stages.delete(container);
    };
    const record = { cleanup, fallback: true, container };
    stages.set(container, record);
    return cleanup;
  }
}

/**
 * Play a visual cue on the mounted stage.
 * @param {'ally'|'enemy'} side - Which side's stage to target.
 * @param {string} cue - One of 'attack', 'hit', 'defend', 'idle'.
 */
export function playCharacterCue(side, cue) {
  for (const [container, record] of stages.entries()) {
    if (record.container === container && record.side === side && !record.fallback) {
      record.triggerCue(cue);
    }
  }
  // Fallback: no-op
}

/**
 * Dispose all mounted stages.
 */
export function clearCharacterStages() {
  for (const [, record] of stages.entries()) {
    try {
      record.cleanup();
    } catch (err) {
      console.warn('Stage cleanup error:', err);
    }
  }
  stages.clear();
}

// -----------------------------------------------------------------------------
// Internal: WebGL detection
// -----------------------------------------------------------------------------
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Internal: Fallback SVG
// -----------------------------------------------------------------------------
function showFallback(container, side, variant) {
  // Static low-poly SVG representing the squad. Does not replace any existing SVG content.
  const color = side === 'ally' ? '#4a7a8c' : '#8c4a4a';
  const variantColor = variant === 'default' ? color : shadeColor(color, (hashString(variant) % 40) - 20);
  const svg = `
    <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
      <g fill="${variantColor}">
        <rect x="5" y="20" width="8" height="50" rx="2"/>
        <rect x="105" y="20" width="8" height="50" rx="2"/>
        <circle cx="60" cy="30" r="12"/>
        <rect x="40" y="45" width="40" height="25" rx="4"/>
        <rect x="20" y="45" width="10" height="25" rx="2"/>
        <rect x="90" y="45" width="10" height="25" rx="2"/>
        <rect x="25" y="70" width="8" height="8"/>
        <rect x="87" y="70" width="8" height="8"/>
      </g>
      <g stroke="#000" stroke-width="1.5" fill="none">
        <path d="M60 25v10M60 35l-5 10M60 35l5 10"/>
      </g>
      <text x="60" y="75" font-size="8" fill="#888" text-anchor="middle">${side === 'ally' ? 'ALLY' : 'ENEMY'}</text>
    </svg>`;
  // Instead of replacing innerHTML (which would destroy any existing SVG), append a fallback div.
  const fallbackDiv = document.createElement('div');
  fallbackDiv.className = 'character-stage-fallback';
  fallbackDiv.style.width = '100%';
  fallbackDiv.style.height = '100%';
  fallbackDiv.innerHTML = svg;
  container.appendChild(fallbackDiv);
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// -----------------------------------------------------------------------------
// Internal: Three.js stage creation
// -----------------------------------------------------------------------------
function createThreeStage(container, side, variant, block) {
  // Set up renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const initialWidth = container.clientWidth || 200;
  const initialHeight = container.clientHeight || 150;
  renderer.setSize(initialWidth, initialHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  container.appendChild(canvas);

  // Scene and camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight || 1.3, 0.1, 100);
  camera.position.set(0, 1.55, initialWidth / initialHeight < 1.65 ? 5.2 : 4.35);
  camera.lookAt(0, 1.05, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);

  // Group for squad
  const squadGroup = new THREE.Group();
  squadGroup.scale.setScalar(1.4);
  scene.add(squadGroup);

  // Build characters and position them to avoid overlap
  const characters = buildSquad(side, variant);
  characters.forEach((charGroup, index) => {
    charGroup.position.x = (index - 1) * 1.2;
    charGroup.position.z = -0.2 * index; // slight stagger
    squadGroup.add(charGroup);
  });

  // Armor meshes: always build, but hide initially unless block=true
  const armorMeshes = addArmorToSquad(squadGroup, side);
  armorMeshes.forEach((mesh) => (mesh.visible = block));

  // Idle animation data: we'll use manual bobbing via RAF, no AnimationMixer
  let rafId = null;
  let disposed = false;
  let currentCue = null;
  let cueStartTime = null;
  const cueDuration = 500; // ms
  let lastTime = 0;
  let idleTime = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Store base positions for animation
  characters.forEach((charGroup) => {
    charGroup.userData.baseY = charGroup.position.y;
    charGroup.userData.baseScale = 1;
    charGroup.userData.baseArmLeftRotZ = charGroup.userData.leftArm.rotation.z;
    charGroup.userData.baseArmRightRotZ = charGroup.userData.rightArm.rotation.z;
  });

  // Pose application
  const applyPose = (pose, progress) => {
    characters.forEach((charGroup) => {
      const data = charGroup.userData;
      if (!data) return;
      if (pose.armsUp !== undefined) {
        const target = pose.armsUp ? Math.PI / 2 : data.baseArmRightRotZ;
        data.rightArm.rotation.z = THREE.MathUtils.lerp(data.baseArmRightRotZ, target, progress);
      }
      if (pose.jump !== undefined) {
        charGroup.position.y = THREE.MathUtils.lerp(0, pose.jump ? 0.3 : 0, progress);
      }
      if (pose.scale !== undefined) {
        charGroup.scale.setScalar(THREE.MathUtils.lerp(1, pose.scale, progress));
      }
    });
    if (pose.armor !== undefined) {
      armorMeshes.forEach((mesh) => (mesh.visible = pose.armor));
    }
  };

  const resetPose = () => {
    characters.forEach((charGroup) => {
      const data = charGroup.userData;
      if (!data) return;
      charGroup.position.y = 0;
      charGroup.scale.setScalar(1);
      data.rightArm.rotation.z = data.baseArmRightRotZ;
      data.leftArm.rotation.z = data.baseArmLeftRotZ;
    });
    armorMeshes.forEach((mesh) => (mesh.visible = block)); // return to initial block state
  };

  // Idle animation parameters
  const idleAmplitude = 0.05; // vertical bob
  const idleSpeed = 2.0; // radians per second

  // Main animation loop
  const animate = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);

    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1); // clamp to avoid jumps
    lastTime = now;

    // Pause when document hidden or reduced motion
    if (document.hidden || reducedMotion) {
      // Still render updates to keep frame fresh (camera etc) but don't advance idle/cue
      renderer.render(scene, camera);
      return;
    }

    // Update idle bob if no cue active
    if (!currentCue) {
      idleTime += delta * idleSpeed;
      characters.forEach((charGroup, index) => {
        // Slight phase offset per character
        const offset = Math.sin(idleTime + index * 1.5) * idleAmplitude;
        charGroup.position.y = offset;
      });
    } else {
      // Update active cue
      const elapsed = now - cueStartTime;
      const progress = Math.min(1, elapsed / cueDuration);
      applyPose(currentCue, progress);
      if (progress >= 1) {
        // Cue complete, reset if not defend (defend holds until next cue or idle)
        if (currentCue.hold) {
          // For defend, keep armor visible and scale until idle/other cue
          // Do nothing (hold)
        } else {
          resetPose();
          currentCue = null;
          cueStartTime = null;
        }
      }
    }

    renderer.render(scene, camera);
  };

  // Start loop
  lastTime = performance.now();
  animate();

  // Resize observer
  const resizeObserver = new ResizeObserver(() => {
    if (disposed || !container.clientWidth || !container.clientHeight) {
      // Container zero size: delay rendering, but don't render now
      return;
    }
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // Cue trigger function
  const triggerCue = (cue) => {
    if (disposed) return;
    if (cue === 'idle') {
      resetPose();
      currentCue = null;
      cueStartTime = null;
      armorMeshes.forEach((mesh) => (mesh.visible = block));
      return;
    }
    let pose;
    switch (cue) {
      case 'attack':
        pose = { armsUp: true, jump: false, scale: 1, armor: false, hold: false };
        break;
      case 'hit':
        pose = { armsUp: false, jump: true, scale: 1, armor: false, hold: false };
        break;
      case 'defend':
        pose = { armsUp: false, jump: false, scale: 1.05, armor: true, hold: true };
        break;
      default:
        pose = { armsUp: false, jump: false, scale: 1, armor: block, hold: false };
    }
    currentCue = pose;
    cueStartTime = performance.now();
    // Immediately apply zero progress
    applyPose(pose, 0);
  };

  // Cleanup function
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    // Dispose geometries/materials
    squadGroup.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    renderer.dispose();
    if (canvas.parentNode === container) {
      container.removeChild(canvas);
    }
    stages.delete(container);
  };

  return {
    container,
    side,
    variant,
    block,
    renderer,
    scene,
    camera,
    squadGroup,
    characters,
    armorMeshes,
    triggerCue,
    cleanup,
    fallback: false,
  };
}

// -----------------------------------------------------------------------------
// Character building
// -----------------------------------------------------------------------------
function buildSquad(side, variant) {
  const isAlly = side === 'ally';
  const baseSkin = 0xe0b38a;
  const uniformColor = isAlly ? 0x4a7a8c : 0x8c4a4a;
  const helmetColor = isAlly ? 0x3b5e6e : 0x6e3b3b;
  const vestColor = isAlly ? 0x2c4b58 : 0x582c2c;
  const gunMetal = 0x333333;
  const accent = isAlly ? 0x6fbf9f : 0xbf6f6f;

  const shade = (hashString(variant) % 30) - 15;
  const applyShade = (color) => {
    const r = Math.min(255, Math.max(0, (color >> 16) + shade));
    const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + shade));
    const b = Math.min(255, Math.max(0, (color & 0xff) + shade));
    return (r << 16) | (g << 8) | b;
  };
  const skinColor = applyShade(baseSkin);
  const helmCol = applyShade(helmetColor);
  const vestCol = applyShade(vestColor);

  const characters = [];
  for (let i = 0; i < 3; i++) {
    const charGroup = new THREE.Group();

    // Torso
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 6);
    const torsoMat = new THREE.MeshStandardMaterial({ color: applyShade(uniformColor), flatShading: true });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.55;
    torso.rotation.y = Math.PI / 6;
    charGroup.add(torso);

    // Vest
    const vestGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.4, 6);
    const vestMat = new THREE.MeshStandardMaterial({ color: vestCol, flatShading: true });
    const vest = new THREE.Mesh(vestGeo, vestMat);
    vest.position.y = 0.65;
    vest.rotation.y = Math.PI / 6;
    charGroup.add(vest);

    // Head
    const headGeo = new THREE.SphereGeometry(0.31, 8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.25;
    charGroup.add(head);

    // Helmet (half sphere)
    const helmetGeo = new THREE.SphereGeometry(0.34, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmetMat = new THREE.MeshStandardMaterial({ color: helmCol, flatShading: true });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 1.3;
    helmet.rotation.z = 0;
    charGroup.add(helmet);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.2, 0.08, 0.1);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.25, 0.22);
    charGroup.add(visor);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.7, 5);
    const armMat = new THREE.MeshStandardMaterial({ color: skinColor, flatShading: true });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.4, 0.8, 0);
    leftArm.rotation.z = Math.PI / 8;
    leftArm.rotation.x = Math.PI / 12;
    charGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.4, 0.8, 0);
    rightArm.rotation.z = -Math.PI / 8;
    rightArm.rotation.x = -Math.PI / 12;
    charGroup.add(rightArm);

    // Gun
    const gunGeo = new THREE.BoxGeometry(0.6, 0.12, 0.12);
    const gunMat = new THREE.MeshStandardMaterial({ color: gunMetal, flatShading: true });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.5, 0.85, 0.2);
    gun.rotation.y = Math.PI / 4;
    charGroup.add(gun);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.55, 5);
    const legMat = new THREE.MeshStandardMaterial({ color: skinColor, flatShading: true });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.25, 0);
    charGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.25, 0);
    charGroup.add(rightLeg);

    // Boots
    const bootGeo = new THREE.BoxGeometry(0.16, 0.1, 0.22);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true });
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.15, 0.0, 0.05);
    charGroup.add(leftBoot);
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.15, 0.0, 0.05);
    charGroup.add(rightBoot);

    // Shoulder pads
    const shoulderGeo = new THREE.BoxGeometry(0.15, 0.12, 0.2);
    const shoulderMat = new THREE.MeshStandardMaterial({ color: accent, flatShading: true });
    const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    leftShoulder.position.set(-0.42, 1.05, 0);
    charGroup.add(leftShoulder);
    const rightShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    rightShoulder.position.set(0.42, 1.05, 0);
    charGroup.add(rightShoulder);

    // Store references for animation
    charGroup.userData = {
      torso,
      head,
      leftArm,
      rightArm,
      gun,
      leftLeg,
      rightLeg,
    };

    characters.push(charGroup);
  }

  return characters;
}

function addArmorToSquad(squadGroup, side) {
  const armorColor = side === 'ally' ? 0x88aacc : 0xaa8888;
  const armorMeshes = [];
  squadGroup.children.forEach((charGroup) => {
    // Armor plate on torso
    const plateGeo = new THREE.BoxGeometry(0.7, 0.4, 0.3);
    const plateMat = new THREE.MeshStandardMaterial({ color: armorColor, flatShading: true, transparent: true, opacity: 0.8 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.7, 0.1);
    plate.scale.set(1, 1, 0.8);
    charGroup.add(plate);
    armorMeshes.push(plate);

    // Chest emblem
    const emblemGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xffcc66, flatShading: true });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0, 0.75, 0.25);
    charGroup.add(emblem);
    armorMeshes.push(emblem);
  });
  return armorMeshes;
}

// Removed animation clip creation functions; we use manual RAF tweens instead.
