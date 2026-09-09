"""Generate the original Plethscape neutral anatomical study surface.

The model is intentionally a simplified educational silhouette, not a clinical
anatomy mesh. Run with: blender --background --python scripts/generate_anatomy.py
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
pieces = []


def xyz(p):
    return (p[0], -p[2], p[1])


def oval(name, center, scale, tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, location=xyz(center))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (scale[0], scale[2], scale[1])
    ob.rotation_euler[1] = -tilt
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    pieces.append(ob)
    return ob


def gaussian(x,y,cx,cy,sx,sy):
    return math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)


def interpolate(rows):
    result=[]
    for k in range(len(rows)-1):
        a,b=rows[k],rows[k+1]
        prev=rows[max(0,k-1)]; following=rows[min(len(rows)-1,k+2)]
        for j in range(5):
            t=j/5
            result.append(tuple((2*t**3-3*t*t+1)*a[i]+(t**3-2*t*t+t)*(b[i]-prev[i])*.5+(-2*t**3+3*t*t)*b[i]+(t**3-t*t)*(following[i]-a[i])*.5 for i in range(len(a))))
    result.append(rows[-1])
    return result


def ridge(name,points,radius):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    curve.resolution_u=10;curve.bevel_depth=radius;curve.bevel_resolution=3;curve.use_fill_caps=True
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):
        p.co=xyz(co);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
    pieces.append(ob)
    return ob


def profile(name, rings, sides=48, sculpt=None):
    rings=interpolate(rings)
    verts, faces = [], []
    for y, x, z, rx, rz in rings:
        for i in range(sides):
            a = i / sides * 2 * math.pi
            # The squared soft elliptical section keeps the shoulders and
            # abdomen broad without a cylindrical mannequin appearance.
            p=(x+max(.001,rx)*math.cos(a),y,z+max(.001,rz)*math.sin(a))
            if sculpt:p=sculpt(p,a)
            verts.append(xyz(p))
    for j in range(len(rings)-1):
        for i in range(sides):
            a = j*sides+i
            b = j*sides+(i+1)%sides
            faces.append((a,a+sides,b+sides,b))
    faces.append(tuple(range(sides)))
    faces.append(tuple((len(rings)-1)*sides+i for i in reversed(range(sides))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(mesh);bm.free()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    pieces.append(ob)
    return ob


def torso_sculpt(p,a):
    x,y,z=p;front=max(0,math.sin(a))**3;back=max(0,-math.sin(a))**3
    d=0;dorsal=0
    for s in [-1,1]:
        d+=.024*gaussian(x,y,s*.17,2.66,.15,.115)
        d-=.007*gaussian(x,y,s*.15,2.54,.13,.022)
        for yy in [2.43,2.32,2.21]:d+=.008*gaussian(x,y,s*.078,yy,.060,.067)
        d+=.013*gaussian(x,y,s*.229,2.23,.060,.19)
        d+=.010*gaussian(x,y,s*.25,1.95,.049,.08)
        d+=.011*gaussian(x,y,s*.17,2.89-abs(x)*.15,.15,.015)
        dorsal+=.019*gaussian(x,y,s*.18,2.69,.12,.145)
        dorsal+=.012*gaussian(x,y,s*.10,2.35,.06,.29)
    d-=.012*gaussian(x,y,0,2.65,.024,.18)
    d-=.004*gaussian(x,y,0,2.30,.011,.24)
    d-=.009*gaussian(x,y,0,2.17,.013,.013)
    dorsal-=.013*gaussian(x,y,0,2.49,.025,.42)
    return (x,y,z+d*front-dorsal*back)


profile('Sculpted thorax abdomen and neutral pelvis', [
    (1.49,0,.022,.015,.041), (1.54,0,.006,.12,.112), (1.60,0,-.015,.25,.165),
    (1.76,0,-.015,.337,.22), (1.9,0,-.012,.321,.208),
    (2.08,0,0,.275,.186), (2.20,0,-.008,.274,.183),
    (2.38,0,-.018,.315,.207), (2.56,0,-.025,.355,.218),
    (2.70,0,-.031,.368,.205), (2.80,0,-.036,.362,.168),
    (2.87,0,-.032,.33,.145), (2.93,0,-.03,.19,.124),
    (2.97,0,-.03,.12,.113)
],72,torso_sculpt)
oval('Neck',(0,3.02,-.02),(.111,.215,.117))


def face_sculpt(p,a):
    x,y,z=p;d=0
    d+=.040*gaussian(x,y,0,3.360,.024,.077)
    d+=.070*gaussian(x,y,0,3.310,.028,.027)
    d+=.011*gaussian(x,y,0,3.279,.012,.021)
    for s in [-1,1]:
        d+=.018*gaussian(x,y,s*.028,3.303,.019,.018)
        d-=.005*gaussian(x,y,s*.019,3.295,.009,.006)
        d-=.020*gaussian(x,y,s*.074,3.387,.044,.025)
        d+=.012*gaussian(x,y,s*.073,3.414,.055,.012)
        d+=.020*gaussian(x,y,s*.073,3.386,.036,.010)
        d-=.005*gaussian(x,y,s*.073,3.395,.035,.0037)
        d+=.005*gaussian(x,y,s*.073,3.373,.040,.009)
        d+=.024*gaussian(x,y,s*.108,3.343,.044,.032)
        d-=.007*gaussian(x,y,s*.115,3.289,.035,.032)
        d-=.008*gaussian(x,y,s*.143,3.398,.025,.034)
    d+=.013*gaussian(x,y,0,3.265,.058,.008)
    d+=.016*gaussian(x,y,0,3.248,.053,.010)
    d-=.006*gaussian(x,y,0,3.257,.059,.0035)
    d-=.005*gaussian(x,y,0,3.228,.047,.009)
    d+=.016*gaussian(x,y,0,3.191,.058,.032)
    return(x,y,z+d*max(0,math.sin(a))**5)


profile('Sculpted neutral adult head',[
    (3.122,0,.035,.049,.045),(3.15,0,.038,.078,.076),
    (3.19,0,.025,.111,.108),(3.235,0,.005,.134,.139),
    (3.294,0,-.012,.151,.160),(3.352,0,-.023,.167,.176),
    (3.410,0,-.025,.177,.183),(3.474,0,-.025,.176,.190),
    (3.538,0,-.027,.164,.180),(3.594,0,-.030,.135,.156),
    (3.631,0,-.032,.074,.086),(3.646,0,-.032,.002,.003),
],112,face_sculpt)
for s in [-1,1]:
    oval('Ear',(s*.179,3.350,-.012),(.026,.059,.028))
    ridge('Auricular helix',[(s*(.187+.013*math.cos(i/20*math.pi*2)),3.348+.053*math.sin(i/20*math.pi*2),-.007+.025*math.cos(i/20*math.pi*2)) for i in range(21)],.006)
    ridge('Auricular antihelix',[(s*.195,3.384,.005),(s*.196,3.358,.015),(s*.193,3.333,.010)],.0052)
    oval('Tragus',(s*.185,3.340,.022),(.010,.014,.010))
    oval('Ear lobule',(s*.183,3.302,-.001),(.018,.019,.022))
    ridge('Sternocleidomastoid',[(s*.092,3.182,-.011),(s*.080,3.083,.068),(s*.034,2.936,.087)],.011)
    oval('Deltoid',(s*.383,2.745,-.028),(.127,.151,.139),s*.32)
    profile('Arm',[
        (2.926,s*.160,-.035,.030,.063),
        (2.885,s*.290,-.025,.064,.102),
        (2.825,s*.413,-.012,.10,.125),
        (2.71,s*.490,-.005,.116,.139),
        (2.55,s*.576,.005,.102,.121),
        (2.39,s*.657,.013,.080,.092),
        (2.28,s*.708,.022,.078,.078),
        (2.16,s*.751,.025,.087,.097),
        (2.02,s*.806,.030,.078,.087),
        (1.89,s*.850,.030,.061,.065),
        (1.775,s*.884,.028,.049,.051),
        (1.718,s*.909,.033,.054,.038),
    ],56)
    oval('Biceps',(s*.559,2.566,.074),(.076,.185,.049),s*.45)
    oval('Triceps',(s*.551,2.579,-.070),(.081,.186,.058),s*.40)
    oval('Brachialis',(s*.654,2.403,.064),(.051,.083,.038),s*.43)
    oval('Olecranon',(s*.714,2.280,-.044),(.043,.051,.035),s*.26)
    oval('Lateral epicondyle',(s*.757,2.300,.018),(.021,.033,.033))
    oval('Forearm flexors',(s*.773,2.093,.086),(.049,.154,.041),s*.35)
    oval('Forearm extensors',(s*.775,2.108,-.033),(.055,.153,.044),s*.34)
    oval('Radial styloid',(s*.851,1.800,.033),(.016,.025,.028))
    oval('Ulnar styloid',(s*.925,1.811,.020),(.014,.028,.025))
    oval('Palm',(s*.928,1.66,.033),(.086,.133,.044),s*.18)
    oval('Thenar eminence',(s*.886,1.670,.061),(.035,.075,.029),s*.24)
    oval('Hypothenar eminence',(s*.979,1.654,.047),(.026,.064,.028),s*.18)
    # Four fingers, each with tapered joints and a rounded tip.
    for j,(offset,length) in enumerate([(-.052,.172),(-.015,.206),(.025,.192),(.061,.15)]):
        x = s*(.928+offset)
        top = 1.595
        r = [.0147,.0153,.0144,.0125][j]
        profile('Finger',[
            (top,x,.033,r*1.2,r),
            (top-length*.25,x+s*.005,.037,r*.95,r*.94),
            (top-length*.45,x+s*.008,.043,r*1.1,r*1.02),
            (top-length*.64,x+s*.010,.049,r*.89,r*.83),
            (top-length*.78,x+s*.011,.054,r*.94,r*.89),
            (top-length*.92,x+s*.010,.059,r*.84,r*.75),
            (top-length,x+s*.008,.060,r*.32,r*.4),
        ],24)
        oval('Finger tip',(x+s*.008,top-length+.005,.057),(r*.8,r*.9,r*.8))
        oval('Knuckle',(x,1.603,.012),(r*1.19,.022,.013))
        ridge('Dorsal hand tendon',[(s*.897,1.764,.003),(s*(.914+offset*.5),1.684,.002),(x,1.614,.007)],.0034)
    profile('Thumb',[
        (1.711,s*.879,.042,.029,.027),
        (1.651,s*.842,.057,.025,.024),
        (1.596,s*.825,.077,.023,.021),
        (1.552,s*.814,.092,.013,.016),
    ],16)
    oval('Thumb tip',(s*.816,1.556,.09),(.02,.029,.02))
    oval('Gluteal plane',(s*.163,1.790,-.133),(.169,.217,.112),s*.10)
    profile('Leg',[
        (1.907,s*.176,-.027,.137,.165),
        (1.815,s*.202,-.016,.147,.185),
        (1.68,s*.227,-.011,.173,.207),
        (1.48,s*.233,-.004,.158,.191),
        (1.25,s*.233,.008,.131,.153),
        (1.045,s*.226,.034,.095,.108),
        (.93,s*.223,.041,.095,.102),
        (.817,s*.220,.011,.103,.115),
        (.68,s*.216,-.022,.115,.140),
        (.525,s*.213,-.038,.100,.124),
        (.34,s*.210,-.008,.070,.077),
        (.185,s*.210,.004,.058,.065),
        (.11,s*.210,.015,.051,.066),
    ],64)
    oval('Rectus femoris',(s*.237,1.438,.121),(.069,.239,.066),s*.015)
    oval('Vastus lateralis',(s*.300,1.433,.058),(.074,.225,.104),s*-.065)
    oval('Vastus medialis',(s*.173,1.114,.073),(.052,.121,.062),s*-.14)
    oval('Patella',(s*.224,.956,.126),(.049,.075,.022))
    ridge('Sartorius',[(s*.285,1.786,.116),(s*.247,1.571,.164),(s*.190,1.286,.141),(s*.170,1.090,.098)],.009)
    oval('Medial gastrocnemius',(s*.181,.693,-.111),(.054,.156,.072),s*.06)
    oval('Lateral gastrocnemius',(s*.255,.709,-.105),(.050,.144,.069),s*-.06)
    oval('Soleus',(s*.219,.519,-.069),(.074,.149,.077))
    ridge('Tibial crest',[(s*.224,.893,.117),(s*.215,.661,.112),(s*.210,.405,.075),(s*.210,.235,.056)],.006)
    ridge('Achilles tendon',[(s*.213,.491,-.104),(s*.211,.337,-.074),(s*.210,.167,-.061),(s*.209,.107,-.044)],.013)
    oval('Medial malleolus',(s*.166,.196,.007),(.018,.031,.028))
    oval('Lateral malleolus',(s*.258,.217,-.005),(.019,.032,.029))
    oval('Heel',(s*.211,.105,-.006),(.071,.102,.091))
    foot=oval('Foot',(s*.212,.073,.140),(.083,.070,.203))
    for v in foot.data.vertices:
        world=foot.matrix_world@v.co
        xx,zz,yy=world.x,-world.y,world.z
        medial=max(0,min(1,(-s*(xx-s*.212)+.01)/.08))
        sole=max(0,min(1,(.075-yy)/.06))
        world.z+=.022*medial*sole*math.exp(-((zz-.105)/.080)**2)
        v.co=foot.matrix_world.inverted()@world
    oval('Dorsal instep',(s*.210,.100,.063),(.063,.054,.097))
    for j in range(5):
        xx = s*(.153+j*.031)
        oval('Toe',(xx,.065,.304-j*.013),(.022-.002*j,.040-.002*j,.064-.005*j))
        oval('Toe knuckle',(xx,.075,.280-j*.01),(.020-.002*j,.026,.032-.003*j))

bpy.ops.object.select_all(action='DESELECT')
for ob in pieces:
    ob.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'Neutral anatomical surface'
# Voxel union removes every joint seam, preserving a single coherent shell.
remesh = body.modifiers.new('Unified surface', 'REMESH')
remesh.mode = 'VOXEL'
remesh.voxel_size = .0052
remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth = body.modifiers.new('Sculpt smoothing','SMOOTH')
smooth.factor = .53
smooth.iterations = 3
bpy.ops.object.modifier_apply(modifier=smooth.name)
# Broad relaxation blends anatomical masses into one continuous human contour.
# Preserve the face, finger articulations and toes with low smoothing weights.
blend_group=body.vertex_groups.new(name='Anatomical mass blending')
weights={1.0:[],.28:[],.10:[]}
for v in body.data.vertices:
    x,y=abs(v.co.x),v.co.z
    w=.10 if y>3.12 or y<.20 or (x>.83 and y<1.82) else .28 if y>2.98 else 1.0
    weights[w].append(v.index)
for w,indices in weights.items():
    if indices:blend_group.add(indices,w,'REPLACE')
blend=body.modifiers.new('Blend integrated muscle landmarks','SMOOTH')
blend.factor=.64;blend.iterations=28;blend.vertex_group=blend_group.name
bpy.ops.object.modifier_apply(modifier=blend.name)
decimate = body.modifiers.new('Efficient surface','DECIMATE')
decimate.ratio = .39
bpy.ops.object.modifier_apply(modifier=decimate.name)
for p in body.data.polygons:
    p.use_smooth=True

mat = bpy.data.materials.new('Translucent jade surface')
mat.diffuse_color = (.50,.72,.66,.12)
body.data.materials.append(mat)

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source_dir = os.path.join(root,'artifacts','model-source')
os.makedirs(source_dir,exist_ok=True)
path = os.path.join(source_dir,'neutral-anatomy.glb')
bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,
    export_materials='NONE',export_animations=False,export_yup=True)
print('Generated:',path,'vertices:',len(body.data.vertices),'faces:',len(body.data.polygons))

if '--preview' in sys.argv:
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(.49,.53,.49,1)
    bsdf.inputs['Roughness'].default_value=.58
    bsdf.inputs['Subsurface Weight'].default_value=.045
    scene=bpy.context.scene;scene.render.engine='CYCLES'
    scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.world.color=(.045,.055,.052)
    scene.render.resolution_x=850;scene.render.resolution_y=1150
    scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    for name,location,energy,size in [('Soft key',(-3,-4,5),650,4),('Fill',(3,-2,3),190,3),('Rim',(1.5,2,4),400,3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
        ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=location
        ob.rotation_euler=(Vector((0,0,1.9))-ob.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('Anatomy preview');camera_data.type='ORTHO'
    camera=bpy.data.objects.new('Anatomy preview',camera_data);bpy.context.collection.objects.link(camera);scene.camera=camera
    for name,position,target,scale in [('body-preview-front',(0,-7,1.86),(0,0,1.83),3.95),('body-preview-three-quarter',(4,-6.5,2.6),(0,0,1.83),3.95),('body-preview-face',(.32,-3.2,3.38),(0,0,3.38),.65)]:
        camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.ortho_scale=scale
        scene.render.filepath=os.path.join(source_dir,name+'.png')
        bpy.ops.render.render(write_still=True)
        print('Rendered:',scene.render.filepath)
