import * as THREE from 'three';
import { gsap } from 'gsap';

const BALL_COUNT = 90;
const FIELD = { x: 46, y: 30, z: 34 };

/** Soft radial sprite used for the drifting dust motes. */
function glowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Background {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
    this.speedBoost = 0;
    this.running = true;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#04121c');
    this.scene.fog = new THREE.FogExp2('#04121c', 0.021);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    this.camera.position.set(0, 7, 34);
    this.camera.lookAt(0, 1, 0);

    this.buildLights();
    this.buildFloor();
    this.buildBalls();
    this.buildMotes();
    this.buildPulseRing();

    this.clock = new THREE.Clock();
    this.onResize = this.onResize.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onResize();

    this.renderer.setAnimationLoop(() => this.tick());
  }

  /* ------------------------------------------------------------- scene */

  buildLights() {
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.55));
    this.keyLight = new THREE.PointLight('#c6ff2e', 220, 120, 2);
    this.keyLight.position.set(-16, 16, 14);
    this.rimLight = new THREE.PointLight('#00e5b0', 160, 120, 2);
    this.rimLight.position.set(18, 10, -8);
    this.scene.add(this.keyLight, this.rimLight);
  }

  buildFloor() {
    // 260/100 gives an exact 2.6 cell so the scroll below loops seamlessly.
    // Vertex colours stay bright because the material colour tints them.
    this.grid = new THREE.GridHelper(260, 100, '#ffffff', '#93b4c6');
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.22;
    this.grid.position.y = -9;
    this.scene.add(this.grid);

    // Court outline — rebuilt whenever the sport changes.
    this.courtMaterial = new THREE.LineBasicMaterial({
      color: '#c6ff2e',
      transparent: true,
      opacity: 0.55,
    });
    this.court = new THREE.LineSegments(new THREE.BufferGeometry(), this.courtMaterial);
    this.court.rotation.x = -Math.PI / 2;
    this.court.position.set(0, -6.5, -6);
    this.scene.add(this.court);
  }

  buildBalls() {
    const geo = new THREE.SphereGeometry(0.52, 20, 16);
    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: '#d8ff3d',
      emissive: '#d8ff3d',
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.1,
    });
    this.balls = new THREE.InstancedMesh(geo, this.ballMaterial, BALL_COUNT);
    this.balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ballData = [];
    for (let i = 0; i < BALL_COUNT; i++) {
      this.ballData.push({
        x: (Math.random() - 0.5) * FIELD.x,
        y: (Math.random() - 0.5) * FIELD.y,
        z: -Math.random() * FIELD.z - 2,
        scale: 0.4 + Math.random() * 1.5,
        speed: 0.6 + Math.random() * 1.6,
        sway: Math.random() * Math.PI * 2,
        swayAmp: 0.4 + Math.random() * 1.4,
        spin: (Math.random() - 0.5) * 1.6,
      });
    }
    this.scene.add(this.balls);
    this.dummy = new THREE.Object3D();
  }

  buildMotes() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FIELD.x * 1.6;
      positions[i * 3 + 1] = (Math.random() - 0.5) * FIELD.y * 1.4;
      positions[i * 3 + 2] = -Math.random() * FIELD.z * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.moteMaterial = new THREE.PointsMaterial({
      size: 0.9,
      map: glowTexture(),
      color: '#00e5b0',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, this.moteMaterial);
    this.scene.add(this.motes);
  }

  buildPulseRing() {
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.5, 64), this.ringMaterial);
    this.ring.position.set(0, 2, -4);
    this.ring.scale.setScalar(0.01);
    this.scene.add(this.ring);
  }

  /* -------------------------------------------------------------- theme */

  setSport(sport) {
    // Court geometry, scaled so any sport fills a similar footprint.
    const scale = Math.min(40 / sport.size.w, 52 / sport.size.l);
    const points = [];
    for (const [x1, z1, x2, z2] of sport.lines) {
      points.push(x1 * scale, z1 * scale, 0, x2 * scale, z2 * scale, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.court.geometry.dispose();
    this.court.geometry = geo;

    tweenColor(this.scene.background, sport.bg);
    tweenColor(this.scene.fog.color, sport.bg);
    tweenColor(this.courtMaterial.color, sport.accent);
    tweenColor(this.ballMaterial.color, sport.ball);
    tweenColor(this.ballMaterial.emissive, sport.ball);
    tweenColor(this.moteMaterial.color, sport.accent2);
    tweenColor(this.keyLight.color, sport.accent);
    tweenColor(this.rimLight.color, sport.accent2);
    tweenColor(this.grid.material.color, sport.accent2);
  }

  /** Burst of energy when a winner is declared. */
  pulse(color = '#ffffff') {
    this.ringMaterial.color.set(color);
    gsap.killTweensOf([this.ring.scale, this.ringMaterial]);
    this.ring.scale.setScalar(0.2);
    this.ringMaterial.opacity = 0.9;
    gsap.to(this.ring.scale, { x: 9, y: 9, z: 9, duration: 1.2, ease: 'power2.out' });
    gsap.to(this.ringMaterial, { opacity: 0, duration: 1.2, ease: 'power2.out' });
    gsap.fromTo(
      this,
      { speedBoost: 9 },
      { speedBoost: 0, duration: 1.6, ease: 'power2.out' },
    );
    gsap.fromTo(
      this.keyLight,
      { intensity: 900 },
      { intensity: 220, duration: 1.1, ease: 'power2.out' },
    );
  }

  /* ---------------------------------------------------------- lifecycle */

  onPointer(event) {
    this.target.x = (event.clientX / window.innerWidth - 0.5) * 2;
    this.target.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  onVisibility() {
    this.running = !document.hidden;
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // eased camera parallax
    this.pointer.x += (this.target.x - this.pointer.x) * 0.045;
    this.pointer.y += (this.target.y - this.pointer.y) * 0.045;
    this.camera.position.x = this.pointer.x * 4.5;
    this.camera.position.y = 7 - this.pointer.y * 2.6;
    this.camera.lookAt(0, 1, -4);

    const boost = 1 + this.speedBoost;
    for (let i = 0; i < BALL_COUNT; i++) {
      const b = this.ballData[i];
      b.y += b.speed * dt * boost;
      b.sway += dt * 0.8;
      if (b.y > FIELD.y / 2 + 4) {
        b.y = -FIELD.y / 2 - 4;
        b.x = (Math.random() - 0.5) * FIELD.x;
        b.z = -Math.random() * FIELD.z - 2;
      }
      this.dummy.position.set(b.x + Math.sin(b.sway) * b.swayAmp, b.y, b.z);
      this.dummy.rotation.set(t * b.spin, t * b.spin * 0.7, 0);
      this.dummy.scale.setScalar(b.scale);
      this.dummy.updateMatrix();
      this.balls.setMatrixAt(i, this.dummy.matrix);
    }
    this.balls.instanceMatrix.needsUpdate = true;

    this.court.rotation.z += dt * 0.045;
    this.court.position.y = -6.5 + Math.sin(t * 0.5) * 0.5;
    this.motes.rotation.y += dt * 0.02;
    this.grid.position.z = ((t * 2.4) % 2.6) - 1.3;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
  }
}

function tweenColor(target, hex) {
  const to = new THREE.Color(hex);
  gsap.to(target, { r: to.r, g: to.g, b: to.b, duration: 0.9, ease: 'power2.inOut' });
}
