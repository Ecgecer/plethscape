import * as THREE from "three";
import {
  footTrack,
  sampleMotion,
  type MotionActivity,
  type MotionTransition,
} from "./locomotion";

// Source-space landmarks fitted to the femur, tibia and arm bone extents.
// Rest transforms leave the reference anatomy intact.
const definitions = [
  ["pelvis", -1, 0, 1.85, -0.025],
  ["spine", 0, 0, 2.24, -0.04],
  ["chest", 1, 0, 2.77, -0.04],
  ["neck", 2, 0, 3.11, -0.025],
  ["head", 3, 0, 3.27, -0.03],
  ["leftUpperArm", 2, 0.355, 2.98, -0.05],
  ["leftForearm", 5, 0.46, 2.37, -0.065],
  ["leftHand", 19, 0.532, 1.9, 0.03],
  ["rightUpperArm", 2, -0.355, 2.98, -0.05],
  ["rightForearm", 8, -0.46, 2.37, -0.065],
  ["rightHand", 20, -0.532, 1.9, 0.03],
  ["leftThigh", 0, 0.16, 1.9, -0.045],
  ["leftShin", 11, 0.16, 0.96, -0.045],
  ["leftFoot", 12, 0.16, 0.16, -0.055],
  ["leftToe", 13, 0.16, 0.07, 0.14],
  ["rightThigh", 0, -0.16, 1.9, -0.045],
  ["rightShin", 15, -0.16, 0.96, -0.045],
  ["rightFoot", 16, -0.16, 0.16, -0.055],
  ["rightToe", 17, -0.16, 0.07, 0.14],
  ["leftForearmRoll", 6, 0.46, 2.37, -0.065],
  ["rightForearmRoll", 9, -0.46, 2.37, -0.065],
] as const;
export const JOINT_COUNT = definitions.length;
export const rigShader = /* glsl */ `
uniform mat4 atlasJoints[${JOINT_COUNT}];
uniform vec4 atlasReal[${JOINT_COUNT}];
uniform vec4 atlasDual[${JOINT_COUNT}];
attribute vec4 atlasJointIndex;
attribute vec4 atlasJointWeight;
mat4 atlasSkinMatrix() {
 bool forearm = false;
 for(int i=0;i<4;i++) if(atlasJointWeight[i]>0. && atlasJointIndex[i]>=19.) forearm=true;
 if(forearm) {
   vec4 r=vec4(0.), d=vec4(0.);
   vec4 reference=atlasReal[int(atlasJointIndex.x)];
   for(int i=0;i<4;i++) {
     int j=int(atlasJointIndex[i]);
     float w=atlasJointWeight[i]*(dot(reference,atlasReal[j])<0. ? -1. : 1.);
     r+=w*atlasReal[j]; d+=w*atlasDual[j];
   }
   float len=max(length(r),.00001); r/=len; d/=len;
   vec3 t=2.*(r.w*d.xyz-d.w*r.xyz+cross(r.xyz,d.xyz));
   float x=r.x,y=r.y,z=r.z,w=r.w;
   return mat4(vec4(1.-2.*(y*y+z*z),2.*(x*y+z*w),2.*(x*z-y*w),0.),
     vec4(2.*(x*y-z*w),1.-2.*(x*x+z*z),2.*(y*z+x*w),0.),
     vec4(2.*(x*z+y*w),2.*(y*z-x*w),1.-2.*(x*x+y*y),0.),vec4(t,1.));
 }
 return atlasJoints[int(atlasJointIndex.x)]*atlasJointWeight.x
      + atlasJoints[int(atlasJointIndex.y)]*atlasJointWeight.y
      + atlasJoints[int(atlasJointIndex.z)]*atlasJointWeight.z
      + atlasJoints[int(atlasJointIndex.w)]*atlasJointWeight.w;
}
vec3 atlasGait(vec3 p) { return (atlasSkinMatrix()*vec4(p,1.)).xyz; }
`;
const smooth = (a: number, b: number, x: number) =>
  THREE.MathUtils.smoothstep(x, a, b);
export function jointWeights(p: THREE.Vector3): [number[], number[]] {
  const x = Math.abs(p.x),
    side = p.x >= 0 ? 0 : 1;
  const weights = new Map<number, number>();
  const put = (id: number, w: number) => {
    if (w > 1e-5) weights.set(id, (weights.get(id) ?? 0) + w);
  };
  const pair = (a: number, b: number, t: number, w = 1) => {
    put(a, (1 - t) * w);
    put(b, t * w);
  };
  // Blend across the shoulder only, avoiding accidental arm assignment at the hips.
  const edge = p.y < 2.1 ? 0.385 + Math.max(0, 2.1 - p.y) * 0.055 : 0.345;
  // Below the deltoid the source arm is separated from the trunk by empty space.
  // Blending across that gap would tether the wrist to the pelvis during flexion.
  const shoulder = smooth(2.4, 2.75, p.y);
  const arm =
    (p.y > 1.25
      ? smooth(
          THREE.MathUtils.lerp(edge - 0.006, 0.29, shoulder),
          THREE.MathUtils.lerp(edge + 0.006, 0.4, shoulder),
          x,
        )
      : 0) *
    (1 - smooth(2.99, 3.12, p.y));
  if (arm > 0) {
    const a = side ? 8 : 5;
    if (p.y > 2.47) put(a, arm);
    else if (p.y > 2.27) pair(a, a + 1, 1 - smooth(2.27, 2.47, p.y), arm);
    else {
      const hand = 1 - smooth(1.84, 1.98, p.y);
      const roll = 1 - smooth(1.95, 2.27, p.y);
      pair(a + 1, side ? 20 : 19, roll, arm * (1 - hand));
      put(a + 2, arm * hand);
    }
  }
  const body = 1 - arm;
  if (p.y < 1.97) {
    const hipBlend = 1.66 + 0.3 * smooth(0.035, 0.18, x);
    const leg = 1 - smooth(hipBlend - 0.3, hipBlend, p.y),
      a = side ? 15 : 11;
    put(0, body * (1 - leg));
    if (p.y > 1.04) put(a, body * leg);
    else if (p.y > 0.88)
      pair(a, a + 1, 1 - smooth(0.88, 1.04, p.y), body * leg);
    else if (p.y > 0.24) put(a + 1, body * leg);
    else if (p.y > 0.12)
      pair(a + 1, a + 2, 1 - smooth(0.12, 0.24, p.y), body * leg);
    else pair(a + 2, a + 3, smooth(0.1, 0.22, p.z), body * leg);
  } else if (p.y < 2.44) pair(0, 1, smooth(2.02, 2.44, p.y), body);
  else if (p.y < 2.86) pair(1, 2, smooth(2.44, 2.86, p.y), body);
  else if (p.y < 3.17) pair(2, 3, smooth(3.02, 3.17, p.y), body);
  else pair(3, 4, smooth(3.17, 3.3, p.y), body);
  const sorted = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4),
    sum = sorted.reduce((s, w) => s + w[1], 0);
  const ids = [0, 0, 0, 0],
    values = [0, 0, 0, 0];
  sorted.forEach(([id, w], i) => {
    ids[i] = id;
    values[i] = w / sum;
  });
  return [ids, values];
}
/** Connected source bones receive one rigid transform; soft tissues blend near joints. */
export function bindRigGeometry(
  geometry: THREE.BufferGeometry,
  rigid = false,
  fixedJoint?: number,
) {
  const position = geometry.getAttribute("position"),
    count = position.count;
  const ids = new Float32Array(count * 4),
    weights = new Float32Array(count * 4),
    point = new THREE.Vector3();
  let rigidIds: Int16Array | undefined;
  if (rigid && geometry.index) {
    const parent = Int32Array.from({ length: count }, (_, i) => i);
    const root = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    // Weld coincident positions for connectivity only; preserve split shading normals.
    const weld = new Map<string, number>();
    for (let i = 0; i < count; i++) {
      const key = `${Math.round(position.getX(i) * 1e5)},${Math.round(position.getY(i) * 1e5)},${Math.round(position.getZ(i) * 1e5)}`;
      const other = weld.get(key);
      if (other === undefined) weld.set(key, i);
      else parent[root(i)] = root(other);
    }
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = root(index.getX(i));
      parent[root(index.getX(i + 1))] = a;
      parent[root(index.getX(i + 2))] = a;
    }
    const centers = new Map<
      number,
      { sum: THREE.Vector3; n: number; joint?: number }
    >();
    for (let i = 0; i < count; i++) {
      const r = root(i);
      let c = centers.get(r);
      if (!c) {
        c = { sum: new THREE.Vector3(), n: 0 };
        centers.set(r, c);
      }
      c.sum.add(point.fromBufferAttribute(position, i));
      c.n++;
    }
    for (const c of centers.values())
      c.joint = jointWeights(c.sum.divideScalar(c.n))[0][0];
    rigidIds = new Int16Array(count);
    for (let i = 0; i < count; i++) rigidIds[i] = centers.get(root(i))!.joint!;
  }
  for (let i = 0; i < count; i++) {
    if (fixedJoint !== undefined || rigidIds) {
      ids[i * 4] = fixedJoint ?? rigidIds![i];
      weights[i * 4] = 1;
    } else {
      const [j, w] = jointWeights(point.fromBufferAttribute(position, i));
      ids.set(j, i * 4);
      weights.set(w, i * 4);
    }
  }
  geometry.setAttribute("atlasJointIndex", new THREE.BufferAttribute(ids, 4));
  geometry.setAttribute(
    "atlasJointWeight",
    new THREE.BufferAttribute(weights, 4),
  );
}
export function solveLeg(
  down: number,
  forward: number,
  upper = 0.94,
  lower = Math.hypot(0.8, 0.01),
) {
  const d = THREE.MathUtils.clamp(
    Math.hypot(down, forward),
    Math.abs(upper - lower) + 0.001,
    upper + lower - 0.001,
  );
  const knee = Math.acos(
    THREE.MathUtils.clamp(
      (d * d - upper * upper - lower * lower) / (2 * upper * lower),
      -1,
      1,
    ),
  );
  const hip =
    Math.atan2(-forward, down) -
    Math.atan2(lower * Math.sin(knee), upper + lower * Math.cos(knee));
  return { hip, knee };
}
export function createLocomotionRig() {
  const root = new THREE.Group();
  const bones = definitions.map(([name]) => {
    const b = new THREE.Bone();
    b.name = name;
    return b;
  });
  definitions.forEach(([, parent, x, y, z], i) => {
    const base =
      parent < 0
        ? [0, 0, 0]
        : (definitions[parent as Exclude<typeof parent, -1>].slice(
            2,
          ) as number[]);
    bones[i].position.set(x - base[0], y - base[1], z - base[2]);
    (parent < 0 ? root : bones[parent]).add(bones[i]);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  skeleton.update();
  const rest = bones.map((b) => b.position.clone());
  const forearmAxes = [
    rest[7].clone().normalize(),
    rest[10].clone().normalize(),
  ];
  const matrices = bones.map(() => new THREE.Matrix4());
  const real = bones.map(() => new THREE.Vector4(0, 0, 0, 1));
  const dual = bones.map(() => new THREE.Vector4());
  const blendReal = new THREE.Vector4(),
    blendDual = new THREE.Vector4();
  const blendRotation = new THREE.Quaternion();
  const vertexIndices = [0, 0, 0, 0],
    vertexWeights = [0, 0, 0, 0];
  const temp = new THREE.Vector3(),
    sum = new THREE.Vector3(),
    rotation = new THREE.Quaternion();
  function sync() {
    root.updateMatrixWorld(true);
    skeleton.update();
    matrices.forEach((m, i) => {
      m.fromArray(skeleton.boneMatrices!, i * 16);
      rotation.setFromRotationMatrix(m);
      const { x, y, z, w } = rotation,
        e = m.elements,
        tx = e[12],
        ty = e[13],
        tz = e[14];
      real[i].set(x, y, z, w);
      dual[i].set(
        0.5 * (w * tx + ty * z - tz * y),
        0.5 * (w * ty + tz * x - tx * z),
        0.5 * (w * tz + tx * y - ty * x),
        -0.5 * (tx * x + ty * y + tz * z),
      );
    });
  }
  sync();
  function pose(
    time: number,
    activity: MotionActivity,
    history?: readonly MotionTransition[],
  ) {
    const m = sampleMotion(time, activity, history),
      a = m.phase * Math.PI * 2,
      amount = m.walk + m.run;
    bones.forEach((b, i) => {
      b.position.copy(rest[i]);
      b.rotation.set(0, 0, 0);
    });
    const idle = 1 - amount;
    const bob =
      m.walk * (-0.035 - 0.015 * Math.cos(2 * a)) +
      m.run * (-0.045 - 0.055 * Math.cos(2 * a - 0.3));
    bones[0].position.x =
      Math.sin(a) * (0.024 * m.walk + 0.011 * m.run) +
      idle * 0.006 * Math.sin(time * 0.57);
    bones[0].position.y += bob;
    bones[0].rotation.set(
      0.035 * m.walk + 0.13 * m.run,
      Math.sin(a) * (0.045 * m.walk + 0.065 * m.run),
      Math.sin(a) * (0.019 * m.walk + 0.012 * m.run),
    );
    bones[1].rotation.y = -Math.sin(a) * (0.04 * m.walk + 0.055 * m.run);
    bones[2].rotation.y = -Math.sin(a) * (0.045 * m.walk + 0.07 * m.run);
    bones[2].rotation.z = -bones[0].rotation.z * 0.65;
    bones[3].rotation.x = -0.02 * m.walk - 0.09 * m.run;
    bones[4].rotation.y =
      idle * 0.01 * Math.sin(time * 0.43) - bones[2].rotation.y * 0.35;
    // Elbow flexion and distributed forearm roll are independent.
    for (let side = 0; side < 2; side++) {
      const phase = m.phase + side * 0.5,
        osc = Math.cos(phase * Math.PI * 2),
        arm = side ? 8 : 5;
      bones[arm].rotation.x =
        0.32 * osc * m.walk + 0.48 * osc * m.run - 0.045 * amount;
      bones[arm].rotation.z =
        (side ? -1 : 1) * (0.012 * m.walk + 0.055 * m.run);
      // Keep arm swing close to the sagittal plane.
      bones[arm].rotation.y = (side ? 1 : -1) * (0.12 * m.walk + 0.12 * m.run);
      bones[arm + 1].rotation.x =
        -(0.12 + 0.13 * (1 - osc)) * m.walk - (0.82 + 0.12 * (1 - osc)) * m.run;
      // Turn the palm inward along the elbow-to-wrist axis, spreading skin
      // rotation down the forearm rather than rotating only the wrist or elbow.
      bones[side ? 20 : 19].quaternion.setFromAxisAngle(
        forearmAxes[side],
        (side ? -1 : 1) * Math.PI * 0.5 * amount,
      );
      bones[arm + 2].rotation.x = -0.04 * amount;
      const leg = side ? 15 : 11,
        foot = footTrack(phase, m),
        s = side ? -1 : 1;
      // Solve each leg to a foot trajectory, maintaining its original segment lengths.
      root.updateMatrixWorld(true);

      const rollClearance = Math.max(
        0,
        0.19 * (Math.cos(foot.pitch) - 1) +
          (foot.pitch > 0 ? 0.23 : -0.13) * Math.sin(foot.pitch),
      );
      const footY = 0.16 + foot.lift + rollClearance;
      const desired = new THREE.Vector3(s * 0.16, footY, -0.055 + foot.z);
      bones[0].worldToLocal(desired);
      const bindHip = rest[leg];
      const down = bindHip.y - desired.y,
        lateral = desired.x - bindHip.x;
      const legPose = solveLeg(
        Math.hypot(down, lateral),
        desired.z - bindHip.z,
      );
      bones[leg].rotation.order = "ZXY";
      bones[leg].rotation.z = Math.atan2(lateral, down);
      bones[leg].rotation.x = legPose.hip;
      bones[leg + 1].rotation.x = legPose.knee - Math.atan2(0.01, 0.8);
      // Foot pitch offsets the leg chain and body lean to keep the sole near level.
      bones[leg + 2].rotation.x =
        foot.pitch -
        bones[leg].rotation.x -
        bones[leg + 1].rotation.x -
        bones[0].rotation.x;
      bones[leg + 3].rotation.x = -Math.max(0, foot.pitch) * 0.7;
    }
    sync();
    return m;
  }
  // Dual-quaternion blending preserves forearm cross-section during pronation.
  // Ordinary limb flexion keeps its existing weights and transforms.
  function skinPoint(
    point: THREE.Vector3,
    out: THREE.Vector3,
    indices: number[],
    weights: number[],
  ) {
    if (indices.some((id, i) => id >= 19 && weights[i] > 0)) {
      blendReal.set(0, 0, 0, 0);
      blendDual.set(0, 0, 0, 0);
      const reference = real[indices[0]];
      for (let i = 0; i < 4; i++) {
        const id = indices[i],
          w = weights[i] * (reference.dot(real[id]) < 0 ? -1 : 1);
        blendReal.addScaledVector(real[id], w);
        blendDual.addScaledVector(dual[id], w);
      }
      const length = blendReal.length();
      blendReal.multiplyScalar(1 / length);
      blendDual.multiplyScalar(1 / length);
      const r = blendReal,
        d = blendDual;
      blendRotation.set(r.x, r.y, r.z, r.w);
      temp.set(
        2 * (r.w * d.x - d.w * r.x + r.y * d.z - r.z * d.y),
        2 * (r.w * d.y - d.w * r.y + r.z * d.x - r.x * d.z),
        2 * (r.w * d.z - d.w * r.z + r.x * d.y - r.y * d.x),
      );
      return out.copy(point).applyQuaternion(blendRotation).add(temp);
    }
    sum.set(0, 0, 0);
    for (let i = 0; i < 4; i++)
      if (weights[i])
        sum.addScaledVector(
          temp.copy(point).applyMatrix4(matrices[indices[i]]),
          weights[i],
        );
    return out.copy(sum);
  }
  function transformPoint(point: THREE.Vector3, out = point, fixed?: number) {
    if (fixed !== undefined)
      return out.copy(point).applyMatrix4(matrices[fixed]);
    const [indices, weights] = jointWeights(point);
    return skinPoint(point, out, indices, weights);
  }
  function transformVertex(
    geometry: THREE.BufferGeometry,
    index: number,
    point: THREE.Vector3,
  ) {
    const ids = geometry.getAttribute("atlasJointIndex"),
      weights = geometry.getAttribute("atlasJointWeight");
    for (let i = 0; i < 4; i++) {
      vertexIndices[i] = ids.getComponent(index, i);
      vertexWeights[i] = weights.getComponent(index, i);
    }
    return skinPoint(point, point, vertexIndices, vertexWeights);
  }
  function attach(
    object: THREE.Object3D,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    joint: number,
  ) {
    transformPoint(position, object.position, joint);
    rotation.setFromRotationMatrix(matrices[joint]);
    object.quaternion.copy(rotation).multiply(quaternion);
  }
  return {
    root,
    bones,
    skeleton,
    matrices,
    real,
    dual,
    pose,
    transformPoint,
    transformVertex,
    attach,
    dispose: () => skeleton.dispose(),
  };
}
export const DEVICE_JOINTS = {
  finger: 7,
  wrist: 7,
  upperarm: 5,
  forehead: 4,
  ear: 4,
  carotid: 3,
  toe: 14,
} as const;
