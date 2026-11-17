"""Dragon Fire detail pass: original crown sculpture and dimensional side ornaments.
Run after generating dragon_fire_hero.blend:
 blender -b dragon_fire_hero.blend --python dragon_fire_detail_pass.py
Writes dragon_fire_detailed.blend and dragon_fire_detailed.glb beside source.
No engineering imports or production assets. Blender 4.x.
"""
import bpy, math, os
from math import sin,cos,pi
from mathutils import Vector
out=os.environ.get("VELVET_ACE_ART_OUT",os.path.dirname(bpy.data.filepath) or os.getcwd())
os.makedirs(out,exist_ok=True)
def mat(name,color,metal,rough,em=None):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get("Principled BSDF")
 p.inputs["Base Color"].default_value=(*color,1);p.inputs["Metallic"].default_value=metal;p.inputs["Roughness"].default_value=rough
 if em:p.inputs["Emission Color"].default_value=(*em,1);p.inputs["Emission Strength"].default_value=.65
 return m
gold=mat("DF_DETAIL hammered gold relief",(.76,.42,.12),.8,.26)
ruby=mat("DF_DETAIL glowing ruby enamel",(.42,.012,.024),.25,.3,(.24,.008,.014))
dark=mat("DF_DETAIL dark inset",(.025,.008,.024),.25,.35)
leather=mat("DF_DETAIL tufted leather buttons",(.16,.015,.033),.08,.55)
def mesh(name,verts,faces,material):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for p in data.polygons:p.use_smooth=True
 return o
def pipe(name,pts,r,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3
 s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for v,p in zip(s.points,pts):v.co=(*p,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);return o
# Remove old chevrons before adding a coherent tuft lattice. Do not modify
# production models: this script runs only on a standalone .blend.
for o in list(bpy.data.objects):
 if o.name.startswith("diamond upholstery seam"):
  bpy.data.objects.remove(o,do_unlink=True)

# Dragon ornaments sit *in* the outer lacquer surface (outer x ~= .560m).
# Original sculpted low-relief silhouette: tapered body, actual head, jaws,
# triangular wing membrane, talons and eye. This is still stylized game art.
for side in (-1,1):
 x=side*.565
 spine=[]
 for i in range(65):
  t=i/64
  spine.append((x,-.14+.095*sin(t*2*pi),.41+1.43*t))
 # Tapered tube in three sections, avoiding the floating wire look.
 for a,b,r in ((0,25,.029),(24,48,.042),(47,64,.028)):
  pipe("dragon tapered torso %s %s"%(side,a),spine[a:b+1],r,gold)
 # Embossed head mass with upper and lower jaw as solid triangular prisms
 hx,hy,hz=spine[-1]
 head=[(x,hy-.09,hz-.055),(x,hy+.065,hz-.05),(x,hy+.045,hz+.09),(x,hy-.13,hz+.075)]
 mesh("dragon head silhouette "+str(side),head,
      [(0,1,2),(0,2,3)],gold)
 pipe("dragon upper jaw "+str(side),[(x,hy-.08,hz+.025),(x,hy-.20,hz+.015),(x,hy-.23,hz-.015)],.018,gold)
 pipe("dragon lower jaw "+str(side),[(x,hy-.08,hz-.05),(x,hy-.19,hz-.073)],.012,gold)
 for j in (-1,1):
  pipe("dragon swept horn "+str(side)+"/"+str(j),
       [(x,hy+j*.032,hz+.065),(x,hy+j*.08,hz+.15),(x,hy+j*.095,hz+.21)],.012,gold)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,
      location=(x+side*.006,hy-.045,hz+.035),scale=(.012,.011,.012))
 bpy.context.object.name="dragon inset ruby eye "+str(side)
 bpy.context.object.data.materials.append(ruby)
 # Wing is a filled, three-dimensional folded membrane, not five floating ribs.
 root=spine[35]
 wing=[(x,root[1],root[2]),(x,root[1]+.20,root[2]+.28),
       (x,root[1]+.28,root[2]+.10),(x,root[1]+.21,root[2]-.16)]
 mesh("dragon folded wing membrane "+str(side),wing,[(0,1,2),(0,2,3)],ruby)
 for tip in wing[1:]:
  pipe("dragon wing gilded vein "+str(side),[root,tip],.010,gold)
 for t in (.26,.42,.59):
  px,py,pz=spine[int(t*64)]
  pipe("dragon talon "+str(side),[(px,py,pz),(x,py-.09,pz-.09),
       (x,py-.15,pz-.11)],.010,gold)
 px,py,pz=spine[0]
 pipe("dragon curled tail "+str(side),[(px,py,pz),(x,py-.12,pz-.08),
      (x,py-.17,pz+.015),(x,py-.12,pz+.09)],.018,gold)
# Five individually tapered crown tips with raised centre and angular facets.
for i in range(5):
 x=(i-2)*.17
 height=.16+.17*(1-abs(i-2)/2)
 v=[(x-.071,-.42,2.255),(x+.071,-.42,2.255),
    (x,-.405,2.255+height),
    (x-.071,-.34,2.255),(x+.071,-.34,2.255),
    (x,-.34,2.255+height)]
 faces=[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)]
 o=mesh("pointed faceted crown tip "+str(i),v,faces,gold)
 mod=o.modifiers.new("soft cast edge","BEVEL");mod.width=.006;mod.segments=2
 o.modifiers.new("weighted normals","WEIGHTED_NORMAL")
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,
    location=(0,-.425,2.35),scale=(.065,.027,.086))
bpy.context.object.name="crown ruby cabochon"
bpy.context.object.data.materials.append(ruby)

# Symmetric, consistent diamond seams on both visible chair-back faces.
for y in (-1.581,-1.393):
 for i in range(-4,5):
  for sign in (-1,1):
   pts=[]
   for j in range(22):
    z=.76+j*.019
    x=i*.105+sign*(z-.76)*.55
    if abs(x)<.28 and z<1.155:pts.append((x,y,z))
   if len(pts)>1:pipe("continuous diamond stitched seam",pts,.002,gold)
 for row in range(4):
  z=.80+row*.09
  for x in (-.2025,-.0675,.0675,.2025):
   bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,
       location=(x,y-.004 if y< -1.5 else y+.004,z),
       scale=(.009,.006,.009))
   bpy.context.object.name="symmetric leather tuft button"
   bpy.context.object.data.materials.append(leather)
# Convert curves to exportable geometry; don't accidentally export floor/cameras.
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE' and (o.name.startswith("dragon ") or o.name.startswith("continuous diamond")):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.convert(target='MESH')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'dragon_fire_detailed.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type=='MESH' and not o.name.startswith('STUDIO_'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'dragon_fire_detailed.glb'),export_format='GLB',use_selection=True,export_apply=True)
print("Dragon Fire detail pass exported to",out)
