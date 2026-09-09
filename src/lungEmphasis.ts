import * as THREE from "three";

/** Presentation region around the source lung envelopes. It excludes the
 * mediastinum; it is a visual mask, not an anatomical segmentation. */
export const lungContextShader = /* glsl */ `
  float lungFlank = smoothstep(.075,.13,abs(atlasPosition.x))
    * (1.-smoothstep(.255,.31,abs(atlasPosition.x)));
  float lungHeight = smoothstep(2.49,2.59,atlasPosition.y)
    * (1.-smoothstep(2.94,3.045,atlasPosition.y));
  float lungContext = lungFlank * lungHeight * atlasLungEmphasis;
  diffuseColor.a *= mix(1.,.18,lungContext);
`;

/** Reorder existing triangle indices into two draw groups. Attributes, geometry
 * and every triangle remain unchanged; only the thoracic group needs blending. */
export function groupLungContext(geometry: THREE.BufferGeometry): boolean {
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
    const crossesFlank =
      (minX < -0.075 && maxX > -0.31) || (maxX > 0.075 && minX < 0.31);
    const overlaps =
      crossesFlank && Math.max(...ys) > 2.49 && Math.min(...ys) < 3.045;
    (overlaps ? context : solid).push(a, b, c);
  }
  if (!context.length) return false;
  geometry.setIndex(solid.concat(context));
  geometry.clearGroups();
  if (solid.length) geometry.addGroup(0, solid.length, 0);
  geometry.addGroup(solid.length, context.length, 1);
  return true;
}
