import * as THREE from "three";

/** Presentation region around the source lung envelopes. The cardiac foreground is
 * also softened; this is a visual mask, not an anatomical segmentation. */
export const lungContextShader = /* glsl */ `
  vec3 cardiacOffset = (atlasPosition-atlasHeart)/vec3(.23,.27,.24);
  float cardiacContext = (1.-smoothstep(.65,1.25,length(cardiacOffset)))
    * (1.-smoothstep(atlasHeart.y+.12,atlasHeart.y+.24,atlasPosition.y))
    * atlasOrganEmphasis * atlasSystemicContext;
  // Keep the central great vessels; suppress peripheral thoracic branches in
  // the clean presentation instead of drawing ghost fragments through organs.
  float peripheralChest = smoothstep(.065,.115,abs(atlasPosition.x))
    * smoothstep(2.40,2.52,atlasPosition.y)
    * (1.-smoothstep(2.98,3.09,atlasPosition.y));
  if (atlasDetailedVessels < .5 && max(atlasLungEmphasis,atlasHeartFocus) > .5
      && peripheralChest > .18) discard;
  diffuseColor.a *= mix(1.,.035,cardiacContext * (1.-atlasDetailedVessels));

`;

/** Reorder existing triangle indices into two draw groups. Attributes, geometry
 * and every triangle remain unchanged; only the thoracic group needs blending. */
export function groupLungContext(geometry: THREE.BufferGeometry): boolean {
  return groupContext(geometry, [-0.36, 0.36, 2.36, 3.1]);
}

function groupContext(
  geometry: THREE.BufferGeometry,
  bounds: [number, number, number, number],
): boolean {
  const positions = geometry.getAttribute("position"),
    index = geometry.index;
  const count = index?.count ?? positions.count;
  const solid: number[] = [],
    context: number[] = [];
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i,
      b = index ? index.getX(i + 1) : i + 1,
      c = index ? index.getX(i + 2) : i + 2;
    const xs = [positions.getX(a), positions.getX(b), positions.getX(c)];
    const ys = [positions.getY(a), positions.getY(b), positions.getY(c)];
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const crossesRegion = minX < bounds[1] && maxX > bounds[0];
    const overlaps =
      crossesRegion &&
      Math.max(...ys) > bounds[2] &&
      Math.min(...ys) < bounds[3];
    (overlaps ? context : solid).push(a, b, c);
  }
  if (!context.length) return false;
  geometry.setIndex(solid.concat(context));
  geometry.clearGroups();
  if (solid.length) geometry.addGroup(0, solid.length, 0);
  geometry.addGroup(solid.length, context.length, 1);
  return true;
}
