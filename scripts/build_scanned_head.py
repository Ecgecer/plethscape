"""Extract Eric's textured head and fit a neck bridge to the existing neutral body.
Requires the authorized Renderpeople FBX and textures in artifacts/eric-source.
Run: Blender --background --python scripts/build_scanned_head.py
Original source files are deliberately kept outside the published assets.
"""
import bpy, bmesh, math
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'artifacts/eric-source'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/neutral-skin.glb'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bvh=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
body_matrix=body.matrix_world.copy();inv=body_matrix.inverted()
def neck_contact(angle):
    start=Vector((math.cos(angle),math.sin(angle),3.105))
    direction=Vector((-math.cos(angle),-math.sin(angle),0))
    hit,_,_,_=bvh.ray_cast(inv@start,inv.to_3x3()@direction)
    assert hit is not None,'Neck cross-section missed skin'
    return body_matrix@hit
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'rp_eric_rigged_001_zup_a.fbx'))
head=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o!=body)
# Freeze the original bind pose, then discard the unrelated suit/body/rig.
head.data.transform(head.matrix_world);head.parent=None;head.matrix_world.identity();head.modifiers.clear()
bm=bmesh.new();bm.from_mesh(head.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,0,1.625),plane_no=(0,0,1),clear_inner=True)
# The FBX contains detached internal teeth/mouth islands in its bind pose.
# With the closed photographic lips they are unnecessary and can protrude below
# the jaw after extraction. Retain the external head and both eye islands only.
unvisited=set(bm.verts)
while unvisited:
    seed=unvisited.pop();component={seed};queue=[seed]
    while queue:
        vertex=queue.pop()
        for edge in vertex.link_edges:
            other=edge.other_vert(vertex)
            if other not in component:
                component.add(other);unvisited.discard(other);queue.append(other)
    if max(v.co.z for v in component)<1.70:
        bmesh.ops.delete(bm,geom=list(component),context='VERTS')
for v in bm.verts:
    v.co=Vector(((v.co.x+.0177155)*2.04,v.co.y*2.04+.065,3.388+(v.co.z-1.72481)*2.04))
uv=bm.loops.layers.uv.active
boundary=[e for e in bm.edges if e.is_boundary and all(v.co.z<3.186 for v in e.verts)]
assert len(boundary)>8, 'Expected a neck opening'
original={v:v.co.copy() for e in boundary for v in e.verts}
texture={v:next(l[uv].uv.copy() for f in v.link_faces for l in f.loops if l.vert==v) for v in original}
target={v:neck_contact(math.atan2(v.co.y,v.co.x)) for v in original}
previous={v:v for v in original}
for row in range(1,9):
    t=row/8
    current={v:bm.verts.new(original[v].lerp(target[v],t)) for v in original}
    for e in boundary:
        a,b=e.verts
        f=bm.faces.new((previous[a],previous[b],current[b],current[a]))
        for l,source in zip(f.loops,(a,b,b,a)):l[uv].uv=texture[source]
    previous=current
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(head.data);bm.free();head.data.update()
# Crop the texture atlas to occupied head UV bounds; no clothing geometry ships.
coords=np.array([l.uv[:] for l in head.data.uv_layers.active.data])
lo=np.maximum(0,coords.min(axis=0)-.002);hi=np.minimum(1,coords.max(axis=0)+.002)
print('Head UV crop',lo,hi,flush=True)
mat=bpy.data.materials.new('Scanned skin and hair');mat.use_nodes=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.68
for kind in ['dif','norm']:
    img=bpy.data.images.load(str(SOURCE/f'tex/rp_eric_rigged_001_{kind}.jpg'))
    w,h=img.size;pixels=np.empty(w*h*4,dtype=np.float32);img.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
    x0,y0=np.floor(lo*np.array([w,h])).astype(int);x1,y1=np.ceil(hi*np.array([w,h])).astype(int)
    crop=pixels[y0:y1,x0:x1,:].copy()
    out=bpy.data.images.new(f'Eric head {kind}',width=x1-x0,height=y1-y0,alpha=False)
    out.pixels.foreach_set(crop.ravel());out.update()
    scale=min(1,2048/max(out.size));out.scale(round(out.size[0]*scale),round(out.size[1]*scale))
    out.file_format='JPEG';out.filepath_raw=str(ROOT/f'artifacts/eric-head-{kind}.jpg');out.save();out.pack()
    tex=nodes.new('ShaderNodeTexImage');tex.image=out
    if kind=='dif':links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    else:
        out.colorspace_settings.name='Non-Color'
        normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55
        links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
for l in head.data.uv_layers.active.data:l.uv=((l.uv.x-lo[0])/(hi[0]-lo[0]),(l.uv.y-lo[1])/(hi[1]-lo[1]))
head.data.materials.clear();head.data.materials.append(mat)
for f in head.data.polygons:f.use_smooth=True;f.material_index=0
head.name='Eric scanned head';head['source']='Renderpeople Eric Rigged 001; separately authorized by project owner'
bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head
sub=head.modifiers.new('Smooth scanned silhouette','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
# Subdivision rounds the open rim inward; re-project it onto the body and
# match its outward normals so the independently textured meshes meet smoothly.
for v in head.data.vertices:
    if v.co.z < 3.1054:
        q=neck_contact(math.atan2(v.co.y,v.co.x));q.z=v.co.z
        v.co=q
head.data.update()
custom=[]
for v in head.data.vertices:
    n=v.normal.copy()
    if v.co.z < 3.19:
        _,near_normal,_,_=bvh.find_nearest(inv@v.co)
        if near_normal is not None:
            near_normal=(body_matrix.to_3x3()@near_normal).normalized()
            t=max(0,min(1,(v.co.z-3.105)/.085));t=t*t*(3-2*t)
            n=near_normal.lerp(n,t).normalized()
    custom.append(n)
head.data.normals_split_custom_set_from_vertices(custom)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/scanned-head.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_image_format='JPEG',export_jpeg_quality=88,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print('HEAD',len(head.data.vertices),'vertices',len(head.data.polygons),'polygons',flush=True)
