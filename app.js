import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this._initRenderer();
    this._initCamera();
    this._initLighting();
    this._initCelestialBodies();
    this._initFog();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
  }
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.clipPlaneActive = false;
    this.clipPlanePosition = 0;
  }
  setClipPlane(enabled, position) {
    this.clipPlane.constant = position;
    this.clipPlaneActive = enabled;
  }
  setClipPlaneFromCamera(camera, enabled) {
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    normal.negate();
    this.clipPlane.normal.copy(normal);
    this.clipPlaneActive = enabled;
  }
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      1000
    );
    this.camera.position.set(0, 1.7, 5);
  }
  _initLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);
    this.dirLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    this.dirLight.position.set(10, 20, 10);
    this.scene.add(this.dirLight);
    this.fillLight = new THREE.DirectionalLight(0xa0c8ff, 0.4);
    this.fillLight.position.set(-10, 5, -10);
    this.scene.add(this.fillLight);
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x404040, 0.3);
    this.scene.add(this.hemiLight);
  }
  _initCelestialBodies() {
    const sunGeo = new THREE.SphereGeometry(3, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.position.set(50, 40, -80);
    this.scene.add(this.sun);
  }
  _initFog() {
    const fogColor = getComputedStyle(document.documentElement).getPropertyValue('--fog').trim() || '#87ceeb';
    const color = parseInt(fogColor.replace('#', ''), 16);
    this.scene.fog = new THREE.FogExp2(color, 0.012);
    this.scene.background = new THREE.Color(color);
  }
  setFogColor() {
    const fogColor = getComputedStyle(document.documentElement).getPropertyValue('--fog').trim() || '#87ceeb';
    const color = parseInt(fogColor.replace('#', ''), 16);
    if (this.scene.fog) {
      this.scene.fog.color.setHex(color);
      this.scene.background.setHex(color);
    }
  }
  setSceneBackground(isDark) {
    if (isDark) {
      this.scene.background = new THREE.Color(0x1a1a2e);
    } else {
      this.scene.background = new THREE.Color(0x87ceeb);
    }
  }
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  get delta() { return this.clock.getDelta(); }
}
class PlayerControls {
    constructor(camera, domElement, scene) {
      this.camera = camera;
      this.scene = scene;
      this.controls = new PointerLockControls(camera, domElement);
      this.keys = { w: false, a: false, s: false, d: false, space: false };
      this.spacePressed = false;
      this.position = new THREE.Vector3();
      this.velocity = new THREE.Vector3();
      this.isOnGround = true;
      this.playerHeight = 1.6;
      this.moveSpeed = 5.0;
      this.jumpForce = 8.0;
      this.gravity = 25;
      this.colliders = [];
      this.jumpCooldown = 0;
      this.teleportRaycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this._bindKeys();
      this._bindMouse();
    }
    _bindMouse() {
      document.addEventListener('mousedown', (e) => {
        if (!this.controls.isLocked) return;
        if (e.button !== 0) return;
        
        this.mouse.x = 0;
        this.mouse.y = 0;
        this.teleportRaycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.teleportRaycaster.intersectObjects(this.colliders, true);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          this.position.x = point.x;
          this.position.z = point.z;
          if (this.isOnGround) {
            this.position.y = point.y + this.playerHeight;
          }
        }
      });
    }
    setColliders(colliders) {
      this.colliders = colliders;
      
    }
    _bindKeys() {
      document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') this.keys.w = true;
        if (e.code === 'KeyA') this.keys.a = true;
        if (e.code === 'KeyS') this.keys.s = true;
        if (e.code === 'KeyD') this.keys.d = true;
        if (e.code === 'Space') {
          e.preventDefault();
          if (this.isOnGround && !this.spacePressed) {
            this.velocity.y = this.jumpForce;
            this.isOnGround = false;
            this.spacePressed = true;
            this.jumpCooldown = 0.1;
          }
        }
      });
      document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') this.keys.w = false;
        if (e.code === 'KeyA') this.keys.a = false;
        if (e.code === 'KeyS') this.keys.s = false;
        if (e.code === 'KeyD') this.keys.d = false;
        if (e.code === 'Space') this.spacePressed = false;
      });
    }
    spawnAt(position) {
      this.position.copy(position);
      this.position.y = 0.1 + this.playerHeight;
      this.velocity.y = 0;
      this.isOnGround = false;
      this.spacePressed = false;
      this.camera.position.copy(this.position);
    }
    lock() { this.controls.lock(); }
    unlock() { this.controls.unlock(); }
    get isLocked() { return this.controls.isLocked; }
    _checkGround() {
      if (this.jumpCooldown > 0) {
        this.jumpCooldown -= 0.016;
      }
      if (!this.colliders || this.colliders.length === 0) {
        if (this.position.y < this.playerHeight + 0.1) {
          this.position.y = this.playerHeight + 0.1;
          this.velocity.y = 0;
        }
        this.isOnGround = true;
        return;
      }
      const raycaster = new THREE.Raycaster();
      raycaster.set(
        new THREE.Vector3(this.position.x, this.position.y, this.position.z),
        new THREE.Vector3(0, -1, 0)
      );
      raycaster.far = 50;
      const intersects = raycaster.intersectObjects(this.colliders, true);
      if (intersects.length > 0) {
        const groundY = intersects[0].point.y;
        const targetY = groundY + this.playerHeight;
        if (this.position.y <= targetY + 0.2) {
          this.position.y = targetY;
          this.velocity.y = 0;
          this.isOnGround = true;
        }
      } else {
        this.isOnGround = false;
      }
    }
    _checkWallCollision(movement) {
      if (!this.colliders || this.colliders.length === 0) return true;
      const raycaster = new THREE.Raycaster();
      const origin = this.position.clone();
      origin.y -= this.playerHeight * 0.5;
      
      raycaster.set(origin, movement.clone().normalize());
      raycaster.far = Math.max(movement.length() + 0.5, 1.0);
      const intersects = raycaster.intersectObjects(this.colliders, true);
      if (intersects.length > 0 && intersects[0].distance < movement.length() + 0.3) {
        return false;
      }
      return true;
    }
    update(dt) {
      if (!this.controls.isLocked) return;
      if (!this.isOnGround) {
        this.velocity.y -= this.gravity * dt;
        if (this.velocity.y < -30) this.velocity.y = -30;
      }
      this.position.y += this.velocity.y * dt;
      const move = new THREE.Vector3();
      const forward = new THREE.Vector3();
      const right = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
      if (this.keys.w) move.add(forward);
      if (this.keys.s) move.sub(forward);
      if (this.keys.a) move.sub(right);
      if (this.keys.d) move.add(right);
      if (move.length() > 0) {
        move.normalize().multiplyScalar(this.moveSpeed * dt);
        if (this._checkWallCollision(move)) {
          this.position.x += move.x;
          this.position.z += move.z;
        }
      }
      this._checkGround();
      if (this.position.y < -50) {
        this.position.set(0, this.playerHeight + 0.3, 5);
        this.velocity.y = 0;
      }
      this.camera.position.copy(this.position);
    }
    getPosition() {
      return this.position.clone();
    }
  }
class ModelLoader {
  constructor(scene) {
    this.scene = scene;
    this.currentModel = null;
    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader.setDRACOLoader(draco);
  }
  async load(source, onProgress) {
    return new Promise((resolve, reject) => {
      const onLoad = (gltf) => {
        const model = gltf.scene;
        this._processModel(model);
        resolve({ model, gltf });
      };
      const onErr = (err) => reject(err);
      if (source instanceof File) {
        const url = URL.createObjectURL(source);
        this.loader.load(url, onLoad, onProgress, onErr);
      } else {
        this.loader.load(source, onLoad, onProgress, onErr);
      }
    });
  }
  _processModel(model) {
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
    }
    let meshCount = 0;
    model.traverse(node => {
      if (node.isMesh) {
        meshCount++;
        node.castShadow = meshCount < 500;
        node.receiveShadow = meshCount < 500;
        if (node.material) {
          node.material.side = THREE.FrontSide;
          if (node.material.map) {
            node.material.map.colorSpace = THREE.SRGBColorSpace;
          }
          node.material.needsUpdate = true;
        }
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 30;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    const box2 = new THREE.Box3().setFromObject(model);
    const groundLevel = box2.min.y;
    const modelHeight = box2.max.y - box2.min.y;
    const embedAmount = Math.min(modelHeight * 0.06, 1.5);
    model.position.y -= groundLevel;
    model.position.y -= embedAmount;
    this.scene.add(model);
    this.currentModel = model;
    return { model, scale, box: box2 };
  }
  getSpawnPoint() {
    if (!this.currentModel) return new THREE.Vector3(0, 2, 0);
    const box = new THREE.Box3().setFromObject(this.currentModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return new THREE.Vector3(center.x, box.max.y + 1.6, box.max.z + 2);
  }
}
class QRManager {
  generate(canvas, url) {
    if (!QRCode) return;
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#00f0c8';
    const panel = style.getPropertyValue('--panel').trim() || '#111318';
    QRCode.toCanvas(canvas, url, {
      width: 128,
      margin: 1,
      color: { dark: accent, light: panel },
    }, (err) => {
      if (err) console.warn('QR error:', err);
    });
  }
}
const DEMO_COLORS = {
  dark: {
    grass: 0x2d5a27,
    floor: 0x1a1c24,
    walls: 0x2a2d38,
    pillars: 0x3a3f52,
    boxes: 0x00f0c8,
    sky: 0x1a1a2e,
    fog: 0x1a1a2e,
  },
  light: {
    grass: 0x4a7c42,
    floor: 0xd4d8e0,
    walls: 0xb8bcc8,
    pillars: 0x9ca3af,
    boxes: 0x0091ff,
    sky: 0x87ceeb,
    fog: 0xe8eaf0,
  },
};
function getDemoColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return isLight ? DEMO_COLORS.light : DEMO_COLORS.dark;
}
function buildDemoScene(scene, sm) {
  const group = new THREE.Group();
  const colors = getDemoColors();
  if (sm) {
    sm.setSceneBackground(document.documentElement.getAttribute('data-theme') !== 'light');
  }
  const grassGeo = new THREE.PlaneGeometry(100, 100, 20, 20);
  const grassMat = new THREE.MeshStandardMaterial({
    color: colors.grass, roughness: 0.95, metalness: 0.0,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  group.add(grass);
  const floorGeo = new THREE.BoxGeometry(12, 0.3, 12);
  const floorMat = new THREE.MeshStandardMaterial({
    color: colors.floor, roughness: 0.9, metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.15;
  group.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: colors.walls, roughness: 0.8 });
  const wallConfigs = [
    { w: 40, h: 5, d: 0.4, x: 0,   y: 2.5, z: -20 },
    { w: 40, h: 5, d: 0.4, x: 0,   y: 2.5, z:  20 },
    { w: 0.4, h: 5, d: 40, x: -20, y: 2.5, z:   0 },
    { w: 0.4, h: 5, d: 40, x:  20, y: 2.5, z:   0 },
  ];
  wallConfigs.forEach(cfg => {
    const g = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
    const m = new THREE.Mesh(g, wallMat);
    m.position.set(cfg.x, cfg.y, cfg.z);
    group.add(m);
  });
  const pillarMat = new THREE.MeshStandardMaterial({ color: colors.pillars, roughness: 0.6, metalness: 0.3 });
  [[-8,-8],[8,-8],[-8,8],[8,8]].forEach(([x,z]) => {
    const g = new THREE.CylinderGeometry(0.4, 0.4, 4, 12);
    const m = new THREE.Mesh(g, pillarMat);
    m.position.set(x, 2, z);
    group.add(m);
  });
  const boxMat = new THREE.MeshStandardMaterial({ color: colors.boxes, roughness: 0.4, metalness: 0.6 });
  [[3, 0.5, 3], [-5, 0.5, 2], [2, 0.5, -6]].forEach(([x,y,z]) => {
    const g = new THREE.BoxGeometry(1.2, 1, 1.2);
    const m = new THREE.Mesh(g, boxMat);
    m.position.set(x, y, z);
    group.add(m);
  });
  scene.add(group);
  return group;
}
class App {
  constructor() {
    this.canvas     = document.getElementById('threeCanvas');
    this.sm         = new SceneManager(this.canvas);
    this.loader     = new ModelLoader(this.sm.scene);
    this.qr         = new QRManager();
    this.player     = null;
    this.frameCount = 0;
    this.fpsTimer   = 0;
    this.fps        = 60;
    this.running    = false;
    this.demoGroup  = null;
    this.grassMesh  = null;
    this.colliders  = [];
    this._bindUI();
  }
  async start() {
    const theme = document.documentElement.getAttribute('data-theme');
    this.sm.setSceneBackground(theme !== 'light');
    this._checkUrlParams();
    this._animate();
  }
  _checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const modelUrl = params.get('model');
    if (modelUrl) {
      this._loadModel(modelUrl);
    }
  }
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.sm.setFogColor();
    this.sm.setSceneBackground(theme === 'dark');
    if (this.grassMesh) {
      this._updateGrassColor();
    }
    if (this.running && this.demoGroup) {
      this._updateDemoColors();
    }
    this._regenerateQR();
  }
  _updateGrassColor() {
    if (!this.grassMesh) return;
    const isLight = document.documentElement.getAttribute('data-theme') !== 'light';
    const grassColor = isLight ? 0x4a7c42 : 0x2d5a27;
    this.grassMesh.material.color.setHex(grassColor);
  }
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    this.setTheme(current === 'light' ? 'dark' : 'light');
  }
  toggleSectionCut() {
    this.sectionCutEnabled = !this.sectionCutEnabled;
    this._updateSectionCut();
  }
  _updateSectionCut() {
    const sectionCutBtn = document.getElementById('sectionCutBtn');
    if (this.sectionCutEnabled) {
      sectionCutBtn.style.background = 'var(--accent)';
      sectionCutBtn.style.color = '#000';
    } else {
      sectionCutBtn.style.background = '';
      sectionCutBtn.style.color = '';
    }
    this._applyClippingToModel(this.loader.currentModel, this.sectionCutEnabled);
  }
  _applyClippingToModel(model, enabled) {
    if (!model) return;
    model.traverse(node => {
      if (node.isMesh && node.material) {
        if (enabled) {
          node.material.clippingPlanes = [this.sm.clipPlane];
          node.material.clipShadows = true;
        } else {
          node.material.clippingPlanes = [];
        }
        node.material.needsUpdate = true;
      }
    });
  }
  toggleMinimap() {
    this.minimapEnabled = !this.minimapEnabled;
    this._updateMinimap();
    if (this.minimapEnabled) {
      this._initMinimap();
    }
  }
  _updateMinimap() {
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapBtn = document.getElementById('minimapBtn');
    if (this.minimapEnabled) {
      minimapCanvas.style.display = 'block';
      if (minimapBtn) {
        minimapBtn.style.background = 'var(--accent)';
        minimapBtn.style.color = '#000';
      }
    } else {
      minimapCanvas.style.display = 'none';
      if (minimapBtn) {
        minimapBtn.style.background = '';
        minimapBtn.style.color = '';
      }
    }
  }
  _initMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    canvas.width = 150;
    canvas.height = 150;
    this.minimapCtx = canvas.getContext('2d');
  }
  _renderMinimap() {
    if (!this.minimapCtx || !this.player) return;
    const ctx = this.minimapCtx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    const playerPos = this.player.getPosition();
    const scale = 3;
    const cx = w / 2;
    const cy = h / 2;
    if (this.loader.currentModel) {
      const box = new THREE.Box3().setFromObject(this.loader.currentModel);
      const modelCenter = new THREE.Vector3();
      box.getCenter(modelCenter);
      const modelW = box.max.x - box.min.x;
      const modelH = box.max.z - box.min.z;
      const maxDim = Math.max(modelW, modelH, 30);
      const minimapScale = (w - 20) / maxDim;
      ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
      ctx.lineWidth = 1;
      this.loader.currentModel.traverse(node => {
        if (node.isMesh) {
          const pos = node.position;
          const bx = cx + (pos.x - modelCenter.x) * minimapScale;
          const by = cy + (pos.z - modelCenter.z) * minimapScale;
          ctx.strokeRect(bx - 2, by - 2, 4, 4);
        }
      });
    }
    const px = cx + playerPos.x * scale;
    const py = cy + playerPos.z * scale;
    ctx.fillStyle = '#00f0c8';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    const dir = new THREE.Vector3();
    this.sm.camera.getWorldDirection(dir);
    const angle = Math.atan2(dir.x, dir.z);
    ctx.strokeStyle = '#00f0c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.sin(angle) * 10, py + Math.cos(angle) * 10);
    ctx.stroke();
  
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapBtn = document.getElementById('minimapBtn');
    if (this.minimapEnabled) {
      minimapCanvas.style.display = 'block';
      minimapBtn.style.background = 'var(--accent)';
      minimapBtn.style.color = '#000';
    } else {
      minimapCanvas.style.display = 'none';
      minimapBtn.style.background = '';
      minimapBtn.style.color = '';
    }
  }
  _updateDemoColors() {
    if (!this.demoGroup) return;
    const colors = getDemoColors();
    let idx = 0;
    this.demoGroup.traverse(node => {
      if (node.isMesh && node.material) {
        if (idx === 0) node.material.color.setHex(colors.floor);
        else if (idx === 1) node.material.color.setHex(colors.walls);
        else if (idx < 6) node.material.color.setHex(colors.walls);
        else if (idx < 10) node.material.color.setHex(colors.pillars);
        else node.material.color.setHex(colors.boxes);
        idx++;
      }
    });
  }
  _regenerateQR() {
    const qrSection = document.getElementById('qrSection');
    if (!qrSection.classList.contains('hidden')) {
      const base = window.location.href.split('?')[0];
      const params = new URLSearchParams(window.location.search);
      const modelParam = params.get('model') || 'demo';
      const url = `${base}?model=${modelParam}`;
      const canvas = document.getElementById('qrCanvas');
      this.qr.generate(canvas, url);
    }
  }
  _bindUI() {
    const fileInput    = document.getElementById('fileInput');
    const uploadZone   = document.getElementById('uploadZone');
    const loadUrlBtn   = document.getElementById('loadUrlBtn');
    const modelUrlInput= document.getElementById('modelUrlInput');
    const loadDemoBtn  = document.getElementById('loadDemoBtn');
    const exitBtn      = document.getElementById('exitBtn');
    const pointerOverlay = document.getElementById('pointerLockOverlay');
    const themeToggle  = document.getElementById('themeToggle');
    const hudThemeToggle = document.getElementById('hudThemeToggle');
    const sectionCutBtn = document.getElementById('sectionCutBtn');
    const minimapBtn = document.getElementById('minimapBtn');
    this.sectionCutEnabled = false;
    this.minimapEnabled = false;
    themeToggle.addEventListener('click', () => this.toggleTheme());
    sectionCutBtn.addEventListener('click', () => this.toggleSectionCut());
    minimapBtn.addEventListener('click', () => this.toggleMinimap());
    hudThemeToggle.addEventListener('click', () => this.toggleTheme());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._loadModel(file);
    });
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault(); uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault(); uploadZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) this._loadModel(file);
    });
    loadUrlBtn.addEventListener('click', () => {
      const url = modelUrlInput.value.trim();
      if (url) this._loadModel(url);
    });
    modelUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadUrlBtn.click();
    });
    loadDemoBtn.addEventListener('click', () => this._loadDemo());
    pointerOverlay.addEventListener('click', () => {
      if (this.player) this.player.lock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) {
        this._onLocked();
      } else {
        this._onUnlocked();
      }
    });
    exitBtn.addEventListener('click', () => {
      if (this.player) this.player.unlock();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.player || !this.player.isLocked) return;
      if (e.code === 'KeyC') this.toggleSectionCut();
      if (e.code === 'KeyM') this.toggleMinimap();
    });
  }
  _onLocked() {
    document.getElementById('pointerLockOverlay').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
  }
  _onUnlocked() {
    if (this.running) {
      document.getElementById('pointerLockOverlay').classList.remove('hidden');
      document.getElementById('hud').classList.add('hidden');
    }
  }
  async _loadModel(source) {
    this._showLoading(true);
    this._hideUpload();
    try {
      const { model, gltf } = await this.loader.load(source, (xhr) => {
        if (xhr.lengthComputable) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          this._setProgress(pct);
        }
      });
      this._setProgress(80);
      this.colliders = [];
      const theme = document.documentElement.getAttribute('data-theme');
      this.sm.setSceneBackground(theme !== 'light');
      this.sm.setFogColor();
      this._updateGrassColor();
      this._addGrassGround();
      if (this.grassMesh) {
        this.colliders.push(this.grassMesh);
      }
      model.traverse(node => {
        if (node.isMesh) {
          this.colliders.push(node);
        }
      });
      this._setProgress(95);
      await this._setupPlayer(this.loader.getSpawnPoint());
      this._generateQR(source);
      this._setProgress(100);
      setTimeout(() => {
        this._showLoading(false);
        this._showPointerOverlay();
      }, 400);
    } catch (err) {
      console.error('Model load error:', err);
      this._showLoading(false);
      this._showUpload();
      alert('Failed to load model. Please try a different file or URL.\n' + err.message);
    }
  }
  async _loadDemo() {
    this._hideUpload();
    this._showLoading(true);
    if (this.loader.currentModel) {
      this.sm.scene.remove(this.loader.currentModel);
      this.loader.currentModel = null;
    }
    if (this.demoGroup) {
      this.sm.scene.remove(this.demoGroup);
      this.demoGroup = null;
    }
    this.colliders = [];
    this._setProgress(50);
    this.demoGroup = buildDemoScene(this.sm.scene, this.sm);
    this._setProgress(90);
    if (this.demoGroup) {
      this.demoGroup.traverse(node => {
        if (node.isMesh) {
          this.colliders.push(node);
        }
      });
    }
    this._addGrassGround();
    if (this.grassMesh) {
      this.colliders.push(this.grassMesh);
    }
    await this._setupPlayer(new THREE.Vector3(0, 0.3, 5));
    this._setProgress(100);
    this._generateQR('demo');
    setTimeout(() => {
      this._showLoading(false);
      this._showPointerOverlay();
    }, 400);
  }
  async _setupPlayer(spawnPoint) {
    if (this.player) {
      this.player.setColliders(this.colliders);
      this.player.spawnAt(spawnPoint);
    } else {
      this.player = new PlayerControls(
        this.sm.camera,
        this.canvas,
        this.sm.scene
      );
      this.player.setColliders(this.colliders);
      this.player.spawnAt(spawnPoint);
      this.running = true;
    }
  }
  _generateQR(source) {
    const base = window.location.href.split('?')[0];
    let modelParam = '';
    if (typeof source === 'string' && source !== 'demo') {
      modelParam = encodeURIComponent(source);
    } else {
      modelParam = 'demo';
    }
    const url = `${base}?model=${modelParam}`;
    const canvas = document.getElementById('qrCanvas');
    const urlEl  = document.getElementById('qrUrl');
    const sec    = document.getElementById('qrSection');
    this.qr.generate(canvas, url);
    urlEl.textContent = url.length > 60 ? url.slice(0, 57) + '…' : url;
    sec.classList.remove('hidden');
  }
  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.sm.delta, 0.05);
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      document.getElementById('hudFps').textContent = `${this.fps} FPS`;
    }
    if (this.running && this.player) {
      this.player.update(dt);
      const p = this.player.getPosition();
      document.getElementById('hudPos').textContent =
        `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
    }
    if (this.minimapEnabled) {
      this._renderMinimap();
    }
    this.sm.renderer.render(this.sm.scene, this.sm.camera);
  }
  _showLoading(show) {
    const el = document.getElementById('loadingScreen');
    if (show) {
      el.classList.remove('hidden');
      this._setProgress(0);
    } else {
      el.classList.add('hidden');
    }
  }
  _setProgress(pct) {
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressText').textContent = pct + '%';
  }
  _hideUpload() {
    document.getElementById('uploadOverlay').classList.add('hidden');
  }
  _showUpload() {
    document.getElementById('uploadOverlay').classList.remove('hidden');
  }
  _showPointerOverlay() {
    document.getElementById('pointerLockOverlay').classList.remove('hidden');
  }
  _addGrassGround() {
    if (this.grassMesh) {
      this.sm.scene.remove(this.grassMesh);
    }
    const isLight = document.documentElement.getAttribute('data-theme') !== 'light';
    const grassColor = isLight ? 0x4a7c42 : 0x2d5a27;
    const grassGeo = new THREE.PlaneGeometry(200, 200, 20, 20);
    const grassMat = new THREE.MeshStandardMaterial({
      color: grassColor,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.grassMesh = new THREE.Mesh(grassGeo, grassMat);
    this.grassMesh.rotation.x = -Math.PI / 2;
    this.sm.scene.add(this.grassMesh);
  }
}
const app = new App();
app.start();
