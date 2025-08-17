// zombie.js - FULL REPLACEMENT
import * as THREE from 'three';

export default class Zombie {
  constructor(scene) {
    this.scene = scene; this.hp = 0; this.maxHP = 0;
    this.mesh = new THREE.Group(); this.mesh.visible = false; this.scene.add(this.mesh);
    this.active = false; this.timer = 0; this.duration = 10; this._onLose = null; this._onWin = null;
    this.mixer = null; this.animations = {}; this.activeAction = null; this.state = 'inactive';
  }

  async init(skinManager) {
    const gltf = await skinManager.loadGLTF('assets/zombie.glb');
    const model = gltf.scene;
    model.scale.set(0.9, 0.9, 0.9); model.position.y = 1; model.rotation.y = Math.PI;
    this.mesh.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => { this.animations[clip.name] = this.mixer.clipAction(clip); });
  }

  // NEW: A function to create a "saber" style energy bolt
  _createSaberMesh() {
    const saberGroup = new THREE.Group();
    
    // Create the bright, inner core of the bolt
    const coreGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, // Pure white core
      blending: THREE.AdditiveBlending 
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    
    // Create a larger, semi-transparent outer glow
    const glowGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ccff, // Blueish glow
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);

    saberGroup.add(core);
    saberGroup.add(glow);

    // Rotate the group so the cylinder points forward (along Z-axis)
    saberGroup.rotation.x = Math.PI / 2;

    return saberGroup;
  }

  // UPDATED: This function now uses the "saber" projectile logic from Option C
  // Replace the existing shootAtPlayer function in zombie.js with this one

// Replace the existing shootAtPlayer function in zombie.js with this one

shootAtPlayer(playerMesh, onHitCallback) {
  const saber = this._createSaberMesh();
  
  // Correctly calculate the start position from the zombie's front
  const startOffset = new THREE.Vector3(0, 1.8, -1);
  const startPos = this.mesh.localToWorld(startOffset);
  
  const endPos = playerMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  
  saber.position.copy(startPos);
  
  this.scene.add(saber);

  let t = 0;
  const duration = 0.3; // Travel time
  const clock = new THREE.Clock();

  const animate = () => {
    const dt = clock.getDelta();
    t += dt;
    const progress = Math.min(t / duration, 1);
    
    // Animate the position from the zombie to the player
    saber.position.lerpVectors(startPos, endPos, progress);
    
    // Keep the saber aimed at the target as it travels
    saber.lookAt(endPos);
    
    // NEW: Add a slight downward tilt for a more natural look
    saber.rotateX(THREE.MathUtils.degToRad(15)); // Tilt down by 15 degrees
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      this.scene.remove(saber);
      if (onHitCallback) onHitCallback();
    }
  };
  animate();
}
  
  // All other functions are unchanged and compacted for brevity
  playAnimation(name, loop = true) { if (this.activeAction?.getClip().name === name) return; const newAction = this.animations[name]; if (!newAction) { console.warn(`Zombie animation "${name}" not found!`); return; } newAction.reset(); newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); newAction.clampWhenFinished = !loop; if (this.activeAction) { newAction.play(); this.activeAction.crossFadeTo(newAction, 0.3, true); } else { newAction.play(); } this.activeAction = newAction; }
  start(hp, duration, onLose, onWin) { const playerZ = window.game.player.mesh.position.z; this.mesh.position.set(0, 0, playerZ + 20); this.mesh.visible = true; this.active = true; this.timer = 0; this.maxHP = hp; this.hp = this.maxHP; this.duration = duration; this._onLose = onLose; this._onWin = onWin; this.state = 'walking'; this.playAnimation('walk'); }
  update(dt, playerZ) { if (this.mixer && this.mesh.visible) { this.mixer.update(dt); } if (!this.active) return; this.timer += dt; const targetZ = playerZ + 5; if (this.state === 'walking') { const direction = Math.sign(targetZ - this.mesh.position.z); const speed = 2.5; if (Math.abs(targetZ - this.mesh.position.z) > 0.2) { this.mesh.position.z += direction * speed * dt; } else { this.state = 'idle'; this.playAnimation('idle'); } } if (this.timer > this.duration && this.state !== 'attacking') { this.active = false; if (this._onLose) this._onLose(); } }
  triggerAttackAnimation(onCompleteCallback) { this.state = 'attacking'; this.playAnimation('attack-melee-right', false); const onAnimationFinished = (e) => { if (e.action === this.animations['attack-melee-right']) { if (onCompleteCallback) onCompleteCallback(); this.mixer.removeEventListener('finished', onAnimationFinished); } }; this.mixer.addEventListener('finished', onAnimationFinished); }
  hit(damage) { if (!this.active) return; this.hp -= damage; if (this.hp <= 0) { this.active = false; this.mesh.visible = false; if (this._onWin) this._onWin(); } }
}