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
 const lista=[...audios,...otros].filter(x=>{
   const q=medNormalizar(document.getElementById('medBuscar')?.value||'');
   return !q||medNormalizar([x.titulo,x.ref,x.post?.body].join(' ')).includes(q);
 });
 if(!lista.length){cont.textContent='No hay meditaciones que coincidan con la búsqueda.';return;}
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
   const a=document.createElement('audio');a.controls=true;a.preload='none';a.className='med-audio';a.src=m.archivo;
   const p=document.createElement('p');p.textContent='Narración musicalizada';
   const velocidad=document.createElement('select');velocidad.setAttribute('aria-label','Velocidad de reproducción');
   for(const n of [0.75,1,1.25,1.5,2]){const opt=document.createElement('option');opt.value=String(n);opt.textContent=n+'×';if(n===1)opt.selected=true;velocidad.append(opt)}
   velocidad.onchange=()=>a.playbackRate=Number(velocidad.value);
   const aviso=document.createElement('p');aviso.className='med-audio-error';aviso.setAttribute('role','status');
   a.onerror=()=>aviso.textContent='No se pudo cargar este audio. Comprueba la conexión o reemplaza el MP3 desde Administración.';
   const link=document.createElement('a');link.className='med-descarga';link.href=m.archivo;link.download='';link.textContent='⬇ Guardar MP3';
   contenido.append(p,a,velocidad,aviso,link);
  }else{
   const post=m.post||medBuscarPublicacion(m.titulo);
   if(!post?.body){contenido.textContent='El texto completo todavía no está publicado. Puedes incorporarlo desde Administración, en la categoría Meditación, usando este mismo título.';return;}
   contenido.append(medCrearLectura(post.body));
  }
 }
 escuchar.onclick=()=>modo('audio');leer.onclick=()=>modo('texto');
 const compartir=document.createElement('div');compartir.className='med-compartir';
 const enlace=new URL(window.location.href);enlace.searchParams.delete('admin');enlace.searchParams.set('meditacion',medNormalizar(m.titulo).replace(/ /g,'-'));enlace.hash='';
 const botonCompartir=document.createElement('button');botonCompartir.type='button';botonCompartir.textContent='↗ Compartir';
 botonCompartir.onclick=async()=>{try{if(navigator.share)await navigator.share({title:m.titulo,text:'Meditación de Luz para tu Alma',url:enlace.href});else{await navigator.clipboard.writeText(enlace.href);botonCompartir.textContent='✓ Enlace copiado'}}catch(e){if(e.name!=='AbortError')alert('No se pudo compartir el enlace.')}};
 const wa=document.createElement('a');wa.href='https://wa.me/?text='+encodeURIComponent(m.titulo+' — '+enlace.href);wa.target='_blank';wa.rel='noopener noreferrer';wa.textContent='WhatsApp';
 const fb=document.createElement('a');fb.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(enlace.href);fb.target='_blank';fb.rel='noopener noreferrer';fb.textContent='Facebook';
 compartir.append(botonCompartir,wa,fb);
 d.append(titulo,ref,compartir,tabs,contenido);modo(m.archivo?'audio':'texto');d.scrollIntoView({behavior:'smooth',block:'start'});
}
// Si la biblioteca termina de cargar después de abrir la sección, actualizar la lista.
window.addEventListener('online',()=>{if(!document.getElementById('meditaciones')?.classList.contains('hide'))renderMeditaciones()});

document.addEventListener('DOMContentLoaded',()=>{cargarAudiosMeditaciones();});

// Abrir un contenido compartido, incluso si los datos de Supabase llegan después.
let medEnlaceAbierto=false;
function medAbrirEnlaceCompartido(){
 if(medEnlaceAbierto)return;
 const objetivo=new URLSearchParams(location.search).get('meditacion');if(!objetivo)return;
 const lista=[...MEDITACIONES_AUDIOS,...medAudiosRemotos].map(x=>({...x,post:medBuscarPublicacion(x.titulo)}));
 for(const x of (typeof items!=='undefined'?items:[]))if(categoriaFiltro(x.category)==='meditaciones'&&!lista.some(y=>medNormalizar(y.titulo)===medNormalizar(x.title)))lista.push({titulo:x.title,ref:x.ref,post:x});
 const hallado=lista.find(x=>medNormalizar(x.titulo).replace(/ /g,'-')===objetivo);
 if(hallado){medEnlaceAbierto=true;show('meditaciones');renderMeditaciones();abrirMeditacion(hallado)}
}
const medRenderOriginal=renderMeditaciones;
renderMeditaciones=function(){medRenderOriginal();medAbrirEnlaceCompartido()};
document.addEventListener('DOMContentLoaded',()=>setTimeout(medAbrirEnlaceCompartido,800));
async function reemplazarAudioMeditacion(){
 if(!admin||!session?.access_token)return alert('Inicia sesión como administrador.');
 const titulo=document.getElementById('medReemplazoTitulo').value.trim();const archivo=document.getElementById('medReemplazoArchivo').files[0];
 const estado=document.getElementById('medReemplazoEstado');const boton=document.getElementById('medReemplazar');
 if(!titulo||!archivo)return alert('Escribe el título y selecciona un MP3.');
 if(!/\.mp3$/i.test(archivo.name)||archivo.size>50*1024*1024)return alert('Selecciona un MP3 de máximo 50 MB.');
 const nombre=medArchivoNombre(titulo);if(!medAudiosRemotos.some(x=>x.nombre===nombre))return alert('No se encontró un audio remoto con ese título. Esta opción solo reemplaza MP3 publicados desde el formulario.');
 if(!confirm('¿Reemplazar el audio existente de «'+titulo+'»?'))return;
 boton.disabled=true;estado.textContent='Actualizando audio...';
 try{const res=await fetch(cfg.url+'/storage/v1/object/musica/'+encodeURIComponent(nombre),{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'audio/mpeg','x-upsert':'true','cache-control':'max-age=0'},body:archivo});if(!res.ok)throw Error('Error '+res.status+': '+(await res.text()).slice(0,180));
 await cargarAudiosMeditaciones();estado.textContent='MP3 reemplazado. Puede tardar unos minutos en actualizarse en caché.';
 }catch(e){estado.textContent='No se pudo reemplazar: '+e.message}finally{boton.disabled=false}
}
