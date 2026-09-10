import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PHYSIOLOGY,
  SITES,
  samplePPG,
  sampleBeat,
  getCardiacState,
} from "../src/simulation";
import type { Wavelength } from "../src/optics";
const bands: Wavelength[] = ["green", "red", "infrared"];
test("wavelength changes each site's clean contour without changing cardiac timing", () => {
  for (const site of SITES) {
    const values = bands.map((wavelength) =>
      Array.from({ length: 101 }, (_, i) =>
        sampleBeat(i / 100, { ...DEFAULT_PHYSIOLOGY, wavelength }, site.id),
      ),
    );
    assert.notDeepEqual(values[0], values[1]);
    assert.notDeepEqual(values[1], values[2]);
    for (const wavelength of bands)
      assert.deepEqual(
        getCardiacState(8, { ...DEFAULT_PHYSIOLOGY, wavelength }),
        getCardiacState(8, DEFAULT_PHYSIOLOGY),
      );
  }
});
test("longer wavelengths amplify gait artifacts at every site and replay exactly", () => {
  for (const site of SITES)
    for (const activity of ["walk", "run"] as const) {
      const energy = bands.map((wavelength) => {
        const p = { ...DEFAULT_PHYSIOLOGY, wavelength, activity };
        const quiet = {
          ...p,
          motionHistory: [
            {
              time: -100,
              previous: "rest",
              to: "rest",
              phase: 0,
              cadence: 0,
              walk: 0,
              run: 0,
            },
          ],
        };
        // Compare active gait to a stationary motion history while preserving cardiac parameters.
        let sum = 0;
        for (let i = 0; i < 2000; i++) {
          const t = i / 100;
          const y = samplePPG(t, p, site.id);
          assert.ok(Number.isFinite(y));
          assert.equal(y, samplePPG(t, p, site.id));
          const delta = y - samplePPG(t, quiet as typeof p, site.id);
          sum += delta * delta;
        }
        return sum;
      });
      assert.ok(
        energy[2] > energy[1] && energy[1] > energy[0],
        `${site.id} ${activity}: ${energy}`,
      );
    }
});
