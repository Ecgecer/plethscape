import * as THREE from "three";

type TissueFinish = {
  roughness: number;
  coat: number;
  coatRoughness: number;
  specular: number;
  colorVariation: number;
  roughnessVariation: number;
  microHeight: number;
};

// These are display finishes, not measurements of patient tissue. Texture is
// deliberately non-anatomical: it never draws vessels, fibres, grooves or fat.
const finishes: Record<string, TissueFinish> = {
  heart: {
    roughness: 0.48,
    coat: 0.22,
    coatRoughness: 0.3,
    specular: 0.85,
    colorVariation: 0.15,
    roughnessVariation: 0.14,
    microHeight: 0.000075,
  },
  vessel: {
    roughness: 0.43,
    coat: 0.15,
    coatRoughness: 0.27,
    specular: 0.82,
    colorVariation: 0.085,
    roughnessVariation: 0.1,
    microHeight: 0.000035,
  },
  lungs: {
    roughness: 0.61,
    coat: 0.12,
    coatRoughness: 0.38,
    specular: 0.76,
    colorVariation: 0.16,
    roughnessVariation: 0.15,
    microHeight: 0.00012,
  },
  muscle: {
    roughness: 0.59,
    coat: 0.08,
    coatRoughness: 0.38,
    specular: 0.78,
    colorVariation: 0.12,
    roughnessVariation: 0.12,
    microHeight: 0.00008,
  },
  skin: {
    roughness: 0.71,
    coat: 0,
    coatRoughness: 0.5,
    specular: 0.72,
    colorVariation: 0.08,
    roughnessVariation: 0.15,
    microHeight: 0.00011,
  },
  bone: {
    roughness: 0.76,
    coat: 0,
    coatRoughness: 0.5,
    specular: 0.66,
    colorVariation: 0.065,
    roughnessVariation: 0.1,
    microHeight: 0.00006,
  },
  connective: {
    roughness: 0.56,
    coat: 0.1,
    coatRoughness: 0.36,
    specular: 0.8,
    colorVariation: 0.065,
    roughnessVariation: 0.09,
    microHeight: 0.00004,
  },
  nerve: {
    roughness: 0.64,
    coat: 0.035,
    coatRoughness: 0.43,
    specular: 0.72,
    colorVariation: 0.05,
    roughnessVariation: 0.08,
    microHeight: 0.000025,
  },
  brain: {
    roughness: 0.59,
    coat: 0.1,
    coatRoughness: 0.36,
    specular: 0.76,
    colorVariation: 0.07,
    roughnessVariation: 0.1,
    microHeight: 0.000055,
  },
  mucosa: {
    roughness: 0.48,
    coat: 0.18,
    coatRoughness: 0.29,
    specular: 0.82,
    colorVariation: 0.09,
    roughnessVariation: 0.1,
    microHeight: 0.000055,
  },
  eyes: {
    roughness: 0.32,
    coat: 0.2,
    coatRoughness: 0.2,
    specular: 0.84,
    colorVariation: 0.025,
    roughnessVariation: 0.035,
    microHeight: 0.000008,
  },
};

function finishFor(tissue: string): TissueFinish {
  const name = tissue.toLowerCase().replace(/[\s_-]/g, "");
  if (/arter|vein|venous|vascular|bloodvessel/.test(name))
    return finishes.vessel;
  if (/heart|myocard/.test(name)) return finishes.heart;
  if (/lung/.test(name)) return finishes.lungs;
  if (/muscle|diaphragm/.test(name)) return finishes.muscle;
  if (/skeleton|bone|teeth|tooth/.test(name)) return finishes.bone;
  if (/cartilage|valve|connective|fibrous|airway/.test(name))
    return finishes.connective;
  if (/nerve|nervous/.test(name)) return finishes.nerve;
  if (/brain/.test(name)) return finishes.brain;
  if (/gingiva|mucosa/.test(name)) return finishes.mucosa;
  if (/eye/.test(name)) return finishes.eyes;
  return finishes.skin;
}

/**
 * Creates a neutral dielectric finish while preserving the supplied anatomy
 * palette, including the pulmonary oxygenation exceptions. The caller owns
 * opacity, cutaways, emission and animation. Call enhanceTissueShader from the
 * caller's onBeforeCompile hook once atlasPosition has been supplied.
 */
export function createTissueMaterial(
  tissue: string,
  color: string,
): THREE.MeshPhysicalMaterial {
  const finish = finishFor(tissue);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: finish.roughness,
    ior: 1.4,
    specularIntensity: finish.specular,
    specularColor: 0xffffff,
    clearcoat: finish.coat,
    clearcoatRoughness: finish.coatRoughness,
    // Transmission needs another scene render and makes these surfaces glassy.
    transmission: 0,
    sheen: 0,
    anisotropy: 0,
    side: THREE.DoubleSide,
    dithering: true,
  });
  material.forceSinglePass = true;
  material.userData.tissue = tissue;
  return material;
}

const surfaceFunctions = /* glsl */ `
// ATLAS_TISSUE_FINISH_V1
float atlasTissueHash(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float atlasTissueNoise(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  // Quintic interpolation leaves continuous first and second derivatives.
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(
    mix(mix(atlasTissueHash(cell), atlasTissueHash(cell+vec3(1,0,0)), u.x),
        mix(atlasTissueHash(cell+vec3(0,1,0)), atlasTissueHash(cell+vec3(1,1,0)), u.x), u.y),
    mix(mix(atlasTissueHash(cell+vec3(0,0,1)), atlasTissueHash(cell+vec3(1,0,1)), u.x),
        mix(atlasTissueHash(cell+vec3(0,1,1)), atlasTissueHash(cell+vec3(1,1,1)), u.x), u.y), u.z);
}
vec3 atlasTissueMicronormal(vec3 surfaceNormal, float height, float facing) {
  vec3 dx = dFdx(-vViewPosition);
  vec3 dy = dFdy(-vViewPosition);
  vec3 tx = cross(dy, surfaceNormal);
  vec3 ty = cross(surfaceNormal, dx);
  float determinant = dot(dx, tx) * facing;
  vec3 gradient = sign(determinant) * (dFdx(height)*tx + dFdy(height)*ty);
  // The gradient only affects shading. Actual atlas surfaces stay untouched.
  return normalize(surfaceNormal - gradient / max(abs(determinant), 1e-12));
}
`;

const glslFloat = (value: number) => value.toFixed(7);

/**
 * Adds stationary, UV-free surface variation to a standard/physical shader.
 * Requires the existing varying vec3 atlasPosition in source scene units
 * (adult atlas height 3.65). Uses no image textures, uniforms or extra passes.
 * Include the tissue name in the caller's customProgramCacheKey.
 */
export function enhanceTissueShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  tissue: string,
): void {
  if (
    tissue === "flow" ||
    shader.fragmentShader.includes("ATLAS_TISSUE_FINISH_V1")
  ) {
    return;
  }
  const finish = finishFor(tissue);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${surfaceFunctions}`)
    .replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
      float atlasTissueFootprint = max(length(dFdx(atlasPosition)), length(dFdy(atlasPosition)));
      float atlasTissueBroadWeight = 1.-smoothstep(.35, 1., atlasTissueFootprint*29.);
      float atlasTissueMediumWeight = 1.-smoothstep(.3, .9, atlasTissueFootprint*137.);
      float atlasTissueFineWeight = 1.-smoothstep(.25, .8, atlasTissueFootprint*617.);
      float atlasTissueBroad = (atlasTissueNoise(atlasPosition*29.+vec3(7.2,31.7,15.4))-.5)*atlasTissueBroadWeight;
      float atlasTissueMedium = (atlasTissueNoise(atlasPosition*137.+vec3(43.1,4.8,23.6))-.5)*atlasTissueMediumWeight;
      float atlasTissueFine = (atlasTissueNoise(atlasPosition*617.+vec3(13.4,67.5,8.3))-.5)*atlasTissueFineWeight;
      // A scalar changes luminance only, preserving red/blue teaching colors.
      diffuseColor.rgb *= 1. + ${glslFloat(finish.colorVariation)}*(atlasTissueBroad + .24*atlasTissueMedium);
      `,
    )
    .replace(
      "#include <roughnessmap_fragment>",
      /* glsl */ `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + ${glslFloat(finish.roughnessVariation)}*(.7*atlasTissueMedium + .3*atlasTissueFine), .22, .92);
      `,
    )
    .replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `#include <normal_fragment_maps>
      float atlasTissueHeight = ${glslFloat(finish.microHeight)}*(atlasTissueFine + .25*atlasTissueMedium);
      normal = atlasTissueMicronormal(normal, atlasTissueHeight, faceDirection);
      `,
    );
}
