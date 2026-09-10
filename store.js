export const clone = value => structuredClone(value);
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function initial(seed) {
 return {schemaVersion:1,app:'pedrapretaEdu',savedSourceIDs:[],sourceCanonIDs:[],analysisCanonIDs:[],analyses:[],sessions:[],projects:[],vocabulary:clone(seed.vocabulary),appearance:'Automatic',customSources:[],sourceOverrides:[],hiddenSourceIDs:[],customCategories:[],focusItems:clone(seed.focus),studyTemplates:clone(seed.templates),drafts:{},weeklyReviews:[],profileName:'Arda',installedAt:now(),lastBackupAt:null};
}
let db,revision=0;
export async function openStore() {
 db = await new Promise((resolve,reject)=>{
  const r=indexedDB.open('pedrapretaEdu-'+new URL('.',location.href).pathname,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('archive');
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
 db.onversionchange=()=>db.close();
 return new Promise((resolve,reject)=>{const r=db.transaction('archive').objectStore('archive').get('current');r.onsuccess=()=>{revision=r.result?._revision||0;resolve(r.result)};r.onerror=()=>reject(r.error);});
}
export function writeStore(state, previous) {
 const snapshot=clone(state);
 return new Promise((resolve,reject)=>{
  if(!db)return reject(new Error('Device storage is unavailable. Export your work before closing.'));
  const tx=db.transaction('archive','readwrite'),store=tx.objectStore('archive'),read=store.get('current');
  let failure=null,nextRevision=revision+1;
  read.onsuccess=()=>{
   try{
   if((read.result?._revision||0)!==revision){failure=new Error('Another tab changed this archive. Export your unsaved work, then reload this tab.');tx.abort();return;}
   snapshot._revision=nextRevision;store.put(snapshot,'current');if(previous)store.put(clone(previous),'before-restore');
   }catch(error){failure=error;tx.abort();}
  };
  tx.oncomplete=()=>{revision=nextRevision;resolve()};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(failure||tx.error||new Error('Save cancelled'));
 });
}
export async function previousRestore() {
 return new Promise((resolve,reject)=>{const r=db.transaction('archive').objectStore('archive').get('before-restore');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export function sources(state,seed,hidden=false) {
 return [...seed.sources.map(s=>({...s,...state.sourceOverrides.find(o=>o.sourceID===s.id)})),...state.customSources].filter(s=>hidden||!state.hiddenSourceIDs.includes(s.id)).sort((a,b)=>(a.customCategory||a.category)===(b.customCategory||b.category)?a.name.localeCompare(b.name):a.id-b.id);
}
export function dna(s) {
 const text=[s.subtitle,...s.lookFor,s.why,...s.tags].join(' ').toLowerCase();
 return [['Atmosphere',['atmosphere','weather','mood','quiet','light']],['Material',['material','stone','wood','fabric','glass','surface']],['Narrative',['narrative','story','human','entourage','moment']],['Landscape',['landscape','terrain','aerial','masterplan','context']],['Commercial',['luxury','commercial','branding','development','campaign']]].map(([name,words],i)=>({name,score:Math.min(5,Math.max(1,(Math.abs(s.artworkSeed+i*7)%2)+2+words.filter(w=>text.includes(w)).length))}));
}
export function validateBackup(raw,seed) {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Choose a pedrapretaEdu JSON backup.');
 if(raw.schemaVersion!==undefined&&raw.schemaVersion!==1)throw new Error('This backup version is not supported.');
 const base=initial(seed);
 const core=['savedSourceIDs','sourceCanonIDs','analysisCanonIDs','analyses','sessions','projects','vocabulary'];
 for(const k of core)if(!Array.isArray(raw[k]))throw new Error('Invalid backup: '+k);
 const optional=['customSources','sourceOverrides','hiddenSourceIDs','customCategories','focusItems','studyTemplates','weeklyReviews'];
 for(const k of optional)if(raw[k]!=null&&!Array.isArray(raw[k]))throw new Error('Invalid backup: '+k);
 const result={...base};
 for(const k of Object.keys(base))if(raw[k]!==undefined&&raw[k]!==null)result[k]=clone(raw[k]);
 const str=(o,k)=>{if(typeof o[k]!=='string')throw new Error('Invalid text field: '+k);};
 const arr=(o,k)=>{if(!Array.isArray(o[k]))throw new Error('Invalid list: '+k);};
 const strarr=(o,k)=>{arr(o,k);if(o[k].some(x=>typeof x!=='string'))throw new Error('Invalid text list: '+k);};
 const ints=(o,k)=>{arr(o,k);if(o[k].some(x=>!Number.isInteger(x)))throw new Error('Invalid source IDs: '+k);};
 const ids=(items,label)=>{const seen=new Set();for(const x of items){if(!x||typeof x!=='object'||(label==='customSources'?typeof x.id!=='number':typeof x.id!=='string')||!/^[-a-zA-Z0-9]+$/.test(String(x.id))||seen.has(x.id))throw new Error('Invalid or duplicate '+label+' ID');seen.add(x.id);}};
 for(const k of ['savedSourceIDs','sourceCanonIDs','hiddenSourceIDs'])ints(result,k);
 strarr(result,'analysisCanonIDs');
 if(result.analysisCanonIDs.some(id=>!/^[-a-zA-Z0-9]+$/.test(id)))throw new Error('Invalid canon ID');
 if(result.sourceCanonIDs.length+result.analysisCanonIDs.length>50)throw new Error('Personal Canon exceeds 50 entries.');
 if(!['Automatic','Light','Dark'].includes(result.appearance))throw new Error('Invalid appearance');
 for(const k of ['analyses','sessions','projects','vocabulary','customSources','customCategories','focusItems','studyTemplates','weeklyReviews'])ids(result[k],k);
 const validDate=(o,k)=>{if(typeof o[k]==='number')o[k]=new Date((o[k]+978307200)*1000).toISOString();if(!Number.isFinite(Date.parse(o[k])))throw new Error('Invalid date: '+k);};
 for(const s of [...result.customSources,...result.sourceOverrides]){
  for(const k of ['name','category','subtitle','url','why','takeaway','personalNote'])str(s,k);
  for(const k of ['tags','lookFor'])strarr(s,k);
  if(!/^https?:\/\//i.test(s.url)||!seed.categories.includes(s.category))throw new Error('Invalid source URL or category');
  if(!Number.isInteger(s.rating)||s.rating<1||s.rating>5)throw new Error('Invalid rating');
  if(s.customCategory!=null)str(s,'customCategory');
 }
 for(const s of result.customSources){if(!Number.isInteger(s.id)||s.id<1000||!Number.isInteger(s.artworkSeed))throw new Error('Invalid custom source');s.isCustom=true;}
 const overridden=new Set();
 for(const s of result.sourceOverrides){const original=seed.sources.find(x=>x.id===s.sourceID);if(!original||overridden.has(s.sourceID))throw new Error('Invalid source override');overridden.add(s.sourceID);s.id=s.sourceID;s.isCustom=false;s.artworkSeed=original.artworkSeed;}
 for(const a of result.analyses){
  str(a,'title');str(a,'mode');if(!['Quick Study','Deep Study','Compare','Blind Study','Revisit'].includes(a.mode))throw new Error('Invalid study mode');validDate(a,'createdAt');
  for(const k of ['composition','depth','light','lens','color','material','humanPresence','narrative','steal','principle']){a[k]??='';str(a,k);}
  for(const k of ['tags','impression']){a[k]??=[];strarr(a,k);}
  a.fieldResponses??=[];ids(a.fieldResponses,'response');
  for(const f of a.fieldResponses){str(f,'fieldID');if(!/^[-a-zA-Z0-9]+$/.test(f.fieldID))throw new Error('Invalid field ID');str(f,'title');str(f,'value');}
  for(const k of ['imageData','secondaryImageData'])if(a[k]!=null){str(a,k);if(!a[k].startsWith('data:'))a[k]='data:image/jpeg;base64,'+a[k];if(!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(a[k]))throw new Error('Invalid image');}
 }
 for(const p of result.projects){validDate(p,'createdAt');for(const k of ['name','subtitle','intent','lens','light','humanPresence'])str(p,k);ints(p,'referenceSourceIDs');strarr(p,'principleAnalysisIDs');arr(p,'checklist');ids(p.checklist,'checklist');for(const c of p.checklist){str(c,'title');if(typeof c.isDone!=='boolean')throw new Error('Invalid checklist');}}
 for(const s of result.sessions){validDate(s,'date');str(s,'focus');str(s,'takeaway');strarr(s,'sourceNames');if(!Number.isFinite(s.minutes)||s.minutes<0)throw new Error('Invalid duration');}
 for(const v of result.vocabulary){for(const k of ['title','definition','note'])str(v,k);strarr(v,'related');}
 for(const c of result.customCategories)str(c,'name');
 for(const f of result.focusItems)for(const k of ['title','prompt','principle'])str(f,k);
 for(const t of result.studyTemplates){str(t,'name');if(!['Quick Study','Deep Study','Compare','Blind Study'].includes(t.mode))throw new Error('Invalid template mode');arr(t,'fields');if(!t.fields.length)throw new Error('Empty template');ids(t.fields,'field');for(const f of t.fields){str(f,'title');str(f,'prompt');strarr(f,'options');if(!seed.fieldTypes.includes(f.type)||typeof f.isRequired!=='boolean')throw new Error('Invalid form field');if(['Single Choice','Multiple Choice'].includes(f.type)&&!f.options.length)throw new Error('Choice field needs options');}}
 for(const r of result.weeklyReviews){str(r,'note');validDate(r,'date');}
 if(!result.drafts||typeof result.drafts!=='object'||Array.isArray(result.drafts))throw new Error('Invalid drafts');
 for(const [k,d] of Object.entries(result.drafts)){
  if(!/^[-a-zA-Z0-9]+$/.test(k)||!d||typeof d!=='object'||Array.isArray(d))throw new Error('Invalid draft');
  if(k.startsWith('study-')){
   if(!d.template||!Array.isArray(d.template.fields)||!d.responses||typeof d.responses!=='object'||Array.isArray(d.responses))throw new Error('Invalid study draft');
   str(d,'mode');str(d,'title');str(d.template,'name');ids(d.template.fields,'draft field');
   for(const f of d.template.fields){str(f,'title');str(f,'prompt');strarr(f,'options');if(!seed.fieldTypes.includes(f.type))throw new Error('Invalid draft field type');}
   if(Object.values(d.responses).some(v=>typeof v!=='string'))throw new Error('Invalid draft responses');
  }
  if(k.startsWith('template-')){arr(d,'fields');ids(d.fields,'draft field');for(const f of d.fields){str(f,'title');str(f,'prompt');strarr(f,'options');if(!seed.fieldTypes.includes(f.type))throw new Error('Invalid draft field type');}}
 }
 str(result,'profileName');
 validDate(result,'installedAt');if(result.lastBackupAt)validDate(result,'lastBackupAt');
 // Old V2 backups did not contain these editable systems.
 if(!raw.focusItems)result.focusItems=clone(seed.focus);
 if(!raw.studyTemplates)result.studyTemplates=clone(seed.templates);
 return result;
}
export function markdown(state,seed) {
 const lines=['# pedrapretaEdu Archive','',`Exported: ${now()}`,'','## Sources'];
 for(const s of sources(state,seed,true))lines.push('',`### ${s.name}`,`- Category: ${s.customCategory||s.category}`,`- Link: ${s.url}`,`- Archived: ${state.hiddenSourceIDs.includes(s.id)}`,`- Canon: ${state.sourceCanonIDs.includes(s.id)}`,'','**Why Study / Editorial Note**',s.why,'','**Look For**',...s.lookFor.map(x=>'- '+x),'','**Principle**',s.takeaway,'','**My Note**',s.personalNote);
 lines.push('','## Analyses');
 for(const a of state.analyses)lines.push('',`### ${a.title}`,`${a.createdAt} · ${a.mode}`,`Source: ${a.sourceID??'Unlinked'}`,`Tags: ${a.tags.join(', ')}`,`Canon: ${state.analysisCanonIDs.includes(a.id)}`,'',...a.fieldResponses.map(f=>`**${f.title}**\n\n${f.value}\n`),`**Principle**\n\n${a.principle}`);
 lines.push('','## Projects');
 for(const p of state.projects)lines.push('',`### ${p.name}`,p.subtitle,`Intent: ${p.intent}`,`Lens: ${p.lens}`,`Light: ${p.light}`,`Human presence: ${p.humanPresence}`,'References: '+p.referenceSourceIDs.map(id=>sources(state,seed,true).find(s=>s.id===id)?.name||id).join(', '),...p.principleAnalysisIDs.map(id=>state.analyses.find(a=>a.id===id)?.principle||''),...p.checklist.map(c=>`- [${c.isDone?'x':' '}] ${c.title}`));
 lines.push('','## Sessions');for(const s of state.sessions)lines.push('',`### ${s.date}`,`${s.minutes} minutes · ${s.sourceNames.join(', ')}`,s.focus,s.takeaway,...Object.entries(s.answers||{}).map(([k,v])=>`${k}: ${v}`));
 lines.push('','## Visual Vocabulary');for(const v of state.vocabulary)lines.push('',`### ${v.title}`,v.definition,v.note,`Related: ${v.related.join(', ')}`);
 lines.push('','## Weekly Review');for(const r of state.weeklyReviews)lines.push('',r.date,r.note);
 lines.push('','## Daily Focus');for(const f of state.focusItems)lines.push('',`### ${f.title}`,f.prompt,f.principle);
 return lines.join('\n');
}
