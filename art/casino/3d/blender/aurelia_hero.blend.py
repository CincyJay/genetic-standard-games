"""Velvet Ace / AURELIA hero slot. Blender 4.x standalone modeling source.
Run: blender -b -t 4 --python aurelia_hero.blend.py
Creates a new, independent modeled scene and exports aurelia_hero.glb plus three PNG views.
Not derived from Royal Crescent or premiumSlotStation. No game-state code.
"""
import bpy, math, os
from mathutils import Vector
from math import radians
OUT=os.environ.get("VELVET_ACE_ART_OUT",os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.3,emission=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get("Principled BSDF");p.inputs["Base Color"].default_value=(*color,1)
 p.inputs["Metallic"].default_value=metal;p.inputs["Roughness"].default_value=rough
 if emission:p.inputs["Emission Color"].default_value=(*emission,1);p.inputs["Emission Strength"].default_value=.8
 return m
black=material("obsidian automotive lacquer",(.023,.033,.048),.55,.18)
gold=material("satin champagne anodized brass",(.65,.41,.16),.83,.28)
edge=material("polished warm brass edge",(.92,.65,.28),.87,.16)
dark=material("graphite rubber gaskets",(.025,.027,.035),.1,.76)
leather=material("oxblood leather upholstery",(.24,.035,.065),.03,.62)
screen=material("dark glass display substrate",(.015,.028,.045),.22,.12)
cyan=material("diffused blue light",(.025,.25,.45),.1,.35,(.04,.4,.9))
def bevel(o,w=.03,segments=4):
 mod=o.modifiers.new("machined radiused edges","BEVEL");mod.width=w;mod.segments=segments
 o.modifiers.new("weighted corner normals","WEIGHTED_NORMAL")
def cube(name,loc,scale,mat,rad=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name
 o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat)
 if rad:bevel(o,rad)
 return o
def curve(name,pts,thick,mat,cyclic=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=24;c.bevel_depth=thick;c.bevel_resolution=4
 spl=c.splines.new('BEZIER');spl.bezier_points.add(len(pts)-1)
 for b,p in zip(spl.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 spl.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
def extruded_profile(name,profile,xwidth,mat):
 # profile points in (z,y), front toward negative Y in Blender; width X
 vertices=[(x,y,z) for x in (-xwidth/2,xwidth/2) for y,z in profile]
 n=len(profile);faces=[]
 faces.append(tuple(reversed(range(n))));faces.append(tuple(range(n,2*n)))
 for i in range(n):j=(i+1)%n;faces.append((i,j,n+j,n+i))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);bevel(o,.035,5);return o
# Sculpted S-curve side cheeks: independent cabinet silhouette, no square slab.
profile=[(-.26,.10),(-.38,.19),(-.43,.42),(-.39,.72),(-.27,.95),(-.25,1.23),(-.31,1.42),(-.28,1.92),(-.18,2.12),(.12,2.15),(.20,2.04),(.19,1.45),(.15,.92),(.12,.25)]
for x in (-.48,.48):
 o=extruded_profile("sculpted cabinet side cheek",profile,.11,black);o.location.x=x
 curve("continuous machined gold silhouette",[(x*1.0,y,z) for y,z in profile],.011,edge,True)
cube("central integrated cabinet chassis",(0,-.06,1.08),(.83,.53,1.99),black,.075)
cube("bronze toe kick",(0,-.30,.14),(.80,.19,.13),gold,.022)
# Framed display bezels and dark glass: display surfaces intentionally kept replaceable.
for tag,z,h,w in (("upper",1.72,.58,.77),("main",1.01,.79,.81)):
 cube(tag+" champagne bezel",(0,-.354,z),(w+.08,.072,h+.08),gold,.055)
 cube(tag+" floating glass display",(0,-.403,z),(w,.025,h),screen,.038)
 # double edge strip to emphasize depth and lens separation
 for sx in (-1,1):
  cube(tag+" side bezel",(sx*(w/2+.012),-.429,z),(.013,.019,h-.035),edge,.006)
# One-piece sculpted control console, integrated with belly.
belly=[(-.33,.26),(-.47,.39),(-.54,.64),(-.56,.78),(-.38,.89),(-.29,.89),(-.23,.58),(-.25,.29)]
extruded_profile("integrated forward-swept belly",belly,.80,black)
deck=cube("ergonomic angled control deck",(0,-.50,.78),(.79,.29,.105),gold,.04)
deck.rotation_euler.x=radians(-13)
for i,x in enumerate((-.28,-.14,0,.14,.28)):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(x,-.58,.855),scale=(.046,.046,.017))
 o=bpy.context.object;o.name="physical illuminated button %02d"%i;o.data.materials.append(cyan if i%2 else edge)
cube("flush card reader",(0.29,-.45,.51),(.15,.03,.07),dark,.012)
cube("ticket dispenser bezel",(-.21,-.45,.48),(.23,.035,.055),gold,.012)
cube("ticket exit black opening",(-.21,-.475,.48),(.17,.006,.012),dark,.003)
# Upholstered swivel chair, shaped rather than a sphere-on-post.
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.22,depth=.045,location=(0,-1.16,.09))
bpy.context.object.name="chair polished circular foot";bpy.context.object.data.materials.append(gold)
bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.055,depth=.52,location=(0,-1.16,.36))
bpy.context.object.name="chair adjustable pedestal";bpy.context.object.data.materials.append(gold)
seat=cube("thick tailored leather seat",(0,-1.16,.67),(.63,.55,.15),leather,.065)
back=cube("low contoured upholstered chair back",(0,-1.40,.91),(.64,.16,.52),leather,.075)
back.rotation_euler.x=radians(-10)
for x in (-.28,.28):
 arm=cube("integrated upholstered armrest",(x,-1.11,.90),(.115,.43,.09),leather,.045)
 curve("chair structural arm support",[(x,-1.12,.78),(x,-1.12,.86),(x,-1.28,.91)],.018,gold)
# Architectural studio with reflective floor and three-point lighting.
floor=material("warm charcoal studio floor",(.07,.058,.07),.25,.36)
cube("studio floor",(0,0,-.07),(8,8,.1),floor,.01)
world=bpy.context.scene.world;world.color=(.16,.16,.16)
def area(name,loc,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
 direction=Vector((0,-.35,1.1))-o.location;o.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
area("warm key",(-2,-3,4),950,3,(1,.79,.58))
area("cool softbox",(2,-2,3),650,2,(.54,.73,1))
area("brass rim",(1.3,1.5,3.5),1200,2,(1,.67,.33))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
def camera(name,loc,target):
 bpy.ops.object.camera_add(location=loc);o=bpy.context.object;o.name=name
 o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 o.data.type='ORTHO';o.data.ortho_scale=3.5;scene.camera=o
for name,loc in (("front",(0,-5,2.0)),("three_quarter",(3,-4,2.2)),("side",(5,-.4,1.9))):
 camera(name,loc,(0,-.5,1.08));scene.render.filepath=os.path.join(OUT,"aurelia_"+name+".png")
 bpy.ops.render.render(write_still=True)
# Exclude studio objects from game export; materials and geometry remain editable in blend.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"aurelia_hero.blend"))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type=='MESH' and not o.name.startswith("studio "):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,"aurelia_hero.glb"),export_format='GLB',use_selection=True,export_apply=True)
