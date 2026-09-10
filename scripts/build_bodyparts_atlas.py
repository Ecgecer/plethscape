"""Build original-source BodyParts3D 4.0 layers and registered HRA lung lobes.

Run with Blender: blender -b --python scripts/build_bodyparts_atlas.py
Source cache is populated by fetch_bodyparts3d.py. No procedural anatomy is added.
BodyParts3D source meshes retain a common coordinate frame; simplification changes
polygon density only. See the exported metadata and docs/ANATOMY-SOURCES.md.
"""
import bpy,json,zipfile,re,hashlib,heapq,math,shutil,struct,os
import numpy as np
from pathlib import Path
from collections import defaultdict
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'scripts/bodyparts3d-source'
OUT=ROOT/'public/models'
ARCHIVE=CACHE/'bodyparts4-complete.zip'
SCALE=3.65/1.7194712
reference=json.loads((CACHE/'atlas.json').read_text())
parts={p['id']:p for p in reference['parts']}
vascular=json.loads((ROOT/'scripts/bodyparts3d-vascular-classification.json').read_text())
vascular_groups={pid:key for key,ids in vascular['groups'].items() for pid in ids}
memberships=defaultdict(set)
for line in (CACHE/'isa_element_parts.txt').read_text().splitlines()[1:]:
    concept,name,pid=line.split('\t')
    memberships[concept].add(pid)
muscle_ids=memberships['FMA5022']
bone_ids=memberships['FMA5018']
cartilage_ids=memberships['FMA55107']|memberships['FMA7538']
connective_ids=memberships['FMA9721']|memberships['FMA21496']|{'FJ1423','FJ1423M'}
gingiva_ids=memberships['FMA59762']
source_url='https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

pulmonary_arteries={'FJ2041','FJ2044'}|{f'FJ{i}' for i in range(2881,2925)}|{f'FJ{i}' for i in range(2966,3020)}
pulmonary_veins={f'FJ{i}' for i in range(2925,2966)}|{f'FJ{i}' for i in range(3020,3071)}
brain_cavities={'FJ1730','FJ1731','FJ1752','FJ1767','FJ1814'}
papillary={'FJ2418','FJ2419','FJ2429','FJ2430','FJ2437'}
group_info={
 'body':{'layer':'body','tissue':'skin','target':105000},
 'face_details':{'layer':'body','tissue':'skin','target':18000},
 'eyes':{'layer':'body','tissue':'eye','target':42000},
 'muscles':{'layer':'muscles','tissue':'muscle','target':360000},
 'muscles_anterior':{'layer':'muscles','tissue':'muscle','cutaway':'chest-wall','target':120000},
 'skeleton':{'layer':'skeleton','tissue':'bone','target':265000},
 'ribs':{'layer':'skeleton','tissue':'bone','cutaway':'anterior-ribs','target':70000},
 'cartilage':{'layer':'skeleton','tissue':'cartilage','target':45000},
 'connective':{'layer':'skeleton','tissue':'fibrous-connective','target':22000},
 'teeth':{'layer':'skeleton','tissue':'tooth','target':14000},
 'gingiva':{'layer':'body','tissue':'gingiva','target':6000},
 'brain':{'layer':'nerves','tissue':'brain','target':180000},
 'nerves':{'layer':'nerves','tissue':'nerve','target':65000},
 'systemic_arteries':{'layer':'arteries','tissue':'systemic-artery','circuit':'systemic','oxygenation':'high','target':240000},
 'pulmonary_arteries':{'layer':'arteries','tissue':'pulmonary-artery','circuit':'pulmonary','oxygenation':'low','target':90000},
 'coronary_arteries':{'layer':'arteries','tissue':'systemic-artery','circuit':'systemic','oxygenation':'high','motionRegion':'heart','target':65000},
 'systemic_veins':{'layer':'veins','tissue':'systemic-vein','circuit':'systemic','oxygenation':'low','target':200000},
 'pulmonary_veins':{'layer':'veins','tissue':'pulmonary-vein','circuit':'pulmonary','oxygenation':'high','target':85000},
 'coronary_veins':{'layer':'veins','tissue':'systemic-vein','circuit':'systemic','oxygenation':'low','motionRegion':'heart','target':45000},
 'portal_veins':{'layer':'veins','tissue':'portal-vein','circuit':'portal','oxygenation':'low','target':35000},
 'heart':{'layer':'heart','tissue':'myocardium','target':110000},
 'heart_valves':{'layer':'heart','tissue':'valve','target':30000},
 'airways':{'layer':'lungs','tissue':'airway','target':100000},
 'diaphragm':{'layer':'lungs','tissue':'muscle','target':25000},
}

def classify(p):
    pid=p['id'];name=p['name'].lower();system=p['system']
    if 'hepatovenous segment' in name:return None
    if system=='reproductive' or pid in {'FJ2813','FJ2815'}:return None
    # Genital vessels can be classified as cardiovascular rather than reproductive.
    if any(term in name for term in ('penis','penile','testicular','scrotal','pudendal','prostatic','seminal','deferential')):return None
    if pid=='FJ2810':return 'body'
    # The pinnae are a separate sensory mesh, not part of the main skin shell.
    if pid in {'FJ2811','FJ2812','FJ2814'}:return 'face_details'
    if pid in vascular_groups:
        return {'systemic_artery':'systemic_arteries','pulmonary_artery':'pulmonary_arteries','coronary_artery':'coronary_arteries','systemic_vein':'systemic_veins','pulmonary_vein':'pulmonary_veins','coronary_vein':'coronary_veins','portal_vein':'portal_veins'}[vascular_groups[pid]]
    if pid in pulmonary_arteries:return 'pulmonary_arteries'
    if pid in pulmonary_veins:return 'pulmonary_veins'
    if pid in brain_cavities:return 'brain'
    if pid in papillary:return 'heart'
    if pid=='FJ3131':return 'diaphragm'
    # Authoritative IS-A leaf memberships override the reference viewer's
    # name-based classification (e.g. "tibialis" had been mistaken for tibia).
    if pid in muscle_ids:
        return 'muscles_anterior' if any(s in name for s in ['pectoralis','intercostal','rectus abdominis','external oblique']) else 'muscles'
    if pid in gingiva_ids:return 'gingiva'
    if 'tooth' in name:return 'teeth'
    if pid in cartilage_ids:return 'cartilage'
    if pid in connective_ids:return 'connective'
    if pid in bone_ids:return 'ribs' if ' rib' in name else 'skeleton'
    if system=='cardiac':
        if 'cavity' in name:return None
        return 'heart_valves' if any(s in name for s in ['cusp','leaflet','valve']) else 'heart'
    if system=='arterial':
        return 'coronary_arteries' if 2631<=int(pid[2:].rstrip('M'))<=2737 else 'systemic_arteries'
    if system=='venous':
        return 'coronary_veins' if any(s in name for s in ['cardiac vein','coronary sinus','vein of left ventricle','marginal vein','interventricular vein']) else 'systemic_veins'
    if system=='nervous':return 'nerves' if any(s in name for s in ['nerve','ganglion','spinal cord']) else 'brain'
    if system=='muscular':
        return 'muscles_anterior' if any(s in name for s in ['pectoralis','intercostal','rectus abdominis','external oblique']) else 'muscles'
    if system=='skeletal':return 'ribs' if any(s in name for s in [' rib','rib ','sternum','xiphoid','manubrium']) else 'skeleton'
    if system=='connective':return 'connective'
    if system=='sensory' and any(s in name for s in ['eyeball','cornea','iris','lens','sclera','retina','vitreous']):return 'eyes'
    if system=='respiratory' and any(s in name for s in ['bronch','trachea','laryn','cricoid','thyroid cartilage','arytenoid']):return 'airways'
    return None

groups=defaultdict(list);original={};excluded=[]
face_ref=re.compile(r'/[^ \n]+')
with zipfile.ZipFile(ARCHIVE) as archive:
    for i,path in enumerate(archive.namelist()):
        pid=Path(path).stem
        if pid not in parts:continue
        p=parts[pid];group=classify(p)
        if group is None:excluded.append({'id':pid,'name':p['name'],'system':p['system']});continue
        data=archive.read(path).decode('utf-8')
        v=[];f=[]
        for line in data.splitlines():
            if line.startswith('v '):v.append(line[2:])
            elif line.startswith('f '):f.append(line[2:])
        xyz=np.fromstring(' '.join(v),sep=' ',dtype=np.float32).reshape(-1,3)
        faces=np.fromstring(face_ref.sub('',' '.join(f)),sep=' ',dtype=np.int32).reshape(-1,3)-1
        scene=np.empty_like(xyz)
        scene[:,0]=xyz[:,0]*.001*SCALE
        scene[:,1]=(xyz[:,2]*.001+.0781112)*SCALE
        scene[:,2]=(-xyz[:,1]*.001-.1)*SCALE
        original[pid]=(scene,faces)
        if group=='body':
            # Flatten only the external genital prominence for the requested
            # non-sexual presentation. Reproductive structures are omitted.
            x=np.abs(scene[:,0]/SCALE);y=scene[:,1]/SCALE;z=scene[:,2]/SCALE
            w=np.clip((.085-x)/.045,0,1)*np.clip((y-.745)/.035,0,1)*np.clip((.945-y)/.035,0,1)
            scene[:,2]-=np.maximum(0,z-.060)*w*SCALE
        groups[group].append((pid,scene,faces))
        if i%250==0:print('Read source mesh',i,pid,flush=True)

def scene_to_blender(points):
    return np.stack([points[:,0],-points[:,2],points[:,1]],axis=1)

manifest={
 'source':{'name':'BodyParts3D 4.0','url':source_url,'sha256':hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),'license':'CC BY 4.0','referenceAnatomy':'adult male'},
 'mappingReference':'https://github.com/ashemag/human-atlas',
 'classification':{'musculoskeletal':'Official BodyParts3D IS-A leaf memberships: FMA5022 muscle organ, FMA55107 cartilage organ, FMA7538 cartilage component, FMA9721 tendon, FMA21496 ligament organ, FMA59762 gingiva; named iliotibial tracts assigned fibrous connective tissue','vascular':'Audited source ID memberships in scripts/bodyparts3d-vascular-classification.json'},
 'transform':{'sourceUnits':'mm','sourceAxes':'X lateral, Z superior, -Y anterior','scale':SCALE,'formula':['x_mm * 0.001 * scale','(z_mm * 0.001 + 0.0781112) * scale','(-y_mm * 0.001 - 0.1) * scale']},
 'groups':[],'excluded':excluded,'flowPaths':[],'sites':{},
 'adaptations':['Source mesh batching and quadric simplification','Smooth vertex normals','Uniform 3.65-unit height normalization','Reproductive structures, genital vessels and pubic/scalp hair omitted','External genital prominence of skin flattened for non-sexual display'],
 'limitations':['BodyParts3D 4.0 does not include a complete peripheral nervous system','HRA lungs and BodyParts3D originate from different reference anatomies; their registration is approximate','Flow paths are approximate centerlines of source vessels, not calibrated hemodynamics'],
}
objects=[]
for name,items in groups.items():
    allv=[];allf=[];offset=0
    for pid,v,f in items:allv.append(v);allf.append(f+offset);offset+=len(v)
    vertices=np.concatenate(allv);faces=np.concatenate(allf)
    mesh=bpy.data.meshes.new(name)
    mesh.vertices.add(len(vertices));mesh.vertices.foreach_set('co',scene_to_blender(vertices).ravel())
    mesh.loops.add(faces.size);mesh.loops.foreach_set('vertex_index',faces.ravel())
    mesh.polygons.add(len(faces));mesh.polygons.foreach_set('loop_start',np.arange(len(faces),dtype=np.int32)*3);mesh.polygons.foreach_set('loop_total',np.full(len(faces),3,dtype=np.int32))
    mesh.polygons.foreach_set('use_smooth',np.ones(len(faces),dtype=bool));mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    info=group_info[name]
    for k,val in info.items():
        if k!='target':ob[k]=val
    ob['source']='BodyParts3D 4.0';ob['sourceIds']=[p[0] for p in items]
    bpy.context.view_layer.objects.active=ob
    if len(faces)>info['target']:
        modifier=ob.modifiers.new('Anatomical mesh simplification','DECIMATE');modifier.ratio=info['target']/len(faces)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    triangles=sum(len(p.vertices)-2 for p in ob.data.polygons)
    manifest['groups'].append({'name':name,**{k:v for k,v in info.items() if k!='target'},'sourceIds':[p[0] for p in items],'sourceNames':[parts[p[0]]['name'] for p in items],'sourceTriangles':len(faces),'triangles':triangles,'bounds':[vertices.min(0).tolist(),vertices.max(0).tolist()]})
    objects.append(ob)
    print('Built',name,'source',len(faces),'triangles',triangles,flush=True)

# HRA/Visible Human male lung segment meshes provide genuine pleural surfaces.
hra=CACHE/'3d-vh-m-lung-v1.4.glb'
if not hra.exists():raise FileNotFoundError('Run scripts/fetch_bodyparts3d.py to download the HRA lung source')
if hra.exists():
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(hra))
    imported=[o for o in bpy.data.objects if o not in before]
    imported_names=[o.name for o in imported]
    bpy.context.view_layer.update()
    side_names={side:[] for side in ['L','R']}
    for o in imported:
        if o.type!='MESH':continue
        ancestry=[];p=o
        while p:ancestry.append(p.name);p=p.parent
        for side in ['L','R']:
            if any(n.startswith(f'VH_M_lungs_{side}') for n in ancestry):side_names[side].append(o.name)
    for side in ['L','R']:
        side_objects=[bpy.data.objects[name] for name in side_names[side] if name in bpy.data.objects]
        if not side_objects:continue
        for o in side_objects:
            world=o.matrix_world.copy();o.parent=None
            o.data.transform(world);o.matrix_world.identity()
            for v in o.data.vertices:
                # glTF importer is already in Blender Z-up: (x,-z,y).
                v.co.x*=SCALE
                v.co.y=(v.co.y+.010)*SCALE
                v.co.z=(v.co.z+.800)*SCALE
        bpy.ops.object.select_all(action='DESELECT')
        for o in side_objects:o.select_set(True)
        bpy.context.view_layer.objects.active=side_objects[0];bpy.ops.object.join()
        ob=bpy.context.object;ob.name='lung_left' if side=='L' else 'lung_right'
        ob['layer']='lungs';ob['tissue']='lung';ob['side']='left' if side=='L' else 'right';ob['source']='HRA Visible Human Male lung v1.4'
        ob['registration']='uniform scale with native Y+0.800m and Z-0.010m translation, then BodyParts scene normalization'
        for p in ob.data.polygons:p.use_smooth=True
        source_tri=sum(len(p.vertices)-2 for p in ob.data.polygons)
        if source_tri>120000:
            modifier=ob.modifiers.new('Lung surface preservation','DECIMATE');modifier.ratio=120000/source_tri
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        coords=np.array([(v.co.x,v.co.z,-v.co.y) for v in ob.data.vertices])
        manifest['groups'].append({'name':ob.name,'layer':'lungs','tissue':'lung','side':ob['side'],'source':'HRA Visible Human Male lung v1.4','sourceNodes':side_names[side],'sourceTriangles':source_tri,'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons),'bounds':[coords.min(0).tolist(),coords.max(0).tolist()]})
        objects.append(ob)
    for name in imported_names:
        o=bpy.data.objects.get(name)
        if o is not None and o not in objects:bpy.data.objects.remove(o,do_unlink=True)
    manifest['lungSource']={'url':'https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/assets/3d-vh-m-lung.glb','license':'CC BY 4.0','doi':'10.48539/HBM532.KLZD.394','sha256':hashlib.sha256(hra.read_bytes()).hexdigest(),'registration':{'nativeTranslationMeters':[0,.8,-.01],'uniformScale':SCALE}}

# Geodesic bands on actual vessel surfaces produce ordered centerline samples.
flow_upstream={
 'FJ3413':['FJ2426','FJ2431','FJ2435'],'FJ3411':['FJ3413'],
 'FJ1931':['FJ3411'],'FJ1932':['FJ1931'],
 'FJ3483':['FJ3411'],'FJ3564':['FJ3417'],'FJ3479':['FJ3411'],'FJ3579':['FJ3417'],
 'FJ2219':['FJ2216'],'FJ2271':['FJ2268'],'FJ2242':['FJ2219'],'FJ2294':['FJ2271'],
 'FJ2074':['FJ3466'],'FJ2143':['FJ3567'],'FJ2065':['FJ2086'],'FJ2087':['FJ2086'],
 'FJ3464':['FJ1932'],'FJ2966':['FJ2417','FJ2427','FJ2434'],
}
for pid,upstream_ids in flow_upstream.items():
    if pid not in original:continue
    points,faces=original[pid]
    adjacency=[{} for _ in range(len(points))]
    for tri in faces:
        for a,b in ((tri[0],tri[1]),(tri[1],tri[2]),(tri[2],tri[0])):
            w=float(np.linalg.norm(points[a]-points[b]));adjacency[a][int(b)]=w;adjacency[b][int(a)]=w
    upstream=np.concatenate([original[source][0] for source in upstream_ids])
    tree=KDTree(len(upstream))
    for index,point in enumerate(upstream):tree.insert(point,index)
    tree.balance()
    proximity=np.array([tree.find(point)[2] for point in points])
    seeds=np.flatnonzero(proximity<=proximity.min()+.00065*SCALE)
    # Some source inlets are capped, while tiny incidental holes are uncapped.
    # Seed from the verified upstream structure, never arbitrary boundary holes.
    distances=np.full(len(points),np.inf);distances[seeds]=0
    queue=[(0,int(index)) for index in seeds];heapq.heapify(queue)
    while queue:
        d,a=heapq.heappop(queue)
        if d>distances[a]:continue
        for b,w in adjacency[a].items():
            new=d+w
            if new<distances[b]:distances[b]=new;heapq.heappush(queue,(new,b))
    finite=np.isfinite(distances);maxd=np.max(distances[finite]);centers=[];samples=[]
    edges=np.linspace(0,maxd,34)
    for lo,hi in zip(edges[:-1],edges[1:]):
        sample=points[(distances>=lo)&(distances<=hi)]
        if len(sample):
            centers.append(sample.mean(0));samples.append(sample)
    radii=[]
    for index,(center,sample) in enumerate(zip(centers,samples)):
        tangent=centers[min(index+1,len(centers)-1)]-centers[max(index-1,0)]
        tangent/=max(np.linalg.norm(tangent),1e-8)
        delta=sample-center
        perpendicular=delta-np.outer(delta@tangent,tangent)
        radii.append(float(np.median(np.linalg.norm(perpendicular,axis=1))))
    if len(centers)>3:manifest['flowPaths'].append({'id':pid,'name':parts[pid]['name'],'points':[center.tolist() for center in centers],'kind':'pulmonary-arterial' if pid in pulmonary_arteries else 'arterial','radius':float(np.median(radii))*.7,'upstreamIds':upstream_ids,'seedCount':len(seeds),'method':'source surface geodesic band centroids, directed from verified upstream structure toward distal end; radius from perpendicular surface distances'})

skin=original['FJ2810'][0]
def near_skin(anchor,dx=.04,dy=.035):
    anchor=np.array(anchor)*SCALE
    candidate=skin[(np.abs(skin[:,0]-anchor[0])<dx*SCALE)&(np.abs(skin[:,1]-anchor[1])<dy*SCALE)]
    if not len(candidate):candidate=skin
    penalty=np.linalg.norm(candidate-anchor,axis=1)-candidate[:,2]*.16
    best=candidate[np.argmin(penalty)].copy();best[2]+=.012
    return best.tolist()
anchors={
 'finger':([.308,.746,.093],['FJ3183','FJ2810']),
 'wrist':([.276,.874,.031],['FJ2242','FJ2810']),
 'ear':([.073,1.561,-.014],['FJ2811']),
 'forehead':([0,1.655,.081],['FJ2810']),
 'carotid':([.029,1.433,.042],['FJ3483','FJ2810']),
 'upperarm':([.172,1.265,.037],['FJ2219','FJ2810']),
 'toe':([.061,.027,.130],['FJ2810']),
}
for key,(anchor,ids) in anchors.items():
    if key=='ear':
        ear_surface=original['FJ2811'][0]
        target=np.array(anchor)*SCALE
        point=ear_surface[np.argmin(np.linalg.norm(ear_surface-target,axis=1))].tolist()
        manifest['sites'][key]={'position':point,'sourceIds':ids,'method':'left earlobe landmark projected to nearest external-ear source surface'}
    else:
        manifest['sites'][key]={'position':near_skin(anchor,.015 if key in ['finger','forehead'] else .033,.014 if key=='finger' else .027),'sourceIds':ids,'method':'source landmark anchor projected to nearest skin surface'}

bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
OUT.mkdir(exist_ok=True)
output=OUT/'bodyparts-atlas.glb'
staged_output=OUT/'bodyparts-atlas.staging.glb'
bpy.ops.export_scene.gltf(filepath=str(staged_output),export_format='GLB',use_selection=True,export_materials='NONE',export_animations=False,export_yup=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12)
decoder=OUT/'draco';decoder.mkdir(exist_ok=True)
for name in ['draco_decoder.wasm','draco_wasm_wrapper.js','draco_decoder.js']:
    shutil.copyfile(ROOT/'node_modules/three/examples/jsm/libs/draco/gltf'/name,decoder/name)
manifest['asset']={'url':'/models/bodyparts-atlas.glb','bytes':staged_output.stat().st_size,'sha256':hashlib.sha256(staged_output.read_bytes()).hexdigest(),'compression':'KHR_draco_mesh_compression','decoderPath':'/models/draco/','triangles':sum(g['triangles'] for g in manifest['groups']),'drawCalls':len(objects)}
staged_metadata=OUT/'bodyparts-atlas-metadata.staging.json'
staged_metadata.write_text(json.dumps(manifest,indent=2))
os.replace(staged_output,output)
os.replace(staged_metadata,OUT/'bodyparts-atlas-metadata.json')
print('EXPORTED',json.dumps(manifest['asset']),flush=True)
