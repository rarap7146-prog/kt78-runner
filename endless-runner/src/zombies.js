import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';

export default class Zombie {
    // Animate zombie shooting at player and spawn a red projectile
    shootAtPlayer(playerMesh, onHitCallback) { 
        // Raise arms (if you want to add arms, you can animate them here)
        // Spawn a red sphere projectile from zombie to player
        const projectileGeo = new THREE.SphereGeometry(0.4, 12, 12);
        const projectileMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x880000 });
        const projectile = new THREE.Mesh(projectileGeo, projectileMat);
        projectile.position.copy(this.mesh.position).add(new THREE.Vector3(0, 1.8, 0));
        this.scene.add(projectile);

        // Animate projectile toward player
        const start = projectile.position.clone();
        const end = playerMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        let t = 0;
        const duration = 0.5; // seconds
        const animate = () => {
            t += 1/60;
            projectile.position.lerpVectors(start, end, Math.min(t/duration, 1));
            if (t < duration) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(projectile);
                if (onHitCallback) onHitCallback();
            }
        };
        animate();
    }
    
    constructor(scene) {
        this.scene = scene;
        this.hp = 0;
        this.mesh = this._createZombieMesh();
        this.active = false;
        this.timer = 0;
        this.duration = 10; 
        this.speed = 8;
        this._onLose = null;
        this._onWin = null;
        this.level = 0;
    }

    _createZombieMesh() {
        // Simple 3D zombie: green box with a head
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 2, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x228833 })
        );
        body.position.y = 1;
        group.add(body);
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0x99ff99 })
        );
        head.position.y = 2.3;
        group.add(head);
        group.visible = false;
        this.scene.add(group);
        return group;
    }

    /**
     * Start the zombie phase.
     * @param {number} dynamicHP - Dynamic HP calculated from game.js (simulated future gates)
     * @param {number} dynamicDuration - Dynamic duration calculated from game.js (simulated future gates)
     * @param {function} onLose - Callback if player loses
     * @param {function} onWin - Callback if player wins
     * @param {function} hideGatesBehindZombie - Function to hide gates behind zombie
     * @param {function} respawnGates - Function to respawn gates after zombie defeated
     */
    start(dynamicHP, dynamicDuration, onLose, onWin, hideGatesBehindZombie, respawnGates) {
        // Set zombie very far in front of player (e.g., z = playerZ + 100)
        // We'll store the intended playerZ at spawn time for reference
        this._playerZAtSpawn = null;
        if (typeof window !== 'undefined' && window.game && window.game.player && window.game.player.mesh) {
            this._playerZAtSpawn = window.game.player.mesh.position.z;
        }
        // Fallback: let game.js pass playerZ as a property if needed
        this.mesh.position.set(0, 0, (this._playerZAtSpawn !== null ? this._playerZAtSpawn + 40 : 100));
        this.mesh.visible = true;
        this.active = true;
        this.timer = 0;
        this.level = this.level || 0;
        // HP scales with level and dynamicHP
        this.maxHP = 300 + (dynamicHP || 0) + (this.level * 50);
        this.hp = this.maxHP;
        // Duration scales with level and dynamicDuration
        this.duration = 5 + (dynamicDuration || 0) + (this.level * 0.5);
        // Speed is calculated so zombie reaches (playerZ - 5) in this.duration seconds
        this._onLose = onLose;
        this._onWin = onWin;
        this._hideGatesBehindZombie = hideGatesBehindZombie;
        this._respawnGates = respawnGates;
        if (typeof hideGatesBehindZombie === 'function') hideGatesBehindZombie();
    }

    update(dt, playerZ) {
        if (!this.active) return;
        this.timer += dt;
        // Target position: keep a gap of 5 units IN FRONT of player
        const targetZ = playerZ + 5;
        // Calculate how far zombie should move this frame to reach targetZ in remaining time
        const remainingTime = Math.max(this.duration - this.timer, 0.01);
        const dz = targetZ - this.mesh.position.z;
        // Only move if not already at targetZ (with small epsilon)
        if (Math.abs(dz) > 0.01) {
            // Move so that zombie reaches targetZ exactly at duration
            const move = dz / remainingTime * dt;
            this.mesh.position.z += move;
        }
        if (this.timer > this.duration) {
            this.active = false;
            this.mesh.visible = false;
            if (this._onLose) this._onLose();
            // Optionally respawn gates if lose? (usually only on win)
        }
        if (this.hp <= 0) {
            this.active = false;
            this.mesh.visible = false;
            if (typeof this._respawnGates === 'function') this._respawnGates();
            if (this._onWin) this._onWin();
        }
    }

    hit(damage) {
        if (!this.active) return;
        this.hp -= damage;
    }
}