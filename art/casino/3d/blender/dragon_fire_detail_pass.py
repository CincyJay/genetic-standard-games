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
# Front is negative Y in Blender; side relief sits on the OUTER X surface.
# Dragon is stylized, original continuous spine, horns, crest and curling tail,
# physically raised above the ruby panel, not a downloaded 2D decal.
for side in (-1,1):
 x=side*.575
 spine=[]
 for i in range(70):
  t=i/69
  y=-.12+.13*sin(t*2.4*pi)
  z=.42+1.38*t
  spine.append((x+side*.028,y,z))
 pipe("dragon embossed winding spine "+str(side),spine,.020,gold)
 # Scale rows taper toward neck and follow body
 for i in range(8,64,3):
  t=i/69;px,py,pz=spine[i]
  spread=.08*(1-t*.55)
  pipe("dragon overlapping engraved scale "+str(side)+"/"+str(i),[
   (px,py-spread,pz-.035),(px+side*.008,py,pz+.02),(px,py+spread,pz-.035)
  ],.008,gold)
 # Stylized head, snout, two horns and eye at upper front
 hx,hy,hz=spine[-1]
 pipe("dragon head crest "+str(side),[(hx,hy,hz),(hx+side*.02,hy-.07,hz+.09),
   (hx+side*.02,hy-.14,hz+.07),(hx,hy-.20,hz+.025)],.024,gold)
 for j in (-1,1):
  pipe("dragon horn "+str(side)+"/"+str(j),[(hx,hy+j*.025,hz+.045),
    (hx+side*.015,hy+j*.07,hz+.15),(hx,hy+j*.10,hz+.21)],.013,gold)
 # Large swept tail below
 px,py,pz=spine[0]
 pipe("dragon curled tail "+str(side),[(px,py,pz),(px,py-.09,pz-.06),
   (px,py-.15,pz-.015),(px,py-.11,pz+.09)],.018,gold)
 # Individually sculpted wing vanes, intentionally not a silhouette-only decal
 for k in range(5):
  t=.45+k*.07;px,py,pz=spine[int(t*69)]
  pipe("dragon raised wing rib "+str(side)+"/"+str(k),[(px,py,pz),
   (px+side*.015,py+.10+k*.013,pz+.13),(px,py+.17+k*.01,pz+.075)],.012,gold)
# Replace plain topper visually with five rising prongs and a centre jewel.
# Retain base as mount. Sculpted tapered triangular blades with bevelled edges.
for i in range(5):
 x=(i-2)*.17;peak=.15+.13*(1-abs(i-2)/2)
 v=[(x-.075,-.414,2.245),(x+.075,-.414,2.245),
    (x+.035,-.40,2.245+peak),(x-.035,-.40,2.245+peak),
    (x-.075,-.34,2.245),(x+.075,-.34,2.245),
    (x+.035,-.34,2.245+peak),(x-.035,-.34,2.245+peak)]
 faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
 o=mesh("sculpted crown fin "+str(i),v,faces,gold)
 mod=o.modifiers.new("softened cast gold edge","BEVEL");mod.width=.008;mod.segments=3
 o.modifiers.new("weighted normals","WEIGHTED_NORMAL")
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(0,-.425,2.33),scale=(.067,.026,.086))
bpy.context.object.name="crown ruby cabochon";bpy.context.object.data.materials.append(ruby)
# Diamond upholstery seam lattice on visible FRONT of chair back, rather than chevrons.
# Keep seams subtly raised; tuft buttons at intersections.
for i in range(-3,4):
 for sign in (-1,1):
  pts=[]
  for j in range(18):
   z=.77+j*.022
   x=i*.13+sign*(z-.77)*.54
   if abs(x)<.285 and z<1.14:pts.append((x,-1.581,z))
  if len(pts)>1:pipe("continuous diamond stitched seam",pts,.0025,gold)
for row in range(4):
 for col in range(4):
  x=(col-1.5)*.135+(row%2)*.0675;z=.79+row*.102
  if abs(x)>.27:continue
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=(x,-1.589,z),scale=(.010,.006,.010))
  bpy.context.object.name="recessed leather tuft button";bpy.context.object.data.materials.append(leather)
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
