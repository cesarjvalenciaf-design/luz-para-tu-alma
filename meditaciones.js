// Módulo aislado: no modifica Escuela Bíblica, Música ni Administración.
// Los textos publicados en Supabase, categoría Meditación, se reutilizan aquí.
const MEDITACIONES_AUDIOS = [
 {numero:9,titulo:'El hombre que construyó un puente',ref:'Gálatas 6:9',archivo:'audios/meditacion-09.mp3'},
 {numero:10,titulo:'El cántaro agrietado',ref:'Zacarías 4:10',archivo:'audios/meditacion-10.mp3'}
];
let medActual=null;
const MED_PREFIJO='meditacion--';
let medAudiosRemotos=[];
function medArchivoNombre(t){return MED_PREFIJO+medNormalizar(t).replace(/\s+/g,'-')+'.mp3'}
async function cargarAudiosMeditaciones(){
 if(typeof configured==='undefined'||!configured)return;
 try{
  const respuesta=await fetch(cfg.url+'/storage/v1/object/list/musica',{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({prefix:MED_PREFIJO,limit:1000,offset:0})});
  if(!respuesta.ok)throw Error('HTTP '+respuesta.status);
  const datos=await respuesta.json();
  medAudiosRemotos=datos.filter(x=>x.name?.startsWith(MED_PREFIJO)&&x.name.endsWith('.mp3')).map(x=>({titulo:x.name.slice(MED_PREFIJO.length,-4).replace(/-/g,' '),archivo:cfg.url+'/storage/v1/object/public/musica/'+encodeURIComponent(x.name),nombre:x.name}));
  if(!document.getElementById('meditaciones')?.classList.contains('hide'))renderMeditaciones();
 }catch(e){console.warn('No se pudo cargar audio de meditaciones:',e)}
}
async function publicarMeditacionNueva(){
 if(!admin||!session?.access_token)return alert('Inicia sesión como administrador.');
 const titulo=document.getElementById('medTitulo').value.trim(),ref=document.getElementById('medReferencia').value.trim(),contenido=document.getElementById('medTexto').value.trim(),archivo=document.getElementById('medArchivo').files[0],estado=document.getElementById('medEstado'),boton=document.getElementById('medPublicar');
 if(!titulo||!ref||!archivo)return alert('Completa título, referencia y selecciona el MP3.');
 if(!/\.mp3$/i.test(archivo.name)||archivo.size>50*1024*1024)return alert('Selecciona un MP3 válido de máximo 50 MB.');
 const categoria=categories.find(x=>categoriaFiltro(x.name)==='meditaciones');
 if(contenido&&!categoria)return alert('No se encontró la categoría Meditaciones en Supabase.');
 if(contenido&&items.some(x=>categoriaFiltro(x.category)==='meditaciones'&&medNormalizar(x.title)===medNormalizar(titulo)))return alert('Ya existe una publicación con ese título. Edítala en el administrador para evitar duplicados.');
 const nombre=medArchivoNombre(titulo);
 if(medAudiosRemotos.some(x=>x.nombre===nombre))return alert('Ya existe un audio con ese título. Utiliza otro título para no sobrescribirlo.');
 boton.disabled=true;estado.textContent='Subiendo audio...';let subido=false;
 try{
  const res=await fetch(cfg.url+'/storage/v1/object/musica/'+encodeURIComponent(nombre),{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'audio/mpeg','x-upsert':'false'},body:archivo});
  if(!res.ok)throw Error('Supabase rechazó el audio: '+res.status+' '+(await res.text()).slice(0,200));
  subido=true;
  if(contenido){estado.textContent='Guardando texto...';const registro={title:titulo,bible_reference:ref,content:contenido,summary:'Meditación narrada',category_id:Number(categoria.id),status:'published',slug:slugify(titulo)+'-'+Date.now().toString(36)};await api('/rest/v1/posts',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(registro)});await loadPublic();}
  document.getElementById('medTitulo').value='';document.getElementById('medReferencia').value='';document.getElementById('medTexto').value='';document.getElementById('medArchivo').value='';
  await cargarAudiosMeditaciones();estado.textContent='Meditación publicada correctamente.';
 }catch(e){estado.textContent=(subido?'El audio se subió, pero hubo un problema al guardar el texto. ':'No se pudo publicar. ')+e.message;}
 finally{boton.disabled=false}
}

function medNormalizar(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function medBuscarPublicacion(titulo){return (typeof items!=='undefined'?items:[]).find(x=>categoriaFiltro(x.category)==='meditaciones'&&medNormalizar(x.title)===medNormalizar(titulo));}
function abrirMeditaciones(){show('meditaciones');renderMeditaciones();cargarAudiosMeditaciones();}
function renderMeditaciones(){
 const cont=document.getElementById('meditacionesLista');if(!cont)return;
 cont.replaceChildren();
 const audios=[...MEDITACIONES_AUDIOS,...medAudiosRemotos.filter(x=>!MEDITACIONES_AUDIOS.some(y=>medNormalizar(y.titulo)===medNormalizar(x.titulo)))].map(x=>({...x,post:medBuscarPublicacion(x.titulo)}));
 const otros=(typeof items!=='undefined'?items:[]).filter(x=>categoriaFiltro(x.category)==='meditaciones'&&!audios.some(a=>a.post?.id===x.id||medNormalizar(a.titulo)===medNormalizar(x.title))).map(x=>({titulo:x.title,ref:x.ref,post:x}));
 const lista=[...audios,...otros];
 if(!lista.length){cont.textContent='Todavía no hay meditaciones publicadas.';return;}
 for(const m of lista){
   const card=document.createElement('div');card.className='card';
   const subt=document.createElement('small');subt.textContent=(m.numero?'Meditación '+m.numero+' · ':'')+(m.ref||'');
   const h=document.createElement('h3');h.textContent=m.titulo;
   const btn=document.createElement('button');btn.textContent='Escuchar / Leer';btn.onclick=()=>abrirMeditacion(m);
   card.append(subt,h,btn);cont.append(card);
 }
}
function medCrearLectura(texto){
 const lectura=document.createElement('article');lectura.className='med-lectura';
 const bloques=String(texto||'').replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/);
 for(const bloque of bloques){
  const lineas=bloque.split('\n').map(x=>x.trim()).filter(Boolean);
  for(const linea of lineas){
   // Si el texto fue pegado como un solo bloque, crear pausas visuales sin alterar palabras.
   const frases=linea.length>450?linea.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g):null;
   if(frases&&frases.length>=5){
    for(let i=0;i<frases.length;i+=3){const p=document.createElement('p');p.textContent=frases.slice(i,i+3).join('').trim();lectura.append(p)}
   }else{const p=document.createElement('p');p.textContent=linea;lectura.append(p)}
  }
 }
 return lectura;
}
function abrirMeditacion(m){
 medActual=m;const d=document.getElementById('meditacionDetalle');d.replaceChildren();d.classList.remove('hide');
 const titulo=document.createElement('h2');titulo.textContent=m.titulo;
 const ref=document.createElement('p');ref.className='muted';ref.textContent=m.ref||'';
 const tabs=document.createElement('div');tabs.className='med-opciones';
 const escuchar=document.createElement('button'),leer=document.createElement('button');
 escuchar.textContent='🎧 Escuchar';leer.textContent='📖 Leer';tabs.append(escuchar,leer);
 const contenido=document.createElement('div');
 function modo(tipo){
  escuchar.setAttribute('aria-pressed',String(tipo==='audio'));leer.setAttribute('aria-pressed',String(tipo==='texto'));
  contenido.replaceChildren();
  if(tipo==='audio'){
   if(!m.archivo){contenido.textContent='Este audio todavía no está disponible.';return;}
   const a=document.createElement('audio');a.controls=true;a.preload='metadata';a.className='med-audio';a.src=m.archivo;
   const p=document.createElement('p');p.textContent='Narración musicalizada';
   const link=document.createElement('a');link.className='med-descarga';link.href=m.archivo;link.download='';link.textContent='⬇ Guardar MP3';
   contenido.append(p,a,link);
  }else{
   const post=m.post||medBuscarPublicacion(m.titulo);
   if(!post?.body){contenido.textContent='El texto completo todavía no está publicado. Puedes incorporarlo desde Administración, en la categoría Meditación, usando este mismo título.';return;}
   contenido.append(medCrearLectura(post.body));
  }
 }
 escuchar.onclick=()=>modo('audio');leer.onclick=()=>modo('texto');
 d.append(titulo,ref,tabs,contenido);modo(m.archivo?'audio':'texto');d.scrollIntoView({behavior:'smooth',block:'start'});
}
// Si la biblioteca termina de cargar después de abrir la sección, actualizar la lista.
window.addEventListener('online',()=>{if(!document.getElementById('meditaciones')?.classList.contains('hide'))renderMeditaciones()});

document.addEventListener('DOMContentLoaded',()=>{cargarAudiosMeditaciones();});
