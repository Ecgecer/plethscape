import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fitWearablesToSkin } from "../src/surfaceFit.ts";

test("wearable fitting follows a curved head and curved neck rather than floating on fixed planes", () => {
  const head = new THREE.SphereGeometry(1, 96, 64)
    .scale(0.17, 0.26, 0.22)
    .translate(0, 3.4, -0.045);
  const neck = new THREE.SphereGeometry(1, 96, 64)
    .scale(0.13, 0.17, 0.115)
    .translate(0, 3.04, -0.09);
  const geometry = mergeGeometries([head, neck]);
  const skin = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  skin.updateMatrixWorld();
  const band = new THREE.Group(),
    patch = new THREE.Group();
  const bandGeometry = new THREE.BoxGeometry(0.028, 0.052, 0.006, 8, 8, 1);
  band.add(new THREE.Mesh(bandGeometry));
  const patchGeometry = new THREE.BoxGeometry(0.041, 0.056, 0.0025, 8, 8, 1);
  patch.add(new THREE.Mesh(patchGeometry));
  const fit = fitWearablesToSkin(
    skin,
    band,
    patch,
    new THREE.Vector3(0, 3.42, -0.045),
  );
  const positions = bandGeometry.getAttribute("position");
  const templePoint = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    templePoint
      .fromBufferAttribute(positions, i)
      .applyQuaternion(fit.temple.quaternion)
      .add(fit.temple.position);
    const ellipsoid =
      (templePoint.x / 0.17) ** 2 +
      ((templePoint.y - 3.4) / 0.26) ** 2 +
      ((templePoint.z + 0.045) / 0.22) ** 2;
    assert(
      ellipsoid >= 0.998 && ellipsoid < 1.15,
      `Temple capsule contact ${ellipsoid}`,
    );
    assert(templePoint.x > 0.1, "Capsule stays on one temple");
  }
  const p = patchGeometry.getAttribute("position");
  const world = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    world
      .fromBufferAttribute(p, i)
      .applyQuaternion(fit.neck.quaternion)
      .add(fit.neck.position);
    const ellipsoid =
      Math.pow(world.x / 0.13, 2) +
      Math.pow((world.y - 3.04) / 0.17, 2) +
      Math.pow((world.z + 0.09) / 0.115, 2);
    assert(
      ellipsoid >= 0.998 && ellipsoid < 1.12,
      `Neck patch contact ${ellipsoid}`,
    );
  }
  for (const g of [head, neck, geometry, bandGeometry, patchGeometry])
    g.dispose();
  skin.material.dispose();
});
