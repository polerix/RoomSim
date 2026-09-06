import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Application State
const state = {
  viewMode: 'inside', // Default to Inside Room
  cubeSize: 10,
  frontFaceOpacity: 0.0,
  autoRotateSpeedX: 0.0,
  autoRotateSpeedY: 0.8,
  autoRotateSpeedZ: 0.0,
  manualRotateX: 0,
  manualRotateY: 0,
  manualRotateZ: 0,
  lensDistortion: 0, // -50 to +50 (Negative: Pincushion, Positive: Fisheye/Barrel)
  showAxes: false,
  showGrid: false,
  
  // X Wall Texture Settings (Left/Right)
  xWall: {
    bgColor: '#0e0f19',
    lineColor: '#ec4899',
    spacingMode: 'count',
    lineCount: 12,
    lineSpacing: 40,
    lineWidth: 4,
    orientation: 'horizontal',
    lineStyle: 'solid'
  },
  
  // Y Wall Texture Settings (Top/Bottom)
  yWall: {
    bgColor: '#080b11',
    lineColor: '#3b82f6',
    spacingMode: 'count',
    lineCount: 12,
    lineSpacing: 40,
    lineWidth: 4,
    orientation: 'diagonal',
    lineStyle: 'solid'
  },
  
  // Z Wall Texture Settings (Back/Front)
  zWall: {
    bgColor: '#0c101b',
    lineColor: '#10b981',
    spacingMode: 'count',
    lineCount: 12,
    lineSpacing: 40,
    lineWidth: 4,
    orientation: 'horizontal',
    lineStyle: 'solid'
  }
};

// Preset Styles Definition
const PRESETS = {
  'neon-lounge': {
    viewMode: 'inside',
    cubeSize: 10,
    frontFaceOpacity: 0.0,
    autoRotateSpeedX: 0.0,
    autoRotateSpeedY: 0.8,
    autoRotateSpeedZ: 0.0,
    lensDistortion: 0,
    showAxes: false,
    showGrid: false,
    xWall: { bgColor: '#0e0f19', lineColor: '#ec4899', spacingMode: 'count', lineCount: 12, lineWidth: 4, orientation: 'horizontal', lineStyle: 'solid' },
    yWall: { bgColor: '#080b11', lineColor: '#3b82f6', spacingMode: 'count', lineCount: 12, lineWidth: 4, orientation: 'diagonal', lineStyle: 'solid' },
    zWall: { bgColor: '#0c101b', lineColor: '#10b981', spacingMode: 'count', lineCount: 12, lineWidth: 4, orientation: 'horizontal', lineStyle: 'solid' }
  },
  'cyber-grid': {
    viewMode: 'inside',
    cubeSize: 12,
    frontFaceOpacity: 0.1,
    autoRotateSpeedX: 0.0,
    autoRotateSpeedY: 1.2,
    autoRotateSpeedZ: 0.0,
    lensDistortion: 0,
    showAxes: false,
    showGrid: true,
    xWall: { bgColor: '#05050a', lineColor: '#06b6d4', spacingMode: 'count', lineCount: 24, lineWidth: 2, orientation: 'vertical', lineStyle: 'solid' },
    yWall: { bgColor: '#05050a', lineColor: '#06b6d4', spacingMode: 'count', lineCount: 24, lineWidth: 2, orientation: 'diagonal', lineStyle: 'solid' },
    zWall: { bgColor: '#05050a', lineColor: '#06b6d4', spacingMode: 'count', lineCount: 24, lineWidth: 2, orientation: 'horizontal', lineStyle: 'solid' }
  },
  'mono-tech': {
    viewMode: 'inside',
    cubeSize: 8,
    frontFaceOpacity: 0.05,
    autoRotateSpeedX: 0.0,
    autoRotateSpeedY: 0.4,
    autoRotateSpeedZ: 0.0,
    lensDistortion: 0,
    showAxes: true,
    showGrid: false,
    xWall: { bgColor: '#1c1d24', lineColor: '#ffffff', spacingMode: 'density', lineSpacing: 25, lineWidth: 1, orientation: 'vertical', lineStyle: 'solid' },
    yWall: { bgColor: '#15161c', lineColor: '#ffffff', spacingMode: 'density', lineSpacing: 25, lineWidth: 1, orientation: 'diagonal', lineStyle: 'solid' },
    zWall: { bgColor: '#1c1d24', lineColor: '#ffffff', spacingMode: 'density', lineSpacing: 25, lineWidth: 1, orientation: 'horizontal', lineStyle: 'solid' }
  },
  'warm-stripes': {
    viewMode: 'inside',
    cubeSize: 10,
    frontFaceOpacity: 0.0,
    autoRotateSpeedX: 0.0,
    autoRotateSpeedY: 0.6,
    autoRotateSpeedZ: 0.0,
    lensDistortion: 0,
    showAxes: false,
    showGrid: false,
    xWall: { bgColor: '#2d1710', lineColor: '#f59e0b', spacingMode: 'count', lineCount: 8, lineWidth: 8, orientation: 'vertical', lineStyle: 'solid' },
    yWall: { bgColor: '#1a0d0a', lineColor: '#f59e0b', spacingMode: 'count', lineCount: 10, lineWidth: 6, orientation: 'diagonal', lineStyle: 'solid' },
    zWall: { bgColor: '#2d1710', lineColor: '#f59e0b', spacingMode: 'count', lineCount: 8, lineWidth: 8, orientation: 'horizontal', lineStyle: 'solid' }
  }
};

// Global WebGL Context Variables
let scene, camera, renderer, controls;
let cubeMesh, cubeGeometry, cubeMaterials = [];
let axesHelper, gridHelper;
let canvasTextures = { x: null, y: null, z: null };

// Camera Smooth Transition Variables
let targetCameraPos = null;
let targetLookAt = new THREE.Vector3(0, 0, 0);
let isTransitioning = false;

// Auto-rotation accumulators
let autoRotateX = 0;
let autoRotateY = 0;
let autoRotateZ = 0;

// Post-Processing Variables for Lens Distortion
let renderTarget, postScene, postCamera, postMaterial;

// First-Person Mouse Look-Around Variables
let isDragging = false;
let previousPointerPosition = { x: 0, y: 0 };
let yaw = Math.PI; // Look straight back at -Z initially
let pitch = 0;
const sensitivity = 0.003;

// Mouse Look-Around Handlers for Inside Room Mode
function handlePointerDown(e) {
  if (state.viewMode !== 'inside') return;
  // Ignore clicks that target the floating UI panel
  if (e.target.closest('#app-hud')) return;
  isDragging = true;
  previousPointerPosition = { x: e.clientX, y: e.clientY };
}

function handlePointerMove(e) {
  if (!isDragging || state.viewMode !== 'inside') return;
  
  const deltaX = e.clientX - previousPointerPosition.x;
  const deltaY = e.clientY - previousPointerPosition.y;
  
  yaw -= deltaX * sensitivity;
  pitch -= deltaY * sensitivity;
  
  // Clamp pitch between -85 and +85 degrees to prevent gymnastics
  pitch = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, pitch));
  
  camera.rotation.order = 'YXZ';
  camera.rotation.set(pitch, yaw, 0);
  
  previousPointerPosition = { x: e.clientX, y: e.clientY };
}

function handlePointerUp() {
  isDragging = false;
}

// Zoom parameters for First-Person FOV zoom
const minFov = 20;
const maxFov = 100;
const fovSensitivity = 0.05;

function handleWheel(e) {
  if (state.viewMode !== 'inside') return;
  
  // Prevent browser window from scrolling
  e.preventDefault();
  
  // Adjust FOV based on scroll delta
  camera.fov += e.deltaY * fovSensitivity;
  camera.fov = Math.max(minFov, Math.min(maxFov, camera.fov));
  camera.updateProjectionMatrix();
}

// 1. DYNAMIC TEXTURE GENERATOR
// Creates a 2D canvas, draws the parallel lines pattern, and returns a CanvasTexture
function generateTexture(settings) {
  const canvas = document.createElement('canvas');
  const size = 512; // Texture resolution
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Fill solid background
  ctx.fillStyle = settings.bgColor;
  ctx.fillRect(0, 0, size, size);
  
  // Set drawing attributes
  ctx.strokeStyle = settings.lineColor;
  
  // Scale line width for density mode based on cubeSize to maintain absolute physical size.
  // In count mode, we keep it as-is so it stretches proportionally with the wall.
  let drawLineWidth = settings.lineWidth;
  if (settings.spacingMode === 'density') {
    drawLineWidth = Math.max(1, Math.round(settings.lineWidth * (10 / state.cubeSize)));
  }
  ctx.lineWidth = drawLineWidth;
  
  // Configure line style (dashed, dotted, solid)
  if (settings.lineStyle === 'dashed') {
    ctx.setLineDash([drawLineWidth * 3, drawLineWidth * 2]);
  } else if (settings.lineStyle === 'dotted') {
    ctx.setLineDash([drawLineWidth, drawLineWidth * 2]);
  } else {
    ctx.setLineDash([]);
  }
  
  // Calculate line count or spacing
  let lineCount = settings.lineCount;
  if (settings.spacingMode === 'density') {
    // Scale line count based on cube size to maintain absolute physical spacing.
    const baseCount = size / settings.lineSpacing;
    lineCount = Math.max(2, Math.floor(baseCount * (state.cubeSize / 10)));
  }
  
  ctx.beginPath();
  
  if (settings.orientation === 'horizontal') {
    // Parallel lines horizontally
    const spacing = size / (lineCount + 1);
    for (let i = 1; i <= lineCount; i++) {
      const y = i * spacing;
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
    }
  } else if (settings.orientation === 'vertical') {
    // Parallel lines vertically
    const spacing = size / (lineCount + 1);
    for (let i = 1; i <= lineCount; i++) {
      const x = i * spacing;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
    }
  } else if (settings.orientation === 'diagonal') {
    // Parallel lines diagonally (45 degrees)
    const spacing = (size * 2) / (lineCount + 1);
    for (let i = 1; i <= lineCount; i++) {
      const offset = i * spacing;
      const startX = Math.max(0, offset - size);
      const startY = Math.min(size, offset);
      const endX = Math.min(size, offset);
      const endY = Math.max(0, offset - size);
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    }
  }
  
  ctx.stroke();
  
  // Convert to Three.js texture
  const texture = new THREE.CanvasTexture(canvas);
  // Always use 1:1 repeat and clamp-to-edge wrapping to completely prevent
  // mid-face repeat seams, grid boundaries, and perspective diagonal bends.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  
  return texture;
}

// Update the textures mapped to the cube materials
function updateTextures() {
  // Clean up old textures
  if (canvasTextures.x) canvasTextures.x.dispose();
  if (canvasTextures.y) canvasTextures.y.dispose();
  if (canvasTextures.z) canvasTextures.z.dispose();
  
  // Generate new ones
  canvasTextures.x = generateTexture(state.xWall);
  canvasTextures.y = generateTexture(state.yWall);
  canvasTextures.z = generateTexture(state.zWall);
  
  // Assign to appropriate materials
  // Cube face order: Right (+X), Left (-X), Top (+Y), Bottom (-Y), Front (+Z), Back (-Z)
  cubeMaterials[0].map = canvasTextures.x; // Right
  cubeMaterials[1].map = canvasTextures.x; // Left
  cubeMaterials[2].map = canvasTextures.y; // Top
  cubeMaterials[3].map = canvasTextures.y; // Bottom
  cubeMaterials[4].map = canvasTextures.z; // Front
  cubeMaterials[5].map = canvasTextures.z; // Back
  
  // Request Three.js material map updates
  cubeMaterials.forEach(mat => mat.needsUpdate = true);
}

// 2. THREE.JS INITIALIZATION
function initThree() {
  const container = document.getElementById('canvas-container');
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(state.xWall.bgColor); // Use dark wallpaper color as scene bg
  
  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(state.cubeSize * 1.5, state.cubeSize * 1.2, state.cubeSize * 1.5);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  
  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = state.cubeSize * 0.4;
  controls.maxDistance = state.cubeSize * 5.0;
  
  // Lighting (needed for depth/shadow hints if desired, though we use BasicMaterial)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  
  // Cube Materials
  // We use DoubleSide so inside walls are visible even if outer faces are culled/transparent.
  // We use MeshBasicMaterial so the colors of the drawn lines are perfectly vibrant (unshaded).
  for (let i = 0; i < 6; i++) {
    cubeMaterials.push(new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0
    }));
  }
  
  // Cube Geometry & Mesh
  cubeGeometry = new THREE.BoxGeometry(state.cubeSize, state.cubeSize, state.cubeSize);
  cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterials);
  scene.add(cubeMesh);
  
  // Space Helpers
  axesHelper = new THREE.AxesHelper(state.cubeSize * 1.5);
  gridHelper = new THREE.GridHelper(state.cubeSize * 3, 30, 0x44444c, 0x20222a);
  gridHelper.position.y = -state.cubeSize / 2 - 0.01; // Place just below the bottom cube face
  
  scene.add(axesHelper);
  scene.add(gridHelper);
  
  // Set initial visibility of helpers
  axesHelper.visible = state.showAxes;
  gridHelper.visible = state.showGrid;
  
  // Generate first textures
  updateTextures();
  
  // Post-Processing setup for Lens Distortion (Fisheye)
  renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat
  });
  
  postScene = new THREE.Scene();
  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  postMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      uDistortion: { value: state.lensDistortion * 0.015 },
      uAspect: { value: window.innerWidth / window.innerHeight }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uDistortion;
      uniform float uAspect;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= uAspect;
        float r2 = uv.x * uv.x + uv.y * uv.y;
        
        // Radial distortion formula
        vec2 distortedUv = uv * (1.0 + uDistortion * r2);
        
        distortedUv.x /= uAspect;
        distortedUv += 0.5;
        
        if (distortedUv.x < 0.0 || distortedUv.x > 1.0 || distortedUv.y < 0.0 || distortedUv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Out-of-bounds border
        } else {
          gl_FragColor = texture2D(tDiffuse, distortedUv);
        }
      }
    `
  });
  
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
  postScene.add(postQuad);
  
  // First-Person Pointer and Scroll Controls
  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
  
  // Resize Handler
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  
  // Resize render target and update aspect uniform
  if (renderTarget) renderTarget.setSize(width, height);
  if (postMaterial) postMaterial.uniforms.uAspect.value = width / height;
}

// 3. CORE RENDERING & PEERING LOGIC
// Local normals mapping for the 6 cube faces
const LOCAL_NORMALS = [
  new THREE.Vector3(1, 0, 0),   // face 0: Right (+X)
  new THREE.Vector3(-1, 0, 0),  // face 1: Left (-X)
  new THREE.Vector3(0, 1, 0),   // face 2: Top (+Y)
  new THREE.Vector3(0, -1, 0),  // face 3: Bottom (-Y)
  new THREE.Vector3(0, 0, 1),   // face 4: Front (+Z)
  new THREE.Vector3(0, 0, -1)   // face 5: Back (-Z)
];

function animate(time) {
  requestAnimationFrame(animate);
  
  // Smoothly animate camera position transition if triggered
  if (isTransitioning && targetCameraPos) {
    camera.position.lerp(targetCameraPos, 0.08);
    
    if (state.viewMode === 'inside') {
      // Look straight ahead towards the back wall (-Z) during fly-in
      const currentLookTarget = new THREE.Vector3(0, 0, -state.cubeSize / 2);
      camera.lookAt(currentLookTarget);
    } else {
      // Lerp lookAt target during fly-out
      controls.target.lerp(targetLookAt, 0.08);
      camera.lookAt(controls.target);
    }
    
    if (camera.position.distanceTo(targetCameraPos) < 0.05) {
      isTransitioning = false;
      targetCameraPos = null;
      
      if (state.viewMode === 'inside') {
        // Initialize look-around yaw and pitch to match the transition's end state
        // (looking straight at -Z wall: yaw = PI, pitch = 0)
        yaw = Math.PI;
        pitch = 0;
        camera.rotation.order = 'YXZ';
        camera.rotation.set(pitch, yaw, 0);
      } else {
        // Re-enable OrbitControls when outside transition is finished
        controls.enabled = true;
        controls.target.copy(targetLookAt);
      }
    }
  }
  
  // Update controls (only if they are enabled)
  if (controls.enabled) {
    controls.update();
  }
  
  // Update cube auto-rotation accumulators
  if (!isTransitioning) {
    if (state.autoRotateSpeedX !== 0) autoRotateX += (state.autoRotateSpeedX * 0.005);
    if (state.autoRotateSpeedY !== 0) autoRotateY += (state.autoRotateSpeedY * 0.005);
    if (state.autoRotateSpeedZ !== 0) autoRotateZ += (state.autoRotateSpeedZ * 0.005);
  }
  
  // Set total rotation combining manual sliders and auto-rotations
  cubeMesh.rotation.set(
    THREE.MathUtils.degToRad(state.manualRotateX) + autoRotateX,
    THREE.MathUtils.degToRad(state.manualRotateY) + autoRotateY,
    THREE.MathUtils.degToRad(state.manualRotateZ) + autoRotateZ
  );
  
  // Update Scene Background to match X-wall background for a cohesive space feel
  scene.background.set(state.xWall.bgColor);
  
  // Dynamic Transparency Calculation (The core "forward faces transparent" logic)
  if (state.viewMode === 'culling') {
    // 1. Outside Explorer Mode: Peer inside by making front-facing walls transparent.
    const worldNormal = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();
    
    // Get direction vector from camera to cube center
    cameraDir.subVectors(cubeMesh.position, camera.position).normalize();
    
    for (let i = 0; i < 6; i++) {
      // Rotate the local face normal according to the cube's rotation to get world normal
      worldNormal.copy(LOCAL_NORMALS[i]).applyQuaternion(cubeMesh.quaternion).normalize();
      
      // Dot product: < 0 means facing the camera (near wall), > 0 means facing away (far wall)
      const dot = worldNormal.dot(cameraDir);
      
      if (dot < 0) {
        // Forward face: transparent
        cubeMaterials[i].transparent = true;
        cubeMaterials[i].opacity = state.frontFaceOpacity;
        // Avoid rendering transparent faces on top of each other in depth buffer
        cubeMaterials[i].depthWrite = (state.frontFaceOpacity > 0.01);
      } else {
        // Back face: fully opaque
        cubeMaterials[i].transparent = false;
        cubeMaterials[i].opacity = 1.0;
        cubeMaterials[i].depthWrite = true;
      }
    }
  } else {
    // 2. Inside Room Mode: Make all walls 100% opaque.
    // Since the camera is inside and we have DoubleSide rendering,
    // we see all 6 interior walls without clipping.
    for (let i = 0; i < 6; i++) {
      cubeMaterials[i].transparent = false;
      cubeMaterials[i].opacity = 1.0;
      cubeMaterials[i].depthWrite = true;
    }
  }
  
  // Render with Lens Distortion if active, else render directly for performance
  if (state.lensDistortion === 0) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    // 1. Update uniforms
    postMaterial.uniforms.uDistortion.value = state.lensDistortion * 0.015;
    
    // 2. Render scene to offscreen render target
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    
    // 3. Render quad with post-processing shader to the screen
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }
}

// 4. VIEW MODE TRANSITIONS
function switchViewMode(mode) {
  state.viewMode = mode;
  isTransitioning = true;
  
  // Reset camera FOV when switching modes
  camera.fov = 60;
  camera.updateProjectionMatrix();
  
  if (mode === 'inside') {
    // Transition camera into the cube room center
    targetCameraPos = new THREE.Vector3(0, 0, 0.001); // Position at the center
    targetLookAt.set(0, 0, -state.cubeSize / 2); // Look towards the back wall
    
    // Disable orbit controls immediately so they don't override positioning
    controls.enabled = false;
    
    // Hide floor grid helper to keep inside clean
    gridHelper.visible = false;
    document.getElementById('show-grid').checked = false;
    state.showGrid = false;
    
    // Hide opacity slider since it's only active in peering mode
    document.getElementById('front-opacity-group').classList.add('hidden');
  } else {
    // Transition camera back outside
    targetCameraPos = new THREE.Vector3(state.cubeSize * 1.5, state.cubeSize * 1.2, state.cubeSize * 1.5);
    targetLookAt.set(0, 0, 0);
    
    // Disable look-around dragging
    isDragging = false;
    
    // Show helpers based on check state
    gridHelper.visible = document.getElementById('show-grid').checked;
    state.showGrid = gridHelper.visible;
    
    // Show opacity slider
    document.getElementById('front-opacity-group').classList.remove('hidden');
  }
}

// 5. HUD INPUT EVENT SYNCHRONIZATION
function bindUIEvents() {
  // Select View Mode
  const viewModeSelect = document.getElementById('view-mode');
  viewModeSelect.addEventListener('change', (e) => {
    switchViewMode(e.target.value);
  });
  
  // Cube Size Slider
  const sizeSlider = document.getElementById('cube-size');
  const sizeVal = document.getElementById('cube-size-val');
  sizeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.cubeSize = val;
    sizeVal.textContent = val.toFixed(1) + 'm';
    
    // Recreate geometry to reflect new size
    cubeMesh.geometry.dispose();
    cubeGeometry = new THREE.BoxGeometry(val, val, val);
    cubeMesh.geometry = cubeGeometry;
    
    // Re-adjust grid helper position
    gridHelper.position.y = -val / 2 - 0.01;
    
    // Update texture repeat scale for visual feedback
    updateTextures();
    
    // Update camera bounds
    if (state.viewMode === 'inside') {
      controls.maxDistance = val * 0.49;
    } else {
      controls.minDistance = val * 0.4;
      controls.maxDistance = val * 5.0;
    }
  });
  
  // Front Face Opacity Slider
  const opacitySlider = document.getElementById('front-opacity');
  const opacityVal = document.getElementById('front-opacity-val');
  opacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.frontFaceOpacity = val;
    opacityVal.textContent = val.toFixed(2);
  });
  
  // Auto Rotate Speed Sliders
  const rotateXSlider = document.getElementById('rotate-speed-x');
  const rotateXVal = document.getElementById('rotate-speed-x-val');
  rotateXSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.autoRotateSpeedX = val;
    rotateXVal.textContent = val.toFixed(1);
  });

  const rotateYSlider = document.getElementById('rotate-speed-y');
  const rotateYVal = document.getElementById('rotate-speed-y-val');
  rotateYSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.autoRotateSpeedY = val;
    rotateYVal.textContent = val.toFixed(1);
  });

  const rotateZSlider = document.getElementById('rotate-speed-z');
  const rotateZVal = document.getElementById('rotate-speed-z-val');
  rotateZSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.autoRotateSpeedZ = val;
    rotateZVal.textContent = val.toFixed(1);
  });
  
  // Manual Rotation Slider bindings
  const rotXSlider = document.getElementById('rotation-x');
  const rotXVal = document.getElementById('rotation-x-val');
  rotXSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.manualRotateX = val;
    rotXVal.textContent = val + '°';
  });

  const rotYSlider = document.getElementById('rotation-y');
  const rotYVal = document.getElementById('rotation-y-val');
  rotYSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.manualRotateY = val;
    rotYVal.textContent = val + '°';
  });

  const rotZSlider = document.getElementById('rotation-z');
  const rotZVal = document.getElementById('rotation-z-val');
  rotZSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.manualRotateZ = val;
    rotZVal.textContent = val + '°';
  });
  
  // Lens Distortion Slider binding
  const lensSlider = document.getElementById('lens-distortion');
  const lensVal = document.getElementById('lens-distortion-val');
  lensSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.lensDistortion = val;
    let label = val.toString();
    if (val === 0) label = "0 (Flat)";
    else if (val > 0) label = `+${val} (Fisheye)`;
    else label = `${val} (Pincushion)`;
    lensVal.textContent = label;
  });
  
  // Helpers Checkboxes
  document.getElementById('show-axes').addEventListener('change', (e) => {
    state.showAxes = e.target.checked;
    axesHelper.visible = state.showAxes;
  });
  
  document.getElementById('show-grid').addEventListener('change', (e) => {
    state.showGrid = e.target.checked;
    gridHelper.visible = state.showGrid;
  });
  
  // Tab Navigation Handling
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      
      // Set active
      tab.classList.add('active');
      const paneId = tab.getAttribute('data-tab');
      document.getElementById(paneId).classList.add('active');
    });
  });
  
  // Connect Wall settings controls dynamically
  const axes = ['x', 'y', 'z'];
  axes.forEach(axis => {
    const prefix = `${axis}-`;
    const settings = state[`${axis}Wall`];
    
    // Background Color
    document.getElementById(`${prefix}bg-color`).addEventListener('input', (e) => {
      settings.bgColor = e.target.value;
      updateTextures();
    });
    
    // Line Color
    document.getElementById(`${prefix}line-color`).addEventListener('input', (e) => {
      settings.lineColor = e.target.value;
      updateTextures();
    });
    
    // Spacing Mode Select
    const spacingMode = document.getElementById(`${prefix}spacing-mode`);
    const countGroup = document.getElementById(`${prefix}line-count-group`);
    const spacingGroup = document.getElementById(`${prefix}line-spacing-group`);
    
    spacingMode.addEventListener('change', (e) => {
      settings.spacingMode = e.target.value;
      if (settings.spacingMode === 'count') {
        countGroup.classList.remove('hidden');
        spacingGroup.classList.add('hidden');
      } else {
        countGroup.classList.add('hidden');
        spacingGroup.classList.remove('hidden');
      }
      updateTextures();
    });
    
    // Line Count range slider
    const countSlider = document.getElementById(`${prefix}line-count`);
    const countVal = document.getElementById(`${prefix}line-count-val`);
    countSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      settings.lineCount = val;
      countVal.textContent = val;
      updateTextures();
    });
    
    // Line Spacing range slider
    const spacingSlider = document.getElementById(`${prefix}line-spacing`);
    const spacingVal = document.getElementById(`${prefix}line-spacing-val`);
    spacingSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      settings.lineSpacing = val;
      spacingVal.textContent = val + 'px';
      updateTextures();
    });
    
    // Line Width range slider
    const widthSlider = document.getElementById(`${prefix}line-width`);
    const widthVal = document.getElementById(`${prefix}line-width-val`);
    widthSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      settings.lineWidth = val;
      widthVal.textContent = val + 'px';
      updateTextures();
    });
    
    // Line Orientation select
    document.getElementById(`${prefix}orientation`).addEventListener('change', (e) => {
      settings.orientation = e.target.value;
      updateTextures();
    });
    
    // Line Style select
    document.getElementById(`${prefix}line-style`).addEventListener('change', (e) => {
      settings.lineStyle = e.target.value;
      updateTextures();
    });
  });
  
  // Presets trigger handlers
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all preset buttons
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const presetName = btn.getAttribute('data-preset');
      applyPreset(presetName);
    });
  });
}

// 6. PRESET APPLICATION AND UI UPDATE
function applyPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) return;
  
  // 1. Update State values
  state.viewMode = preset.viewMode;
  state.cubeSize = preset.cubeSize;
  state.frontFaceOpacity = preset.frontFaceOpacity;
  state.autoRotateSpeedX = preset.autoRotateSpeedX;
  state.autoRotateSpeedY = preset.autoRotateSpeedY;
  state.autoRotateSpeedZ = preset.autoRotateSpeedZ;
  state.lensDistortion = preset.lensDistortion || 0;
  state.showAxes = preset.showAxes;
  state.showGrid = preset.showGrid;
  
  // Deep copy wall properties
  ['xWall', 'yWall', 'zWall'].forEach(wall => {
    Object.assign(state[wall], preset[wall]);
  });
  
  // Reset manual rotations and auto-rotation accumulators
  state.manualRotateX = 0;
  state.manualRotateY = 0;
  state.manualRotateZ = 0;
  autoRotateX = 0;
  autoRotateY = 0;
  autoRotateZ = 0;
  
  // 2. Synchronize HTML UI Elements
  
  // View Mode
  document.getElementById('view-mode').value = state.viewMode;
  switchViewMode(state.viewMode);
  
  // Cube Size
  const sizeSlider = document.getElementById('cube-size');
  sizeSlider.value = state.cubeSize;
  document.getElementById('cube-size-val').textContent = state.cubeSize.toFixed(1) + 'm';
  
  // Re-initialize geometry size
  cubeMesh.geometry.dispose();
  cubeGeometry = new THREE.BoxGeometry(state.cubeSize, state.cubeSize, state.cubeSize);
  cubeMesh.geometry = cubeGeometry;
  gridHelper.position.y = -state.cubeSize / 2 - 0.01;
  
  // Opacity
  const opacitySlider = document.getElementById('front-opacity');
  opacitySlider.value = state.frontFaceOpacity;
  document.getElementById('front-opacity-val').textContent = state.frontFaceOpacity.toFixed(2);
  
  // Auto rotation
  document.getElementById('rotate-speed-x').value = state.autoRotateSpeedX;
  document.getElementById('rotate-speed-x-val').textContent = state.autoRotateSpeedX.toFixed(1);
  
  document.getElementById('rotate-speed-y').value = state.autoRotateSpeedY;
  document.getElementById('rotate-speed-y-val').textContent = state.autoRotateSpeedY.toFixed(1);
  
  document.getElementById('rotate-speed-z').value = state.autoRotateSpeedZ;
  document.getElementById('rotate-speed-z-val').textContent = state.autoRotateSpeedZ.toFixed(1);
  
  // Reset manual rotation sliders
  document.getElementById('rotation-x').value = 0;
  document.getElementById('rotation-x-val').textContent = '0°';
  document.getElementById('rotation-y').value = 0;
  document.getElementById('rotation-y-val').textContent = '0°';
  document.getElementById('rotation-z').value = 0;
  document.getElementById('rotation-z-val').textContent = '0°';
  
  // Reset lens distortion slider
  document.getElementById('lens-distortion').value = state.lensDistortion;
  document.getElementById('lens-distortion-val').textContent = state.lensDistortion === 0 ? "0 (Flat)" : (state.lensDistortion > 0 ? `+${state.lensDistortion} (Fisheye)` : `${state.lensDistortion} (Pincushion)`);
  
  // Checkboxes
  document.getElementById('show-axes').checked = state.showAxes;
  axesHelper.visible = state.showAxes;
  
  document.getElementById('show-grid').checked = state.showGrid;
  // If inside room mode, grid helper remains hidden regardless of preset setting
  gridHelper.visible = state.viewMode === 'inside' ? false : state.showGrid;
  
  // Sync each Wall controls
  const axes = ['x', 'y', 'z'];
  axes.forEach(axis => {
    const prefix = `${axis}-`;
    const wallSettings = state[`${axis}Wall`];
    
    document.getElementById(`${prefix}bg-color`).value = wallSettings.bgColor;
    document.getElementById(`${prefix}line-color`).value = wallSettings.lineColor;
    
    document.getElementById(`${prefix}spacing-mode`).value = wallSettings.spacingMode;
    const countGroup = document.getElementById(`${prefix}line-count-group`);
    const spacingGroup = document.getElementById(`${prefix}line-spacing-group`);
    if (wallSettings.spacingMode === 'count') {
      countGroup.classList.remove('hidden');
      spacingGroup.classList.add('hidden');
    } else {
      countGroup.classList.add('hidden');
      spacingGroup.classList.remove('hidden');
    }
    
    document.getElementById(`${prefix}line-count`).value = wallSettings.lineCount;
    document.getElementById(`${prefix}line-count-val`).textContent = wallSettings.lineCount;
    
    document.getElementById(`${prefix}line-spacing`).value = wallSettings.lineSpacing;
    document.getElementById(`${prefix}line-spacing-val`).textContent = wallSettings.lineSpacing + 'px';
    
    document.getElementById(`${prefix}line-width`).value = wallSettings.lineWidth;
    document.getElementById(`${prefix}line-width-val`).textContent = wallSettings.lineWidth + 'px';
    
    document.getElementById(`${prefix}orientation`).value = wallSettings.orientation;
    document.getElementById(`${prefix}line-style`).value = wallSettings.lineStyle;
  });
  
  // Re-generate textures
  updateTextures();
}

// 7. ENTRYPOINT EXECUTION
initThree();
bindUIEvents();
animate();

// Initialize with Neon Lounge preset
applyPreset('neon-lounge');

// --- NEW WORKSPACE MENU AND DRAG LOGIC ---

// 1. Panels initialized invisibly, positioning handled dynamically upon spawning from buttons

// Z-index stack management
let maxZIndex = 100;
function bringToFront(elm) {
  maxZIndex++;
  elm.style.zIndex = maxZIndex;
}

// 2. Drag and Drop Functionality (Smooth pointer-based dragging)
function makeElementDraggable(elm, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onpointerdown = dragMouseDown;

  function dragMouseDown(e) {
    // Only drag with left mouse click or touch pointer
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    // Allow interacting with sliders, dropdowns, buttons
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('.close-panel')) {
      return;
    }
    
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    document.onpointermove = elementDrag;
    document.onpointerup = closeDragElement;
    
    bringToFront(elm);
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    let newTop = elm.offsetTop - pos2;
    let newLeft = elm.offsetLeft - pos1;
    
    // Boundary collision clamping
    newTop = Math.max(10, Math.min(window.innerHeight - elm.offsetHeight - 10, newTop));
    newLeft = Math.max(10, Math.min(window.innerWidth - elm.offsetWidth - 10, newLeft));

    elm.style.top = newTop + "px";
    elm.style.left = newLeft + "px";
    elm.style.right = "auto";
    elm.style.bottom = "auto";
  }

  function closeDragElement() {
    document.onpointermove = null;
    document.onpointerup = null;
  }
}

// Bind draggable to menu container and panels
const menuContainer = document.getElementById('cube-menu-container');
const menuDragHandle = document.getElementById('menu-drag-handle');
if (menuContainer && menuDragHandle) {
  makeElementDraggable(menuContainer, menuDragHandle);
}

const panels = document.querySelectorAll('.floating-panel');
panels.forEach(panel => {
  const header = panel.querySelector('.panel-header');
  if (header) {
    makeElementDraggable(panel, header);
  }
});

// 3. Collapsible Cube Menu Toggling
const menuTrigger = document.getElementById('menu-trigger');
const menuTriggerImg = document.getElementById('menu-trigger-img');

if (menuTrigger && menuContainer) {
  menuTrigger.addEventListener('click', () => {
    const isOpen = menuContainer.classList.toggle('open');
    if (isOpen) {
      // Check if mouse is currently hovering to set the hover state image
      const isHovered = menuTrigger.matches(':hover');
      menuTriggerImg.src = isHovered ? 'SVG/CubeBurgerClose_MO.svg' : 'SVG/CubeBurgerClose.svg';
    } else {
      menuTriggerImg.src = 'SVG/CubeBurger.svg';
    }
  });

  // Mouse over / hover event for close state
  menuTrigger.addEventListener('pointerenter', () => {
    if (menuContainer.classList.contains('open')) {
      menuTriggerImg.src = 'SVG/CubeBurgerClose_MO.svg';
    }
  });

  // Mouse leave event
  menuTrigger.addEventListener('pointerleave', () => {
    if (menuContainer.classList.contains('open')) {
      menuTriggerImg.src = 'SVG/CubeBurgerClose.svg';
    }
  });
}

// 4. Panel Button Toggle Bindings
const menuButtons = document.querySelectorAll('.menu-item-btn');
menuButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.getAttribute('data-panel');
    const panel = document.getElementById(panelId);
    if (!panel) return;
    
    const isVisible = panel.classList.toggle('visible');
    btn.classList.toggle('active', isVisible);
    
    if (isVisible) {
      bringToFront(panel);
      
      // Spawn panel centered at the menu button
      const btnRect = btn.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 320;
      const panelHeight = panel.offsetHeight || 300;
      
      // Calculate center coordinates
      const btnCenterX = btnRect.left + btnRect.width / 2;
      const btnCenterY = btnRect.top + btnRect.height / 2;
      
      let panelLeft = btnCenterX - panelWidth / 2;
      let panelTop = btnCenterY - panelHeight / 2;
      
      // Clamp within screen boundaries with padding
      const maxX = window.innerWidth - panelWidth - 30;
      const maxY = window.innerHeight - panelHeight - 30;
      panelLeft = Math.max(30, Math.min(panelLeft, maxX));
      panelTop = Math.max(50, Math.min(panelTop, maxY));
      
      panel.style.left = panelLeft + "px";
      panel.style.top = panelTop + "px";
    }
  });
});

// Bind close button inside each panel
const closeButtons = document.querySelectorAll('.close-panel');
closeButtons.forEach(closeBtn => {
  const closeImg = closeBtn.querySelector('.panel-close-img');
  
  closeBtn.addEventListener('click', () => {
    const panel = closeBtn.closest('.floating-panel');
    if (panel) {
      panel.classList.remove('visible');
      const menuBtn = document.querySelector(`.menu-item-btn[data-panel="${panel.id}"]`);
      if (menuBtn) menuBtn.classList.remove('active');
    }
  });

  if (closeImg) {
    closeBtn.addEventListener('pointerenter', () => {
      closeImg.src = 'SVG/CubeBurgerClose_MO.svg';
    });
    closeBtn.addEventListener('pointerleave', () => {
      closeImg.src = 'SVG/CubeBurgerClose.svg';
    });
  }
});

// Helper: bring clicked panels to the front immediately when clicking anywhere inside them
panels.forEach(panel => {
  panel.addEventListener('pointerdown', () => {
    bringToFront(panel);
  });
});
