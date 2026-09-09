import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
execFileSync(
  "npx",
  [
    "--yes",
    "@gltf-transform/cli@4.5.0",
    "meshopt",
    join(root, "artifacts/model-source/neutral-anatomy.glb"),
    join(root, "public/models/neutral-anatomy.meshopt.glb"),
    "--level",
    "medium",
    "--quantize-position",
    "16",
    "--quantize-normal",
    "12",
  ],
  { stdio: "inherit" },
);
