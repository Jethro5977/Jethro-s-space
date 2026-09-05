import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import {
  CARD_DIMENSIONS,
  HOLO_EFFECT_MODES,
  SLAB_CONFIGS,
  cardEdgeColor,
  normalizeRendererState
} from "./config.js";
import { holoVertexShader, holoFragmentShader, HOLO_UNIFORMS_DEFAULTS } from "./shaders.js";
import { advanceSpring, advancePointerSpring } from "./spring.js";
import {
  createScratchCanvas,
  createPlaceholderCanvas,
  createLabelCanvas,
  getCardTextureSize
} from "./textures.js";

const { width: CARD_WIDTH, height: CARD_HEIGHT, depth: CARD_DEPTH, baseCameraRadius: BASE_CAMERA_RADIUS } = CARD_DIMENSIONS;

// Re-export public API from submodules.
export { CARD_DIMENSIONS, HOLO_EFFECT_MODES, SLAB_CONFIGS, cardEdgeColor, normalizeRendererState } from "./config.js";
export { advanceSpring, advancePointerSpring } from "./spring.js";
export { holoVertexShader, holoFragmentShader, HOLO_UNIFORMS_DEFAULTS } from "./shaders.js";
export { createDefaultBridge, fromImage } from "./bridge.js";
export {
  mulberry32,
  createScratchCanvas,
  createPlaceholderCanvas,
  createLabelCanvas,
  getCardTextureSize
} from "./textures.js";

// ---------------------------------------------------------------------------
// Hover-tilt configuration
// ---------------------------------------------------------------------------
// Interaction reference: https://github.com/simeydotme/hover-tilt
// Values mirror the public component's 10-degree pointer mapping, hover
// scale, delayed exit, and softer return spring.  The motion is implemented
// natively in Three.js so the acrylic shell, foil, glare, and real PBR
// shadow react as one object without bundling the Svelte component.

/** @internal Exported for tests only. */
export const HOVER_TILT_CONFIG = Object.freeze({
  rotation: THREE.MathUtils.degToRad(10),
  scale: 1.035,
  exitDelay: 200,
  enterSpring: Object.freeze({ stiffness: 210, damping: 24 }),
  exitSpring: Object.freeze({ stiffness: 54, damping: 11 }),
  activationSpring: Object.freeze({ stiffness: 170, damping: 21 }),
  deactivationSpring: Object.freeze({ stiffness: 46, damping: 10 })
});

// ---------------------------------------------------------------------------
// Rarity → holo tint lookup
// ---------------------------------------------------------------------------
const RARITY_TINT = Object.freeze({
  base: 0xd9f5ff,
  silver: 0xc8f2ff,
  gold: 0xffd45f,
  neon: 0x5dff8c,
  rwb: 0xaec8ff,
  black: 0xe6c76d
});

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

/**
 * Create an isolated Card Builder WebGL renderer.
 *
 * The renderer owns only its supplied canvas and host. Product state, card
 * texture rendering and view persistence remain responsibilities of `bridge`.
 */
export function createCardRenderer({
  host,
  canvas,
  status = null,
  bridge,
  runtime = globalThis,
  eventTarget = runtime,
  documentTarget = runtime.document,
  autoListen = true
} = {}) {
  if (!host || !canvas) throw new TypeError("createCardRenderer requires host and canvas elements");
  validateBridge(bridge);
  if (!documentTarget?.createElement) throw new TypeError("createCardRenderer requires a documentTarget with createElement()");

  // -- helpers bound to the runtime --
  let destroyed = false;
  let resizeObserver = null;
  const interactionAbortController = new runtime.AbortController();
  const setTimer = runtime.setTimeout.bind(runtime);
  const clearTimer = runtime.clearTimeout.bind(runtime);
  const now = () => runtime.performance?.now?.() ?? Date.now();
  const handleStateEvent = (event) => applyState(event.detail);
  const handleViewEvent = (event) => applyExternalView(event.detail);

  /** Shorthand canvas factory wired to the injected document. */
  const makeCanvas = (w, h) => {
    const c = documentTarget.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  const CARD_RENDERER_STATUS = Object.freeze({
    loading: "LOADING 3D",
    ready: "ACRYLIC / PBR",
    unavailable: "WEBGL UNAVAILABLE"
  });

  // -- scene graph references --
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
  let orbitEndTimer = 0;
  let pointerStart = null;
  let shellPickables = [];
  let selectedMaterial = null;
  let selectedRestoreTimer = 0;
  let frontCardMesh = null;
  let backCardMesh = null;
  let holoMaterial = null;
  let lastRenderTime = 0;
  let environmentTexture = null;

  // -- holo pointer state --
  const reducedMotionQuery = runtime.matchMedia?.("(prefers-reduced-motion: reduce)") || { matches: false };
  const holoRaycaster = new THREE.Raycaster();
  const holoPointerNdc = new THREE.Vector2();
  const holoPointer = new THREE.Vector2(0.5, 0.5);
  const holoPointerTarget = new THREE.Vector2(0.5, 0.5);
  const holoPointerVelocity = new THREE.Vector2();
  let holoHover = 0;
  let holoHoverTarget = 0;
  let holoHoverVelocity = 0;
  let holoRaycastPending = false;
  let holoExitAt = 0;

  // -- procedural textures (generated once) --
  const scratchRoughnessMap = toThreeTexture(createScratchCanvas(false, makeCanvas), true);
  const scratchHighlightMap = toThreeTexture(createScratchCanvas(true, makeCanvas), true);

  // -- public API --
  const api = Object.freeze({
    get ready() { return Boolean(renderer) && !destroyed; },
    captureCanvas,
    destroy,
    getHoverTiltState,
    rebuild: () => !destroyed && cardGroup && currentState && rebuildShell(currentState),
    resize: resizeRenderer,
    setState: applyState,
    setView: (view) => applyExternalView(view, true)
  });

  setStatus(CARD_RENDERER_STATUS.loading);
  init();
  return api;

  // =========================================================================
  // Initialisation
  // =========================================================================

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
      setStatus(CARD_RENDERER_STATUS.unavailable);
      host.classList.add("is-unavailable");
      return;
    }

    renderer.setPixelRatio(Math.min(runtime.devicePixelRatio || 1, 2));
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
    environmentTexture = pmrem.fromScene(room, 0.04).texture;
    scene.environment = environmentTexture;
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
      clearTimer(orbitEndTimer);
      orbitInputActive = true;
      resetHoloHover(true);
      suppressControlSyncUntil = 0;
      bridge.setView({ motionOn: false });
      if (currentState) currentState.motionOn = false;
    });
    controls.addEventListener("end", () => {
      syncViewToApp();
      orbitEndTimer = setTimer(() => {
        orbitInputActive = false;
        syncViewToApp();
      }, 160);
    });
    controls.addEventListener("change", scheduleControlSync);

    bindInteraction();
    if (runtime.ResizeObserver) {
      resizeObserver = new runtime.ResizeObserver(resizeRenderer);
      resizeObserver.observe(host);
    }
    setStatus(CARD_RENDERER_STATUS.ready);

    if (autoListen) {
      eventTarget.addEventListener("cardbuilder:state", handleStateEvent);
      eventTarget.addEventListener("cardbuilder:view", handleViewEvent);
    }

    const initialState = bridge.getState();
    applyState(initialState);
    applyExternalView(initialState.view);
    resizeRenderer();
    renderer.setAnimationLoop(renderFrame);
  }

  // =========================================================================
  // Lighting & ground
  // =========================================================================

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

  // =========================================================================
  // Card mesh construction
  // =========================================================================

  function createCard() {
    cardGroup = new THREE.Group();
    cardGroup.name = "card-insert";
    rootGroup.add(cardGroup);

    const placeholderFront = toCardTexture(createPlaceholderCanvas("FRONT", makeCanvas));
    const placeholderBack = toCardTexture(createPlaceholderCanvas("BACK", makeCanvas));

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
    frontCardMesh = front;
    cardGroup.add(front);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH - 0.025, CARD_HEIGHT - 0.025), backMaterial);
    back.name = "card-back-texture";
    back.position.z = -CARD_DEPTH / 2 - 0.002;
    back.rotation.y = Math.PI;
    backCardMesh = back;
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

    holoMaterial = createHoloMaterial();
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH - 0.035, CARD_HEIGHT - 0.035), holoMaterial);
    holo.name = "card-pointer-holo-layer";
    holo.position.z = CARD_DEPTH / 2 + 0.009;
    holo.renderOrder = 9;
    cardGroup.add(holo);
  }

  function createCardMaterial(texture) {
    return new THREE.MeshBasicMaterial({ color: 0xffffff, map: texture, side: THREE.FrontSide });
  }

  function createHoloMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPointer: { value: new THREE.Vector2(...HOLO_UNIFORMS_DEFAULTS.uPointer) },
        uHover: { value: HOLO_UNIFORMS_DEFAULTS.uHover },
        uTime: { value: HOLO_UNIFORMS_DEFAULTS.uTime },
        uStrength: { value: HOLO_UNIFORMS_DEFAULTS.uStrength },
        uMode: { value: HOLO_UNIFORMS_DEFAULTS.uMode },
        uOpacity: { value: HOLO_UNIFORMS_DEFAULTS.uOpacity },
        uTint: { value: new THREE.Color(HOLO_UNIFORMS_DEFAULTS.uTint) }
      },
      vertexShader: holoVertexShader,
      fragmentShader: holoFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
  }

  // =========================================================================
  // Slab shell
  // =========================================================================

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
    setStatus(hasShell ? `${data.slabType.toUpperCase()} / PBR` : "RAW CARD / PBR");
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
    const texture = toCardTexture(createLabelCanvas(data, makeCanvas));
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
      opacity: config.depth >= 0.4 ? 0.055 : 0.04,
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

  // =========================================================================
  // State & view
  // =========================================================================

  function applyState(data) {
    if (destroyed || !cardGroup || !data) return;
    data = normalizeRendererState({ ...currentState, ...data });
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
    labelMaterial.map = toCardTexture(createLabelCanvas(data, makeCanvas));
    labelMaterial.needsUpdate = true;
    previous?.dispose();
  }

  function updateFoilMaterial(data) {
    const effectStrength = Math.max(0, Math.min(1, Number(data.effectIntensity || 0) / 100));
    const effectOpacity = data.effect === "none" ? 0.02 : 0.038 + effectStrength * 0.045;
    foilMaterial.opacity = effectOpacity;
    foilMaterial.iridescence = data.effect === "rainbow" || data.effect === "holographic" ? 1 : data.effect === "laser" ? 0.82 : data.effect === "none" ? 0.18 : 0.58;
    foilMaterial.metalness = data.rarity === "gold" ? 0.34 : data.rarity === "silver" ? 0.26 : 0.12;
    foilMaterial.color.set(data.rarity === "gold" ? 0xffd66f : data.effect === "lightning" ? 0xb9d9ff : 0xe6ecff);
    foilMaterial.needsUpdate = true;
    updateHoloMaterial(data, effectStrength);
  }

  function updateHoloMaterial(data, effectStrength) {
    if (!holoMaterial) return;
    holoMaterial.uniforms.uMode.value = HOLO_EFFECT_MODES[data.effect] ?? 0;
    holoMaterial.uniforms.uStrength.value = data.effect === "none" ? 0.18 : 0.34 + effectStrength * 0.66;
    holoMaterial.uniforms.uOpacity.value = data.effect === "none" ? 0.34 : 0.48 + effectStrength * 0.34;
    holoMaterial.uniforms.uTint.value.setHex(RARITY_TINT[data.rarity] || RARITY_TINT.base);
  }

  // =========================================================================
  // Texture refresh
  // =========================================================================

  function scheduleTextureRefresh() {
    // Invalidate an in-flight render immediately, not only after the debounce.
    textureRevision += 1;
    clearTimer(textureRefreshTimer);
    textureRefreshTimer = setTimer(refreshCardTextures, 90);
  }

  async function refreshCardTextures() {
    if (destroyed) return;
    const revision = ++textureRevision;
    try {
      const textureSize = getCardTextureSize(host?.clientWidth, runtime.devicePixelRatio);
      const [frontCanvas, backCanvas] = await Promise.all([
        bridge.renderCardCanvas("front", textureSize.width, textureSize.height),
        bridge.renderCardCanvas("back", textureSize.width, textureSize.height)
      ]);
      if (destroyed || revision !== textureRevision) return;
      replaceCardTexture(frontMaterial, frontCanvas);
      replaceCardTexture(backMaterial, backCanvas);
    } catch (error) {
      if (!destroyed) console.error("Unable to update Three.js card textures", error);
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

  // =========================================================================
  // Camera / view sync
  // =========================================================================

  function applyExternalView(view, force = false) {
    if (destroyed || !controls || !view) return;
    if (!force && (orbitInputActive || now() < ignoreExternalViewUntil)) return;
    if (currentState && typeof view.motionOn === "boolean") currentState.motionOn = view.motionOn;
    const currentView = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const scale = THREE.MathUtils.clamp(finiteOr(view.viewScale, BASE_CAMERA_RADIUS / currentView.radius), 0.6, 1.6);
    const rotX = THREE.MathUtils.clamp(finiteOr(view.rotX, 90 - THREE.MathUtils.radToDeg(currentView.phi)), -85, 85);
    const rotY = finiteOr(view.rotY, THREE.MathUtils.radToDeg(currentView.theta));
    const spherical = new THREE.Spherical(
      BASE_CAMERA_RADIUS / scale,
      THREE.MathUtils.degToRad(90 - rotX),
      THREE.MathUtils.degToRad(rotY)
    );
    suppressControlSyncUntil = now() + 90;
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    camera.lookAt(controls.target);
    controls.update();
  }

  function scheduleControlSync() {
    if (destroyed || now() < suppressControlSyncUntil) return;
    clearTimer(controlSyncTimer);
    controlSyncTimer = setTimer(syncViewToApp, 55);
  }

  function syncViewToApp() {
    if (destroyed || !controls) return;
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    ignoreExternalViewUntil = now() + 140;
    bridge.setView({
      rotX: THREE.MathUtils.clamp(90 - THREE.MathUtils.radToDeg(spherical.phi), -85, 85),
      rotY: THREE.MathUtils.radToDeg(spherical.theta),
      viewScale: THREE.MathUtils.clamp(BASE_CAMERA_RADIUS / spherical.radius, 0.6, 1.6),
      motionOn: false
    });
  }

  // =========================================================================
  // Interaction (pointer, holo, tilt)
  // =========================================================================

  function bindInteraction() {
    const listenerOptions = { signal: interactionAbortController.signal };
    for (const type of ["pointerdown", "wheel", "dblclick"]) {
      canvas.addEventListener(type, (event) => event.stopPropagation(), listenerOptions);
    }

    canvas.addEventListener("pointerdown", (event) => {
      resetHoloHover(true);
      pointerStart = { x: event.clientX, y: event.clientY };
    }, listenerOptions);
    canvas.addEventListener("pointerup", (event) => {
      if (!pointerStart) return;
      const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      pointerStart = null;
      if (distance < 4) selectShellPart(event);
    }, listenerOptions);
    canvas.addEventListener("dblclick", () => {
      bridge.flip();
      applyExternalView(bridge.getState().view, true);
    }, listenerOptions);
    canvas.addEventListener("pointermove", updateHoloPointer, listenerOptions);
    canvas.addEventListener("pointerleave", () => resetHoloHover(), listenerOptions);
    canvas.addEventListener("pointercancel", () => resetHoloHover(true), listenerOptions);
  }

  function updateHoloPointer(event) {
    if (!frontCardMesh || !backCardMesh || reducedMotionQuery.matches || orbitInputActive || event.pointerType === "touch") {
      resetHoloHover(true);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    holoPointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    holoRaycastPending = true;
  }

  function resolveHoloPointer() {
    if (!holoRaycastPending) return;
    holoRaycastPending = false;
    holoRaycaster.setFromCamera(holoPointerNdc, camera);
    const hit = holoRaycaster.intersectObjects([frontCardMesh, backCardMesh], false)[0];

    if (!hit?.uv) {
      resetHoloHover();
      return;
    }
    holoPointerTarget.copy(hit.uv);
    holoHoverTarget = 1;
    holoExitAt = 0;
    canvas.classList.add("is-holo-hover");
  }

  function resetHoloHover(immediate = false) {
    holoRaycastPending = false;
    if (!immediate && !reducedMotionQuery.matches && holoHoverTarget > 0) {
      if (!holoExitAt) holoExitAt = now() + HOVER_TILT_CONFIG.exitDelay;
      return;
    }
    deactivateHoloTilt(immediate || reducedMotionQuery.matches);
  }

  function deactivateHoloTilt(immediate = false) {
    holoExitAt = 0;
    holoPointerTarget.set(0.5, 0.5);
    holoHoverTarget = 0;
    canvas.classList.remove("is-holo-hover");
    if (!immediate) return;
    holoPointer.set(0.5, 0.5);
    holoPointerVelocity.set(0, 0);
    holoHover = 0;
    holoHoverVelocity = 0;
    if (rootGroup) {
      rootGroup.rotation.set(0, 0, 0);
      rootGroup.scale.setScalar(1);
    }
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

    clearTimer(selectedRestoreTimer);
    if (selectedMaterial) {
      selectedMaterial.emissive.setHex(selectedMaterial.userData.previousEmissive || 0x000000);
      selectedMaterial.emissiveIntensity = selectedMaterial.userData.previousEmissiveIntensity || 1;
    }
    selectedMaterial = hit.object.material;
    selectedMaterial.userData.previousEmissive = selectedMaterial.emissive.getHex();
    selectedMaterial.userData.previousEmissiveIntensity = selectedMaterial.emissiveIntensity;
    selectedMaterial.emissive.setHex(0x78d8ff);
    selectedMaterial.emissiveIntensity = 0.22;
    selectedRestoreTimer = setTimer(() => {
      selectedMaterial?.emissive.setHex(selectedMaterial.userData.previousEmissive || 0x000000);
      if (selectedMaterial) selectedMaterial.emissiveIntensity = selectedMaterial.userData.previousEmissiveIntensity || 1;
      selectedMaterial = null;
    }, 260);
  }

  // =========================================================================
  // Render loop
  // =========================================================================

  function renderFrame(time) {
    if (destroyed) return;
    controls.update();
    const reducedMotion = reducedMotionQuery.matches;
    const deltaSeconds = lastRenderTime ? Math.min(0.04, (time - lastRenderTime) / 1000) : 0.016;
    lastRenderTime = time;
    resolveHoloPointer();

    if (holoExitAt && time >= holoExitAt) deactivateHoloTilt();
    if (reducedMotion) {
      deactivateHoloTilt(true);
    } else {
      const pointerSpring = holoHoverTarget > 0 ? HOVER_TILT_CONFIG.enterSpring : HOVER_TILT_CONFIG.exitSpring;
      const activationSpring = holoHoverTarget > 0 ? HOVER_TILT_CONFIG.activationSpring : HOVER_TILT_CONFIG.deactivationSpring;
      advancePointerSpring(holoPointer, holoPointerVelocity, holoPointerTarget, pointerSpring, deltaSeconds);
      const hoverStep = advanceSpring(holoHover, holoHoverVelocity, holoHoverTarget, activationSpring, deltaSeconds);
      holoHover = hoverStep.value;
      holoHoverVelocity = hoverStep.velocity;
    }

    const hoverActivation = reducedMotion ? 0 : THREE.MathUtils.clamp(holoHover, 0, 1.08);
    rootGroup.rotation.x = (0.5 - holoPointer.y) * HOVER_TILT_CONFIG.rotation * 2 * hoverActivation;
    rootGroup.rotation.y = (0.5 - holoPointer.x) * HOVER_TILT_CONFIG.rotation * 2 * hoverActivation;
    rootGroup.scale.setScalar(1 + (HOVER_TILT_CONFIG.scale - 1) * hoverActivation);

    const shimmer = reducedMotion ? 0.5 : 0.5 + Math.sin(time * 0.0007) * 0.5;
    foilMaterial.clearcoatRoughness = 0.07 + shimmer * 0.05;
    if (holoMaterial) {
      const idleEnergy = reducedMotion ? 0 : currentState?.motionOn ? 0.16 : 0.055;
      holoMaterial.uniforms.uPointer.value.copy(holoPointer);
      holoMaterial.uniforms.uHover.value = Math.max(THREE.MathUtils.clamp(holoHover, 0, 1), idleEnergy);
      holoMaterial.uniforms.uTime.value = reducedMotion ? 0 : time * 0.001;
    }
    renderer.render(scene, camera);
  }

  // =========================================================================
  // Capture & resize
  // =========================================================================

  function captureCanvas(width, height) {
    if (!renderer || destroyed) throw new Error("Renderer is not ready");
    const safeWidth = THREE.MathUtils.clamp(Math.round(Number(width) || 1), 1, 8192);
    const safeHeight = THREE.MathUtils.clamp(Math.round(Number(height) || 1), 1, 8192);
    const exportCanvas = documentTarget.createElement("canvas");
    exportCanvas.width = safeWidth;
    exportCanvas.height = safeHeight;
    const context = exportCanvas.getContext("2d");
    if (!context) throw new Error("Unable to create an export canvas");
    // Keep PMREM render-target textures in their owning WebGL context. A new
    // renderer cannot share those GPU resources and leaks contexts on repeated exports.
    const previousSize = renderer.getSize(new THREE.Vector2());
    const previousPixelRatio = renderer.getPixelRatio();
    const previousColor = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    const exportCamera = camera.clone();
    exportCamera.aspect = safeWidth / safeHeight;
    exportCamera.updateProjectionMatrix();
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(safeWidth, safeHeight, false);
      renderer.setClearColor(0x0a0a0f, 1);
      renderer.render(scene, exportCamera);
      context.drawImage(canvas, 0, 0);
    } finally {
      renderer.setPixelRatio(previousPixelRatio);
      renderer.setSize(previousSize.x, previousSize.y, false);
      renderer.setClearColor(previousColor, previousAlpha);
      renderer.render(scene, camera);
    }
    return exportCanvas;
  }

  function resizeRenderer() {
    if (destroyed || !renderer || !camera || !host) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function getHoverTiltState() {
    return {
      active: holoHover > 0.01,
      targetActive: holoHoverTarget > 0,
      pointer: { x: holoPointer.x, y: holoPointer.y },
      rotation: { x: rootGroup?.rotation.x || 0, y: rootGroup?.rotation.y || 0 },
      scale: rootGroup?.scale.x || 1
    };
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    textureRevision += 1;
    clearTimer(textureRefreshTimer);
    clearTimer(controlSyncTimer);
    clearTimer(orbitEndTimer);
    clearTimer(selectedRestoreTimer);
    interactionAbortController.abort();
    resizeObserver?.disconnect();
    if (autoListen) {
      eventTarget.removeEventListener("cardbuilder:state", handleStateEvent);
      eventTarget.removeEventListener("cardbuilder:view", handleViewEvent);
    }
    renderer?.setAnimationLoop(null);
    controls?.dispose();
    if (scene) disposeObject(scene);
    environmentTexture?.dispose();
    scratchRoughnessMap.dispose();
    scratchHighlightMap.dispose();
    renderer?.dispose();
    canvas.classList.remove("is-holo-hover");
  }

  // =========================================================================
  // Internal helpers
  // =========================================================================

  /** Wrap a raw canvas in a THREE.CanvasTexture with sRGB + repeat. */
  function toThreeTexture(sourceCanvas, repeat = false) {
    const texture = new THREE.CanvasTexture(sourceCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  /** Wrap a raw canvas in a THREE.CanvasTexture with sRGB (no repeat). */
  function toCardTexture(sourceCanvas) {
    const texture = new THREE.CanvasTexture(sourceCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else if (child.material) disposeMaterial(child.material);
    });
  }

  function disposeMaterial(material) {
    for (const key of ["map", "roughnessMap", "metalnessMap", "normalMap", "alphaMap", "emissiveMap"]) {
      material[key]?.dispose?.();
    }
    material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function validateBridge(bridge) {
  const requiredMethods = ["getState", "setView", "flip", "renderCardCanvas"];
  if (!bridge || requiredMethods.some((method) => typeof bridge[method] !== "function")) {
    throw new TypeError(`createCardRenderer requires bridge methods: ${requiredMethods.join(", ")}`);
  }
}
