const cfg=window.LUZ_CONFIG||{};
const configured=cfg.url?.startsWith('https://')&&cfg.publishableKey?.startsWith('sb_publishable_');
let session=null, items=[], categories=[], editing=null, admin=false;
const $=id=>document.getElementById(id);
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value??'';return e};
function message(m){$('connectionMessage').textContent=m}
function headers(auth=false){return {'apikey':cfg.publishableKey,'Content-Type':'application/json',...(auth&&session?.access_token?{'Authorization':'Bearer '+session.access_token}:{})}}
async function api(path,opts={}){const res=await fetch(cfg.url+path,{...opts,headers:{...headers(!!session),...(opts.headers||{})}});const body=await res.text();let data;try{data=body?JSON.parse(body):null}catch{data=body}if(!res.ok)throw Error((typeof data==='object'&&(data?.message||data?.error_description||data?.error))||'Error HTTP '+res.status);return data}
async function apiPublica(path, opts = {}) {
    const res = await fetch(cfg.url + path, {
        ...opts,
        headers: {
            'apikey': cfg.publishableKey,
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        }
    });

    const body = await res.text();
    let data;

    try {
        data = body ? JSON.parse(body) : null;
    } catch {
        data = body;
    }

    if (!res.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            'Error HTTP ' + res.status
        );
    }

    return data;
}

function show(id){document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('hide',s.id!==id));if(id==='biblioteca')render();if(id==='admin')renderAdmin()}
function filterType(t){show('biblioteca');$('typeFilter').value=t;render()}
function render(){const target=$('cards');target.replaceChildren();const q=$('search').value.toLocaleLowerCase(),type=$('typeFilter').value;const found=items.filter(x=>(!type||x.category===type)&&[x.title,x.ref,x.body].join(' ').toLocaleLowerCase().includes(q));for(const x of found){const c=text('div','');c.className='card';c.append(text('small',x.category+' · '+x.ref),text('h3',x.title));const b=text('button','Leer estudio');b.onclick=()=>read(x.id);c.append(b);target.append(c)}if(!found.length)target.append(text('p','No hay publicaciones que coincidan.'))}
function read(id){const x=items.find(a=>a.id===id),r=$('reader');if(!x)return;r.replaceChildren(text('small',x.category+' · '+x.ref),text('h2',x.title),text('article',x.body));const b=text('button','Cerrar');b.className='secondary';b.onclick=()=>r.classList.add('hide');r.append(b);r.classList.remove('hide');r.scrollIntoView({behavior:'smooth'})}
function mapPost(x){return {id:x.id,title:x.title,ref:x.bible_reference||'',body:x.content,category:categories.find(c=>c.id===x.category_id)?.name||'Estudio',category_id:x.category_id,summary:x.summary||'',status:x.status,slug:x.slug}}
async function loadCategories(){categories=await api('/rest/v1/categories?select=id,name&order=id.asc');const select=$('category');select.replaceChildren();for(const c of categories){const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.name;select.append(opt)}}
async function loadPublic(){const posts=await api('/rest/v1/posts?select=id,title,bible_reference,content,category_id,summary,status,slug&status=eq.published&order=created_at.desc');items=posts.map(mapPost);render()}
function resetForm(){editing=null;for(const id of ['title','ref','summary','body'])$(id).value='';$('status').value='draft'}
async function login(){if(!configured)return alert('Primero configura config.js');try{const s=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});session=s;sessionStorage.setItem('luz_session',JSON.stringify(s));$('password').value='';await verifyAdmin();await loadPublic()}catch(e){session=null;admin=false;sessionStorage.removeItem('luz_session');alert('No se pudo iniciar sesión: '+e.message)}}
async function verifyAdmin(){if(!session){admin=false;renderAdmin();return}try{const u=await api('/auth/v1/user');const rows=await api('/rest/v1/admins?select=user_id&user_id=eq.'+encodeURIComponent(u.id));admin=rows.length>0;message(admin?'Sesión de administrador activa.':'Esta cuenta no tiene permisos de administración.');renderAdmin()}catch(e){admin=false;message('No se pudo verificar el administrador: '+e.message);renderAdmin()}}
async function logout(){try{await api('/auth/v1/logout',{method:'POST'})}catch{}session=null;admin=false;sessionStorage.removeItem('luz_session');resetForm();renderAdmin()}
function renderAdmin(){ $('loginBox').classList.toggle('hide',admin);$('adminEditor').classList.toggle('hide',!admin);if(admin)loadAdmin().catch(e=>message('Error al consultar borradores: '+e.message))}
async function loadAdmin(){const rows=await api('/rest/v1/posts?select=id,title,bible_reference,content,category_id,summary,status,slug&order=created_at.desc');const list=$('adminList');list.replaceChildren();for(const raw of rows){const x=mapPost(raw),c=text('div','');c.className='card';c.style.marginTop='10px';c.append(text('b',x.title),text('p',x.category+' · '+x.status));const a=text('button','Editar');a.onclick=()=>{editing=x.id;$('title').value=x.title;$('ref').value=x.ref;$('body').value=x.body;$('summary').value=x.summary;$('status').value=x.status;$('category').value=x.category_id;window.scrollTo(0,0)};const b=text('button','Eliminar');b.className='danger';b.style.marginLeft='8px';b.onclick=async()=>{if(!confirm('¿Eliminar definitivamente este contenido?'))return;try{await api('/rest/v1/posts?id=eq.'+encodeURIComponent(x.id),{method:'DELETE'});await loadAdmin();await loadPublic()}catch(e){alert(e.message)}};c.append(a,b);list.append(c)}}
function slugify(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)}
async function save(){if(!admin)return;const title=$('title').value.trim(),content=$('body').value.trim(),ref=$('ref').value.trim(),summary=$('summary').value.trim();if(!title||!content||!ref||!summary)return alert('Completa título, referencia, resumen y contenido.');const category_id=Number($('category').value);if(!category_id)return alert('Primero crea las categorías en Supabase.');const record={title,content,bible_reference:ref,summary,category_id,status:$('status').value,slug:slugify(title)+'-'+(editing?editing.slice(0,8):Date.now().toString(36))};try{if(editing){await api('/rest/v1/posts?id=eq.'+encodeURIComponent(editing),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(record)})}else{await api('/rest/v1/posts',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(record)})}resetForm();await loadAdmin();await loadPublic();alert('Contenido guardado en Supabase.')}catch(e){alert('No se pudo guardar: '+e.message)}}
async function exportData(){if(!admin)return;try{const rows=await api('/rest/v1/posts?select=*&order=created_at.desc');const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),posts:rows},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='luz-para-tu-alma-respaldo.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}}
(async()=>{if(!configured){message('Falta configurar la clave pública en config.js.');return}message('Conectando a Supabase...');try{await loadCategories();await loadPublic();message('Conectado a Supabase. Inicia sesión para administrar.');try{session=JSON.parse(sessionStorage.getItem('luz_session')||'null')}catch{}if(session)await verifyAdmin()}catch(e){message('Error de conexión: '+e.message);$('cards').replaceChildren(text('p','No se pudo cargar la biblioteca.'))}})();
if (new URLSearchParams(window.location.search).has('admin')) {
    show('admin');
}

function abrirAccesoPrivado() {
    if (window.location.hash === "#admin") {
        show("admin");
    }
}

window.addEventListener("hashchange", abrirAccesoPrivado);
window.addEventListener("load", abrirAccesoPrivado);

/* ==========================================
   LUZ PARA TU ALMA - ORACIÓN Y TESTIMONIOS
   ========================================== */

let enviandoOracion = false;
let enviandoTestimonio = false;

async function enviarOracion() {
    if (enviandoOracion) return;

    const nombre = $('nombreOracion').value.trim();
    const peticion = $('textoOracion').value.trim();
    const publicar = $('publicarOracion').checked;
    const mensaje = $('mensajeOracion');

    if (peticion.length < 10) {
        mensaje.textContent =
            'Escribe una petición de al menos 10 caracteres.';
        return;
    }

    if (peticion.length > 3000 || nombre.length > 100) {
        mensaje.textContent = 'El texto es demasiado largo.';
        return;
    }

    enviandoOracion = true;
    mensaje.textContent = 'Enviando tu petición...';

    try {
        await apiPublica('/rest/v1/peticiones_oracion', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
                nombre: nombre || null,
                peticion: peticion,
                correo: null,
                autoriza_contacto: false,
                solicita_publicacion: publicar,
                estado: 'pendiente',
                aprobada: false
            })
        });

        $('nombreOracion').value = '';
        $('textoOracion').value = '';
        $('publicarOracion').checked = false;

        mensaje.textContent =
            'Tu petición fue recibida. Estaremos orando por ti.';
    } catch (error) {
        mensaje.textContent =
            'No se pudo enviar la petición: ' + error.message;
    } finally {
        enviandoOracion = false;
    }
}

async function enviarTestimonio() {
    if (enviandoTestimonio) return;

    const nombre = $('nombreTestimonio').value.trim();
    const testimonio = $('textoTestimonio').value.trim();
    const publicar = $('publicarTestimonio').checked;
    const mensaje = $('mensajeTestimonio');

    if (testimonio.length < 10) {
        mensaje.textContent =
            'Escribe un testimonio de al menos 10 caracteres.';
        return;
    }

    if (testimonio.length > 3000 || nombre.length > 100) {
        mensaje.textContent = 'El texto es demasiado largo.';
        return;
    }

    enviandoTestimonio = true;
    mensaje.textContent = 'Enviando tu testimonio...';

    try {
        await apiPublica('/rest/v1/testimonios_oracion', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
                nombre: nombre || null,
                testimonio: testimonio,
                correo: null,
                autoriza_contacto: false,
                solicita_publicacion: publicar,
                aprobado: false
            })
        });

        $('nombreTestimonio').value = '';
        $('textoTestimonio').value = '';
        $('publicarTestimonio').checked = false;

        mensaje.textContent =
            'Tu testimonio fue recibido y está pendiente de revisión.';
    } catch (error) {
        mensaje.textContent =
            'No se pudo enviar el testimonio: ' + error.message;
    } finally {
        enviandoTestimonio = false;
    }
}

async function cargarOracionesPublicas() {
    const contenedor = $('listaOraciones');
    contenedor.replaceChildren(
        text('p', 'Cargando peticiones...')
    );

    try {
        const registros = await apiPublica(
            '/rest/v1/oraciones_publicas' +
            '?select=id,nombre,peticion,fecha' +
            '&order=fecha.desc&limit=30'
        );

        contenedor.replaceChildren();

        if (!registros.length) {
            contenedor.append(
                text('p', 'Todavía no hay peticiones publicadas.')
            );
            return;
        }

        for (const registro of registros) {
            const tarjeta = text('div', '');
            tarjeta.className = 'card';

            tarjeta.append(
                text('h3', registro.nombre || 'Anónimo'),
                text('article', registro.peticion)
            );

            contenedor.append(tarjeta);
        }
    } catch (error) {
        contenedor.replaceChildren(
            text('p', 'No se pudieron cargar las peticiones.')
        );
        console.error(error);
    }
}

async function cargarTestimoniosPublicos() {
    const contenedor = $('listaTestimonios');
    contenedor.replaceChildren(
        text('p', 'Cargando testimonios...')
    );

    try {
        const registros = await api(
            '/rest/v1/testimonios_publicos' +
            '?select=nombre,testimonio,fecha' +
            '&order=fecha.desc&limit=30'
        );

        contenedor.replaceChildren();

        if (!registros.length) {
            contenedor.append(
                text('p', 'Todavía no hay testimonios publicados.')
            );
            return;
        }

        for (const registro of registros) {
            const tarjeta = text('div', '');
            tarjeta.className = 'card';

            tarjeta.append(
                text('h3', registro.nombre || 'Anónimo'),
                text('article', registro.testimonio)
            );

            contenedor.append(tarjeta);
        }
    } catch (error) {
        contenedor.replaceChildren(
            text('p', 'No se pudieron cargar los testimonios.')
        );
        console.error(error);
    }
}

/* Cargar las publicaciones cuando se abra Oración. */
const mostrarSeccionOriginal = show;

show = function (id) {
    mostrarSeccionOriginal(id);

    if (id === 'oracion' && configured) {
        cargarOracionesPublicas();
        cargarTestimoniosPublicos();
    }
};

/* ADMINISTRACIÓN DE ORACIONES Y TESTIMONIOS */

async function cargarSolicitudesOracion() {
    if (!admin || !session?.access_token) return;

    const cajaOraciones = $('adminOraciones');
    const cajaTestimonios = $('adminTestimonios');

    cajaOraciones.replaceChildren(text('p', 'Cargando...'));
    cajaTestimonios.replaceChildren(text('p', 'Cargando...'));

    try {
        const peticiones = await api(
            '/rest/v1/peticiones_oracion' +
            '?select=id,nombre,peticion,estado,aprobada,' +
            'solicita_publicacion,fecha' +
            '&order=fecha.desc&limit=100'
        );

        const testimonios = await api(
            '/rest/v1/testimonios_oracion' +
            '?select=id,nombre,testimonio,aprobado,' +
            'solicita_publicacion,fecha' +
            '&order=fecha.desc&limit=100'
        );

        cajaOraciones.replaceChildren();
        cajaTestimonios.replaceChildren();

        if (!peticiones.length) {
            cajaOraciones.append(
                text('p', 'No hay peticiones recibidas.')
            );
        }

        for (const p of peticiones) {
            const tarjeta = text('div', '');
            tarjeta.className = 'card';
            tarjeta.style.marginBottom = '12px';

            tarjeta.append(
                text('h3', p.nombre || 'Anónimo'),
                text('article', p.peticion),
                text(
                    'p',
                    'Estado: ' + p.estado +
                    ' | Autoriza publicación: ' +
                    (p.solicita_publicacion ? 'Sí' : 'No')
                )
            );

            const acciones = text('div', '');
            acciones.className = 'actions';

            if (p.solicita_publicacion) {
                const aprobar = text('button', 'Aprobar');
                aprobar.onclick = () =>
                    actualizarPeticion(p.id, true);
                acciones.append(aprobar);
            }

            const retirar = text('button', 'No publicar');
            retirar.className = 'secondary';
            retirar.onclick = () =>
                actualizarPeticion(p.id, false);

            acciones.append(retirar);
            tarjeta.append(acciones);
            cajaOraciones.append(tarjeta);
        }

        if (!testimonios.length) {
            cajaTestimonios.append(
                text('p', 'No hay testimonios recibidos.')
            );
        }

        for (const t of testimonios) {
            const tarjeta = text('div', '');
            tarjeta.className = 'card';
            tarjeta.style.marginBottom = '12px';

            tarjeta.append(
                text('h3', t.nombre || 'Anónimo'),
                text('article', t.testimonio),
                text(
                    'p',
                    'Autoriza publicación: ' +
                    (t.solicita_publicacion ? 'Sí' : 'No')
                )
            );

            const acciones = text('div', '');
            acciones.className = 'actions';

            if (t.solicita_publicacion) {
                const aprobar = text('button', 'Aprobar');
                aprobar.onclick = () =>
                    actualizarTestimonio(t.id, true);
                acciones.append(aprobar);
            }

            const retirar = text('button', 'No publicar');
            retirar.className = 'secondary';
            retirar.onclick = () =>
                actualizarTestimonio(t.id, false);

            acciones.append(retirar);
            tarjeta.append(acciones);
            cajaTestimonios.append(tarjeta);
        }

    } catch (error) {
        cajaOraciones.replaceChildren(
            text('p', 'Error al consultar solicitudes.')
        );
        cajaTestimonios.replaceChildren(
            text('p', 'Comprueba los permisos de administrador.')
        );
        alert('Error: ' + error.message);
    }
}



/* APROBAR O RETIRAR PETICIONES */

async function actualizarPeticion(id, aprobar) {
    if (!admin) return;

    if (aprobar && !confirm(
        '¿Confirmas que revisaste la petición y autorizas su publicación?'
    )) return;

    try {
        const resultado = await api(
            '/rest/v1/peticiones_oracion?id=eq.' +
            encodeURIComponent(id),
            {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: JSON.stringify({
                    aprobada: aprobar,
                    
estado: aprobar ? 'en_oración' : 'pendiente'

                })
            }
        );

        if (!Array.isArray(resultado) || resultado.length !== 1) {
            throw new Error(
                'Supabase no confirmó la actualización.'
            );
        }

        await cargarSolicitudesOracion();
        alert('Petición actualizada correctamente.');

    } catch (error) {
        alert('No se pudo actualizar: ' + error.message);
    }
}

/* APROBAR O RETIRAR TESTIMONIOS */

async function actualizarTestimonio(id, aprobar) {
    if (!admin) return;

    if (aprobar && !confirm(
        '¿Confirmas que revisaste el testimonio y autorizas su publicación?'
    )) return;

    try {
        const resultado = await api(
            '/rest/v1/testimonios_oracion?id=eq.' +
            encodeURIComponent(id),
            {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: JSON.stringify({
                    aprobado: aprobar
                })
            }
        );

        if (!Array.isArray(resultado) || resultado.length !== 1) {
            throw new Error(
                'Supabase no confirmó la actualización.'
            );
        }

        await cargarSolicitudesOracion();
        alert('Testimonio actualizado correctamente.');

    } catch (error) {
        alert('No se pudo actualizar: ' + error.message);
    }
}
