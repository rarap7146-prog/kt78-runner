// Format large numbers as 1K, 1M, 1B, etc.
function formatNumberShort(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
  return n.toString();
}
// Add a zombie timer overlay to the DOM
function createZombieTimerOverlay() {
  let timer = document.getElementById('zombie-timer');
  if (!timer) {
    timer = document.createElement('div');
    timer.id = 'zombie-timer';
    timer.style.position = 'absolute';
    timer.style.top = '60px';
    timer.style.left = '50%';
    timer.style.transform = 'translateX(-50%)';
    timer.style.fontSize = '2.2em';
    timer.style.fontWeight = 'bold';
    timer.style.color = '#ff4444';
    timer.style.background = 'rgba(0,0,0,0.7)';
    timer.style.padding = '10px 32px';
    timer.style.borderRadius = '12px';
    timer.style.zIndex = 100;
    timer.style.display = 'none';
    document.body.appendChild(timer);
  }
  return timer;
}

// Global helper function to create a random modifier
function pickRandomModifier() {
  const types = ['mul', 'div', 'add', 'sub']; // Removed 'sqrt'
  let t, v, label;
  t = types[Math.floor(Math.random() * types.length)];
  switch (t) {
    case 'mul': v = 2 + Math.floor(Math.random() * 4); label = `x${v}`; break;
    case 'div': v = 5 + Math.floor(Math.random() * 6); label = `/${v}`; break;
    case 'add': v = 10 + Math.floor(Math.random() * 99); label = `+${v}`; break;
    case 'sub': v = 10 + Math.floor(Math.random() * 200); label = `-${v}`; break;
    default: v = 1; label = 'x1'; break;
  }
  return { type: t, value: v, label };
}

import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';

import Player from './player.js';
import Track from './track.js';
import Gates from './gates.js';
import UI from './ui.js';
import Zombie from './zombies.js';

export default class Game {
  constructor({ container = document.body, onGameOver = () => {} } = {}) {
    this.zombieTimerOverlay = createZombieTimerOverlay();
    this.container = container;
    this.onGameOver = onGameOver;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 4, -19);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x222222);
    this.container.appendChild(this.renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 10, -10);
    this.scene.add(light);

    this.track = new Track(this.scene);
    this.player = new Player(this.scene);
    this.gates = new Gates(this.scene);
    this.ui = new UI({ game: this });
    this.zombie = new Zombie(this.scene);
    this.zombieMode = false;
    this.zombieTimer = 0;
    this.bullets = [];
    this.zombieHpLabel = null;

    this.clock = new THREE.Clock();
    this.running = false;
    this.score = 0;
    this.gateCount = 0;
    this.zombieLevel = 0;
    this.trackSpeed = 5;

    this._boundStep = this.step.bind(this);
  }

  start() {
    this.running = true;
    this.clock.start();
    requestAnimationFrame(this._boundStep);
  }

  dispose() {
    this.running = false;
    if (this.renderer && this.renderer.domElement) this.container.removeChild(this.renderer.domElement);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  step() {
    if (!this.running) return;
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    this.track.update(dt, this.player.mesh.position.z, this.trackSpeed);
    
    if (!this.zombieMode) {
      this.player.update(dt);
      this.gates.update(dt, this.player.mesh.position.z, this.player, (modifier) => {
        this.player.applyModifier(modifier);
  this.ui.updatePower(formatNumberShort(this.player.power));
        this.gateCount++;
        this.score++; // Score for passing a gate
        this.ui.updateScore(this.score);

        // Increase track speed gradually
        this.trackSpeed = Math.min(20, 5 + Math.floor(this.gateCount / 10));

        if (this.player.power < 0) this.endGame();
        // Check for zombie spawn after every 5 gates
        if (this.gateCount % 5 === 0 && this.gateCount !== 0) {
            this.startZombieMode();
        }
      });
      // Hide zombie timer overlay if not in zombie mode
      if (this.zombieTimerOverlay) this.zombieTimerOverlay.style.display = 'none';
    } else {
      this.zombie.update(dt, this.player.mesh.position.z, this.trackSpeed);
      this.zombieTimer += dt;
      // Show and update zombie timer overlay
      if (this.zombieTimerOverlay) {
        this.zombieTimerOverlay.style.display = 'block';
        const timeLeft = Math.max(0, Math.ceil(this.zombie.duration - this.zombie.timer));
        this.zombieTimerOverlay.textContent = `Boss Spawn: ${timeLeft}s`;
      }
      if (this.zombie.active && this.zombieTimer > 0.2) {
        this.zombie.hit(this.player.power);
        this.spawnBullet();
        this._updateZombieHpLabel();
        this.zombieTimer = 0;
      }
      // If zombie is defeated, clear all bullets
      if (!this.zombie.active && this.bullets.length > 0) {
        this._clearAllBullets();
        if (this.zombieTimerOverlay) this.zombieTimerOverlay.style.display = 'none';
        this.zombieLevel++;
      }
      this.updateBullets(dt);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._boundStep);
  }

  endGame() {
    this.running = false;
    if (this.zombieTimerOverlay) this.zombieTimerOverlay.style.display = 'none';
    if (typeof this.onGameOver === 'function') {
      this.onGameOver(this.score);
    }
  }

  // Animate player flying backward (scatter)
  _animatePlayerScatter() {
    const mesh = this.player.mesh;
    let t = 0;
    const duration = 0.7;
    const start = mesh.position.clone();
    const end = start.clone().add(new THREE.Vector3(0, 2, -10));
    const animate = () => {
      t += 1 / 60;
      mesh.position.lerpVectors(start, end, Math.min(t / duration, 1));
      mesh.rotation.x += 0.2;
      mesh.rotation.z += 0.1;
      if (t < duration) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  spawnBullet() {
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffee00 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.player.mesh.position.x, 1.2, this.player.mesh.position.z);
    this.scene.add(mesh);
    this.bullets.push({ mesh, t: 0, duration: 0.25 });
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.t += dt / b.duration;
      const t = Math.min(b.t, 1);
      if (this.zombie && this.zombie.mesh) {
        b.mesh.position.lerpVectors(
          new THREE.Vector3(this.player.mesh.position.x, 1.2, this.player.mesh.position.z),
          new THREE.Vector3(this.zombie.mesh.position.x, 1.8, this.zombie.mesh.position.z),
          t
        );
      }
      if (b.t >= 1) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }

  startZombieMode() {
    this.zombieMode = true;
    this.zombieTimer = 0;

    // Simulate future power after 5 gates with up to 1 mistake
    const simulatedPower = this._simulateFuturePower(this.player.power, 5, 1);
    // Dynamic HP and duration for zombie
    const dynamicHP = Math.max(20, Math.round(simulatedPower * (10 + this.zombieLevel * 2)));
    const dynamicDuration = Math.max(0, 10 - Math.round(this.zombieLevel * 0.5));
    this.zombie.level = this.zombieLevel;

    // Hide all gates when zombie spawns, show all when zombie is defeated
    const hideGatesBehindZombie = () => {
      if (this.gates && typeof this.gates.hideAll === 'function') {
        this.gates.hideAll();
      }
    };
    const respawnGates = () => {
      if (this.gates && typeof this.gates.showAll === 'function') {
        this.gates.showAll();
      }
    };

    this.zombie.start(
      dynamicHP,
      dynamicDuration,
      () => {
        this.zombie.shootAtPlayer(this.player.mesh, () => {
          this._animatePlayerScatter();
          if (this.zombieTimerOverlay) this.zombieTimerOverlay.style.display = 'none';
          setTimeout(() => this.endGame(), 700);
        });
      },
      () => {
        // When zombie is defeated
        this.score += 100 + (this.zombieLevel * 50); // Add score for defeating zombie
        this.ui.updateScore(this.score);
        this.zombieMode = false;
        this.gateCount = 0;
        this._removeZombieHpLabel();
      },
      hideGatesBehindZombie,
      respawnGates
    );
    this._showZombieHp();
  }

  // Show zombie HP as floating label
  _showZombieHp() {
    if (this.zombieHpLabel) {
      this._removeZombieHpLabel();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  ctx.fillText(`HP: ${formatNumberShort(this.zombie.hp)}`, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(7, 1.7, 1);
    sprite.position.set(0, 3.5, 0);
    this.zombie.mesh.add(sprite);
    this.zombieHpLabel = sprite;
  }

  // Update zombie HP label after each hit
  _updateZombieHpLabel() {
    if (!this.zombieHpLabel) return;
    const canvas = this.zombieHpLabel.material.map.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  ctx.fillText(`HP: ${formatNumberShort(Math.max(0, Math.floor(this.zombie.hp)))}`, 128, 32);
    this.zombieHpLabel.material.map.needsUpdate = true;
  }

  // Remove zombie HP label
  _removeZombieHpLabel() {
    if (this.zombieHpLabel) {
      if (this.zombieHpLabel.parent) this.zombieHpLabel.parent.remove(this.zombieHpLabel);
      if (this.zombieHpLabel.material && this.zombieHpLabel.material.map) this.zombieHpLabel.material.map.dispose();
      if (this.zombieHpLabel.material) this.zombieHpLabel.material.dispose();
      this.zombieHpLabel = null;
    }
  }

  // Method to remove all bullets from the scene
  _clearAllBullets() {
    for (const b of this.bullets) {
      this.scene.remove(b.mesh);
    }
    this.bullets = [];
  }

  // Simulate the next N gates and return the minimum power after up to maxMistakes
  _simulateFuturePower(currentPower, numGates = 5, maxMistakes = 1) {
    let power = currentPower;
    let mistakes = 0;

    for (let i = 0; i < numGates; i++) {
      // Simulate two random gates and apply the modifier that gives the highest power
      const mod1 = pickRandomModifier();
      const mod2 = pickRandomModifier();
      const powerAfterMod1 = this._applyModifier(power, mod1);
      const powerAfterMod2 = this._applyModifier(power, mod2);

      const best = (powerAfterMod1 > powerAfterMod2) ? mod1 : mod2;
      const worst = (powerAfterMod1 <= powerAfterMod2) ? mod1 : mod2;

      // Simulate: up to maxMistakes, take worst, otherwise best
      if (mistakes < maxMistakes) {
        power = this._applyModifier(power, worst);
        mistakes++;
      } else {
        power = this._applyModifier(power, best);
      }
      
      // Clamp to avoid negative or NaN
      if (!isFinite(power) || power < 0.1) power = 0.1;
    }
    return Math.round(power * 10) / 10;
  }

  // Apply a modifier to a power value
  _applyModifier(power, mod) {
    switch (mod.type) {
      case 'mul': return power * mod.value;
      case 'add': return power + mod.value;
      case 'sub': return power - mod.value;
      case 'div': return Math.max(0.1, power / mod.value);
    }
    return power;
  }
}