// shared/character-stage-source.js
// Three.js character stage using Quaternius Toon Shooter GLB models.
// Exports mountCharacterStage, playCharacterCue, clearCharacterStages.
// Handles WebGL fallback, reduced motion, resize, loading, and disposal.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// -----------------------------------------------------------------------------
// Global model cache (shared geometry/material across instances)
// -----------------------------------------------------------------------------
const modelCache = new Map(); // url -> Promise<{ scene, animations }>
const loader = new GLTFLoader();

function loadModel(url) {
  if (!modelCache.has(url)) {
    const promise = loader.loadAsync(url).then((gltf) => {
      const processed = {
        scene: gltf.scene,
        animations: gltf.animations || [],
      };
      return processed;
    });
    modelCache.set(url, promise);
  }
  return modelCache.get(url);
}

// -----------------------------------------------------------------------------
// Internal state
// -----------------------------------------------------------------------------
const stages = new Map(); // container -> record
let fallbackActive = false;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export function mountCharacterStage(container, { side = 'ally', variant = 'default', block = false } = {}) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('mountCharacterStage requires a valid DOM container.');
  }

  // Clean up any existing stage in this container
  if (stages.has(container)) {
    stages.get(container).cleanup();
  }
  // Remove stale stages whose containers are no longer in the document
  for (const [existingContainer, record] of stages.entries()) {
    if (!document.contains(existingContainer)) {
      record.cleanup();
    }
  }

  // Check WebGL support
  if (fallbackActive || !isWebGLAvailable()) {
    fallbackActive = true;
    showStaticFallback(container, side, variant);
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
    if (stages.has(container)) {
      stages.get(container).cleanup();
    }
    showStaticFallback(container, side, variant);
    const cleanup = () => {
      container.innerHTML = '';
      stages.delete(container);
    };
    const record = { cleanup, fallback: true, container };
    stages.set(container, record);
    return cleanup;
  }
}

export function playCharacterCue(side, cue) {
  for (const [container, record] of stages.entries()) {
    if (record.container === container && record.side === side && !record.fallback) {
      record.triggerCue(cue);
    }
  }
}

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
// WebGL detection
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
// Static SVG fallback (used when WebGL fails or during initial load)
// -----------------------------------------------------------------------------
function showStaticFallback(container, side, variant) {
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
// Three.js stage creation
// -----------------------------------------------------------------------------
function createThreeStage(container, side, variant, block) {
  // Renderer
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

  // Loading overlay (SVG placeholder)
  const loadingOverlay = document.createElement('div');
  loadingOverlay.style.position = 'absolute';
  loadingOverlay.style.top = '0';
  loadingOverlay.style.left = '0';
  loadingOverlay.style.width = '100%';
  loadingOverlay.style.height = '100%';
  loadingOverlay.style.pointerEvents = 'none';
  loadingOverlay.innerHTML = `
    <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
      <rect x="45" y="35" width="30" height="10" fill="#ccc" rx="2">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.2s" repeatCount="indefinite" />
      </rect>
      <text x="60" y="25" font-size="8" fill="#888" text-anchor="middle">Loading...</text>
    </svg>`;
  container.appendChild(loadingOverlay);

  // Scene and camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight || 1.3, 0.1, 100);
  camera.position.set(0, 1.55, initialWidth / initialHeight < 1.65 ? 4.6 : 4.7);
  camera.lookAt(0, 1.15, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);
  const rimLight = new THREE.DirectionalLight(side === 'ally' ? 0x86d9f6 : 0xff8b73, 1.1);
  rimLight.position.set(-2, 2, -2);
  scene.add(rimLight);

  // Squad group
  const squadGroup = new THREE.Group();
  squadGroup.scale.setScalar(1.0);
  scene.add(squadGroup);

  // Character data holders
  const characters = []; // each: { group, mixer, actions, baseTransform, userData }
  const armorIndicators = []; // per character, toggled by block/defend

  // Add armor indicators (transparent rings at feet to avoid covering character)
  function createArmorIndicator(parent) {
    const ringGeo = new THREE.TorusGeometry(0.45, 0.05, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    parent.add(ring);
    return ring;
  }

  // Build characters asynchronously
  const buildPromise = buildSquadModels(side, variant).then((builtSquad) => {
    if (disposed) {
      builtSquad.forEach(({ group, mixer }) => {
        mixer?.stopAllAction();
        group.traverse((obj) => {
          if (!obj.isMesh) return;
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => { if (mat?.userData?.isClone) mat.dispose(); });
        });
      });
      return;
    }
    builtSquad.forEach((built, index) => {
      const charGroup = built.group;
      charGroup.scale.multiplyScalar(index === 1 ? 1.16 : 0.88);
      charGroup.position.x = (index - 1) * 1.16;
      charGroup.position.z = index === 1 ? 0.25 : -0.16;
      squadGroup.add(charGroup);

      const armorRing = createArmorIndicator(charGroup);
      armorRing.visible = block;
      armorIndicators.push(armorRing);

      const userDataObj = {
        defaultActionName: built.defaultActionName,
        fallbackTransform: built.fallbackTransform || false,
        baseY: charGroup.position.y,
        baseArmLeftRotZ: 0,
        baseArmRightRotZ: 0,
        leftArm: null,
        rightArm: null,
      };
      characters.push({
        group: charGroup,
        mixer: built.mixer,
        actions: built.actions,
        basePosition: new THREE.Vector3(charGroup.position.x, charGroup.position.y, charGroup.position.z),
        baseRotation: charGroup.rotation.clone(),
        baseScale: charGroup.scale.clone(),
        userData: userDataObj,
      });

      // Automatically play idle or idle_shoot for each character
      if (built.mixer) {
        const defaultAction = built.actions[built.defaultActionName];
        if (defaultAction) {
          defaultAction.reset().fadeIn(0.2).play();
        }
      }
    });

    // Remove loading overlay
    if (loadingOverlay.parentNode === container) {
      container.removeChild(loadingOverlay);
    }
  }).catch((err) => {
    console.error('Model loading failed:', err);
    if (disposed) return;
    // Fallback to static SVG if models cannot load
    if (loadingOverlay.parentNode === container) {
      container.removeChild(loadingOverlay);
    }
    showStaticFallback(container, side, variant);
    // Clean up partially created stage
    cleanup();
  });

  // Animation state
  let rafId = null;
  let disposed = false;
  const clock = new THREE.Clock();
  let currentCue = null;
  let cueStartTime = null;
  const cueDuration = 500;
  let lastTime = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fallback transform animation helpers (if no GLB animations available)
  const applyFallbackPose = (pose, progress) => {
    characters.forEach((char) => {
      const data = char.userData;
      if (pose.armsUp !== undefined && data.leftArm) {
        const target = pose.armsUp ? Math.PI / 2 : data.baseArmRightRotZ;
        data.rightArm.rotation.z = THREE.MathUtils.lerp(data.baseArmRightRotZ, target, progress);
      }
      if (pose.jump !== undefined) {
        char.group.position.y = THREE.MathUtils.lerp(0, pose.jump ? 0.3 : 0, progress);
      }
      if (pose.scale !== undefined) {
        char.group.scale.setScalar(THREE.MathUtils.lerp(1, pose.scale, progress));
      }
    });
    if (pose.armor !== undefined) {
      armorIndicators.forEach((ring) => (ring.visible = pose.armor));
    }
  };

  const resetFallbackPose = () => {
    characters.forEach((char) => {
      const data = char.userData;
      char.group.position.y = data.baseY;
      char.group.scale.setScalar(1);
      if (data.leftArm) {
        data.leftArm.rotation.z = data.baseArmLeftRotZ;
        data.rightArm.rotation.z = data.baseArmRightRotZ;
      }
    });
    armorIndicators.forEach((ring) => (ring.visible = block));
  };

  const triggerCue = (cue) => {
    if (disposed || characters.length === 0) return;

    // Reset any fallback pose
    resetFallbackPose();

    if (cue === 'idle') {
      // Stop all actions and play default idle if available
      characters.forEach((char) => {
        if (char.mixer) {
          char.mixer.stopAllAction();
          const defaultAction = char.actions[char.userData.defaultActionName];
          if (defaultAction) {
            defaultAction.reset().fadeIn(0.2).play();
          }
        }
      });
      currentCue = null;
      cueStartTime = null;
      return;
    }

    // Determine animation name and fallback pose
    let animName = null;
    let fallbackPose = null;
    switch (cue) {
      case 'attack':
        animName = 'Idle_Shoot';
        fallbackPose = { armsUp: true, jump: false, scale: 1, armor: false };
        break;
      case 'hit':
        animName = 'HitReact';
        fallbackPose = { armsUp: false, jump: true, scale: 1, armor: false };
        break;
      case 'defend':
        // Prefer Duck animation if available, else use Idle_Shoot as placeholder
        if (characters.some((char) => char.actions['Duck'])) {
          animName = 'Duck';
        } else {
          animName = 'Idle_Shoot';
        }
        fallbackPose = { armsUp: false, jump: false, scale: 1.05, armor: true };
        break;
      default:
        animName = 'Idle';
        fallbackPose = { armsUp: false, jump: false, scale: 1, armor: block };
    }

    let usedAnimation = false;
    characters.forEach((char) => {
      const action = char.actions[animName];
      if (char.mixer && action) {
        // Stop all actions except the one we want to play
        char.mixer.stopAllAction();
        action.reset().fadeIn(0.15).play();
        // For non-looping cues, schedule return to idle after finish
        if (cue !== 'idle') {
          const onFinished = () => {
            char.mixer.removeEventListener('finished', onFinished);
            if (!disposed) {
              char.mixer.stopAllAction();
              const idleAction = char.actions[char.userData.defaultActionName];
              if (idleAction) {
                idleAction.reset().fadeIn(0.2).play();
              }
            }
          };
          char.mixer.addEventListener('finished', onFinished);
          // Handle looped actions (like Idle_Shoot) by setting loopOnce then back to loop
          if (action.loop === THREE.LoopRepeat) {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
            // Note: after finish event, we revert to idle; but if we need to keep looping for attack, adjust logic accordingly.
            // For attack, we want one shot, so LoopOnce is correct.
          }
        }
        usedAnimation = true;
      }
    });

    if (!usedAnimation) {
      // Use fallback transform animation
      currentCue = fallbackPose;
      cueStartTime = performance.now();
      applyFallbackPose(currentCue, 0);
    } else {
      currentCue = null;
      cueStartTime = null;
      // For defend, also show armor indicator
      if (cue === 'defend') {
        armorIndicators.forEach((ring) => (ring.visible = true));
      } else if (cue === 'attack' || cue === 'hit') {
        armorIndicators.forEach((ring) => (ring.visible = block));
      }
    }
  };

  // Main animation loop
  const animate = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const now = performance.now();

    if (!document.hidden && !reducedMotion) {
      // Update mixers
      characters.forEach((char) => {
        if (char.mixer) {
          char.mixer.update(delta);
        }
      });

      // Fallback transform animation
      if (currentCue) {
        const elapsed = now - cueStartTime;
        const progress = Math.min(1, elapsed / cueDuration);
        applyFallbackPose(currentCue, progress);
        if (progress >= 1) {
          resetFallbackPose();
          currentCue = null;
          cueStartTime = null;
        }
      }
    }

    renderer.render(scene, camera);
    lastTime = now;
  };

  lastTime = performance.now();
  animate();

  // Resize observer
  const resizeObserver = new ResizeObserver(() => {
    if (disposed || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // Cleanup
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    // Stop all mixers
    characters.forEach((char) => {
      if (char.mixer) {
        char.mixer.stopAllAction();
        char.mixer.uncacheRoot(char.group);
      }
    });
    // Dispose non-shared resources: cloned materials and armor ring geometries/materials
    squadGroup.traverse((obj) => {
      if (obj.isMesh) {
        if (obj.userData.stageOwned) obj.geometry.dispose();
        // Dispose cloned materials from tintMaterials
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => {
              if (mat && mat.userData && mat.userData.isClone) {
                mat.dispose();
              }
            });
          } else {
            if (obj.userData.stageOwned || (obj.material.userData && obj.material.userData.isClone)) {
              obj.material.dispose();
            }
          }
        }
      }
    });
    // Also dispose any cloned materials tracked in userData (safety)
    if (squadGroup.userData.clonedMaterials) {
      squadGroup.userData.clonedMaterials.forEach((mat) => mat.dispose());
      squadGroup.userData.clonedMaterials.clear();
    }
    armorIndicators.forEach((ring) => {
      ring.geometry.dispose();
      ring.material.dispose();
    });
    renderer.dispose();
    if (canvas.parentNode === container) {
      container.removeChild(canvas);
    }
    if (loadingOverlay.parentNode === container) {
      container.removeChild(loadingOverlay);
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
    armorIndicators,
    triggerCue,
    cleanup,
    fallback: false,
  };
}

// -----------------------------------------------------------------------------
// Model loading and squad building
// -----------------------------------------------------------------------------
async function buildSquadModels(side, variant) {
  const isAlly = side === 'ally';
  const models = [];

  if (isAlly) {
    // Ally: three soldier models with slight variations
    const soldierUrl = '/shared/models/soldier.glb';
    const soldierData = await loadModel(soldierUrl);
    for (let i = 0; i < 3; i++) {
      const clone = cloneModel(soldierData);
      // Slight variations: scale, rotation, and material tint
      if (i === 1) clone.group.scale.multiplyScalar(1.05);
      if (i === 2) clone.group.rotation.y = 0.1;
      // Tint materials slightly per member (unique clones)
      tintMaterials(clone.group, new THREE.Color().setHSL(0.6 + i * 0.05, 0.5, 0.6));
      models.push(clone);
    }
  } else {
    // Enemy: map ID to model URL and variations
    const enemyId = String(variant || 'E01');
    const selected = getEnemyModelSelection(enemyId);
    const baseUrl = selected.url;
    const baseData = await loadModel(baseUrl);

    // For known IDs, apply deterministic variations (size, tone, etc.)
    for (let i = 0; i < 3; i++) {
      const clone = cloneModel(baseData);
      // Apply per-member slight variation
      if (i === 0) clone.group.scale.multiplyScalar(selected.scaleVariation[0]);
      if (i === 1) clone.group.scale.multiplyScalar(selected.scaleVariation[1]);
      if (i === 2) clone.group.scale.multiplyScalar(selected.scaleVariation[2]);
      clone.group.rotation.y = (i - 1) * 0.1;
      tintMaterials(clone.group, selected.tintColor);
      decorateEnemy(clone.group, enemyId);
      models.push(clone);
    }
  }

  return models;
}

function decorateEnemy(group, enemyId) {
  const kind = enemyId.replace(/^A[23]_/, '');
  if (kind === 'E01') return;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const height = Math.max(.1, bounds.max.y - bounds.min.y);
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const head = bounds.min.y + height * .88;
  const chest = bounds.min.y + height * .54;
  const z = (bounds.min.z + bounds.max.z) / 2 + height * .12;
  const material = (color) => new THREE.MeshStandardMaterial({ color, metalness: .12, roughness: .72, flatShading: true });
  const part = (geometry, color, x, y, depth) => {
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.set(x, y, depth);
    mesh.userData.stageOwned = true;
    group.add(mesh);
    return mesh;
  };
  if (kind === 'E02') {
    for (const side of [-1, 1]) {
      part(new THREE.CylinderGeometry(height*.018, height*.018, height*.35, 5), 0x587fbb,
        cx + side*height*.17, head + height*.2, z - height*.12);
      part(new THREE.SphereGeometry(height*.055, 8, 6), 0x6ae4f0,
        cx + side*height*.17, head + height*.38, z - height*.12);
    }
  } else if (kind === 'E03') {
    for (const side of [-1, 1]) {
      const fin = part(new THREE.ConeGeometry(height*.15, height*.47, 5), 0xc66852,
        cx + side*height*.29, chest + height*.32, z - height*.16);
      fin.rotation.z = side * -.48;
    }
  } else if (kind === 'E04') {
    const shield = part(new THREE.BoxGeometry(height*.28, height*.62, height*.07), 0x82929c,
      cx - height*.34, chest, z + height*.1);
    shield.rotation.z = -.12;
    part(new THREE.BoxGeometry(height*.11, height*.15, height*.08), 0xa9e6ed,
      cx - height*.34, chest + height*.04, z + height*.15);
  } else if (kind === 'E05') {
    part(new THREE.BoxGeometry(height*.62, height*.08, height*.32), 0x71828a,
      cx, head + height*.13, z - height*.02);
    part(new THREE.BoxGeometry(height*.1, height*.15, height*.04), 0xdbad6c,
      cx, chest + height*.17, z + height*.15);
  } else if (kind === 'EL01') {
    for (const side of [-1, 1]) {
      const shoulder = part(new THREE.BoxGeometry(height*.29, height*.28, height*.27), 0xb38b49,
        cx + side*height*.33, chest + height*.19, z);
      shoulder.rotation.z = side*.18;
    }
    part(new THREE.BoxGeometry(height*.28, height*.13, height*.06), 0xf0c55b,
      cx, head, z + height*.11);
  } else if (kind === 'B01') {
    part(new THREE.ConeGeometry(height*.16, height*.4, 5), 0xe1aa48,
      cx, head + height*.32, z - height*.04);
    for (const side of [-1, 1]) {
      const banner = part(new THREE.BoxGeometry(height*.12, height*.55, height*.04), 0xa7393d,
        cx + side*height*.39, chest + height*.37, z - height*.2);
      banner.rotation.z = side*.15;
    }
  }
}

function cloneModel(modelData) {
  const clonedScene = SkeletonUtils.clone(modelData.scene);
  const mixer = new THREE.AnimationMixer(clonedScene);
  const actions = {};
  // Build action map using normalized clip names
  modelData.animations.forEach((clip) => {
    const normalized = normalizeClipName(clip.name);
    if (!actions[normalized]) {
      actions[normalized] = mixer.clipAction(clip);
    }
  });
  // Determine default idle action name
  let defaultActionName = 'Idle';
  if (!actions[defaultActionName]) {
    // Try common alternatives
    const alternatives = ['Idle_Shoot', 'Idle_Rifle', 'Idle_Pistol', 'Idle_Unarmed'];
    for (const alt of alternatives) {
      if (actions[alt]) {
        defaultActionName = alt;
        break;
      }
    }
  }
  // If no animations at all, use fallback transform
  const fallbackTransform = Object.keys(actions).length === 0;
  return {
    group: clonedScene,
    mixer,
    actions,
    defaultActionName,
    fallbackTransform,
  };
}

function normalizeClipName(name) {
  // Remove known prefix like "CharacterArmature|"
  const parts = name.split('|');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function tintMaterials(group, baseColor) {
  const clonedMaterials = new Set(); // track materials we cloned to dispose later
  group.userData.clonedMaterials = clonedMaterials;
  group.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      if (Array.isArray(obj.material)) {
        // Process each material in the array
        for (let i = 0; i < obj.material.length; i++) {
          const originalMat = obj.material[i];
          const cloneMat = cloneAndTintMaterial(originalMat, baseColor, clonedMaterials);
          obj.material[i] = cloneMat;
        }
      } else {
        // Single material
        const originalMat = obj.material;
        const cloneMat = cloneAndTintMaterial(originalMat, baseColor, clonedMaterials);
        obj.material = cloneMat;
      }
    }
  });
}

function cloneAndTintMaterial(originalMat, baseColor, clonedMaterialsSet) {
  // If original material is already a clone from a previous tint, avoid re-cloning
  if (!originalMat.userData || !originalMat.userData.isClone) {
    const clone = originalMat.clone();
    clone.userData.isClone = true;
    clonedMaterialsSet.add(clone);
    clone.color.lerp(baseColor, 0.2);
    return clone;
  } else {
    // Already cloned, just re-tint
    originalMat.color.lerp(baseColor, 0.2);
    return originalMat;
  }
}

function getEnemyModelSelection(enemyId) {
  // Deterministic mapping for known enemy IDs; no hashing of known IDs.
  const id = enemyId.replace(/^A[23]_/, ''); // strip act prefix
  const act = enemyId.includes('A2_') ? 2 : enemyId.includes('A3_') ? 3 : 1;

  // Base URL and variations per ID
  const selections = {
    'E01': { url: '/shared/models/enemy.glb', scaleVariation: [1.0, 0.95, 1.05], tintColor: new THREE.Color(0x8c4a4a) },
    'E02': { url: '/shared/models/enemy.glb', scaleVariation: [0.9, 1.0, 0.85], tintColor: new THREE.Color(0x4a4a8c) },
    'E03': { url: '/shared/models/enemy.glb', scaleVariation: [1.1, 0.9, 1.0], tintColor: new THREE.Color(0x744d59) },
    'E04': { url: '/shared/models/hazmat.glb', scaleVariation: [1.0, 1.1, 0.95], tintColor: new THREE.Color(0x8c8c4a) },
    'E05': { url: '/shared/models/hazmat.glb', scaleVariation: [0.85, 1.0, 0.9], tintColor: new THREE.Color(0x5a5a5a) },
    'EL01': { url: '/shared/models/soldier.glb', scaleVariation: [1.2, 1.15, 1.25], tintColor: new THREE.Color(0x506773) },
    'B01': { url: '/shared/models/hazmat.glb', scaleVariation: [1.3, 1.25, 1.35], tintColor: new THREE.Color(0x413c50) },
  };

  let selection = selections[id];
  if (!selection) {
    // Unknown ID fallback: use enemy.glb with default scale and neutral tint
    selection = { url: '/shared/models/enemy.glb', scaleVariation: [1.0, 1.0, 1.0], tintColor: new THREE.Color(0xaaaaaa) };
  }

  // Apply act upgrades: increase scale slightly and adjust tint brightness for A2/A3
  if (act > 1) {
    const scaleBoost = act === 2 ? 1.08 : 1.15;
    selection.scaleVariation = selection.scaleVariation.map((s) => s * scaleBoost);
    const hsl = {};
    selection.tintColor.getHSL(hsl);
    hsl.l = Math.min(0.8, hsl.l + (act === 2 ? 0.1 : 0.15));
    selection.tintColor.setHSL(hsl.h, hsl.s, hsl.l);
  }

  return selection;
}
