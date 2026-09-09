import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createTissueMaterial, enhanceTissueShader } from "./tissueMaterials";
import { createWearables } from "./wearables";
import { WEARABLE_SITES } from "./devices";
import { createFlowTrails } from "./flowTrails";
import { fitWearablesToSkin, upperSkinGeometry } from "./surfaceFit";
import {
  sculptNostrils,
  facialPigment,
  createEyeMaterial,
} from "./faceDetails";

export type Presentation = "atlas" | "xray" | "surface";

type Layer =
  | "body"
  | "muscles"
  | "arteries"
  | "veins"
  | "nerves"
  | "skeleton"
  | "lungs"
  | "flow";
type Tissue =
  | Layer
  | "heart"
  | "valves"
  | "diaphragm"
  | "eyes"
  | "gingiva"
  | "airways"
  | "brain"
  | "cartilage"
  | "pulmonaryArteries"
  | "pulmonaryVeins"
  | "coronaryArteries"
  | "coronaryVeins";
type Point = [number, number, number];
type Activity = "rest" | "walk" | "run";
type FlowPath = {
  id: string;
  name?: string;
  points: Point[];
  kind?: string;
  radius?: number;
};
type Metadata = {
  sites?: Record<string, Point | { position: Point }>;
  hotspots?: Record<string, Point>;
  structureCount?: number;
  parts?: unknown[];
  groups?: { sourceIds?: string[] }[];
  flowPaths?: FlowPath[];
};

// Geometry is BodyParts3D 4.0, CC BY 4.0. All positions use one uniform
// source-to-scene transform. This module supplies presentation and animation.
const movement = /* glsl */ `
uniform float atlasTime;
uniform float atlasMotion;
uniform float atlasCadence;
vec3 sagittal(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c*p.y-s*p.z, s*p.y+c*p.z);
}
vec3 atlasGait(vec3 p) {
  float side = p.x < 0.0 ? -1.0 : 1.0;
  float step = sin(atlasTime*atlasCadence)*side;
  if (p.y < 1.96 && abs(p.x) < .39) {
    float weight = 1.0-smoothstep(1.72, 1.96, p.y);
    if (p.y < 1.07) {
      vec3 knee = vec3(side*.19, 1.07, -.015);
      p = knee+sagittal(p-knee, -max(0.0,-step)*atlasMotion*1.3);
    }
    vec3 hip = vec3(side*.19, 1.85, -.025);
    p = mix(p, hip+sagittal(p-hip, step*atlasMotion), weight);
  } else if (abs(p.x) > .34 && p.y > 1.25 && p.y < 3.05) {
    float weight = smoothstep(.34,.45,abs(p.x));
    vec3 shoulder = vec3(side*.35,2.96,-.035);
    p = mix(p,shoulder+sagittal(p-shoulder,-step*atlasMotion*.7),weight);
  }
  return p;
}
`;

const defaults: Record<string, Point> = {
  finger: [0.65, 1.52, 0.08],
  wrist: [0.59, 1.78, 0.07],
  ear: [0.16, 3.38, 0.035],
  forehead: [0.045, 3.52, 0.23],
  carotid: [0.085, 3.12, 0.13],
  upperarm: [0.43, 2.58, 0.05],
  toe: [0.15, 0.065, 0.3],
};

export function createAnatomy() {
  const group = new THREE.Group();
  group.name = "BodyParts3D reference anatomy";
  group.userData.bodyLoaded = false;
  group.userData.loadProgress = 0;
  const heart = new THREE.Group();
  const layers = Object.fromEntries(
    (
      [
        "body",
        "muscles",
        "arteries",
        "veins",
        "nerves",
        "skeleton",
        "lungs",
        "flow",
      ] as Layer[]
    ).map((name) => {
      const layer = new THREE.Group();
      layer.name = name;
      group.add(layer);
      return [name, layer];
    }),
  ) as Record<Layer, THREE.Group>;
  group.add(heart);
  const headOccluders: THREE.Mesh[] = [];
  const wearables = createWearables();
  group.add(wearables.group);
  // Fitted to the source skin and left proximal index phalanx (FJ3313).
  // These are rigid wearable attachments, not additional anatomical structures.
  const attachmentPoses = {
    finger: {
      position: new THREE.Vector3(0.629, 1.658, 0.107),
      axis: new THREE.Vector3(-0.3, 0.83, -0.47),
      rotation: 0,
    },
    wrist: {
      position: new THREE.Vector3(0.532, 1.935, 0.018),
      axis: new THREE.Vector3(-0.2, 0.946, -0.26),
      // The optical pod rests on the dorsal (back) side of the wrist.
      rotation: Math.PI,
    },
    ear: {
      position: new THREE.Vector3(0.158, 3.327, -0.032),
      axis: new THREE.Vector3(0, 1, 0),
      rotation: Math.PI / 2,
    },
    forehead: {
      position: new THREE.Vector3(0, 3.5, -0.045),
      axis: new THREE.Vector3(0, 1, 0),
      rotation: 0,
    },
    carotid: {
      position: new THREE.Vector3(0.085, 3.065, 0.08),
      axis: new THREE.Vector3(0, 1, 0),
      rotation: 0.65,
    },
    upperarm: {
      position: new THREE.Vector3(0.438, 2.53, -0.08),
      axis: new THREE.Vector3(-0.1, 0.99, -0.05),
      rotation: 0,
    },
    toe: {
      position: new THREE.Vector3(0.217, 0.038, 0.218),
      axis: new THREE.Vector3(-0.48, 0.03, -0.88),
      rotation: 0,
    },
  };
  const attachmentUp = new THREE.Vector3(0, 1, 0);
  const attachmentTurns = Object.fromEntries(
    WEARABLE_SITES.map((id) => [
      id,
      new THREE.Quaternion()
        .setFromUnitVectors(attachmentUp, attachmentPoses[id].axis.normalize())
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            attachmentUp,
            attachmentPoses[id].rotation,
          ),
        ),
    ]),
  ) as Record<(typeof WEARABLE_SITES)[number], THREE.Quaternion>;
  const attachmentSwing = new THREE.Quaternion();
  const baseSites = Object.fromEntries(
    Object.entries(defaults).map(([key, p]) => [key, new THREE.Vector3(...p)]),
  );
  const sites = Object.fromEntries(
    Object.entries(baseSites).map(([key, p]) => [key, p.clone()]),
  );
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let disposed = false;
  let priorTime: number | null = null;
  let flowTime = 0;
  let flowTrails: ReturnType<typeof createFlowTrails> | null = null;
  let mode: Presentation = "atlas";
  let heartFocus = false;
  const shared = {
    atlasTime: { value: 0 },
    atlasMotion: { value: 0 },
    atlasCadence: { value: 5.5 },
    atlasCutaway: { value: 1 },
    atlasXray: { value: 0 },
    atlasSurface: { value: 0 },
    atlasHeartFocus: { value: 0 },
    atlasContraction: { value: 0 },
    atlasBreath: { value: 0 },
    atlasFlow: { value: 0 },
    atlasBeat: { value: 0 },
    atlasFlowEnabled: { value: 1 },
    atlasHeart: { value: new THREE.Vector3(0.11, 2.64, 0.1) },
    atlasGlowColor: { value: new THREE.Color("#ff933f") },
    atlasNeckPatch: { value: new THREE.Vector3(0, 3.065, 0) },
  };
  const tissueMaterials: {
    material: THREE.MeshStandardMaterial;
    tissue: Tissue;
  }[] = [];
  const colors: Record<Tissue, string> = {
    body: "#cfb59e",
    muscles: "#965046",
    arteries: "#bd303b",
    veins: "#497faa",
    nerves: "#d7b971",
    skeleton: "#756e61",
    lungs: "#cf9095",
    heart: "#ba484c",
    airways: "#d6baa7",
    brain: "#bdab9c",
    cartilage: "#77786e",
    flow: "#ffa888",
    pulmonaryArteries: "#44698d",
    pulmonaryVeins: "#b02e32",
    coronaryArteries: "#b42d31",
    coronaryVeins: "#44698d",
    valves: "#c8b4a0",
    diaphragm: "#a66359",
    eyes: "#d5cdc0",
    gingiva: "#9b625d",
  };

  function materialFor(tissue: Tissue, center: THREE.Vector3) {
    const external =
      tissue === "body" ||
      tissue === "muscles" ||
      tissue === "skeleton" ||
      tissue === "cartilage";
    const isFlow = tissue === "flow";
    const material = createTissueMaterial(
      tissue,
      tissue === "body" ? "#80949e" : colors[tissue],
    );
    material.setValues({
      transparent: tissue === "body" || isFlow,
      opacity: tissue === "body" ? 0.12 : 1,
      depthWrite: tissue !== "body" && !isFlow,
      side: THREE.DoubleSide,
      emissive: isFlow
        ? "#ff9971"
        : tissue === "arteries"
          ? "#6e0907"
          : "#000000",
      emissiveIntensity: isFlow ? 0.8 : 0.04,
      polygonOffset: isFlow,
      polygonOffsetFactor: isFlow ? -2 : 0,
    });
    material.forceSinglePass = true;
    material.userData.tissue = tissue;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, {
        atlasOrganCenter: { value: center },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
        ${movement}
        uniform float atlasContraction;
        uniform float atlasBreath;
        uniform vec3 atlasOrganCenter;
        uniform vec3 atlasHeart;
        varying vec3 atlasPosition;
      `,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
        atlasPosition = position;
        ${
          tissue === "heart" || tissue === "valves"
            ? `
          vec3 offset = transformed-atlasOrganCenter;
          float apex = clamp((atlasOrganCenter.y+.15-transformed.y)/.32,0.,1.);
          float squeeze = atlasContraction*(.035+.065*apex);
          offset *= vec3(1.-squeeze,1.-squeeze*.4,1.-squeeze*.8);
          float twist = atlasContraction*.038*apex;
          offset.xz = mat2(cos(twist),-sin(twist),sin(twist),cos(twist))*offset.xz;
          transformed = atlasOrganCenter+offset;
        `
            : ""
        }
        ${
          tissue === "lungs"
            ? `
          vec3 offset = transformed-atlasOrganCenter;
          transformed = atlasOrganCenter + offset*vec3(1.+atlasBreath*.10,1.+atlasBreath*.055,1.+atlasBreath*.13);
          transformed.y -= atlasBreath*.016;
        `
            : ""
        }
        ${tissue === "diaphragm" ? "transformed.y -= atlasBreath*.038;" : ""}
        ${
          [
            "arteries",
            "veins",
            "pulmonaryArteries",
            "pulmonaryVeins",
            "coronaryArteries",
            "coronaryVeins",
          ].includes(tissue)
            ? `
          float cardiac = 1.-smoothstep(.11,.25,distance(transformed,atlasHeart));
          transformed -= (transformed-atlasHeart)*atlasContraction*.04*cardiac;
        `
            : ""
        }
        ${
          ["body", "muscles", "skeleton", "cartilage"].includes(tissue)
            ? `
          float thorax = smoothstep(2.18,2.40,position.y)*(1.-smoothstep(2.98,3.10,position.y))
            *(1.-smoothstep(.28,.38,abs(position.x)));
          transformed.x *= 1.+atlasBreath*.055*thorax;
          transformed.z += (position.z+.12)*atlasBreath*.085*thorax;
          transformed.y += atlasBreath*.008*thorax;
        `
            : ""
        }
        transformed = atlasGait(transformed);
      `,
        );
      if (tissue === "heart" || tissue === "valves") {
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          float normalApex = clamp((atlasOrganCenter.y+.15-position.y)/.32,0.,1.);
          float normalSqueeze = atlasContraction*(.035+.065*normalApex);
          objectNormal /= vec3(1.-normalSqueeze,1.-normalSqueeze*.4,1.-normalSqueeze*.8);
          float normalTwist = atlasContraction*.038*normalApex;
          objectNormal.xz = mat2(cos(normalTwist),-sin(normalTwist),sin(normalTwist),cos(normalTwist))*objectNormal.xz;
          objectNormal = normalize(objectNormal);
          `,
        );
      }
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        uniform float atlasCutaway;
        uniform float atlasXray;
        uniform float atlasSurface;
        uniform float atlasHeartFocus;
        uniform float atlasFlow;
        uniform vec3 atlasHeart;
        varying vec3 atlasPosition;
      `,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        ${
          tissue === "eyes"
            ? "discard;"
            : tissue !== "body"
              ? "if (atlasPosition.y > 3.18 && atlasHeartFocus < .5) discard;"
              : ""
        }
        ${
          external
            ? `
          vec2 windowPosition = vec2(atlasPosition.x/.365,(atlasPosition.y-2.62)/.48);
          if (atlasCutaway>.5 && dot(windowPosition,windowPosition)<1. && atlasPosition.z>.015) discard;
        `
            : ""
        }
        ${
          ["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(
            tissue,
          )
            ? "if (atlasHeartFocus>.5 && (distance(atlasPosition,atlasHeart)>.20 || atlasPosition.y<atlasHeart.y+.065 || abs(atlasPosition.x-atlasHeart.x)>.14)) discard;"
            : ""
        }
        ${
          !["body", "eyes", "gingiva"].includes(tissue)
            ? `
          if (atlasSurface>.5) {
            vec2 surfaceWindow = vec2(atlasPosition.x/.365,(atlasPosition.y-2.62)/.48);
            if (atlasCutaway<.5 || dot(surfaceWindow,surfaceWindow)>1.) discard;
          }
        `
            : ""
        }
      `,
        );
      if (tissue === "body") {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "uniform float atlasFlow;",
            "uniform float atlasFlow;\nuniform vec3 atlasGlowColor;\nuniform vec3 atlasNeckPatch;",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            float rim = pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.1);
            diffuseColor.a = mix(.012+rim*.42,1.,atlasSurface)*(1.-atlasHeartFocus);
            totalEmissiveRadiance = atlasGlowColor*(.035+pow(rim,1.5)*2.1)*(1.-atlasSurface)*(1.-atlasHeartFocus);
            float gentleHead = smoothstep(3.04,3.15,atlasPosition.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.32,.21,.145), gentleHead);
            diffuseColor.a = mix(diffuseColor.a, 1.*(1.-atlasHeartFocus), gentleHead);
            totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(.018,.009,.006)+atlasGlowColor*pow(rim,2.)*.12, gentleHead);
            float patchSkin = 1.-smoothstep(.038,.073,distance(atlasPosition,atlasNeckPatch));
            diffuseColor.a = max(diffuseColor.a,patchSkin*.42*(1.-atlasHeartFocus));
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.32,.21,.145),patchSkin*.65);
            ${facialPigment}
          `,
          );
      }
      if (
        [
          "arteries",
          "pulmonaryArteries",
          "pulmonaryVeins",
          "coronaryArteries",
        ].includes(tissue)
      ) {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "uniform float atlasFlow;",
            "uniform float atlasFlow;\nuniform float atlasContraction;\nuniform float atlasFlowEnabled;",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * atlasFlowEnabled * (.035 + .16 * atlasContraction);
          `,
          );
      }
      enhanceTissueShader(shader, tissue);
    };
    material.customProgramCacheKey = () => `bodyparts-${tissue}-physical-v2`;
    materials.add(material);
    tissueMaterials.push({ material, tissue });
    return material;
  }

  function setPresentation(next: Presentation) {
    mode = next;
    shared.atlasXray.value = next === "xray" ? 1 : 0;
    shared.atlasSurface.value = next === "surface" && !heartFocus ? 1 : 0;
    for (const { material, tissue } of tissueMaterials) {
      let transparent = [
        "body",
        "flow",
        "muscles",
        "skeleton",
        "cartilage",
        "brain",
        "lungs",
      ].includes(tissue);
      if (tissue === "body" && next === "surface" && !heartFocus)
        transparent = false;
      if (tissue === "nerves" || tissue === "airways" || tissue === "diaphragm")
        transparent = true;
      if (
        heartFocus &&
        ["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(
          tissue,
        )
      )
        transparent = true;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = !transparent;
      // Opaque anatomy in front of a device clears that device's stencil mark.
      material.stencilWrite = !transparent;
      material.stencilRef = 0;
      material.stencilZPass = THREE.ReplaceStencilOp;
      if (tissue === "body") {
        material.color.set(
          next === "surface" && !heartFocus ? "#a6775e" : "#80949e",
        );
        material.side = THREE.FrontSide;
      }
      material.opacity =
        tissue === "body"
          ? 0.12
          : tissue === "muscles"
            ? mode === "atlas"
              ? 0.035
              : 0.025
            : tissue === "skeleton"
              ? mode === "atlas"
                ? 0.14
                : 0.22
              : tissue === "cartilage"
                ? mode === "atlas"
                  ? 0.1
                  : 0.12
                : tissue === "lungs"
                  ? mode === "atlas"
                    ? 0.78
                    : 0.22
                  : tissue === "brain"
                    ? mode === "atlas"
                      ? 0.12
                      : 0.25
                    : 1;
      if (tissue === "nerves") material.opacity = 0.22;
      if (tissue === "airways") material.opacity = 0.58;
      if (tissue === "diaphragm") material.opacity = 0.65;
      if (heartFocus) {
        if (
          ["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(
            tissue,
          )
        )
          material.opacity = 0.5;
        if (tissue === "lungs") material.opacity = 0.055;
        else if (["muscles", "skeleton", "cartilage", "brain"].includes(tissue))
          material.opacity = 0.025;
        else if (tissue === "nerves") {
          material.opacity = 0.05;
        }
      }
    }
    for (const name of [
      "body",
      "muscles",
      "skeleton",
      "nerves",
      "lungs",
    ] as Layer[]) {
      for (const child of layers[name].children) child.visible = !heartFocus;
    }
    if (flowTrails) flowTrails.visible = !heartFocus;
  }

  function tissueOf(mesh: THREE.Mesh): Tissue {
    const layer =
      `${mesh.userData.tissue ?? ""} ${mesh.userData.layer ?? ""} ${mesh.name}`.toLowerCase();
    if (/pulmonary/.test(layer) && /arter/.test(layer))
      return "pulmonaryArteries";
    if (/pulmonary/.test(layer) && /vein|venous/.test(layer))
      return "pulmonaryVeins";
    if (/coronary/.test(layer) && /arter/.test(layer))
      return "coronaryArteries";
    if (/coronary/.test(layer) && /vein|venous/.test(layer))
      return "coronaryVeins";
    if (/valve/.test(layer)) return "valves";
    if (/diaphragm/.test(layer)) return "diaphragm";
    if (/\beye/.test(layer)) return "eyes";
    if (/gingiva/.test(layer)) return "gingiva";
    if (/heart|cardiac/.test(layer)) return "heart";
    if (/airway|bronch|trache/.test(layer)) return "airways";
    if (/lung|pulmonary_lobe/.test(layer)) return "lungs";
    if (/brain|cereb/.test(layer)) return "brain";
    if (/cartilage/.test(layer)) return "cartilage";
    if (/arter/.test(layer)) return "arteries";
    if (/vein|venous/.test(layer)) return "veins";
    if (/nerv|neural/.test(layer)) return "nerves";
    if (/skelet|bone/.test(layer)) return "skeleton";
    if (/musc/.test(layer)) return "muscles";
    return "body";
  }

  const draco = new DRACOLoader()
    .setDecoderPath("/models/draco/")
    .setWorkerLimit(2);
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .setDRACOLoader(draco);
  Promise.all([
    loader.loadAsync("/models/bodyparts-atlas.glb", (event) => {
      if (!disposed && event.total)
        group.userData.loadProgress = event.loaded / event.total;
    }),
    fetch("/models/bodyparts-atlas-metadata.json").then((r) => {
      if (!r.ok) throw new Error("Anatomy metadata unavailable");
      return r.json() as Promise<Metadata>;
    }),
    loader.loadAsync("/models/neutral-skin.glb"),
  ])
    .then(([gltf, metadata, skin]) => {
      if (disposed) {
        for (const source of [gltf, skin])
          source.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (Array.isArray(o.material) ? o.material : [o.material]).forEach(
                (m) => m.dispose(),
              );
            }
          });
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      skin.scene.updateMatrixWorld(true);
      let presentationSkin: THREE.Mesh | undefined;
      skin.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) presentationSkin = o;
      });
      if (!presentationSkin)
        throw new Error("Neutral presentation skin unavailable");
      let fittingSkin: THREE.Mesh | undefined;
      const heartBounds = new THREE.Box3();
      const heartMaterials: THREE.MeshStandardMaterial[] = [];
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const tissue = tissueOf(object);
        const bakedSkin = object.name === "body";
        const sourceMesh = bakedSkin ? presentationSkin! : object;
        const geometry = sourceMesh.geometry;
        if (bakedSkin) object.geometry.dispose();
        // Expand normalized quantized attributes before baking the common glTF
        // transform. Applying matrices to normalized integer storage clamps it.
        for (const name of ["position", "normal"]) {
          const attribute = geometry.getAttribute(name);
          if (!attribute) continue;
          const unpacked = new Float32Array(attribute.count * 3);
          for (let i = 0; i < attribute.count; i++) {
            unpacked[i * 3] = attribute.getX(i);
            unpacked[i * 3 + 1] = attribute.getY(i);
            unpacked[i * 3 + 2] = attribute.getZ(i);
          }
          geometry.setAttribute(name, new THREE.BufferAttribute(unpacked, 3));
        }
        geometry.applyMatrix4(sourceMesh.matrixWorld);
        const positions = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        const point = new THREE.Vector3();
        const normal = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i);
          if (normals) normal.fromBufferAttribute(normals, i);
          positions.setXYZ(i, point.x, point.y, point.z);
          if (normals) normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
        if (bakedSkin) sculptNostrils(geometry);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
        geometries.add(geometry);
        const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
        const material = materialFor(tissue, center);
        if (object.name === "face_details") {
          const finish = material.onBeforeCompile;
          material.onBeforeCompile = (shader, renderer) => {
            finish.call(material, shader, renderer);
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <color_fragment>",
              "#include <color_fragment>\nif (abs(atlasPosition.x)<.13 && atlasPosition.z>.06) discard;",
            );
          };
          material.customProgramCacheKey = () => "external-ears-calm-face-v1";
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = object.name;
        mesh.userData = { ...object.userData, tissue };
        if (tissue === "body") mesh.renderOrder = 4;
        else if (/arteries|veins|nerves/i.test(tissue)) mesh.renderOrder = 1;
        const layer =
          tissue === "heart" || tissue === "valves"
            ? heart
            : tissue === "brain"
              ? layers.nerves
              : tissue === "airways" || tissue === "diaphragm"
                ? layers.lungs
                : tissue === "cartilage"
                  ? layers.skeleton
                  : tissue === "eyes" || tissue === "gingiva"
                    ? layers.body
                    : tissue.endsWith("Arteries")
                      ? layers.arteries
                      : tissue.endsWith("Veins")
                        ? layers.veins
                        : layers[tissue as Layer];
        layer.add(mesh);
        if (bakedSkin) {
          const samplingGeometry = upperSkinGeometry(geometry, 3);
          const samplingMaterial = new THREE.MeshBasicMaterial({
            side: THREE.FrontSide,
          });
          geometries.add(samplingGeometry);
          materials.add(samplingMaterial);
          fittingSkin = new THREE.Mesh(samplingGeometry, samplingMaterial);
          fittingSkin.updateMatrixWorld(true);
          const headGeometry = upperSkinGeometry(geometry, 3.14);
          const depthMaterial = new THREE.ShaderMaterial({
            colorWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: 2,
            polygonOffsetUnits: 3,
            depthWrite: true,
            depthTest: true,
            vertexShader: `varying float headY;void main(){headY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
            fragmentShader: `varying float headY;void main(){if(headY<3.15)discard;gl_FragColor=vec4(0.);}`,
          });
          geometries.add(headGeometry);
          materials.add(depthMaterial);
          const occluder = new THREE.Mesh(headGeometry, depthMaterial);
          occluder.name = "Opaque head depth surface";
          occluder.renderOrder = -10;
          layers.body.add(occluder);
          headOccluders.push(occluder);
        }
        if (tissue === "heart" || tissue === "valves") {
          heartBounds.union(geometry.boundingBox!);
          heartMaterials.push(material);
        }
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((m) => m.dispose());
      });
      (Array.isArray(presentationSkin.material)
        ? presentationSkin.material
        : [presentationSkin.material]
      ).forEach((m) => m.dispose());
      if (!fittingSkin)
        throw new Error("Skin surface unavailable for wearable fitting");
      const neckFit = fitWearablesToSkin(
        fittingSkin,
        wearables.devices.forehead,
        wearables.devices.carotid,
        attachmentPoses.forehead.position,
      );
      attachmentPoses.carotid.position.copy(neckFit.position);
      shared.atlasNeckPatch.value.copy(neckFit.position);
      attachmentTurns.carotid.copy(neckFit.quaternion);
      const eyeMaterial = createEyeMaterial();
      materials.add(eyeMaterial);
      for (const x of [-0.065, 0.062]) {
        const eyeGeometry = new THREE.SphereGeometry(0.026, 48, 32);
        geometries.add(eyeGeometry);
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eye.name = "Detailed eye with procedural iris";
        eye.position.set(x, 3.388, 0.108);
        layers.body.add(eye);
      }
      if (!heartBounds.isEmpty()) {
        shared.atlasHeart.value.copy(
          heartBounds.getCenter(new THREE.Vector3()),
        );
        for (const mat of heartMaterials) {
          // All cardiac substructures contract around the same source heart.
          const original = mat.onBeforeCompile;
          mat.onBeforeCompile = (shader, renderer) => {
            original.call(mat, shader, renderer);
            shader.uniforms.atlasOrganCenter = shared.atlasHeart;
          };
        }
      }
      for (const [key, value] of Object.entries(
        metadata.sites ?? metadata.hotspots ?? {},
      )) {
        const point = Array.isArray(value) ? value : value.position;
        if (Array.isArray(point) && point.length === 3 && baseSites[key])
          baseSites[key].set(...point);
      }
      // Device markers follow the fitted sensor, rather than the original
      // fingertip pad / radial landmark used for bare anatomical hotspots.
      for (const id of WEARABLE_SITES) {
        baseSites[id]
          .set(
            0,
            id === "ear" ? -0.012 : 0,
            {
              finger: 0.031,
              wrist: 0.088,
              ear: 0.0022,
              forehead: 0.235,
              carotid: 0.006,
              upperarm: 0.151,
              toe: 0.031,
            }[id],
          )
          .applyQuaternion(attachmentTurns[id])
          .add(attachmentPoses[id].position);
      }
      group.userData.structureCount =
        metadata.structureCount ??
        metadata.parts?.length ??
        metadata.groups?.reduce(
          (sum, g) => sum + (g.sourceIds?.length ?? 0),
          0,
        ) ??
        0;
      group.userData.source = "BodyParts3D 4.0";
      flowTrails = createFlowTrails(
        (metadata.flowPaths ?? []).map((route) => ({
          ...route,
          points: route.points.map((p) => new THREE.Vector3(...p)),
        })),
        shared,
        movement,
      );
      geometries.add(flowTrails.geometry);
      materials.add(flowTrails.material);
      layers.flow.add(flowTrails);
      group.userData.flowStyle = "luminous-trails";
      group.userData.flowTriangles = flowTrails.geometry.index!.count / 3;
      setPresentation(mode);
      group.userData.bodyLoaded = true;
      group.userData.loadProgress = 1;
    })
    .catch((error) => {
      if (!disposed) {
        group.userData.loadError = String(error);
        console.error("BodyParts3D anatomy could not load", error);
      }
    });

  const axis = new THREE.Vector3(1, 0, 0);
  const pivot = new THREE.Vector3();
  const transformSite = (
    p: THREE.Vector3,
    x: number,
    y: number,
    z: number,
    angle: number,
    weight = 1,
  ) => {
    pivot.set(x, y, z);
    const destination = p
      .clone()
      .sub(pivot)
      .applyAxisAngle(axis, angle)
      .add(pivot);
    p.lerp(destination, weight);
  };

  function animate(
    time: number,
    heartRate: number,
    activity: Activity,
    respiratoryRate = 16,
  ) {
    const elapsed =
      priorTime === null ? 0 : THREE.MathUtils.clamp(time - priorTime, 0, 0.06);
    priorTime = time;
    shared.atlasTime.value = time;
    const target = activity === "run" ? 0.42 : activity === "walk" ? 0.23 : 0;
    shared.atlasMotion.value = THREE.MathUtils.lerp(
      shared.atlasMotion.value,
      target,
      1 - Math.exp(-elapsed * 3.4),
    );
    shared.atlasCadence.value = activity === "run" ? 8.8 : 5.5;
    const phase = ((time * heartRate) / 60) % 1;
    shared.atlasContraction.value = Math.exp(
      -Math.pow((phase - 0.16) / 0.115, 2),
    );
    shared.atlasBreath.value =
      0.5 - 0.5 * Math.cos(((time * respiratoryRate) / 60) * Math.PI * 2);
    flowTime +=
      elapsed *
      0.7 *
      Math.sqrt(heartRate / 72) *
      (0.8 + shared.atlasContraction.value * 0.5);
    shared.atlasFlow.value = flowTime;
    shared.atlasBeat.value = (time * heartRate) / 60;
    shared.atlasFlowEnabled.value = layers.flow.visible && !heartFocus ? 1 : 0;
    group.position.y =
      Math.abs(Math.sin(time * shared.atlasCadence.value)) *
      shared.atlasMotion.value *
      0.045;
    for (const [key, base] of Object.entries(baseSites)) {
      const p = sites[key].copy(base);
      const side = p.x < 0 ? -1 : 1;
      const step = Math.sin(time * shared.atlasCadence.value) * side;
      const amount = shared.atlasMotion.value;
      if (p.y < 1.96 && Math.abs(p.x) < 0.39) {
        const weight = 1 - THREE.MathUtils.smoothstep(p.y, 1.72, 1.96);
        if (p.y < 1.07)
          transformSite(
            p,
            side * 0.19,
            1.07,
            -0.015,
            -Math.max(0, -step) * amount * 1.3,
          );
        transformSite(p, side * 0.19, 1.85, -0.025, step * amount, weight);
      } else if (Math.abs(p.x) > 0.34 && p.y > 1.25 && p.y < 3.05) {
        transformSite(
          p,
          side * 0.35,
          2.96,
          -0.035,
          -step * amount * 0.7,
          THREE.MathUtils.smoothstep(Math.abs(p.x), 0.34, 0.45),
        );
      }
    }
    for (const id of WEARABLE_SITES) {
      const device = wearables.devices[id];
      device.position.copy(attachmentPoses[id].position);
      device.quaternion.copy(attachmentTurns[id]);
      if (id === "finger" || id === "wrist" || id === "upperarm") {
        const angle =
          -Math.sin(time * shared.atlasCadence.value) *
          shared.atlasMotion.value *
          0.7;
        transformSite(device.position, 0.35, 2.96, -0.035, angle);
        attachmentSwing.setFromAxisAngle(axis, angle);
        device.quaternion.premultiply(attachmentSwing);
      } else if (id === "toe") {
        const step = Math.sin(time * shared.atlasCadence.value);
        const knee = -Math.max(0, -step) * shared.atlasMotion.value * 1.3;
        const hip = step * shared.atlasMotion.value;
        transformSite(device.position, 0.19, 1.07, -0.015, knee);
        transformSite(device.position, 0.19, 1.85, -0.025, hip);
        attachmentSwing.setFromAxisAngle(axis, knee + hip);
        device.quaternion.premultiply(attachmentSwing);
      }
    }
  }

  function dispose() {
    disposed = true;
    draco.dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    wearables.dispose();
    group.clear();
  }
  return {
    group,
    heart,
    layers,
    sites,
    wearables,
    headOccluders,
    animate,
    setPresentation,
    heartCenter: shared.atlasHeart.value,
    setHeartFocus: (enabled: boolean) => {
      if (enabled === heartFocus) return;
      heartFocus = enabled;
      shared.atlasHeartFocus.value = enabled ? 1 : 0;
      setPresentation(mode);
    },
    setGlow: (color: "blue" | "amber") => {
      shared.atlasGlowColor.value.set(color === "blue" ? "#5babff" : "#ff933f");
    },
    setCutaway: (enabled: boolean) => {
      shared.atlasCutaway.value = enabled ? 1 : 0;
    },
    dispose,
  };
}
