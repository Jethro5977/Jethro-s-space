import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const host = document.querySelector("#threeCardStage");
const canvas = document.querySelector("#threeCardCanvas");
const status = document.querySelector("#threeStatus");
let bridge = null;
let didInit = false;
let bridgeWaitAttempts = 0;

const CARD_WIDTH = 3;
const CARD_HEIGHT = 4.2;
const CARD_DEPTH = 0.065;
const BASE_CAMERA_RADIUS = 9.6;

const SLAB_CONFIGS = {
  none: { depth: 0, width: 3.12, height: 4.34, tint: 0xffffff, transmission: 0 },
  magnetic: { depth: 0.2, width: 3.46, height: 4.78, tint: 0xe7f7ff, transmission: 0.9, magnets: true },
  forge: { depth: 0.27, width: 3.56, height: 5.18, tint: 0xc4f7ff, transmission: 0.82, magnets: true },
  museum: { depth: 0.31, width: 3.58, height: 5.2, tint: 0xffe4a0, transmission: 0.72, magnets: true },
  acrylic: { depth: 0.46, width: 3.64, height: 5.24, tint: 0xeaf9ff, transmission: 0.97, magnets: true },
  crystal: { depth: 0.16, width: 3.3, height: 4.58, tint: 0xf4fcff, transmission: 0.96, magnets: false },
  gallery: { depth: 0.36, width: 3.6, height: 5.22, tint: 0xdce8f4, transmission: 0.78, magnets: true }
};

let renderer;
let scene;
let camera;
let controls;
let rootGroup;
let shellGroup;
let cardGroup;
let frontMaterial;
let backMaterial;
let cardBodyMaterial;
let foilMaterial;
let labelMaterial;
let currentState = null;
let currentSlabType = "";
let textureRefreshTimer = 0;
let textureRevision = 0;
let suppressControlSyncUntil = 0;
let ignoreExternalViewUntil = 0;
let orbitInputActive = false;
let controlSyncTimer = 0;
let pointerStart = null;
let shellPickables = [];
let selectedMaterial = null;
let selectedRestoreTimer = 0;

const scratchRoughnessMap = createScratchTexture(false);
const scratchHighlightMap = createScratchTexture(true);

bootWhenReady();

function bootWhenReady() {
  if (didInit) return;
  bridge = window.cardBuilder3D;

  if (!host || !canvas) return;
  if (!bridge) {
    status.textContent = "LOADING 3D";
    bridgeWaitAttempts += 1;
    if (bridgeWaitAttempts <= 100) window.setTimeout(bootWhenReady, 50);
    else {
      status.textContent = "3D LOAD FAILED";
      host.classList.add("is-unavailable");
    }
    return;
  }

  didInit = true;
  init();
}

window.addEventListener("cardbuilder:bridge-ready", bootWhenReady, { once: true });

function init() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
  } catch (error) {
    console.error("Unable to initialize Three.js preview", error);
    status.textContent = "WEBGL UNAVAILABLE";
    host.classList.add("is-unavailable");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x090910, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(0, 0.1, BASE_CAMERA_RADIUS);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  createLighting();
  createGround();

  rootGroup = new THREE.Group();
  rootGroup.name = "acrylic-card-assembly";
  scene.add(rootGroup);
  createCard();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.03, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.72;
  controls.minDistance = BASE_CAMERA_RADIUS / 1.6;
  controls.maxDistance = BASE_CAMERA_RADIUS / 0.6;
  controls.minPolarAngle = THREE.MathUtils.degToRad(5);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(175);

  controls.addEventListener("start", () => {
    orbitInputActive = true;
    suppressControlSyncUntil = 0;
    bridge.setView({ motionOn: false });
  });
  controls.addEventListener("end", () => {
    syncViewToApp();
    window.setTimeout(() => {
      orbitInputActive = false;
      syncViewToApp();
    }, 160);
  });
  controls.addEventListener("change", scheduleControlSync);

  bindInteraction();
  new ResizeObserver(resizeRenderer).observe(host);
  document.body.classList.add("three-preview-ready");
  status.textContent = "ACRYLIC / PBR";
  window.cardBuilderThree = { captureCanvas, rebuild: () => currentState && rebuildShell(currentState) };

  window.addEventListener("cardbuilder:state", (event) => applyState(event.detail));
  window.addEventListener("cardbuilder:view", (event) => applyExternalView(event.detail));

  const initialState = bridge.getState();
  applyState(initialState);
  applyExternalView(initialState.view);
  resizeRenderer();
  renderer.setAnimationLoop(renderFrame);
}

function createLighting() {
  RectAreaLightUniformsLib.init();
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x17131d, 0.62));

  const key = new THREE.RectAreaLight(0xffffff, 2.7, 4.5, 6.5);
  key.position.set(-4.2, 4.8, 5.5);
  key.lookAt(0, 0, 0);
  scene.add(key);

  const rim = new THREE.RectAreaLight(0x9edfff, 2.2, 3.2, 5.4);
  rim.position.set(4.6, 1.2, -4.4);
  rim.lookAt(0, 0.15, 0);
  scene.add(rim);

  const warmFill = new THREE.RectAreaLight(0xffd59b, 1.15, 3, 3);
  warmFill.position.set(-3.8, -3.4, 3.2);
  warmFill.lookAt(0, -0.4, 0);
  scene.add(warmFill);

  const shadowLight = new THREE.DirectionalLight(0xe8f4ff, 0.9);
  shadowLight.position.set(3.6, 5.5, 6.5);
  shadowLight.castShadow = true;
  shadowLight.shadow.mapSize.set(1024, 1024);
  shadowLight.shadow.camera.near = 1;
  shadowLight.shadow.camera.far = 18;
  shadowLight.shadow.camera.left = -5;
  shadowLight.shadow.camera.right = 5;
  shadowLight.shadow.camera.top = 6;
  shadowLight.shadow.camera.bottom = -6;
  shadowLight.shadow.bias = -0.0003;
  scene.add(shadowLight);
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 })
  );
  ground.name = "contact-shadow-plane";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.05;
  ground.receiveShadow = true;
  scene.add(ground);
}

function createCard() {
  cardGroup = new THREE.Group();
  cardGroup.name = "card-insert";
  rootGroup.add(cardGroup);

  const placeholderFront = createPlaceholderTexture("FRONT");
  const placeholderBack = createPlaceholderTexture("BACK");

  cardBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e9ec, roughness: 0.48, metalness: 0.02 });
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH, 5, 0.055),
    cardBodyMaterial
  );
  body.name = "card-stock-edge";
  body.castShadow = true;
  body.receiveShadow = true;
  cardGroup.add(body);

  frontMaterial = createCardMaterial(placeholderFront);
  backMaterial = createCardMaterial(placeholderBack);

  const front = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH - 0.025, CARD_HEIGHT - 0.025), frontMaterial);
  front.name = "card-front-texture";
  front.position.z = CARD_DEPTH / 2 + 0.002;
  cardGroup.add(front);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH - 0.025, CARD_HEIGHT - 0.025), backMaterial);
  back.name = "card-back-texture";
  back.position.z = -CARD_DEPTH / 2 - 0.002;
  back.rotation.y = Math.PI;
  cardGroup.add(back);

  foilMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdce9ff,
    metalness: 0.14,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 0.48,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [110, 520],
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const foil = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH - 0.04, CARD_HEIGHT - 0.04), foilMaterial);
  foil.name = "card-foil-optical-layer";
  foil.position.z = CARD_DEPTH / 2 + 0.006;
  foil.renderOrder = 8;
  cardGroup.add(foil);
}

function createCardMaterial(texture) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: texture,
    side: THREE.FrontSide
  });
}

function rebuildShell(data) {
  if (shellGroup) {
    rootGroup.remove(shellGroup);
    disposeObject(shellGroup);
  }

  shellPickables = [];
  labelMaterial = null;
  shellGroup = new THREE.Group();
  shellGroup.name = `slab-${data.slabType}`;
  rootGroup.add(shellGroup);
  currentSlabType = data.slabType;

  const config = SLAB_CONFIGS[data.slabType] || SLAB_CONFIGS.acrylic;
  const hasShell = config.depth > 0;
  cardGroup.position.y = hasShell && config.height > 4.8 ? -0.18 : 0;
  status.textContent = hasShell ? `${data.slabType.toUpperCase()} / PBR` : "RAW CARD / PBR";
  if (!hasShell) return;

  const plateDepth = Math.min(0.085, config.depth * 0.25);
  const frontZ = config.depth / 2 - plateDepth / 2;
  const frontPlateMaterial = createShellMaterial(config, false, THREE.FrontSide);
  const rearPlateMaterial = createShellMaterial(config, false, THREE.BackSide);
  const edgeMaterial = createShellMaterial(config, true);

  const plateGeometry = new RoundedBoxGeometry(config.width, config.height, plateDepth, 8, 0.115);
  const frontPlate = new THREE.Mesh(plateGeometry, frontPlateMaterial);
  frontPlate.name = "front-acrylic-plate";
  frontPlate.position.z = frontZ;
  frontPlate.castShadow = true;
  frontPlate.renderOrder = 6;
  shellGroup.add(frontPlate);

  const backPlate = new THREE.Mesh(plateGeometry.clone(), rearPlateMaterial);
  backPlate.name = "rear-acrylic-plate";
  backPlate.position.z = -frontZ;
  backPlate.castShadow = true;
  backPlate.renderOrder = 1;
  shellGroup.add(backPlate);

  const railWidth = 0.18;
  const railDepth = Math.max(0.1, config.depth - 0.025);
  const railRadius = Math.min(0.065, railDepth * 0.25);
  const verticalGeometry = new RoundedBoxGeometry(railWidth, config.height - 0.16, railDepth, 5, railRadius);
  const horizontalGeometry = new RoundedBoxGeometry(config.width - 0.18, railWidth, railDepth, 5, railRadius);
  addShellPart("left-perimeter-rail", verticalGeometry, edgeMaterial, -config.width / 2 + railWidth / 2, 0, 0);
  addShellPart("right-perimeter-rail", verticalGeometry.clone(), edgeMaterial, config.width / 2 - railWidth / 2, 0, 0);
  addShellPart("top-perimeter-rail", horizontalGeometry, edgeMaterial, 0, config.height / 2 - railWidth / 2, 0);
  addShellPart("bottom-perimeter-rail", horizontalGeometry.clone(), edgeMaterial, 0, -config.height / 2 + railWidth / 2, 0);

  createCavityFrame(config, edgeMaterial);
  createDepthSeam(config);
  if (config.magnets) createFasteners(config, frontZ, plateDepth);
  createSlabLabel(data, config, frontZ, plateDepth);
  createScratchOverlay(config, frontZ, plateDepth);

  shellPickables.push(frontPlate, backPlate);
}

function createShellMaterial(config, edge, side = THREE.DoubleSide) {
  return new THREE.MeshPhysicalMaterial({
    color: config.tint,
    metalness: 0,
    roughness: edge ? 0.16 : 0.055,
    roughnessMap: scratchRoughnessMap,
    transmission: edge ? Math.max(0.5, config.transmission - 0.2) : Math.min(0.72, config.transmission),
    thickness: edge ? Math.max(0.22, config.depth * 1.35) : Math.max(0.035, Math.min(0.11, config.depth * 0.18)),
    ior: 1.49,
    attenuationDistance: edge ? 2.2 : 9,
    attenuationColor: new THREE.Color(config.tint),
    clearcoat: edge ? 0.95 : 0.52,
    clearcoatRoughness: edge ? 0.055 : 0.045,
    specularIntensity: edge ? 0.72 : 0.2,
    envMapIntensity: edge ? 1.15 : 0.32,
    transparent: true,
    opacity: edge ? 0.66 : 0.075,
    depthWrite: false,
    side
  });
}

function addShellPart(name, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 4;
  shellGroup.add(mesh);
  shellPickables.push(mesh);
  return mesh;
}

function createCavityFrame(config, material) {
  const cavityWidth = CARD_WIDTH + 0.14;
  const cavityHeight = CARD_HEIGHT + 0.14;
  const rim = 0.045;
  const rimDepth = Math.max(0.08, config.depth * 0.48);
  const cavityMaterial = material.clone();
  cavityMaterial.color.set(0xbad5e2);
  cavityMaterial.roughness = 0.2;
  cavityMaterial.transmission = Math.max(0.48, config.transmission - 0.24);

  addShellPart("cavity-left", new RoundedBoxGeometry(rim, cavityHeight, rimDepth, 3, 0.015), cavityMaterial, -cavityWidth / 2, cardGroup.position.y, 0);
  addShellPart("cavity-right", new RoundedBoxGeometry(rim, cavityHeight, rimDepth, 3, 0.015), cavityMaterial, cavityWidth / 2, cardGroup.position.y, 0);
  addShellPart("cavity-top", new RoundedBoxGeometry(cavityWidth, rim, rimDepth, 3, 0.015), cavityMaterial, 0, cardGroup.position.y + cavityHeight / 2, 0);
  addShellPart("cavity-bottom", new RoundedBoxGeometry(cavityWidth, rim, rimDepth, 3, 0.015), cavityMaterial, 0, cardGroup.position.y - cavityHeight / 2, 0);
}

function createDepthSeam(config) {
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: config.tint,
    roughness: 0.28,
    metalness: 0.02,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  });
  const seamDepth = 0.012;
  addShellPart("left-plate-seam", new THREE.BoxGeometry(0.018, config.height - 0.24, seamDepth), seamMaterial, -config.width / 2 + 0.03, 0, 0);
  addShellPart("right-plate-seam", new THREE.BoxGeometry(0.018, config.height - 0.24, seamDepth), seamMaterial, config.width / 2 - 0.03, 0, 0);
  addShellPart("top-plate-seam", new THREE.BoxGeometry(config.width - 0.24, 0.018, seamDepth), seamMaterial, 0, config.height / 2 - 0.03, 0);
  addShellPart("bottom-plate-seam", new THREE.BoxGeometry(config.width - 0.24, 0.018, seamDepth), seamMaterial, 0, -config.height / 2 + 0.03, 0);
}

function createFasteners(config, frontZ, plateDepth) {
  const ringMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeaf7fc,
    metalness: 0.05,
    roughness: 0.12,
    transmission: 0.78,
    thickness: 0.16,
    ior: 1.49,
    clearcoat: 1,
    envMapIntensity: 2.4
  });
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x9fb8c5, roughness: 0.22, metalness: 0.42 });
  const x = config.width / 2 - 0.19;
  const y = config.height / 2 - 0.19;

  for (const [px, py] of [[-x, -y], [x, -y], [-x, y], [x, y]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.015, 12, 36), ringMaterial);
    ring.name = "acrylic-fastener-ring";
    ring.position.set(px, py, frontZ + plateDepth / 2 + 0.008);
    ring.renderOrder = 9;
    shellGroup.add(ring);
    shellPickables.push(ring);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.024, 28), coreMaterial);
    core.name = "fastener-core";
    core.rotation.x = Math.PI / 2;
    core.position.set(px, py, frontZ + plateDepth / 2 + 0.004);
    shellGroup.add(core);
    shellPickables.push(core);
  }
}

function createSlabLabel(data, config, frontZ, plateDepth) {
  if (config.height < 4.8) return;
  const texture = createLabelTexture(data);
  labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(config.width - 0.48, 0.3), labelMaterial);
  label.name = "encapsulated-grade-label";
  label.position.set(0, config.height / 2 - 0.34, frontZ - plateDepth / 2 - 0.012);
  label.renderOrder = 5;
  shellGroup.add(label);
}

function createScratchOverlay(config, frontZ, plateDepth) {
  const material = new THREE.MeshBasicMaterial({
    map: scratchHighlightMap,
    transparent: true,
    opacity: dataAcrylicScratchOpacity(config),
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(config.width - 0.12, config.height - 0.12), material);
  overlay.name = "front-surface-micro-scratches";
  overlay.position.z = frontZ + plateDepth / 2 + 0.004;
  overlay.renderOrder = 10;
  shellGroup.add(overlay);
}

function dataAcrylicScratchOpacity(config) {
  return config.depth >= 0.4 ? 0.055 : 0.04;
}

function applyState(data) {
  if (!data) return;
  currentState = data;
  if (data.slabType !== currentSlabType) rebuildShell(data);
  else updateLabelTexture(data);

  cardGroup.scale.z = data.cardThickness === false ? 0.28 : 1;
  cardBodyMaterial.color.set(cardEdgeColor(data.rarity));
  updateFoilMaterial(data);
  scheduleTextureRefresh();
}

function updateLabelTexture(data) {
  if (!labelMaterial) return;
  const previous = labelMaterial.map;
  labelMaterial.map = createLabelTexture(data);
  labelMaterial.needsUpdate = true;
  previous?.dispose();
}

function updateFoilMaterial(data) {
  const effectStrength = Math.max(0, Math.min(1, Number(data.effectIntensity || 0) / 100));
  const effectOpacity = data.effect === "none" ? 0.02 : 0.038 + effectStrength * 0.045;
  foilMaterial.opacity = effectOpacity;
  foilMaterial.iridescence = data.effect === "rainbow" ? 1 : data.effect === "none" ? 0.18 : 0.58;
  foilMaterial.metalness = data.rarity === "gold" ? 0.34 : data.rarity === "silver" ? 0.26 : 0.12;
  foilMaterial.color.set(data.rarity === "gold" ? 0xffd66f : data.effect === "lightning" ? 0xb9d9ff : 0xe6ecff);
  foilMaterial.needsUpdate = true;
}

function cardEdgeColor(rarity) {
  if (rarity === "gold") return 0xd6b85a;
  if (rarity === "black") return 0x181713;
  if (rarity === "silver") return 0xd8d9de;
  if (rarity === "neon") return 0x39ff14;
  return 0xe8e8ec;
}

function captureCanvas(width, height) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportRenderer = new THREE.WebGLRenderer({
    canvas: exportCanvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });
  exportRenderer.setSize(width, height, false);
  exportRenderer.setPixelRatio(1);
  exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
  exportRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  exportRenderer.toneMappingExposure = renderer.toneMappingExposure;
  exportRenderer.shadowMap.enabled = true;
  exportRenderer.shadowMap.type = THREE.PCFShadowMap;
  exportRenderer.setClearColor(0x0a0a0f, 1);
  const exportCamera = camera.clone();
  exportCamera.aspect = width / height;
  exportCamera.updateProjectionMatrix();
  exportRenderer.render(scene, exportCamera);
  exportRenderer.dispose();
  return exportCanvas;
}

function scheduleTextureRefresh() {
  clearTimeout(textureRefreshTimer);
  textureRefreshTimer = window.setTimeout(refreshCardTextures, 90);
}

function getCardTextureSize() {
  // Match the source texture to the actual preview density so uploaded photos
  // stay crisp on Retina displays without allocating an unbounded canvas.
  const previewWidth = Math.max(host?.clientWidth || 0, 520);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = THREE.MathUtils.clamp(Math.round(previewWidth * pixelRatio * 1.45), 1080, 1800);
  return { width, height: Math.round(width * (CARD_HEIGHT / CARD_WIDTH)) };
}

async function refreshCardTextures() {
  const revision = ++textureRevision;
  try {
    const textureSize = getCardTextureSize();
    const [frontCanvas, backCanvas] = await Promise.all([
      bridge.renderCardCanvas("front", textureSize.width, textureSize.height),
      bridge.renderCardCanvas("back", textureSize.width, textureSize.height)
    ]);
    if (revision !== textureRevision) return;
    replaceCardTexture(frontMaterial, frontCanvas);
    replaceCardTexture(backMaterial, backCanvas);
  } catch (error) {
    console.error("Unable to update Three.js card textures", error);
  }
}

function replaceCardTexture(material, sourceCanvas) {
  const previous = material.map;
  const texture = new THREE.CanvasTexture(sourceCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  material.map = texture;
  material.needsUpdate = true;
  previous?.dispose();
}

function applyExternalView(view) {
  if (!controls || !view) return;
  if (orbitInputActive || performance.now() < ignoreExternalViewUntil) return;
  const scale = THREE.MathUtils.clamp(Number(view.viewScale) || 1, 0.6, 1.6);
  const rotX = THREE.MathUtils.clamp(Number(view.rotX) || 0, -85, 85);
  const rotY = Number(view.rotY) || 0;
  const spherical = new THREE.Spherical(
    BASE_CAMERA_RADIUS / scale,
    THREE.MathUtils.degToRad(90 - rotX),
    THREE.MathUtils.degToRad(rotY)
  );
  suppressControlSyncUntil = performance.now() + 90;
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  camera.lookAt(controls.target);
  controls.update();
}

function scheduleControlSync() {
  if (performance.now() < suppressControlSyncUntil) return;
  clearTimeout(controlSyncTimer);
  controlSyncTimer = window.setTimeout(syncViewToApp, 55);
}

function syncViewToApp() {
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  ignoreExternalViewUntil = performance.now() + 140;
  bridge.setView({
    rotX: THREE.MathUtils.clamp(90 - THREE.MathUtils.radToDeg(spherical.phi), -85, 85),
    rotY: THREE.MathUtils.radToDeg(spherical.theta),
    viewScale: THREE.MathUtils.clamp(BASE_CAMERA_RADIUS / spherical.radius, 0.6, 1.6),
    motionOn: false
  });
}

function bindInteraction() {
  for (const type of ["pointerdown", "wheel", "dblclick"]) {
    canvas.addEventListener(type, (event) => event.stopPropagation());
  }

  canvas.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance < 4) selectShellPart(event);
  });
  canvas.addEventListener("dblclick", () => bridge.flip());
}

function selectShellPart(event) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(shellPickables, false)[0];
  if (!hit?.object?.material?.emissive) return;

  clearTimeout(selectedRestoreTimer);
  if (selectedMaterial) {
    selectedMaterial.emissive.setHex(selectedMaterial.userData.previousEmissive || 0x000000);
    selectedMaterial.emissiveIntensity = selectedMaterial.userData.previousEmissiveIntensity || 1;
  }
  selectedMaterial = hit.object.material;
  selectedMaterial.userData.previousEmissive = selectedMaterial.emissive.getHex();
  selectedMaterial.userData.previousEmissiveIntensity = selectedMaterial.emissiveIntensity;
  selectedMaterial.emissive.setHex(0x78d8ff);
  selectedMaterial.emissiveIntensity = 0.22;
  selectedRestoreTimer = window.setTimeout(() => {
    selectedMaterial?.emissive.setHex(selectedMaterial.userData.previousEmissive || 0x000000);
    if (selectedMaterial) selectedMaterial.emissiveIntensity = selectedMaterial.userData.previousEmissiveIntensity || 1;
    selectedMaterial = null;
  }, 260);
}

function renderFrame(time) {
  controls.update();
  const shimmer = 0.5 + Math.sin(time * 0.0007) * 0.5;
  foilMaterial.clearcoatRoughness = 0.07 + shimmer * 0.05;
  renderer.render(scene, camera);
}

function resizeRenderer() {
  if (!renderer || !host) return;
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function createScratchTexture(highlight) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 1024;
  textureCanvas.height = 1024;
  const context = textureCanvas.getContext("2d");
  const random = mulberry32(highlight ? 9863 : 4217);

  if (highlight) {
    context.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  } else {
    context.fillStyle = "rgb(58,58,58)";
    context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  }

  for (let index = 0; index < 84; index += 1) {
    const x = random() * 1024;
    const y = random() * 1024;
    const length = 18 + random() * 145;
    const angle = -0.82 + random() * 1.64;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.lineWidth = 0.35 + random() * 1.05;
    if (highlight) context.strokeStyle = `rgba(235,250,255,${0.035 + random() * 0.085})`;
    else context.strokeStyle = `rgb(${130 + Math.floor(random() * 86)},${130 + Math.floor(random() * 86)},${130 + Math.floor(random() * 86)})`;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createPlaceholderTexture(label) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 600;
  textureCanvas.height = 840;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 600, 840);
  gradient.addColorStop(0, "#392866");
  gradient.addColorStop(0.5, "#14141e");
  gradient.addColorStop(1, "#b68b36");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 600, 840);
  context.strokeStyle = "rgba(255,255,255,.6)";
  context.lineWidth = 3;
  context.strokeRect(28, 28, 544, 784);
  context.fillStyle = "#fff";
  context.font = "700 54px sans-serif";
  context.textAlign = "center";
  context.fillText(label, 300, 438);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLabelTexture(data) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 1024;
  textureCanvas.height = 160;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "rgba(10,15,20,.88)";
  context.fillRect(0, 0, 1024, 160);
  context.strokeStyle = "rgba(195,235,250,.55)";
  context.lineWidth = 4;
  context.strokeRect(3, 3, 1018, 154);
  context.fillStyle = "#dcebf2";
  context.font = "700 30px ui-monospace, monospace";
  context.fillText("CARD BUILDER // ACRYLIC", 34, 58);
  context.fillStyle = "#91a7b2";
  context.font = "600 23px ui-monospace, monospace";
  context.fillText(String(data.name || "CUSTOM CARD").slice(0, 34), 34, 112);
  context.textAlign = "right";
  context.fillStyle = "#ffffff";
  context.font = "800 60px ui-monospace, monospace";
  context.fillText(String(data.gradeValue || "10"), 972, 106);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
}
