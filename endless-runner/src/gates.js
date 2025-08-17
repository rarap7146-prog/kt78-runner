// gates.js - FULL REPLACEMENT
import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';

// =================================================================
// NEW: Helper functions for "Hell Mode" math
// =================================================================
function sumOfDigits(n) {
  let sum = 0;
  // Ensure we're working with an integer
  n = Math.floor(Math.abs(n));
  while (n > 0) {
    sum += n % 10;
    n = Math.floor(n / 10);
  }
  return sum;
}

// MODIFIED: createModifier now handles formulaic types
function createModifier(type, value = 0) {
  let label = '';
  // Standard types
  if (type === 'add') label = `+${value}`;
  else if (type === 'sub') label = `-${value}`;
  else if (type === 'mul') label = `x${value}`;
  else if (type === 'div') label = `/${value}`;
  // Formulaic types
  else if (type === 'sqrt') label = `√x`;
  else if (type === 'sum_digits') label = `+ Σx`; // Σ is the symbol for summation
  else if (type === 'mod') label = `+ (x % ${value})`;
  
  return { type, value, label };
}

export default class Gates {
  constructor(scene) {
    this.scene = scene;
    this.gatePairs = [];
    this.pool = [];
    this.gateSpawnCounter = 0;
    this.visible = true;
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    
    this.currentGauntlet = [];
    this.level = 0;

    for (let i = 0; i < 20; i++) this.pool.push(this._createGateMesh());
  }

  // MODIFIED: The Gauntlet Generator now includes "Hell Mode" for level > 0
  generateGauntlet() {
    console.log(`Generating a new gauntlet for level ${this.level + 1}...`);
    this.currentGauntlet = [];

    // Define pools of modifiers
    const tutorialAdd = (val) => createModifier('add', val);
    const easyAdd = () => createModifier('add', 10 + Math.floor(Math.random() * 41));
    const easySub = () => createModifier('sub', 10 + Math.floor(Math.random() * 41));
    const mediumAdd = () => createModifier('add', 50 + Math.floor(Math.random() * 101));
    const goodMul = () => createModifier('mul', 2);
    
    // "Hell Mode" modifier pool
    const hellModeChoices = [
        () => [createModifier('sqrt'), mediumAdd()],
        () => [createModifier('sum_digits'), easyAdd()],
        () => [createModifier('mod', 100), createModifier('add', 50)],
        () => [goodMul(), createModifier('add', 500 + Math.floor(Math.random() * 500))]
    ];

    for (let i = 0; i < 10; i++) {
        let pair;
        // First 3 gates of any gauntlet are a simple warm-up
        if (i === 0) pair = [tutorialAdd(i + 2), tutorialAdd(i + 3)];
        else if (i === 1) pair = [tutorialAdd(i + 2), tutorialAdd(i + 3)];
        else if (i === 2) pair = [tutorialAdd(i + 2), tutorialAdd(i + 3)];
        else {
            // After the warm-up, the real challenge begins
            if (this.level === 0) { // Level 1 Gauntlet (Easy)
                pair = [easyAdd(), easySub()];
            } else { // Level 2+ Gauntlets ("Hell Mode")
                // Pick a random challenging pair from our hellModeChoices
                const choiceFn = hellModeChoices[Math.floor(Math.random() * hellModeChoices.length)];
                pair = choiceFn();
            }
        }
        
        // Randomly swap the left and right gates for variety
        if (Math.random() > 0.5) [pair[0], pair[1]] = [pair[1], pair[0]];
        this.currentGauntlet.push(pair);
    }
  }

  prepareNextGauntlet() {
    this.level++;
    this.generateGauntlet();
  }
  
  // MODIFIED: The 'onPass' callback now needs to handle our new formulaic types
  // NOTE: This change is actually in game.js, but this is a reminder of the dependency.
  update(dt, playerZ, player, onPass) {
    if (!this.visible) return;

    const activeAhead = this.gatePairs.some(pair => pair.z > playerZ);
    if (!activeAhead && this.gateSpawnCounter < this.currentGauntlet.length) {
      const spawnZ = playerZ + 30;
      this._spawnPairAt(spawnZ);
    }

    for (const pair of this.gatePairs) { pair.z -= window.game.trackSpeed * dt; if (pair.left.mesh) pair.left.mesh.position.z = pair.z; if (pair.right.mesh) pair.right.mesh.position.z = pair.z; }
    for (let i = 0; i < this.gatePairs.length; i++) { const pair = this.gatePairs[i]; if (pair.sudahTriggered) continue; const collisionDistance = 0.7; if (pair.left.mesh.visible && Math.abs(pair.z - playerZ) < collisionDistance && Math.abs(pair.left.mesh.position.x - player.mesh.position.x) < 2.1) { pair.left.mesh.visible = false; if (pair.right.mesh.visible) pair.right.mesh.visible = false; if (typeof onPass === 'function') onPass(pair.left.modifier, pair.right.modifier); pair.sudahTriggered = true; continue; } if (pair.right.mesh.visible && Math.abs(pair.z - playerZ) < collisionDistance && Math.abs(pair.right.mesh.position.x - player.mesh.position.x) < 2.1) { pair.right.mesh.visible = false; if (pair.left.mesh.visible) pair.left.mesh.visible = false; if (typeof onPass === 'function') onPass(pair.right.modifier, pair.left.modifier); pair.sudahTriggered = true; continue; } }
    for (let i = this.gatePairs.length - 1; i >= 0; i--) { const pair = this.gatePairs[i]; if (!pair.left.mesh.visible && !pair.right.mesh.visible && pair.z < playerZ - 20) { this.pool.push(pair.left.mesh); this.pool.push(pair.right.mesh); this.gatePairs.splice(i, 1); } }
  }
  
  // The rest of the functions are unchanged and compacted for brevity
  _spawnPairAt(z) { this.gateSpawnCounter++; const gateIndex = this.gateSpawnCounter - 1; if (!this.currentGauntlet || !this.currentGauntlet[gateIndex]) { console.error(`No gauntlet definition for gate number ${gateIndex + 1}`); return; } const [leftMod, rightMod] = this.currentGauntlet[gateIndex]; const meshL = this.pool.pop() || this._createGateMesh(); const meshR = this.pool.pop() || this._createGateMesh(); this._clearLabels(meshL); this._clearLabels(meshR); meshL.position.set(-2, 1, z); meshR.position.set(2, 1, z); meshL.visible = true; meshR.visible = true; meshL.material = this.material; meshR.material = this.material; this._attachLabelSprite(meshL, leftMod.label); this._attachLabelSprite(meshR, rightMod.label); this.gatePairs.push({ left: { mesh: meshL, modifier: leftMod }, right: { mesh: meshR, modifier: rightMod }, z, sudahTriggered: false }); }
  hideAll() { this.visible = false; for (const pair of this.gatePairs) { if (pair.left.mesh) pair.left.mesh.visible = false; if (pair.right.mesh) pair.right.mesh.visible = false; } }
  showAll() { this.visible = true; for (const pair of this.gatePairs) { if (pair.left.mesh) pair.left.mesh.visible = true; if (pair.right.mesh) pair.right.mesh.visible = true; } }
  _createGateMesh() { const geo = new THREE.BoxGeometry(4.0, 2.2, 0.6); const mesh = new THREE.Mesh(geo, this.material); const borderGeo = new THREE.EdgesGeometry(geo); const borderMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }); const border = new THREE.LineSegments(borderGeo, borderMat); mesh.add(border); mesh.visible = false; this.scene.add(mesh); return mesh; }
  _attachLabelSprite(mesh, text) { const size = 256; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size / 2; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = 'bold 72px Arial'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2); const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true }); const sprite = new THREE.Sprite(spriteMat); sprite.scale.set(2.2, 0.8, 1); sprite.position.set(0, 0, 0.35); sprite.userData.isLabel = true; mesh.add(sprite); }
  _clearLabels(mesh) { for (let i = mesh.children.length - 1; i >= 0; i--) { const c = mesh.children[i]; if (c.userData?.isLabel) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); mesh.remove(c); } } }
  setGateMaterial(material) { if (!material) return; this.material = material; for (const pair of this.gatePairs) { if(pair.left.mesh) pair.left.mesh.material = material; if(pair.right.mesh) pair.right.mesh.material = material; } for (const m of this.pool) { m.material = material; } }
}