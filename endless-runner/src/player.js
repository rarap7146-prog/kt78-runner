import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';

export default class Player {
  constructor(scene){
    this.scene = scene;
    this.lane = 1; // 0 or 1
    this.lanesX = [-2, 2]; // only left and right
    this.targetX = this.lanesX[this.lane];
    this.positionZ = -14; 
    this.speed = 15; 
    this.power = 5;

    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = Math.PI/1;
    this.mesh.position.set(this.targetX, 0.6, this.positionZ);
    scene.add(this.mesh);

    this._input = { left: false, right: false };
    this._bindKeys();
  }

  _bindKeys(){
    window.addEventListener('keydown', (e) => {
      if(e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.moveRight();
      if(e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.moveLeft();
    });
  }

  moveLeft(){
    this.lane = 0;
    this.targetX = this.lanesX[this.lane];
  }
  moveRight(){
    this.lane = 1;
    this.targetX = this.lanesX[this.lane];
  }

  applyModifier(mod){
    switch(mod.type){
      case 'mul': this.power *= mod.value; break;
      case 'add': this.power += mod.value; break;
      case 'sub': this.power -= mod.value; break;
      case 'div': this.power = Math.max(0.1, this.power / mod.value); break;
    }
    this.power = Math.round(this.power*10)/10;
  }

  update(dt, track){
    this.mesh.position.x += (this.targetX - this.mesh.position.x) * 10 * dt;
  }
}