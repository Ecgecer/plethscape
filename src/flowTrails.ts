import * as THREE from "three";

export type FlowRoute = {
  points: THREE.Vector3[];
  radius?: number;
  kind?: string;
};

/** Static, camera-facing ribbons on the source centerlines. No moving particles. */
export function buildFlowGeometry(routes: FlowRoute[]) {
  const position: number[] = [],
    tangent: number[] = [],
    color: number[] = [];
  const ribbon: number[] = [],
    indices: number[] = [];
  const direction = new THREE.Vector3();
  for (const route of routes) {
    const points = route.points.filter(
      (p, i, a) => !i || p.distanceToSquared(a[i - 1]) > 1e-12,
    );
    if (points.length < 2) continue;
    const distances = [0];
    for (let i = 1; i < points.length; i++)
      distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    const length = distances.at(-1)!;
    if (length < 0.01) continue;
    // Resample before smoothing to avoid overshooting sparse source bends.
    const count = Math.max(8, Math.ceil(length / 0.006));
    let samples: THREE.Vector3[] = [];
    let segment = 1;
    for (let i = 0; i <= count; i++) {
      const distance = (length * i) / count;
      while (segment < points.length - 1 && distances[segment] < distance)
        segment++;
      samples.push(
        points[segment - 1]
          .clone()
          .lerp(
            points[segment],
            (distance - distances[segment - 1]) /
              (distances[segment] - distances[segment - 1]),
          ),
      );
    }
    // Remove short-scale source jitter without changing the route endpoints.
    // Bound displacement by the source radius; this is a display adaptation,
    // not a reconstruction of a measured vessel lumen.
    const original = samples.map((p) => p.clone());
    const maxOffset = (route.radius ?? 0.004) * 0.8;
    for (let pass = 0; pass < 12; pass++) {
      samples = samples.map((p, i) => {
        if (i === 0 || i === count) return p;
        const next = p
          .clone()
          .multiplyScalar(0.5)
          .addScaledVector(samples[i - 1], 0.25)
          .addScaledVector(samples[i + 1], 0.25);
        const offset = next.sub(original[i]).clampLength(0, maxOffset);
        return original[i].clone().add(offset);
      });
    }
    const cool = route.kind === "pulmonary-arterial" || route.kind === "venous";
    const hue = new THREE.Color(cool ? "#79b9e2" : "#ff825a");
    const width = THREE.MathUtils.clamp(
      (route.radius ?? 0.004) * 2.3,
      0.006,
      0.013,
    );
    const base = position.length / 3;
    for (let i = 0; i <= count; i++) {
      direction
        .subVectors(
          samples[Math.min(count, i + 1)],
          samples[Math.max(0, i - 1)],
        )
        .normalize();
      for (const side of [-1, 1]) {
        position.push(...samples[i].toArray());
        tangent.push(...direction.toArray());
        color.push(hue.r, hue.g, hue.b);
        ribbon.push(side, (length * i) / count, width, length);
      }
      if (i < count) {
        const a = base + i * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(position, 3),
  );
  geometry.setAttribute(
    "flowTangent",
    new THREE.Float32BufferAttribute(tangent, 3),
  );
  geometry.setAttribute(
    "flowColor",
    new THREE.Float32BufferAttribute(color, 3),
  );
  geometry.setAttribute("ribbon", new THREE.Float32BufferAttribute(ribbon, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createFlowTrails(
  routes: FlowRoute[],
  uniforms: Record<string, THREE.IUniform>,
  movement: string,
) {
  const geometry = buildFlowGeometry(routes);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${movement}
      attribute vec3 flowTangent;
      attribute vec3 flowColor;
      attribute vec4 ribbon;
      varying vec4 vRibbon;
      varying vec3 vColor;
      varying vec3 vFlowPosition;
      void main() {
        vec3 p = atlasGait(position);
        vec3 ahead = atlasGait(position + flowTangent * .003);
        vec4 view = modelViewMatrix * vec4(p, 1.);
        vec3 forward = (modelViewMatrix * vec4(ahead, 1.)).xyz - view.xyz;
        vec2 across = vec2(-forward.y, forward.x);
        across /= max(length(across), .000001);
        view.xy += across * ribbon.x * ribbon.z;
        gl_Position = projectionMatrix * view;
        vRibbon = ribbon;
        vColor = flowColor;
        vFlowPosition = position;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float atlasFlow;
      uniform float atlasBeat;
      varying vec4 vRibbon;
      varying vec3 vColor;
      varying vec3 vFlowPosition;
      void main() {
        // Respect the simplified head treatment.
        if (vFlowPosition.y > 3.18) discard;
        float distanceAlong = vRibbon.y;
        float spacing = .31;
        float behind = fract((atlasFlow * .18 - distanceAlong) / spacing);
        float tail = (1.-smoothstep(.06,.76,behind)) * smoothstep(0.,.055,behind);
        float taper = .24 + .76 * (1.-behind);
        float across = abs(vRibbon.x) / taper;
        float core = exp(-across*across*38.);
        float halo = exp(-across*across*5.);
        float phase = fract(atlasBeat - distanceAlong * .30);
        float pulse = exp(-pow((phase-.19)/.13,2.));
        float ends = smoothstep(0.,.014,distanceAlong) * smoothstep(0.,.018,vRibbon.w-distanceAlong);
        float intensity = ends * ((core*.48+halo*.34)*tail + halo*(.025+.10*pulse));
        float edge = 1.-smoothstep(.78,1.,abs(vRibbon.x));
        vec3 tint = mix(vColor, vec3(1.,.73,.48), core*.20);
        gl_FragColor = vec4(tint * (1.05 + .25*pulse), min(.56,intensity*edge));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Continuous luminous blood-flow trails";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return mesh;
}
