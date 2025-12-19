import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { AppConfig, SceneMode, SavedPhoto } from '../types';

// Constants
const COLORS = { bg: 0x050505, champagneGold: 0xffd966, deepGreen: 0x03180a, accentRed: 0x990000 };
const TREE_HEIGHT = 24;
const TREE_RADIUS = 8;

class Particle {
  mesh: THREE.Mesh | THREE.Group;
  type: string;
  isDust: boolean;
  posTree: THREE.Vector3;
  posScatter: THREE.Vector3;
  baseScale: number;
  spinSpeed: THREE.Vector3;
  photoId: string | null = null;
  texture: THREE.Texture | null = null;

  constructor(mesh: THREE.Mesh | THREE.Group, type: string, isDust: boolean = false) {
    this.mesh = mesh;
    this.type = type;
    this.isDust = isDust;
    this.posTree = new THREE.Vector3();
    this.posScatter = new THREE.Vector3();
    this.baseScale = mesh.scale.x;
    
    const s = (type === 'PHOTO') ? 0.3 : 2.0;
    this.spinSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * s,
      (Math.random() - 0.5) * s,
      (Math.random() - 0.5) * s
    );
    this.calcPos();
  }

  calcPos() {
    // Tree Position
    const h = TREE_HEIGHT;
    let t = Math.pow(Math.random(), 0.8);
    const y = (t * h) - (h / 2);
    let rm = Math.max(0.5, TREE_RADIUS * (1.0 - t));
    const a = t * 50 * Math.PI + Math.random() * Math.PI;
    const r = rm * (0.8 + Math.random() * 0.4);
    this.posTree.set(Math.cos(a) * r, y, Math.sin(a) * r);

    // Scatter Position (Sphere/Galaxy)
    let rs = this.isDust ? (12 + Math.random() * 20) : (8 + Math.random() * 12);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    this.posScatter.set(
      rs * Math.sin(ph) * Math.cos(th),
      rs * Math.sin(ph) * Math.sin(th),
      rs * Math.cos(ph)
    );
  }

  update(dt: number, mode: SceneMode, focusTarget: THREE.Object3D | null, elapsedTime: number, focusType: number, groupWorldMatrix: THREE.Matrix4, cameraPos: THREE.Vector3) {
    let target = this.posTree;
    
    if (mode === 'SCATTER') {
      target = this.posScatter;
    } else if (mode === 'FOCUS') {
      if (this.mesh === focusTarget) {
        let off = new THREE.Vector3(0, 1, 38); // Base focus pos in front of camera
        if (focusType === 1) off.set(-4, 2, 35);
        else if (focusType === 2) off.set(3, 0, 32);
        else if (focusType === 3) off.set(0, -2.5, 30);
        
        // Convert world focus pos to local space of the group
        const invMatrix = new THREE.Matrix4().copy(groupWorldMatrix).invert();
        target = off.applyMatrix4(invMatrix);
      } else {
        target = this.posScatter;
      }
    }

    const lerpSpeed = (mode === 'FOCUS' && this.mesh === focusTarget) ? 8.0 : 4.0;
    this.mesh.position.lerp(target, lerpSpeed * dt);

    if (mode === 'SCATTER') {
      this.mesh.rotation.x += this.spinSpeed.x * dt;
      this.mesh.rotation.y += this.spinSpeed.y * dt;
      this.mesh.rotation.z += this.spinSpeed.z * dt;
    } else if (mode === 'TREE') {
      // Gentle spin or align
      this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt);
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt);
      this.mesh.rotation.y += 0.5 * dt;
    }

    if (mode === 'FOCUS' && this.mesh === focusTarget) {
       this.mesh.lookAt(cameraPos);
       // Add some artistic tilt based on type
       if (focusType === 1) this.mesh.rotateZ(0.38);
       if (focusType === 2) this.mesh.rotateZ(-0.15);
       if (focusType === 3) this.mesh.rotateX(-0.4);
    }

    // Scaling logic
    let s = this.baseScale;
    if (this.isDust) {
      s = this.baseScale * (0.8 + 0.4 * Math.sin(elapsedTime * 4 + this.mesh.id));
      if (mode === 'TREE') s = 0; // Hide dust in tree mode
    } else if (mode === 'SCATTER' && this.type === 'PHOTO') {
      s = this.baseScale * 2.5;
    } else if (mode === 'FOCUS') {
      if (this.mesh === focusTarget) {
        if (focusType === 2) s = 3.5;
        else if (focusType === 3) s = 4.8;
        else s = 3.0;
      } else {
        s = this.baseScale * 0.8;
      }
    }
    this.mesh.scale.lerp(new THREE.Vector3(s, s, s), 6 * dt);
  }
}

export class ThreeEngine {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  composer!: EffectComposer;
  mainGroup!: THREE.Group;
  particles: Particle[] = [];
  photoMeshGroup: THREE.Group = new THREE.Group();
  
  // Snow
  snowInstancedMesh: THREE.InstancedMesh | null = null;
  snowDummy = new THREE.Object3D();
  snowData: { vy: number, rx: number, ry: number, rz: number }[] = [];

  // MediaPipe
  handLandmarker: HandLandmarker | null = null;
  videoElement: HTMLVideoElement | null = null;
  lastVideoTime = -1;

  // State
  clock = new THREE.Clock();
  mode: SceneMode = 'TREE';
  focusTarget: THREE.Object3D | null = null;
  focusType = 0;
  rotation = { x: 0, y: 0 };
  manualRotate = { x: 0, y: 0 };
  handState = { detected: false, x: 0, y: 0 };
  config: AppConfig;
  
  // Callbacks
  onHandStatusChange?: (detected: boolean) => void;

  constructor(container: HTMLElement, config: AppConfig, videoElement: HTMLVideoElement) {
    this.config = config;
    this.videoElement = videoElement;
    this.initThree(container);
    this.setupEnvironment();
    this.setupLights();
    this.setupPostProcessing();
    this.createParticles();
    this.createDust();
    this.createSnow();
    
    // Initial Photo Group
    this.mainGroup.add(this.photoMeshGroup);

    this.initMediaPipe();
    this.animate();
  }

  private initThree(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.FogExp2(COLORS.bg, 0.01);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 50);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 2.2;
    container.appendChild(this.renderer.domElement);

    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  private setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffaa00, 2, 20);
    pointLight.position.set(0, 5, 0);
    this.mainGroup.add(pointLight);

    const s1 = new THREE.SpotLight(0xffcc66, 1200);
    s1.position.set(30, 40, 40);
    s1.angle = 0.5;
    s1.penumbra = 0.5;
    this.scene.add(s1);

    const s2 = new THREE.SpotLight(0x6688ff, 600);
    s2.position.set(-30, 20, -30);
    this.scene.add(s2);

    const dirLight = new THREE.DirectionalLight(0xffeebb, 0.8);
    dirLight.position.set(0, 0, 50);
    this.scene.add(dirLight);
  }

  private setupPostProcessing() {
    const renderPass = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.7;
    bloomPass.strength = 0.45;
    bloomPass.radius = 0.4;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(bloomPass);
  }

  private createCaneTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#880000';
    x.beginPath();
    for (let i = -128; i < 256; i += 32) {
      x.moveTo(i, 0);
      x.lineTo(i + 32, 128);
      x.lineTo(i + 16, 128);
      x.lineTo(i - 16, 0);
    }
    x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  public updateParticles() {
    // Clear non-photo particles
    const photos = this.particles.filter(p => p.type === 'PHOTO');
    
    // Remove old meshes from group (excluding photos group)
    const toRemove: THREE.Object3D[] = [];
    this.mainGroup.children.forEach(c => {
        if (c !== this.photoMeshGroup && c.type === 'Mesh') {
             // Basic heuristic to identify particle meshes we generated
             toRemove.push(c);
        }
    });
    toRemove.forEach(c => this.mainGroup.remove(c));

    this.particles = [...photos]; // Keep photos
    this.createParticles();
    this.createDust();
  }

  private createParticles() {
    const sg = new THREE.SphereGeometry(0.5, 32, 32);
    const bg = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0)
    ]);
    const cg = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const goldMat = new THREE.MeshStandardMaterial({ color: COLORS.champagneGold, metalness: 1, roughness: 0.1, envMapIntensity: 2, emissive: 0x443300, emissiveIntensity: 0.3 });
    const greenMat = new THREE.MeshStandardMaterial({ color: COLORS.deepGreen, metalness: 0.2, roughness: 0.8, emissive: 0x002200, emissiveIntensity: 0.2 });
    const redMat = new THREE.MeshPhysicalMaterial({ color: COLORS.accentRed, metalness: 0.3, roughness: 0.2, clearcoat: 1, emissive: 0x330000 });
    const caneMat = new THREE.MeshStandardMaterial({ map: this.createCaneTexture(), roughness: 0.4 });

    for (let i = 0; i < this.config.particle.treeCount; i++) {
      const r = Math.random();
      let m: THREE.Mesh;
      let t: string;

      if (r < 0.4) { m = new THREE.Mesh(bg, greenMat); t = 'BOX'; }
      else if (r < 0.7) { m = new THREE.Mesh(bg, goldMat); t = 'GOLD_BOX'; }
      else if (r < 0.92) { m = new THREE.Mesh(sg, goldMat); t = 'GOLD_SPHERE'; }
      else if (r < 0.97) { m = new THREE.Mesh(sg, redMat); t = 'RED'; }
      else { m = new THREE.Mesh(cg, caneMat); t = 'CANE'; }

      const s = 0.4 + Math.random() * 0.5;
      m.scale.set(s, s, s);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.mainGroup.add(m);
      this.particles.push(new Particle(m, t, false));
    }
    
    // Star topper
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1, metalness: 1, roughness: 0 }));
    st.position.set(0, TREE_HEIGHT / 2 + 1.2, 0);
    this.mainGroup.add(st);
  }

  private createDust() {
    const g = new THREE.TetrahedronGeometry(0.08, 0);
    const m = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.8 });
    for (let i = 0; i < this.config.particle.dustCount; i++) {
      const ms = new THREE.Mesh(g, m);
      ms.scale.setScalar(0.5 + Math.random());
      this.mainGroup.add(ms);
      this.particles.push(new Particle(ms, 'DUST', true));
    }
  }

  public updateSnow() {
    this.createSnow();
  }

  private createSnow() {
    if (this.snowInstancedMesh) {
      this.scene.remove(this.snowInstancedMesh);
      this.snowInstancedMesh.geometry.dispose();
      (this.snowInstancedMesh.material as THREE.Material).dispose();
      this.snowInstancedMesh = null;
      this.snowData = [];
    }
    if (this.config.snow.count <= 0) return;

    const g = new THREE.IcosahedronGeometry(this.config.snow.size, 0);
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.15, transmission: 0.9, thickness: 0.5, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.1, ior: 1.33 });
    
    this.snowInstancedMesh = new THREE.InstancedMesh(g, m, this.config.snow.count);
    this.snowInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const range = 70;
    for (let i = 0; i < this.config.snow.count; i++) {
      this.snowDummy.position.set((Math.random() - 0.5) * range, Math.random() * range, (Math.random() - 0.5) * range);
      this.snowDummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const s = 0.5 + Math.random() * 0.1;
      this.snowDummy.scale.set(s, s, s);
      this.snowDummy.updateMatrix();
      this.snowInstancedMesh.setMatrixAt(i, this.snowDummy.matrix);
      this.snowData.push({ vy: (Math.random() * 0.5 + 0.8), rx: (Math.random() - 0.5) * 2, ry: (Math.random() - 0.5) * 2, rz: (Math.random() - 0.5) * 2 });
    }
    this.scene.add(this.snowInstancedMesh);
  }

  // --- Photo Management ---
  
  public addPhotos(photos: SavedPhoto[]) {
      // Clear existing photo meshes from logic (not memory, assuming DB handles source)
      // Actually we need to rebuild the photo meshes.
      // 1. Identify particles that are PHOTOS
      const photoParticles = this.particles.filter(p => p.type === 'PHOTO');
      
      // 2. Remove their meshes from scene group
      photoParticles.forEach(p => this.photoMeshGroup.remove(p.mesh));
      
      // 3. Remove from particle array
      this.particles = this.particles.filter(p => p.type !== 'PHOTO');
      
      // 4. Create new ones
      photos.forEach(photo => this.createPhotoTexture(photo.data, photo.id));
  }
  
  public createPhotoTexture(base64: string, id: string) {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          this.addPhotoToScene(tex, id, img);
      };
  }
  
  private addPhotoToScene(tex: THREE.Texture, id: string, imgObj: HTMLImageElement) {
      const aspect = imgObj.width / imgObj.height;
      let w = 1.2, h = 1.2;
      if (aspect > 1) h = w / aspect;
      else w = h * aspect;

      const frameGeo = new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.05);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.5 });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      
      const planeGeo = new THREE.PlaneGeometry(w, h);
      const planeMat = new THREE.MeshBasicMaterial({ map: tex });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.z = 0.04;

      const group = new THREE.Group();
      group.add(frame);
      group.add(plane);
      const s = 0.8;
      group.scale.set(s, s, s);
      
      this.photoMeshGroup.add(group);
      
      const p = new Particle(group, 'PHOTO', false);
      p.photoId = id;
      p.texture = tex;
      this.particles.push(p);
  }

  public removePhoto(id: string) {
      const p = this.particles.find(pa => pa.photoId === id);
      if (p) {
          this.photoMeshGroup.remove(p.mesh);
          this.particles.splice(this.particles.indexOf(p), 1);
      }
  }

  // --- MediaPipe ---
  
  private async initMediaPipe() {
      try {
          const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                  modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                  delegate: "GPU"
              },
              runningMode: "VIDEO",
              numHands: 1
          });
          this.predictWebcam();
      } catch (e) {
          console.error("MediaPipe failed:", e);
      }
  }

  private predictWebcam = () => {
      if (this.videoElement && this.videoElement.currentTime !== this.lastVideoTime && this.handLandmarker) {
          this.lastVideoTime = this.videoElement.currentTime;
          const result = this.handLandmarker.detectForVideo(this.videoElement, performance.now());
          
          const isDetected = result.landmarks.length > 0;
          if (this.onHandStatusChange) this.onHandStatusChange(isDetected);
          
          if (isDetected) {
              this.handState.detected = true;
              const lm = result.landmarks[0];
              this.handState.x = (lm[9].x - 0.5) * 2;
              this.handState.y = (lm[9].y - 0.5) * 2;
              
              const thumb = lm[4], index = lm[8], wrist = lm[0], middle = lm[12];
              const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
              const openDist = Math.hypot(middle.x - wrist.x, middle.y - wrist.y);
              
              if (this.mode === 'FOCUS') {
                  if (pinchDist > 0.1) this.setMode('SCATTER');
              } else {
                   if (pinchDist < 0.05) this.triggerPhotoGrab();
                   else if (openDist > 0.4) this.setMode('SCATTER');
                   else if (openDist < 0.2) this.setMode('TREE');
              }
          } else {
              this.handState.detected = false;
          }
      }
      requestAnimationFrame(this.predictWebcam);
  }

  // --- Interaction ---

  public setMode(mode: SceneMode) {
      this.mode = mode;
      this.focusTarget = null;
      // You might emit this state change back to React if needed
  }

  public triggerPhotoGrab() {
      let closest: THREE.Object3D | null = null;
      let minDst = Infinity;
      this.focusType = Math.floor(Math.random() * 4);
      
      const photos = this.particles.filter(p => p.type === 'PHOTO');
      photos.forEach(p => {
          p.mesh.updateMatrixWorld();
          const pos = new THREE.Vector3();
          p.mesh.getWorldPosition(pos);
          const screenPos = pos.project(this.camera);
          const d = Math.hypot(screenPos.x, screenPos.y);
          // Grab radius check (approx)
          if (screenPos.z < 1 && d < 0.25) {
              if (d < minDst) {
                  minDst = d;
                  closest = p.mesh;
              }
          }
      });

      if (closest) {
          this.setMode('FOCUS');
          this.focusTarget = closest;
      } else {
          this.setMode('SCATTER');
      }
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    const et = this.clock.getElapsedTime();

    // Snow animation
    if (this.snowInstancedMesh && this.mode === 'TREE') {
        this.snowInstancedMesh.visible = true;
        const range = 70;
        for (let i = 0; i < this.config.snow.count; i++) {
            this.snowInstancedMesh.getMatrixAt(i, this.snowDummy.matrix);
            this.snowDummy.matrix.decompose(this.snowDummy.position, this.snowDummy.quaternion, this.snowDummy.scale);
            const d = this.snowData[i];
            
            this.snowDummy.position.y -= d.vy * this.config.snow.speed * dt;
            this.snowDummy.position.x += Math.sin(et * 0.5 + i) * 2.5 * dt;
            this.snowDummy.position.z += Math.cos(et * 0.3 + i) * 1.5 * dt;

            if (this.snowDummy.position.y < -25) {
                this.snowDummy.position.y = 40;
                this.snowDummy.position.x = (Math.random() - 0.5) * range;
                this.snowDummy.position.z = (Math.random() - 0.5) * range;
            }
            this.snowDummy.updateMatrix();
            this.snowInstancedMesh.setMatrixAt(i, this.snowDummy.matrix);
        }
        this.snowInstancedMesh.instanceMatrix.needsUpdate = true;
    } else if (this.snowInstancedMesh) {
        this.snowInstancedMesh.visible = false;
    }

    // Rotation
    if (this.manualRotate.x !== 0 || this.manualRotate.y !== 0) {
        const s = this.config.rotationSpeed * 2.0;
        this.rotation.x += this.manualRotate.x * s * dt;
        this.rotation.y += this.manualRotate.y * s * dt;
    } else if (this.mode === 'SCATTER' && this.handState.detected) {
        const th = 0.3;
        const s = this.config.rotationSpeed;
        if (this.handState.x > th) this.rotation.y -= s * dt * (this.handState.x - th);
        else if (this.handState.x < -th) this.rotation.y -= s * dt * (this.handState.x + th);
        if (this.handState.y < -th) this.rotation.x += s * dt * (-this.handState.y - th);
        else if (this.handState.y > th) this.rotation.x -= s * dt * (this.handState.y - th);
    } else {
        if (this.mode === 'TREE') {
            this.rotation.y += 0.3 * dt;
            this.rotation.x += (0 - this.rotation.x) * 2.0 * dt;
        } else {
            this.rotation.y += 0.1 * dt;
        }
    }

    this.mainGroup.rotation.y = this.rotation.y;
    this.mainGroup.rotation.x = this.rotation.x;

    this.particles.forEach(p => p.update(dt, this.mode, this.focusTarget, et, this.focusType, this.mainGroup.matrixWorld, this.camera.position));
    this.composer.render();
  }

  public cleanup() {
      // Basic cleanup
      window.removeEventListener('resize', this.onResize);
      this.renderer.dispose();
      this.renderer.domElement.remove();
  }
}