// shared/character-stage-source.js
// Three.js character stage using proportionate Quaternius tactical GLTF characters.
// Exports mountCharacterStage, playCharacterCue, clearCharacterStages.
// Handles WebGL fallback, reduced motion, resize, loading, and disposal.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { buildChibiFigure } from './chibi-figure-source.js';

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
  const color = side === 'ally' ? '#4a7a8c' : side === 'npc' ? '#8c7a4a' : '#8c4a4a';
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
      <text x="60" y="75" font-size="8" fill="#888" text-anchor="middle">${side === 'ally' ? 'ALLY' : side === 'npc' ? 'NPC' : 'ENEMY'}</text>
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
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(1);
  const initialWidth = container.clientWidth || 200;
  const initialHeight = container.clientHeight || 150;
  const renderSize = (width, height) => renderer.setSize(Math.max(1, Math.round(width * 0.62)), Math.max(1, Math.round(height * 0.62)), false);
  renderSize(initialWidth, initialHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  canvas.style.imageRendering = 'pixelated';
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
  camera.position.set(0, 1.18, 2.55);
  camera.lookAt(0, 0.9, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 1.35);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.15);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);
  // Shop NPCs get a neutral warm light instead of the hostile red rim.
  const rimLight = new THREE.DirectionalLight(side === 'ally' ? 0x86d9f6 : side === 'npc' ? 0xffe2a8 : 0xff8b73, 1.1);
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
      charGroup.position.x = 0;
      charGroup.position.z = 0;
      squadGroup.add(charGroup);

      const armorRing = createArmorIndicator(charGroup);
      armorRing.visible = block;
      armorIndicators.push(armorRing);

      const userDataObj = {
        defaultActionName: built.defaultActionName,
        fallbackTransform: built.fallbackTransform || false,
        baseY: charGroup.position.y,
        baseArmLeftRotZ: built.leftArm?.rotation.z || 0,
        baseArmRightRotZ: built.rightArm?.rotation.z || 0,
        baseArmLeftRotX: built.leftArm?.rotation.x || 0,
        baseArmRightRotX: built.rightArm?.rotation.x || 0,
        leftArm: built.leftArm || null,
        rightArm: built.rightArm || null,
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
      if (pose.armsUp !== undefined && data.leftArm && data.rightArm) {
        data.leftArm.rotation.x = THREE.MathUtils.lerp(data.baseArmLeftRotX, pose.armsUp ? -0.7 : data.baseArmLeftRotX, progress);
        data.rightArm.rotation.x = THREE.MathUtils.lerp(data.baseArmRightRotX, pose.armsUp ? -1.1 : data.baseArmRightRotX, progress);
      }
      if (pose.jump !== undefined) {
        char.group.position.y = THREE.MathUtils.lerp(0, pose.jump ? 0.3 : 0, progress);
      }
      if (pose.scale !== undefined) {
        char.group.scale.copy(char.baseScale).multiplyScalar(THREE.MathUtils.lerp(1, pose.scale, progress));
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
      char.group.scale.copy(char.baseScale);
      if (data.leftArm) {
        data.leftArm.rotation.z = data.baseArmLeftRotZ;
        data.rightArm.rotation.z = data.baseArmRightRotZ;
        data.leftArm.rotation.x = data.baseArmLeftRotX;
        data.rightArm.rotation.x = data.baseArmRightRotX;
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
        animName = 'Gun_Shoot';
        fallbackPose = { armsUp: true, jump: false, scale: 1, armor: false };
        break;
      case 'hit':
        animName = 'HitRecieve';
        fallbackPose = { armsUp: false, jump: true, scale: 1, armor: false };
        break;
      case 'defend':
        animName = 'Idle_Gun_Pointing';
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
        } else if (!currentCue) {
          char.group.position.y = char.userData.baseY + Math.sin(now * 0.003) * 0.015;
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
    renderSize(container.clientWidth, container.clientHeight);
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
  const model = buildChibiFigure(side, variant);
  model.group.rotation.y = side === 'ally' ? -0.18 : side === 'npc' ? 0 : 0.18;
  return [model];
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
  let defaultActionName = 'Idle_Gun';
  if (!actions[defaultActionName]) {
    // Try common alternatives
    const alternatives = ['Idle', 'Idle_Neutral'];
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
    clone.flatShading = true;
    clone.roughness = 1;
    if (clone.map) clone.map.magFilter = THREE.NearestFilter;
    clone.needsUpdate = true;
    return clone;
  } else {
    // Already cloned, just re-tint
    originalMat.color.lerp(baseColor, 0.2);
    return originalMat;
  }
}

function getEnemyModelSelection(enemyId) {
  const id = enemyId.replace(/^A[23]_/, '');
  const act = enemyId.includes('A3_') ? 3 : enemyId.includes('A2_') ? 2 : 1;
  const selections = {
    E01: ['adventurer', 0x9b7d66],
    E02: ['punk', 0xab6b62],
    E03: ['adventurer', 0x867a91],
    E04: ['spacesuit', 0xb68465],
    E05: ['swat', 0xa56a62],
    EL01: ['spacesuit', 0xb26e47],
    B01: ['spacesuit', 0xbd644e],
  };
  const [name, color] = selections[id] || selections.E01;
  return {
    url: `/shared/models/operative-${name}.gltf`,
    tintColor: new THREE.Color(color),
    scale: id === 'B01' ? 1.08 : act === 3 ? 1.05 : 1,
  };
}
