// game.js - FULL REPLACEMENT
import * as THREE from 'three';
import Player from './player.js';
import Track from './track.js';
import Gates from './gates.js';
import UI from './ui.js';
import Zombie from './zombies.js';
import SkinManager from './skin.js';

function formatNumberShort(n) { if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K'; return n.toString(); }

export default class Game {
  constructor({ container = document.body, onGameOver = () => {} } = {}) {
    this.container = container; this.onGameOver = onGameOver; this.width = window.innerWidth; this.height = window.innerHeight;
    window.game = this;
    this.zombieMode = false; this.zombieTimer = 0; this.bullets = []; this._zombieHpOverlay = null;
    this.clock = new THREE.Clock(); this.running = false; this.score = 0; this.gateCount = 0;
    this.trackSpeed = 23;
    this.playerChoices = [];
  }

  async _initAsync() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000); this.camera.position.set(0, 4, -19); this.camera.lookAt(0, 0, 0);
  this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // Mobile crispness without overdraw: clamp DPR
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  this.renderer.setSize(this.width, this.height, false);
  this.renderer.setClearColor(0x222222);
  // Ensure canvas stretches with CSS
  Object.assign(this.renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });
  this.container.appendChild(this.renderer.domElement);
    const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(0, 10, -10); this.scene.add(light);
    
    this.skin = new SkinManager(this.renderer);
    this.track = new Track(this.scene);
    this.gates = new Gates(this.scene);
    this.ui = new UI({ game: this });
    this.player = new Player(this.scene);
    this.zombie = new Zombie(this.scene);

    await Promise.all([ this.player.init(this.skin), this.zombie.init(this.skin) ]);

    this.gates.prepareNextGauntlet();
    this._boundStep = this.step.bind(this);
  this._injectAnimationStyles();
  this._injectResponsiveCss();
  this._attachResizeHandlers();
  this._attachInputHandlers();
  this.onResize();
    this._tryApplySkins();
  }
  
  // NEW: Function to procedurally create the fireball
  _createFireballMesh() {
    // 1. Create a custom twisted, tapered shape
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.1, -0.2),
      new THREE.Vector3(0.1, -0.1, -0.5),
      new THREE.Vector3(0, 0, -1.0)
    ]);
    const geometry = new THREE.TubeGeometry(curve, 20, 0.2, 5, false);

    // 2. Create the animated fire shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        color: { value: new THREE.Color(0xffaa33) } // Base color of the fire
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        float noise(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.x += sin(pos.z * 5.0 + time * 3.0) * 0.1;
          pos.y += cos(pos.z * 4.0 + time * 3.5) * 0.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        float noise(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
        void main() {
          float gradient = vUv.y;
          vec3 fireColor = mix(color, vec3(1.0, 0.2, 0.0), gradient);
          float turbulence = noise(vUv * 5.0 - time * 2.0);
          fireColor = mix(fireColor, vec3(1.0, 1.0, 0.8), turbulence * 0.5);
          gl_FragColor = vec4(fireColor, gradient);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Add a point light to make it cast light on the scene
    const pointLight = new THREE.PointLight(0xffaa33, 1, 3);
    mesh.add(pointLight);

    return mesh;
  }

  // MODIFIED: This now calls the fireball creator
  spawnBullet() {
    const mesh = this._createFireballMesh();
    
    mesh.scale.set(0.5, 0.5, 0.5);
    mesh.position.copy(this.player.mesh.position).setY(1.8);
    
    this.scene.add(mesh);
    this.bullets.push({
      mesh: mesh,
      t: 0,
      duration: 0.25,
      material: mesh.material,
    });
  }
  
  // MODIFIED: This now updates the fireball's shader
  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.t += dt / b.duration;

      if (b.material) {
        b.material.uniforms.time.value += dt * 5.0;
      }
      
      if (b.t >= 1) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      } else if (this.zombie.mesh) {
        const startPos = this.player.mesh.position.clone().setY(1.8);
        const endPos = this.zombie.mesh.position.clone().setY(3);
        b.mesh.position.lerpVectors(startPos, endPos, b.t);
      }
    }
  }

  // All other functions are unchanged and compacted for brevity
  step() { if (!this.running) return; const dt = this.clock.getDelta(); this.track.update(dt, this.player.mesh.position.z, this.trackSpeed); if (!this.zombieMode) { this.player.update(dt); this.gates.update(dt, this.player.mesh.position.z, this.player, (chosenModifier, otherModifier) => { const powerBefore = this.player.power; const outcomeChosen = this._applyModifier(powerBefore, chosenModifier); const outcomeOther = this._applyModifier(powerBefore, otherModifier); this.playerChoices.push(outcomeChosen >= outcomeOther ? 'good' : 'bad'); this.player.applyModifier(chosenModifier); this.ui.updatePower(formatNumberShort(this.player.power)); this.gateCount++; this.score++; this.ui.updateScore(this.score); this.trackSpeed = Math.min(50, 23 + Math.floor(this.gateCount / 10)); if (this.player.power < 1) this.endGame(); const gauntletLength = this.gates.currentGauntlet.length; if (this.gateCount >= gauntletLength) { this.startZombieMode(); } }); } else { this.player.update(dt); this.zombie.update(dt, this.player.mesh.position.z); this.zombieTimer += dt; const timeLeft = Math.max(0, Math.ceil(this.zombie.duration - this.zombie.timer)); this._updateZombieHpLabel(timeLeft); if (this.zombie.active && this.zombieTimer > 0.2) { this.zombieTimer = 0; const damage = this.player.power; this.spawnBullet(); this._createFloatingDamageLabel(damage); this.zombie.hit(damage); } this.updateBullets(dt); } this.renderer.render(this.scene, this.camera); requestAnimationFrame(this._boundStep); }
  _sumOfDigits(n) { let sum = 0; n = Math.floor(Math.abs(n)); while (n > 0) { sum += n % 10; n = Math.floor(n / 10); } return sum; }
  _applyModifier(power, mod) { switch (mod.type) { case 'mul': return power * mod.value; case 'add': return power + mod.value; case 'sub': return power - mod.value; case 'div': return power / mod.value; case 'sqrt': return Math.sqrt(power); case 'sum_digits': return power + this._sumOfDigits(power); case 'mod': return power + (Math.floor(power) % mod.value); } return power; }
  startZombieMode() { this.zombieMode = true; this.zombieTimer = 0; this.player.enterZombieModeAnimation(); const bossStats = this._calculateBossStats(); this.zombie.start( bossStats.hp, bossStats.duration, () => { this.zombie.shootAtPlayer(this.player.mesh, () => {}); this.zombie.triggerAttackAnimation(() => { this._animatePlayerScatter(); setTimeout(() => this.endGame(), 700); }); }, () => { this.score += 100; this.ui.updateScore(this.score); this.zombieMode = false; this.gateCount = 0; this.playerChoices = []; if (this.gates.gateSpawnCounter) this.gates.gateSpawnCounter = 0; this.player.exitZombieModeAnimation(); this._removeZombieHpLabel(); this._clearAllBullets(); if (typeof this.gates.showAll === 'function') this.gates.showAll(); this.gates.prepareNextGauntlet(); } ); this._showZombieHp(); }
  _calculateBossStats() { const mistakeCount = this.playerChoices.filter(choice => choice === 'bad').length; const baseFightTime = 4; const timePenaltyPerMistake = 4; const desiredFightTime = baseFightTime + (mistakeCount * timePenaltyPerMistake); const damagePerBullet = Math.max(1, this.player.power); const bulletsPerSecond = 5; const bossHP = Math.round(damagePerBullet * bulletsPerSecond * desiredFightTime); const bossDuration = 15; return { hp: bossHP, duration: bossDuration }; }
  _updateZombieHpLabel(timeLeft = 0) { if (!this._zombieHpOverlay) return; const hp = Math.max(0, this.zombie.hp); const maxHp = Math.max(1, this.zombie.maxHP); const percent = Math.max(0, Math.min(1, hp / maxHp)); let titleText = ''; if (hp <= 0) { titleText = 'Boss Defeated!'; } else if (timeLeft > 0) { titleText = `Boss Fight: ${timeLeft}s`; } else { titleText = 'Time\'s Up!'; } document.getElementById('zombie-title').textContent = titleText; document.getElementById('zombie-hp-text').innerHTML = `HP: <b>${formatNumberShort(hp)}</b> / ${formatNumberShort(maxHp)}`; document.getElementById('zombie-hp-fill').style.width = `${percent * 100}%`; }
  async _tryApplySkins() { try { await Promise.allSettled([ this.skin.loadFirstAvailable(['assets/track.png'], { repeat: [1, 4] }).then(tex => this.track.setMaterial(this.skin.makeStandard({ map: tex }))), this.skin.loadFirstAvailable(['assets/gate.png']).then(tex => this.gates.setGateMaterial(this.skin.makeStandard({ map: tex, transparent: true, opacity: 0.9 }))), ]); } catch (error) { console.warn("Skin loading failed:", error); } }
  _injectAnimationStyles() { if (document.getElementById('game-animations')) return; const style = document.createElement('style'); style.id = 'game-animations'; style.innerHTML = ` @keyframes float-and-fade { 0% { opacity: 0; transform: translateY(10px); } 20% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-50px); } } .damage-float-up { animation: float-and-fade 2s ease-out forwards; } `; document.head.appendChild(style); }
  _injectResponsiveCss() { if (document.getElementById('game-responsive')) return; const style = document.createElement('style'); style.id = 'game-responsive'; style.innerHTML = ` html, body { height: 100%; margin: 0; overflow: hidden; } canvas { display: block; } #zombie-hp-overlay { /* respect safe area */ padding-top: calc(env(safe-area-inset-top, 0px) + 12px); } `; document.head.appendChild(style); }
  start() { this.running = true; this.clock.start(); requestAnimationFrame(this._boundStep); }
  dispose() { this.running = false; if (this.renderer?.domElement) this.container.removeChild(this.renderer.domElement); }
  _attachResizeHandlers() { this._boundOnResize = this.onResize.bind(this); window.addEventListener('resize', this._boundOnResize); window.addEventListener('orientationchange', this._boundOnResize); if (window.visualViewport) { window.visualViewport.addEventListener('resize', this._boundOnResize); } }
  _attachInputHandlers() {
    const el = this.renderer?.domElement || window;
    const threshold = 30; // px needed to trigger
    const verticalRestraint = 80; // max vertical movement
    let startX = 0, startY = 0, swiping = false, consumed = false, activePointerId = null;

    const start = (x, y, pointerId) => {
      startX = x; startY = y; swiping = true; consumed = false; activePointerId = pointerId ?? null;
    };
    const move = (x, y) => {
      if (!swiping || consumed) return;
      const dx = x - startX; const dy = y - startY;
      if (Math.abs(dx) >= threshold && Math.abs(dy) <= verticalRestraint) {
        // Fixed: correct swipe direction mapping
        if (dx > 0) this.player.moveLeft(); else this.player.moveRight();
        consumed = true; // prevent multiple triggers per swipe
      }
    };
    const end = () => { swiping = false; consumed = false; activePointerId = null; };

    if (window.PointerEvent) {
      el.addEventListener('pointerdown', (e) => { start(e.clientX, e.clientY, e.pointerId); try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch(_){} });
      el.addEventListener('pointermove', (e) => { if (activePointerId === null || e.pointerId === activePointerId) move(e.clientX, e.clientY); });
      el.addEventListener('pointerup', (e) => { if (activePointerId === null || e.pointerId === activePointerId) end(); });
      el.addEventListener('pointercancel', (e) => { if (activePointerId === null || e.pointerId === activePointerId) end(); });
    } else {
      // Fallback for very old browsers
      el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; start(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchmove', (e) => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchend', () => end());
      el.addEventListener('touchcancel', () => end());
    }
  }
  onResize() {
    // Prefer visualViewport to avoid iOS dynamic toolbar jumpiness
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    this.width = Math.max(1, Math.floor(vw));
    this.height = Math.max(1, Math.floor(vh));
    // Update DPR in case it changed (zoom/rotate)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Update renderer size without overriding CSS size
    this.renderer.setSize(this.width, this.height, false);
    // Camera aspect and adaptive FOV/frame for portrait
    const aspect = this.width / this.height; // < 1 = portrait
    let targetFov = 60;
    if (aspect < 0.75) targetFov = 72; else if (aspect > 2.0) targetFov = 55;
    this.camera.fov = targetFov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Adjust camera framing to keep lanes and UI visible in portrait
    // Base lane half-width ~2. Switch between slight dolly/height to avoid crop
    if (aspect < 0.75) {
      // Back the camera off a bit and raise eye to see more track vertically
      this.camera.position.set(0, 4.5, -21);
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.set(0, 4, -19);
      this.camera.lookAt(0, 0, 0);
    }
  }
  endGame() { this.running = false; this.player.exitZombieModeAnimation(); this._removeZombieHpLabel(); if (typeof this.onGameOver === 'function') this.onGameOver(this.score); }
  _animatePlayerScatter() { const mesh = this.player.mesh; let t = 0; const duration = 0.7; const start = mesh.position.clone(); const end = start.clone().add(new THREE.Vector3(0, 2, -10)); const animate = () => { t += 1 / 60; mesh.position.lerpVectors(start, end, Math.min(t / duration, 1)); mesh.rotation.x += 0.2; if (t < duration) requestAnimationFrame(animate); }; animate(); }
  _showZombieHp() { if (this._zombieHpOverlay) this._removeZombieHpLabel(); let overlay = document.getElementById('zombie-hp-overlay'); if (!overlay) { overlay = document.createElement('div'); overlay.id = 'zombie-hp-overlay'; Object.assign(overlay.style, { position: 'absolute', left: '50%', top: '100px', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '12px 24px', borderRadius: '14px', textAlign: 'center', zIndex: '200', minWidth: '320px', }); overlay.innerHTML = ` <div id="zombie-title" style="font-size:1.5em;color:#ff4444;font-weight:bold;"></div> <div id="zombie-hp-text" style="margin-top:8px;font-size:1.1em;color:#fff;"></div> <div style="background:#333;border-radius:8px;width:260px;height:22px;display:inline-block;overflow:hidden;margin-top:6px;"> <div id="zombie-hp-fill" style="background:#ff4444;width:100%;height:100%;"></div> </div>`; document.body.appendChild(overlay); } this._zombieHpOverlay = overlay; this._updateZombieHpLabel(this.zombie.duration); }
  _createFloatingDamageLabel(damage) { if (!this._zombieHpOverlay || damage <= 0) return; const damageLabel = document.createElement('div'); damageLabel.textContent = `-${formatNumberShort(damage)}`; const randomXOffset = Math.random() * 40 - 20; const randomYOffset = Math.random() * 20 - 10; Object.assign(damageLabel.style, { position: 'absolute', left: `calc(100% + ${randomXOffset}px)`, top: `calc(50px + ${randomYOffset}px)`, transform: 'translateX(-50%)', color: '#ffeb3b', fontSize: '0.6em', fontWeight: 'bold', pointerEvents: 'none', }); damageLabel.className = 'damage-float-up'; damageLabel.addEventListener('animationend', () => damageLabel.remove()); this._zombieHpOverlay.appendChild(damageLabel); }
  _removeZombieHpLabel() { if (this._zombieHpOverlay) { this._zombieHpOverlay.remove(); this._zombieHpOverlay = null; } }
  _clearAllBullets() { this.bullets.forEach(b => this.scene.remove(b.mesh)); this.bullets = []; }
}