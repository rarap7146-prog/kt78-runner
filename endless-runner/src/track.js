import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';

export default class Track {
  constructor(scene){
    this.scene = scene;
    this.segments = [];
    this.segmentLength = 30;
    this.poolLength = 6; // number of segments
    this.baseZ = 0;

    const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    for(let i=0;i<this.poolLength;i++){
      const geo = new THREE.BoxGeometry(8, 0.1, this.segmentLength);
      const mesh = new THREE.Mesh(geo, mat);
      // place segments upward (z increasing)
      mesh.position.set(0, 0, i*this.segmentLength);
      scene.add(mesh);
      this.segments.push(mesh);
    }
  }

  update(dt, playerZ, speed){ // ⬅️ Add a speed parameter
    // move segments toward player based on speed
    for(const seg of this.segments){
      seg.position.z += speed * dt;
      // if segment is too far behind player, move it ahead
      if(seg.position.z > playerZ + this.segmentLength * (this.poolLength / 2)){
        seg.position.z -= this.segmentLength * this.poolLength;
      }
    }
  }
}