import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';

export default class Gates {
  constructor(scene) {
    this.scene = scene;
    this.gatePairs = []; // active gate pairs {left: {mesh, modifier}, right: {mesh, modifier}, z}
    this.pool = [];
    this._nextSpawnZ = 20; // posisi gate pertama
    this._staticGateCount = 0; // penghitung internal untuk 3 gate pertama
    this.visible = true; // a new property to track global gate visibility
    // precreate pool
    for (let i = 0; i < 20; i++) this.pool.push(this._createGateMesh());
  }

  // Hide all gates (for zombie phase)
  hideAll() {
    this.visible = false;
    for (const pair of this.gatePairs) {
      if (pair.left.mesh) pair.left.mesh.visible = false;
      if (pair.right.mesh) pair.right.mesh.visible = false;
    }
  }

  // Show all gates (for after zombie phase)
  showAll() {
    this.visible = true;
    for (const pair of this.gatePairs) {
      if (pair.left.mesh) pair.left.mesh.visible = true;
      if (pair.right.mesh) pair.right.mesh.visible = true;
    }
  }

  _createGateMesh() {
    // Track width is 8 units (left -2, right 2), so each gate is 4 units wide and touch at center
    const geo = new THREE.BoxGeometry(4.0, 2.2, 0.6); // width 4.0, height 2.2, depth 0.6
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }); // putih semi transparan
    const mesh = new THREE.Mesh(geo, mat);
    // Tambahkan border hitam di tepi gate
    const borderGeo = new THREE.EdgesGeometry(geo);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    mesh.add(border);
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  update(dt, playerZ, player, onPass) {
    if (!this.visible) return; // do not update if gates are hidden

    // Jika tidak ada gate aktif dalam 10 unit di depan player, spawn pasangan baru
    const activeAhead = this.gatePairs.some(pair => pair.z > playerZ && pair.z < playerZ + 10 && (pair.left.mesh.visible || pair.right.mesh.visible));
    if (!activeAhead) {
      this._spawnPairAt(this._nextSpawnZ);
      this._nextSpawnZ += 30; // jarak antar baris gate lebih jauh
    }

    // Semua gate bergerak ke arah player
    for (let i = 0; i < this.gatePairs.length; i++) {
      const pair = this.gatePairs[i];
      pair.z -= player.speed * dt;
      pair.left.mesh.position.z = pair.z;
      pair.right.mesh.position.z = pair.z;
    }

    // Set untuk mencatat baris z yang sudah di-trigger
    if (!this._triggeredZ) this._triggeredZ = new Set();

    for (let i = 0; i < this.gatePairs.length; i++) {
      const pair = this.gatePairs[i];
      if (pair.sudahTriggered) continue;
      // Hanya satu gate per baris yang bisa diambil per frame
      if (pair.left.mesh.visible && Math.abs(pair.z - playerZ) < 0.7 && Math.abs(pair.left.mesh.position.x - player.mesh.position.x) < 2.1) {
        pair.left.mesh.visible = false;
        this.pool.push(pair.left.mesh);
        if (pair.right.mesh.visible) { pair.right.mesh.visible = false; this.pool.push(pair.right.mesh); }
        if (typeof onPass === 'function') onPass(pair.left.modifier);
        pair.sudahTriggered = true;
        continue;
      }
      if (pair.right.mesh.visible && Math.abs(pair.z - playerZ) < 0.7 && Math.abs(pair.right.mesh.position.x - player.mesh.position.x) < 2.1) {
        pair.right.mesh.visible = false;
        this.pool.push(pair.right.mesh);
        if (pair.left.mesh.visible) { pair.left.mesh.visible = false; this.pool.push(pair.left.mesh); }
        if (typeof onPass === 'function') onPass(pair.right.modifier);
        pair.sudahTriggered = true;
        continue;
      }
    }
    // Buang gate yang sudah tidak visible sama sekali dan sudah jauh di belakang player
    this.gatePairs = this.gatePairs.filter(pair => (pair.left.mesh.visible || pair.right.mesh.visible) || pair.z > playerZ - 20);
  }

  _spawnPairAt(z) {
    // Place left gate at x=-2, right gate at x=2 (so they touch at center, no gap)
    const leftX = -2;
    const rightX = 2;
    const meshL = this.pool.pop() || this._createGateMesh();
    const meshR = this.pool.pop() || this._createGateMesh();
    const mods = this._randomModifiersPair();
    this._clearLabels(meshL);
    this._clearLabels(meshR);
    meshL.scale.set(1.0, 1, 1);
    meshR.scale.set(1.0, 1, 1);
    meshL.position.set(leftX, 1, z);
    meshL.visible = true;
    meshL.userData = { label: mods.left.label };
    meshR.position.set(rightX, 1, z);
    meshR.visible = true;
    meshR.userData = { label: mods.right.label };
    this._attachLabelSprite(meshL, mods.left.label);
    this._attachLabelSprite(meshR, mods.right.label);
    this.gatePairs.push({ left: { mesh: meshL, modifier: mods.left }, right: { mesh: meshR, modifier: mods.right }, z, sudahTriggered: false }); // Reset flag
  }

  _randomModifiersPair() {
    // generate formulas: +n, -n, *n, /n
    const types = ['mul', 'div', 'add', 'sub'];
    function pick(safe = false, power = 1) {
      let t, v, label, valid = false;
      while (!valid) {
        t = types[Math.floor(Math.random() * types.length)];
        switch (t) {
          case 'mul':
            v = 2 + Math.floor(Math.random() * 4); // 2..5
            label = `x${v}`;
            valid = !safe || (power * v >= 0);
            break;
          case 'div':
            v = 5 + Math.floor(Math.random() * 6); // 5..10
            label = `/${v}`;
            valid = !safe || (power / v >= 0);
            break;
          case 'add':
            v = 10 + Math.floor(Math.random() * 99); // 10..99
            label = `+${v}`;
            valid = !safe || (power + v >= 0);
            break;
          case 'sub':
            v = 10 + Math.floor(Math.random() * 200); // 10..200
            label = `-${v}`;
            valid = !safe || (power - v >= 0);
            break;
        }
      }
      return { type: t, value: v, label };
    }

    if (this._staticGateCount < 3) {
      // 3 gate pertama benar-benar statis: (+2,+3), (+3,+4), (+4,+5)
      const preset = [
        { left: { type: 'add', value: 2, label: '+2' }, right: { type: 'add', value: 3, label: '+3' } },
        { left: { type: 'add', value: 3, label: '+3' }, right: { type: 'add', value: 4, label: '+4' } },
        { left: { type: 'add', value: 4, label: '+4' }, right: { type: 'add', value: 5, label: '+5' } }
      ];
      const result = preset[this._staticGateCount];
      this._staticGateCount++;
      return result;
    }
    
    let a, b;
    // Logic for after the first 3 gates
    const safe = true; // or false, depending on desired difficulty
    const power = 1; // You might want to pass the real player power here
    a = pick(safe, power); 
    b = pick(safe, power);
    while (a.label === b.label) b = pick(safe, power);

    return { left: a, right: b };
  }

  _attachLabelSprite(mesh, text) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');
    // label: background hitam solid, teks putih tebal, kontras tinggi
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.2, 0.8, 1); // tetap besar
    sprite.position.set(0, 0, 0.35); // tepat di tengah permukaan depan gate
    sprite.userData.isLabel = true;
    mesh.add(sprite);
  }

  _clearLabels(mesh) {
    for (let i = mesh.children.length - 1; i >= 0; i--) {
      const c = mesh.children[i];
      if (c.userData && c.userData.isLabel) {
        if (c.material) {
          if (c.material.map) c.material.map.dispose();
          c.material.dispose();
        }
        if (c.geometry) c.geometry.dispose();
        mesh.remove(c);
      }
    }
  }
}