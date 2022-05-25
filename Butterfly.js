import * as THREE from 'https://cdn.skypack.dev/three@0.138.0';
class Butterfly {
    constructor(model, animations, {
        position,
        scene
    }) {
        this.mesh = model.clone();
        this.mixer = new THREE.AnimationMixer(this.mesh);
        this.animations = [];
        animations.forEach(clip => {
            this.animations.push(this.mixer.clipAction(clip));
        });
        this.mesh.position.copy(position);
        const timing = Math.random();
        this.animations.forEach(animation => {
            animation.timeScale = 2;
            animation.time = timing;
            animation.play();
        });
        this.state = "fly";
        this.oldDirection = new THREE.Quaternion();
        this.newDirection = new THREE.Quaternion();
        this.target = this.mesh.position.clone();
        this.newTarget = null;
        this.scene = scene;
        this.marker = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 1, 0) }));
        this.marker.visible = false;
        this.transitionFactor = 0;
        this.aimUp = false;
        this.toLand = false;
        this.noFollow = 0;
        scene.add(this.marker);
    }
    update(delta, collider, {
        flower,
        flowerPos,
        playerPos,
        butterflies,
        timeScale
    }) {
        this.mixer.update(delta);
        this.noFollow--;
        if (this.state === "fly") {
            if (!this.newTarget) {
                for (let i = 0; i < 1000; i++) {
                    this.newTarget = this.mesh.position.clone().add(new THREE.Vector3(Math.random() * 100 - 50, Math.random() * 20 - 10, Math.random() * 100 - 50));
                    if (this.newTarget.x < -256 || this.newTarget.x > 256 || this.newTarget.z < -256 || this.newTarget.z > 256 ||
                        this.newTarget.y < 10 || this.newTarget.y > 100) {
                        continue;
                    }

                    const ray = new THREE.Ray(this.mesh.position, this.newTarget.clone().sub(this.mesh.position).normalize());
                    if (this.runAway) {
                        if (ray.direction.dot(playerPos.clone().sub(this.mesh.position).normalize()) > 0) {
                            continue;
                        }
                    }
                    let hit = collider.geometry.boundsTree.raycastFirst(ray, THREE.DoubleSide);
                    if (!hit ||
                        (hit.point.distanceTo(this.mesh.position) > this.mesh.position.distanceTo(this.newTarget) + 5)) {
                        this.mesh.lookAt(this.target);
                        this.oldDirection.copy(this.mesh.quaternion);
                        this.mesh.lookAt(this.newTarget);
                        this.newDirection.copy(this.mesh.quaternion);
                        this.transitionFactor = 0;
                        break;
                    }
                    if (hit && hit.face.normal.dot(ray.direction) < 0 && (hit.point.distanceTo(this.mesh.position) < this.mesh.position.distanceTo(this.newTarget))) {
                        this.newTarget = hit.point;
                        this.mesh.lookAt(this.target);
                        this.oldDirection.copy(this.mesh.quaternion);
                        this.mesh.lookAt(this.newTarget);
                        this.newDirection.copy(this.mesh.quaternion);
                        this.transitionFactor = 0;
                        this.hitNormal = hit.face.normal;
                        this.toLand = true;
                        this.cameFrom = this.mesh.position.clone();
                        break;
                    }
                }
                this.runAway = false;
            }
            if (this.newTarget === null) {
                return;
            }
            this.transitionFactor += 0.05;
            this.target.lerp(this.newTarget, 0.1);
            this.marker.position.copy(this.target);
            this.mesh.quaternion.slerpQuaternions(this.oldDirection, this.newDirection, Math.min(this.transitionFactor, 1));
            this.mesh.position.add(this.newTarget.clone().sub(this.mesh.position).normalize().multiplyScalar(0.25 * timeScale));
            this.mesh.rotateX(Math.PI / 3);
            if (this.mesh.position.distanceTo(this.target) < 1) {
                if (this.toLand && this.noFollow < -180) {
                    this.toLand = false;
                    this.state = "land";
                } else {
                    this.newTarget = null;
                }
            }
            if (this.mesh.position.distanceTo(flowerPos) < 50 && flower && this.noFollow < 1 && butterflies.filter(b => b.state === "follow").length < 3) {
                this.state = "follow";
            }
            if (this.mesh.position.distanceTo(playerPos) < 37.5 && !flower && this.noFollow < 1) {
                //this.state = "flee";
                this.noFollow = 180;
                this.newTarget = null;
                this.runAway = true;
            }
        } else if (this.state === "land") {
            if (this.newTarget === null) {
                this.state = "fly";
                this.newTarget = this.cameFrom;
                this.mesh.lookAt(this.target);
                this.oldDirection.copy(this.mesh.quaternion);
                this.mesh.lookAt(this.newTarget);
                this.newDirection.copy(this.mesh.quaternion);
                this.transitionFactor = 0;
                return;
            }
            this.animations.forEach(animation => {
                animation.time += (0.83333333333 - animation.time) / 10;
                animation.timeScale = 0;
            });
            this.target.lerp(this.newTarget, 0.1);
            this.mesh.position.copy(this.newTarget);
            const oldQuaternion = this.mesh.quaternion.clone();
            this.mesh.lookAt(this.newTarget.clone().add(this.hitNormal));
            const newQuaternion = this.mesh.quaternion.clone();
            this.mesh.quaternion.slerpQuaternions(oldQuaternion, newQuaternion, 0.1);
            const ray = new THREE.Ray(this.mesh.position, this.hitNormal.clone().multiplyScalar(-1));
            let hit = collider.geometry.boundsTree.raycastFirst(ray, THREE.DoubleSide);
            if (Math.random() < 0.0025 ||
                (!hit || hit.point.distanceTo(this.mesh.position) > 5)) {
                this.animations.forEach(animation => {
                    animation.timeScale = 2;
                });
                this.state = "fly";
                this.newTarget = this.cameFrom;
                this.mesh.lookAt(this.target);
                this.oldDirection.copy(this.mesh.quaternion);
                this.mesh.lookAt(this.newTarget);
                this.newDirection.copy(this.mesh.quaternion);
                this.transitionFactor = 0;
            }
        } else if (this.state === "follow") {
            this.noFollow = 0;
            this.mesh.rotateX(-Math.PI / 3);
            const oldQuaternion = this.mesh.quaternion.clone();
            this.mesh.lookAt(flowerPos);
            const newQuaternion = this.mesh.quaternion.clone();
            this.mesh.quaternion.slerpQuaternions(oldQuaternion, newQuaternion, 0.1);
            if (this.mesh.position.distanceTo(flowerPos) > 0.25) {
                this.mesh.position.add(flowerPos.clone().sub(this.mesh.position).normalize().multiplyScalar(0.25 * timeScale));
            }
            this.mesh.rotateX(Math.PI / 3);
            const ray = new THREE.Ray(this.mesh.position, flowerPos.clone().sub(this.mesh.position).normalize());
            let hit = collider.geometry.boundsTree.raycastFirst(ray, THREE.DoubleSide);
            let fly = false;
            if (hit) {
                if (hit.point.distanceTo(this.mesh.position) < flowerPos.distanceTo(this.mesh.position)) {
                    fly = true;
                }
            }
            if (!flower || this.mesh.position.distanceTo(flowerPos) > 75 || fly) {
                this.newTarget = null;
                this.target = flowerPos.clone();
                this.state = "fly";
                this.noFollow = 120 + 120 * Math.random();
                this.mesh.rotateX(-Math.PI / 3);
            }
            butterflies.forEach(butterfly => {
                if (butterfly !== this) {
                    if (butterfly.mesh.position.distanceTo(this.mesh.position) < 5) {
                        this.newTarget = null;
                        this.target = flowerPos.clone();
                        this.state = "fly";
                        this.noFollow = 15 + 15 * Math.random();
                        this.mesh.rotateX(-Math.PI / 3);
                    }
                }
            })
        }
    }
}
export { Butterfly };