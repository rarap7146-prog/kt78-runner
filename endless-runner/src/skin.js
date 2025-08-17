import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// This class now manages both textures and 3D models
export default class SkinManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.textureLoader = new THREE.TextureLoader();
    // NEW: Create an instance of the GLTFLoader
    this.gltfLoader = new GLTFLoader();
  }

  // NEW: A function dedicated to loading GLTF (.glb) models
  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url,
        (gltf) => resolve(gltf), // Success
        undefined, // We don't need progress updates
        (error) => reject(error) // Failure
      );
    });
  }

  loadTexture(url, { repeat = [1, 1], wrapS = THREE.RepeatWrapping, wrapT = THREE.RepeatWrapping } = {}) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(url,
        (tex) => {
          tex.wrapS = wrapS; tex.wrapT = wrapT;
          tex.repeat.set(repeat[0], repeat[1]);
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined, (err) => reject(err)
      );
    });
  }
  
  makeStandard({ map, color = 0xffffff, metalness = 0.1, roughness = 0.9, transparent = true, opacity = 1.0 } = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent, opacity });
    if (map) mat.map = map;
    return mat;
  }
  
  async loadFirstAvailable(urls, opts) {
    if (!Array.isArray(urls)) urls = [urls];
    let lastErr = null;
    for (const url of urls) {
      try {
        const tex = await this.loadTexture(url, opts);
        return tex;
      } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
  }
}