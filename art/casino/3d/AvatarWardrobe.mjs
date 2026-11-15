/** Velvet Ace original 3D avatar wardrobe loader. NO paid API; caller injects Three.js and GLTFLoader.
 * Geometry pack: VelvetAce_3D_Avatar_Prototype_Pack.zip (ChatGPT artifact).
 * PROTOTYPE quality: NO photorealism, NO skeletal walk/sit rig yet; never replace current avatars by default.
 * Use a dedicated dev-only scene and storage key until art/Android review approves it.
 */
export const DRAFT_KEY = 'velvetace.dev.avatar-customization.v1';
const fallback = {preset:'01_ava',hair:'swept',hairColor:'hair_brown',outfit:'evening',accessories:[]};
const selected=(value,valid,def)=>valid.includes(value)?value:def;
export class AvatarWardrobe {
  constructor({THREE, GLTFLoader, rootUrl, storage=globalThis.localStorage}) {
    if(!THREE?.Group || !GLTFLoader || !rootUrl) throw Error('THREE / GLTFLoader / rootUrl required');
    this.THREE=THREE;this.loader=new GLTFLoader();this.url=rootUrl.replace(/\/$/,'');
    this.storage=storage;this.root=new THREE.Group();this.root.name='VelvetAce_CustomAvatar';
    this.config={...fallback,accessories:[]};this.cache=new Map();this.manifest=null;
  }
  async init() {
    const response=await fetch(this.url+'/manifest.json',{cache:'no-store'});
    if(!response.ok) throw Error('Avatar manifest HTTP '+response.status);
    this.manifest=await response.json();
    await this.configure(this.loadDraft(),false);
    return this;
  }
  normalize(next) {
    const m=this.manifest,n=next||{},ids=Object.keys(m.presets);
    return {
      preset:selected(n.preset,ids,ids[0]),
      hair:selected(n.hair,m.hair_styles,fallback.hair),
      hairColor:selected(n.hairColor,Object.keys(m.hair_colors),fallback.hairColor),
      outfit:selected(n.outfit,m.outfits,fallback.outfit),
      accessories:[...new Set((Array.isArray(n.accessories)?n.accessories:[])
         .filter(x=>m.accessories.includes(x)))],
    };
  }
  async getPart(path) {
    if(!this.cache.has(path))this.cache.set(path,this.loader.loadAsync(this.url+'/'+path));
    const loaded=await this.cache.get(path);
    return loaded.scene.clone(true);
  }
  async configure(next={},persist=true) {
    if(!this.manifest)throw Error('Call init first');
    const config=this.normalize({...this.config,...next});
    const gender=this.manifest.presets[config.preset].frame;
    const paths=[
      this.manifest.presets[config.preset].base,
      'glb/hair_'+gender+'_'+config.hair+'.glb',
      'glb/outfit_'+gender+'_'+config.outfit+'.glb',
      ...config.accessories.map(x=>'glb/accessory_'+x+'.glb'),
    ];
    const parts=await Promise.all(paths.map(p=>this.getPart(p)));
    // Recolor only independent hair material clones; do not modify cached source GLBs.
    const hairColor=new this.THREE.Color(this.manifest.hair_colors[config.hairColor]);
    parts[1].traverse(node=>{
      if(!node.isMesh)return;
      const original=Array.isArray(node.material)?node.material:[node.material];
      const changed=original.map(mat=>{
        if(!mat || !/hair/i.test(mat.name||''))return mat;
        const clone=mat.clone();clone.color.copy(hairColor);clone.name='velvetwardrobe_custom_hair';
        return clone;
      });
      node.material=Array.isArray(node.material)?changed:changed[0];
    });
    const nextRoot=new this.THREE.Group();
    nextRoot.name='AvatarParts';
    nextRoot.add(...parts);
    // Release recolored hair copies from the old assembly, but not shared model geometry.
    this.root.traverse(node=>{
      if(!node.isMesh)return;
      (Array.isArray(node.material)?node.material:[node.material]).forEach(mat=>{
        if(mat?.name==='velvetwardrobe_custom_hair')mat.dispose();
      });
    });
    this.root.clear();this.root.add(nextRoot);this.config=config;
    if(persist)this.saveDraft();
    return config;
  }
  loadDraft(){try{return JSON.parse(this.storage?.getItem(DRAFT_KEY)||'null')||fallback;}catch{return fallback;}}
  saveDraft(){try{this.storage?.setItem(DRAFT_KEY,JSON.stringify(this.config));return true;}catch{return false;}}
  serialize(){return JSON.parse(JSON.stringify(this.config));}
  setPreset(preset){return this.configure({preset});}
  setHair(hair){return this.configure({hair});}
  setHairColor(hairColor){return this.configure({hairColor});}
  setOutfit(outfit){return this.configure({outfit});}
  toggleAccessory(name){
    const s=new Set(this.config.accessories);
    if(s.has(name))s.delete(name);else s.add(name);
    return this.configure({accessories:[...s]});
  }
  dispose(){
    this.root.traverse(node=>{if(node.isMesh){
      (Array.isArray(node.material)?node.material:[node.material])
        .forEach(mat=>{if(mat?.name==='velvetwardrobe_custom_hair')mat.dispose();});
    }});
    this.root.clear();
    for(const promise of this.cache.values()){
      promise.then(g=>g.scene.traverse(node=>{
        if(node.isMesh){
          node.geometry?.dispose();
          (Array.isArray(node.material)?node.material:[node.material]).forEach(m=>m?.dispose());
        }
      })).catch(()=>{});
    }
    this.cache.clear();
  }
}