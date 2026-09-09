"""Build the neutral presentation skin in the original anatomical arm pose from BodyParts3D FJ2810.

Run with Blender --background --python scripts/build_neutral_skin.py.
Source anatomy is CC BY 4.0; internal tissues remain in bodyparts-atlas.glb.
"""
import bpy, bmesh, zipfile, math
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with zipfile.ZipFile(ROOT / 'scripts/bodyparts3d-source/bodyparts4-complete.zip') as archive:
    name = next(n for n in archive.namelist() if n.endswith('/FJ2810.obj'))
    lines = archive.read(name).decode().splitlines()
vertices = np.array([list(map(float, l.split()[1:4])) for l in lines if l.startswith('v ')])
faces = [[int(p.split('/')[0])-1 for p in l.split()[1:]] for l in lines if l.startswith('f ')]
scale = 2.122745644125938
p = np.column_stack((vertices[:,0]*.001, vertices[:,2]*.001+.0781112, -vertices[:,1]*.001-.1)) * scale
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

# A featureless lower pelvis, including the bottom silhouette.
x,y,z=p.T.copy()
w=(1-smooth(.065,.17,np.abs(x)))*smooth(1.53,1.64,y)*(1-smooth(1.92,2.08,y))*smooth(-.035,.025,z)
p[:,2]=z*(1-.94*w)

# Preserve every source arm and hand coordinate; never twist an unrigged mesh.

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mesh=bpy.data.meshes.new('Neutral source skin')
mesh.from_pydata(np.column_stack((p[:,0],-p[:,2],p[:,1])).tolist(),[],faces)
mesh.update()
obj=bpy.data.objects.new('neutral_skin',mesh);bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
source_normals=bmesh.new();source_normals.from_mesh(obj.data)
bmesh.ops.recalc_face_normals(source_normals,faces=list(source_normals.faces))
source_normals.to_mesh(obj.data);source_normals.free()
# Fill the external genital region with a smooth, featureless pelvic envelope.
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,location=(0,-.025,1.85))
cover=bpy.context.object;cover.scale=(.18,.15,.19)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.objects.active=obj
union=obj.modifiers.new('Union neutral envelope into skin','BOOLEAN')
union.operation='UNION';union.solver='EXACT';union.object=cover
bpy.ops.object.modifier_apply(modifier=union.name)
bpy.data.objects.remove(cover,do_unlink=True)
obj.select_set(True)
# Reconstruct a single watertight surface after posing, removing folded/sliver
# triangles instead of exposing them under physical lighting.
obj.data.remesh_voxel_size=.0035
obj.data.remesh_voxel_adaptivity=0
bpy.ops.object.voxel_remesh()
smooth_mod=obj.modifiers.new('Surface relaxation','SMOOTH');smooth_mod.factor=.75;smooth_mod.iterations=8
bpy.ops.object.modifier_apply(modifier=smooth_mod.name)
tri=obj.modifiers.new('Triangulate','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
dec=obj.modifiers.new('Interactive mesh budget','DECIMATE');dec.ratio=min(1,210000/len(obj.data.polygons))
bpy.ops.object.modifier_apply(modifier=dec.name)
clean=bmesh.new();clean.from_mesh(obj.data)
bmesh.ops.remove_doubles(clean,verts=list(clean.verts),dist=0.000001)
bmesh.ops.dissolve_degenerate(clean,edges=list(clean.edges),dist=0.0000001)
bmesh.ops.recalc_face_normals(clean,faces=list(clean.faces))
clean.to_mesh(obj.data);clean.free();obj.data.validate();obj.data.update()
assert len(obj.data.vertices)>50000, 'Skin reconstruction unexpectedly lost source geometry'
for poly in obj.data.polygons:poly.use_smooth=True
obj['source']='BodyParts3D FJ2810, CC BY 4.0'
obj['adaptation']='Neutral external pelvis, source arm pose preserved, watertight surface reconstruction'
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/neutral-skin.glb'),export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12)
print('Neutral presentation skin:',len(obj.data.vertices),'vertices,',len(obj.data.polygons),'triangles',flush=True)
