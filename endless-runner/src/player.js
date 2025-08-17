// player.js - FULL REPLACEMENT
import * as THREE from 'three';

export default class Player {
  constructor(scene){
    this.scene = scene;
    this.lane = 1;
    this.lanesX = [-2, 2];
    this.targetX = this.lanesX[this.lane];
    this.positionZ = -14; 
    this.speed = 15; 
    this.power = 5;
    
    this.mesh = new THREE.Group();
    this.mesh.position.set(this.targetX, 0, this.positionZ);
    scene.add(this.mesh);

    this.mixer = null;
    this.animations = {};
    // NEW: A property to keep track of the currently playing animation
    this.activeAction = null;

    this._bindKeys();
  }

  async init(skinManager) {
    const gltf = await skinManager.loadGLTF('assets/player.glb');
    const model = gltf.scene;
    
    model.scale.set(0.5, 0.5, 0.5);
    model.position.y = 1;
    
    this.mesh.add(model);

    this.mixer = new THREE.AnimationMixer(model);

    gltf.animations.forEach((clip) => {
      this.animations[clip.name] = this.mixer.clipAction(clip);
    });

    // Start the player in the running animation
    this.playAnimation('sprint');
  }

  // NEW: A function to smoothly switch from one animation to another
  playAnimation(name) {
    // If the animation is already playing, do nothing
    if (this.activeAction?.getClip().name === name) return;

    const newAction = this.animations[name];
    if (!newAction) {
      console.warn(`Animation "${name}" not found!`);
      return;
    }

    // If another animation is playing, fade from it to the new one
    if (this.activeAction) {
      newAction.reset().play();
      this.activeAction.crossFadeTo(newAction, 0.2, true);
    } else {
      newAction.play();
    }
    
    this.activeAction = newAction;
  }

  // NEW: Public methods to be called by game.js
  enterZombieModeAnimation() {
    this.playAnimation('holding-right-shoot'); // The name of the shooting stance animation
  }

  exitZombieModeAnimation() {
    this.playAnimation('sprint');
  }

  update(dt){
    this.mesh.position.x += (this.targetX - this.mesh.position.x) * this.speed * dt;

    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  _bindKeys(){
    window.addEventListener('keydown', (e) => {
  if(e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.moveRight();
  if(e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.moveLeft();
    });
  }

  moveLeft(){ this.lane = 0; this.targetX = this.lanesX[this.lane]; }
  moveRight(){ this.lane = 1; this.targetX = this.lanesX[this.lane]; }

  applyModifier(mod){
    switch(mod.type){
      case 'mul': this.power *= mod.value; break;
      case 'add': this.power += mod.value; break;
      case 'sub': this.power -= mod.value; break;
      case 'div': this.power /= mod.value; break;
      case 'sqrt': this.power = Math.sqrt(this.power); break;
      case 'sum_digits': this.power += window.game._sumOfDigits(this.power); break;
      case 'mod': this.power += (Math.floor(this.power) % mod.value); break;
    }
    this.power = Math.max(0, this.power);
    this.power = Math.round(this.power*10)/10;
  }

  setMaterial(material) {
    // Not used for the GLB model
  }
}