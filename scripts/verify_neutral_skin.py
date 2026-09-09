"""Check reconstructed arm surfaces against the untwisted source anatomy.
Run with Blender --background --python scripts/verify_neutral_skin.py.
Requires the source archive downloaded by fetch_bodyparts3d.py.
"""
import bpy, zipfile, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
scale = 2.122745644125938
with zipfile.ZipFile(ROOT / "scripts/bodyparts3d-source/bodyparts4-complete.zip") as archive:
    name = next(n for n in archive.namelist() if n.endswith("/FJ2810.obj"))
    lines = archive.read(name).decode().splitlines()
raw = [list(map(float, l.split()[1:4])) for l in lines if l.startswith("v ")]
# Blender coordinates: scene x, -scene z, scene y.
vertices = [Vector((x*.001*scale,(y*.001+.1)*scale,(z*.001+.0781112)*scale)) for x,y,z in raw]
faces = [[int(p.split("/")[0])-1 for p in l.split()[1:]] for l in lines if l.startswith("f ")]
source = BVHTree.FromPolygons(vertices, faces)
bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/models/neutral-skin.glb"))
report = {}
for side, sign in [("left",1),("right",-1)]:
    distances = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH": continue
        for vertex in obj.data.vertices:
            p = obj.matrix_world @ vertex.co
            if sign*p.x > .37 and 1.3 < p.z < 2.9:
                nearest = source.find_nearest(p)
                distances.append(nearest[3])
    distances.sort()
    assert len(distances)>1000, "Arm sample is incomplete"
    p99 = distances[int(len(distances)*.99)]
    maximum = distances[-1]
    assert p99 < .006 and maximum < .014, f"{side} arm deviates from the source: {p99}, {maximum}"
    report[side] = {"vertices":len(distances), "p99_scene_distance":p99,"maximum_scene_distance":maximum}
print("Source arm surface comparison:", json.dumps(report), flush=True)
