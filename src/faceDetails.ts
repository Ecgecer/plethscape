import * as THREE from "three";

/** Small illustrative nostril recesses; never modify the source atlas file. */
export function sculptNostrils(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    if (z < 0.18 || y < 3.298 || y > 3.316 || Math.abs(x) > 0.031) continue;
    const d =
      Math.pow((Math.abs(x) - 0.019) / 0.007, 2) +
      Math.pow((y - 3.306) / 0.006, 2);
    if (d < 1) p.setZ(i, z - 0.01 * Math.pow(1 - d, 2));
  }
  p.needsUpdate = true;
  geometry.computeVertexNormals();
}

// Pigment follows the actual facial surface, so nothing floats off the lips,
// brows or nose when the camera is viewed from the side.
export const facialPigment = /* glsl */ `
  float frontFace = smoothstep(.10,.15,atlasPosition.z);
  float ax = abs(atlasPosition.x);
  float browT = clamp((ax-.026)/.087,0.,1.);
  float browY = 3.426 + .012*sin(browT*3.14159) - .003*browT;
  float browWidth = .0037*(1.-.65*browT);
  float browEdge = max(fwidth(atlasPosition.y)*1.5,.0005);
  float brow = (1.-smoothstep(browWidth,browWidth+browEdge,abs(atlasPosition.y-browY)))
    * smoothstep(.023,.034,ax)*(1.-smoothstep(.102,.118,ax))*frontFace;
  float hair = .52+.48*smoothstep(-.6,.8,sin(atlasPosition.x*4700.+atlasPosition.y*2500.+sin(atlasPosition.x*730.)*1.5+sin(atlasPosition.y*1300.)*.7));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.045,.030,.023),brow*hair*.84);
  float nostril = length(vec2((ax-.019)/.007,(atlasPosition.y-3.306)/.006));
  float nostrilShadow = (1.-smoothstep(.38,1.08,nostril))*frontFace;
  diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.029,.012,.009),nostrilShadow*.93);
  float mouthY = 3.276-.003*pow(clamp(ax/.038,0.,1.),2.);
  float mouthEnds = 1.-smoothstep(.026,.043,ax);
  float lipBody = exp(-pow((atlasPosition.y-mouthY)/.008,2.))*mouthEnds*frontFace;
  diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.29,.115,.087),lipBody*.30);
  float mouth = (1.-smoothstep(.0004,.0018,abs(atlasPosition.y-mouthY)))*mouthEnds*frontFace;
  diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.075,.028,.023),mouth*.72);
`;

export function createEyeMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#c7beb0",
    roughness: 0.27,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 eyePosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\neyePosition=position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 eyePosition;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float r=length(eyePosition.xy)/.026;
        float angle=atan(eyePosition.y,eyePosition.x);
        float iris=(1.-smoothstep(.385,.425,r))*step(0.,eyePosition.z);
        float fibers=.5+.22*sin(angle*87.+r*81.)+.18*sin(angle*143.-r*32.);
        vec3 brown=mix(vec3(.048,.027,.013),vec3(.22,.13,.052),fibers);
        float edge=smoothstep(.335,.407,r);
        brown=mix(brown,vec3(.023,.018,.014),edge*.8);
        diffuseColor.rgb=mix(diffuseColor.rgb,brown,iris);
        float pupil=(1.-smoothstep(.145,.173,r))*step(0.,eyePosition.z);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.004,.005,.006),pupil);
      `,
      );
  };
  material.customProgramCacheKey = () => "procedural-brown-iris-v1";
  return material;
}
