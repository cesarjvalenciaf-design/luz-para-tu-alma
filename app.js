const cfg=window.LUZ_CONFIG||{};
const configured=cfg.url?.startsWith('https://')&&cfg.publishableKey?.startsWith('sb_publishable_');
let session=null, items=[], categories=[], editing=null, admin=false;
let sesionEstudiante = null;
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
        throw new Error('Error HTTP ' + res.status + ': ' +
            (data?.message || data?.error_description || data?.error || 'Solicitud rechazada'));
    }

    return data;
}

function iniciarGuardadoEstudio1() {
    for (let i = 1; i <= 6; i++) {
        const campo = document.getElementById('respuesta' + i);
        if (!campo) continue;

        const clave = 'luzparatualma_estudio1_respuesta' + i;

        campo.value = localStorage.getItem(clave) || '';

        campo.addEventListener('input', function () {
            localStorage.setItem(clave, campo.value);
            programarSincronizacion(i && 1);
        });
    }
}

document.addEventListener('DOMContentLoaded', iniciarGuardadoEstudio1);

function mostrarProgresoEstudio1() {
    const progreso = document.getElementById('progresoEstudio1');
    if (!progreso) return;

    const completado =
        localStorage.getItem('luzparatualma_estudio1_completado') === 'true';

    if (completado) {
        progreso.textContent =
            '✅ ¡Estudio 1 completado! Has avanzado 1 de 20 estudios (5 %).';
    } else {
        progreso.textContent =
            'Responde las seis preguntas para completar este estudio.';
    }
}

document.addEventListener('DOMContentLoaded', actualizarProgresoCurso);

function finalizarEstudio1() {
    for (let i = 1; i <= 6; i++) {
        const campo = document.getElementById('respuesta' + i);

        if (!campo || !campo.value.trim()) {
            alert('Falta responder la pregunta ' + i);
            if (campo) campo.focus();
            return;
        }
    }

    try {
        localStorage.setItem('luzparatualma_estudio1_completado', 'true');
    } catch (error) {
        alert('No se pudo guardar el progreso en este navegador.');
        return;
    }

    const progreso = document.getElementById('progresoEstudio1');

    if (progreso) {
        progreso.textContent =
            '✅ ¡Estudio 1 completado! Has avanzado 1 de 20 estudios (5 %).';
    }

    actualizarProgresoCurso();
    renderizarListaLecciones();
    sincronizarEstudio(1);
    alert('¡Felicitaciones! Has completado el Estudio 1 de La Fe de Jesús. ' + resumenProgresoCurso());
}

function leccionCompletada(numero) {
    if (numero === 1) return localStorage.getItem('luzparatualma_estudio1_completado') === 'true';
    return progresoLocalLeccion(numero).completado === true;
}
function totalLeccionesCompletadas() {
    return Array.from({length:20}, (_,i) => i+1).filter(leccionCompletada).length;
}
function resumenProgresoCurso() {
    const total = totalLeccionesCompletadas();
    return `Has completado ${total} de 20 estudios (${total * 5} %).`;
}
function actualizarProgresoCurso() {
    const resumen = resumenProgresoCurso();
    const general = document.getElementById('progresoGeneralCurso');
    if (general) general.textContent = '📘 ' + resumen;
    const primero = document.getElementById('progresoEstudio1');
    if (primero) primero.textContent = leccionCompletada(1)
        ? '✅ ¡Estudio 1 completado! ' + resumen
        : 'Responde las seis preguntas para completar este estudio. ' + resumen;
}
function abrirLeccion(numero) {
    if (numero < 1 || numero > 20) return;
    if (numero > 1 && !leccionCompletada(numero - 1)) {
        alert('Primero debes finalizar el estudio ' + (numero - 1) + ' para continuar.');
        return;
    }
    if (numero === 1) {
        show('leccion1');
    } else {
        const leccion = LECCIONES_2_A_20.find(x => x.numero === numero);
        if (!leccion) return;
        renderizarLeccion(leccion);
        show('leccionDinamica');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function enviarEnlaceEstudiante(nombre, correo) {
    // Compatible con formularios antiguos que pasan el evento de envío.
    if (nombre && typeof nombre === 'object' && typeof nombre.preventDefault === 'function') {
        nombre.preventDefault();
        nombre = document.getElementById('nombreEstudiante')?.value || '';
        correo = document.getElementById('correoEstudiante')?.value || '';
    }
    nombre = typeof nombre === 'string' ? nombre.trim() : '';
    correo = typeof correo === 'string' ? correo.trim().toLowerCase() : '';

    if (!nombre || !correo) {
        alert('Escribe tu nombre y correo electrónico.');
        return;
    }

    try {
        const destino = window.location.origin +
            window.location.pathname;

        await apiPublica('/auth/v1/otp', {
            method: 'POST',
            body: JSON.stringify({
                email: correo,
                data: { nombre_estudiante: nombre },
                create_user: true,
                email_redirect_to: destino
            })
        });

        alert('Revisa tu correo. Te enviamos un enlace para ingresar.');
    } catch (error) {
        if (/429|rate limit|too many/i.test(error.message)) {
            alert('Supabase ha limitado temporalmente los correos de acceso. No sigas solicitando enlaces. Revisa Authentication > Rate Limits y vuelve a intentar cuando se restablezca el límite.');
        } else {
            alert('Error al enviar el enlace: ' + error.message);
        }
    }
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
async function recuperarSesionEstudiante() {
    const datos = new URLSearchParams(window.location.hash.substring(1));

    const accessToken = datos.get('access_token');
    const refreshToken = datos.get('refresh_token');

    if (!accessToken || !refreshToken) return;

    try {
        const usuario = await apiPublica('/auth/v1/user', {
            headers: {
                Authorization: 'Bearer ' + accessToken
            }
        });

        sesionEstudiante = {
            access_token: accessToken,
            refresh_token: refreshToken,
            usuario: usuario
        };

        sessionStorage.setItem(
            'luz_estudiante',
            JSON.stringify(sesionEstudiante)
        );

        history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
        );

        await iniciarSincronizacionEstudiante();
        console.log('Estudiante autenticado correctamente');
    } catch (error) {
        console.error('Error al autenticar estudiante:', error);
    }
}
function cargarSesionEstudianteGuardada() {
    try {
        const guardada = sessionStorage.getItem('luz_estudiante');

        if (!guardada) return;

        const datos = JSON.parse(guardada);

        if (!datos.access_token || !datos.usuario?.id) {
            sessionStorage.removeItem('luz_estudiante');
            return;
        }

        sesionEstudiante = datos;

        console.log('Sesión de estudiante recuperada');
    } catch (error) {
        sessionStorage.removeItem('luz_estudiante');
        console.error('Error al recuperar sesión:', error);
    }
}

cargarSesionEstudianteGuardada();
recuperarSesionEstudiante().then(() => { if (sesionEstudiante) iniciarSincronizacionEstudiante(); else actualizarEstadoEstudiante(); });
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


function obtenerVisitanteOracion() {
    const clave = 'luz_para_tu_alma_visitante_oracion';

    let id = localStorage.getItem(clave);

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(clave, id);
    }

    return id;
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

    const nombre = text('h3', registro.nombre || 'Anónimo');
    const peticion = text('article', registro.peticion);

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = '🙏 Estoy orando por ti';

    const contador = text('p', 'Personas orando: ...');

    tarjeta.append(nombre, peticion, boton, contador);
    contenedor.append(tarjeta);

    try {
        const cantidad = await apiPublica(
            '/rest/v1/rpc/contar_oraciones',
            {
                method: 'POST',
                body: JSON.stringify({
                    p_peticion_id: registro.id
                })
            }
        );
        contador.textContent = 'Personas orando: ' + cantidad;
    } catch (error) {
        contador.textContent = 'Contador no disponible';
    }

    boton.addEventListener('click', async () => {
        boton.disabled = true;

        try {
            await apiPublica(
                '/rest/v1/rpc/registrar_oracion',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        p_peticion_id: registro.id,
                        p_visitante_id: obtenerVisitanteOracion()
                    })
                }
            );

            const cantidad = await apiPublica(
                '/rest/v1/rpc/contar_oraciones',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        p_peticion_id: registro.id
                    })
                }
            );

            contador.textContent = 'Personas orando: ' + cantidad;
            boton.textContent = '✓ Gracias por unirte en oración';
        } catch (error) {
            boton.disabled = false;
            alert('No se pudo registrar tu oración: ' + error.message);
        }
    });
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
let filtroPeticionesActual = 'pendientes';
let filtroTestimoniosActual = 'pendientes';

function filtrarPeticiones(filtro) {
    filtroPeticionesActual = filtro;
    cargarSolicitudesOracion();
}

function filtrarTestimonios(filtro) {
    filtroTestimoniosActual = filtro;
    cargarSolicitudesOracion();
}

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
           'solicita_publicacion,estado,fecha' +
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
            if (filtroPeticionesActual === 'pendientes' &&
    (p.estado === 'eliminada' || p.aprobada)) continue;

if (filtroPeticionesActual === 'publicadas' &&
    (p.estado === 'eliminada' || !p.aprobada || !p.solicita_publicacion)) continue;

if (filtroPeticionesActual === 'retiradas' &&
    p.estado !== 'eliminada') continue;
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
if (p.estado === 'eliminada') {
    tarjeta.append(
        text('p', 'Esta petición fue retirada y no puede modificarse desde este panel.')
    );
    cajaOraciones.append(tarjeta);
    continue;
}
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

const eliminar = text('button', 'Eliminar');
eliminar.className = 'danger';
eliminar.style.backgroundColor = '#b42318';
eliminar.style.color = 'white';

eliminar.onclick = () => {
    eliminarPeticion(p.id);
};

acciones.append(eliminar);

            tarjeta.append(acciones);
            cajaOraciones.append(tarjeta);
        }

if (cajaOraciones.children.length === 0) {
    const mensajes = {
        pendientes: 'No hay peticiones pendientes.',
        publicadas: 'No hay peticiones publicadas.',
        retiradas: 'No hay peticiones retiradas.'
    };

    cajaOraciones.append(
        text('p', mensajes[filtroPeticionesActual] || 'No hay peticiones para mostrar.')
    );
}

        if (!testimonios.length) {
            cajaTestimonios.append(
                text('p', 'No hay testimonios recibidos.')
            );
        }

        for (const t of testimonios) {
           if (filtroTestimoniosActual === 'pendientes' &&
    t.estado !== 'pendiente') continue;

if (filtroTestimoniosActual === 'publicados' &&
    (t.estado !== 'publicado' || !t.aprobado ||
     !t.solicita_publicacion)) continue;

if (filtroTestimoniosActual === 'retirados' &&
    t.estado !== 'retirado') continue;
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

const eliminarTest = text('button', 'Eliminar');
eliminarTest.className = 'danger';
eliminarTest.style.backgroundColor = '#b42318';
eliminarTest.style.color = 'white';

eliminarTest.onclick = () => {
    eliminarTestimonio(t.id);
};

acciones.append(eliminarTest);

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

/* ELIMINAR PETICION DE LA VISTA PUBLICA */
async function eliminarPeticion(id) {
    if (!admin) return;

    const confirmar = confirm(
        '¿Deseas eliminar esta petición de oración? Dejará de aparecer públicamente.'
    );

    if (!confirmar) return;

    try {
        const resultado = await api(
            '/rest/v1/peticiones_oracion?id=eq.' +
            encodeURIComponent(id),
            {
                method: 'PATCH',
                headers: {
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({
                    aprobada: false,
                    estado: 'eliminada'
                })
            }
        );

        if (!Array.isArray(resultado) || resultado.length !== 1) {
            throw new Error('Supabase no confirmó la eliminación.');
        }

        await cargarSolicitudesOracion();
        alert('Petición retirada correctamente.');

    } catch (error) {
        alert('No se pudo eliminar: ' + error.message);
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
    aprobado: aprobar,
    estado: aprobar ? 'publicado' : 'retirado'
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


/* RETIRAR TESTIMONIOS DE LA PUBLICACIÓN */
async function eliminarTestimonio(id) {
    if (!admin) return;

    if (!confirm(
        '¿Seguro que deseas retirar este testimonio de la página pública?'
    )) return;

    try {
        const resultado = await api(
            '/rest/v1/testimonios_oracion?id=eq.' +
            encodeURIComponent(id),
            {
                method: 'PATCH',
                headers: {
                    Prefer: 'return=representation'
                },
              body: JSON.stringify({
    aprobado: false,
    estado: 'retirado'
})
            }
        );

        if (!Array.isArray(resultado) || resultado.length !== 1) {
            throw new Error(
                'Supabase no confirmó la actualización.'
            );
        }

        await cargarSolicitudesOracion();
        alert('Testimonio retirado correctamente.');

    } catch (error) {
        alert('No se pudo retirar: ' + error.message);
    }
}



/* ESCUELA BÍBLICA: estudios originales 2 a 20.
   Guardado local en este navegador. Sin sincronización con Supabase todavía. */
const LECCIONES_2_A_20 = [
  {
    "numero": 2,
    "titulo": "La Santa Biblia",
    "textoClave": "2 Timoteo 3:16-17",
    "introduccion": "Dios nos ha dejado en las Escrituras un testimonio confiable de su carácter y de su plan de salvación. Estudiarlas es escuchar su llamado a conocer a Jesús.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Cuál es el origen de las Escrituras?",
        "referencia": "2 Timoteo 3:16",
        "explicacion": "La Escritura es inspirada por Dios y útil para enseñar, corregir y educar en justicia."
      },
      {
        "pregunta": "¿Cómo actuó Dios mediante los profetas?",
        "referencia": "2 Pedro 1:21",
        "explicacion": "Los autores bíblicos hablaron impulsados por el Espíritu Santo, sin dejar de emplear su lenguaje y contexto."
      },
      {
        "pregunta": "¿Qué testifican las Escrituras?",
        "referencia": "Juan 5:39",
        "explicacion": "Jesús enseñó que las Escrituras dan testimonio de él; su lectura debe conducirnos al Salvador."
      },
      {
        "pregunta": "¿Cómo ilumina la Biblia nuestra vida?",
        "referencia": "Salmo 119:105",
        "explicacion": "La Palabra es lámpara y luz: orienta nuestras decisiones y confronta nuestros errores."
      },
      {
        "pregunta": "¿Qué respuesta espera Dios del lector?",
        "referencia": "Santiago 1:22",
        "explicacion": "La fe auténtica escucha y practica la Palabra, no se conforma con conocerla."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Cuál es el origen de las Escrituras?",
        "opciones": [
          "Su mensaje fue inspirado por Dios",
          "Es solamente una colección de opiniones",
          "Fue dictada por los emperadores"
        ],
        "correcta": 0,
        "explicacion": "La Escritura es inspirada por Dios y útil para enseñar, corregir y educar en justicia."
      },
      {
        "pregunta": "¿Cómo actuó Dios mediante los profetas?",
        "opciones": [
          "Por la acción del Espíritu Santo",
          "Por decisión de los reyes",
          "Por adivinación"
        ],
        "correcta": 0,
        "explicacion": "Los autores bíblicos hablaron impulsados por el Espíritu Santo, sin dejar de emplear su lenguaje y contexto."
      },
      {
        "pregunta": "¿Qué testifican las Escrituras?",
        "opciones": [
          "Dan testimonio de Jesucristo",
          "Reemplazan a Jesucristo",
          "Solo contienen normas civiles"
        ],
        "correcta": 0,
        "explicacion": "Jesús enseñó que las Escrituras dan testimonio de él; su lectura debe conducirnos al Salvador."
      },
      {
        "pregunta": "¿Cómo ilumina la Biblia nuestra vida?",
        "opciones": [
          "Guía nuestro camino",
          "Elimina toda dificultad",
          "Evita la necesidad de pensar"
        ],
        "correcta": 0,
        "explicacion": "La Palabra es lámpara y luz: orienta nuestras decisiones y confronta nuestros errores."
      },
      {
        "pregunta": "¿Qué respuesta espera Dios del lector?",
        "opciones": [
          "Ponerla en práctica",
          "Solo memorizar versículos",
          "Leer sin obedecer"
        ],
        "correcta": 0,
        "explicacion": "La fe auténtica escucha y practica la Palabra, no se conforma con conocerla."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer 2 Timoteo 3:16-17 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La Santa Biblia» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la santa biblia. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 3,
    "titulo": "La oración y la fe",
    "textoClave": "Marcos 11:24",
    "introduccion": "La oración es diálogo sincero con el Padre. La fe no obliga a Dios a conceder cada deseo: aprende a confiar en su sabiduría y voluntad.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué enseñó Jesús sobre la oración personal?",
        "referencia": "Mateo 6:6",
        "explicacion": "Invitó a buscar al Padre sin convertir la oración en espectáculo."
      },
      {
        "pregunta": "¿Cómo debemos presentar nuestras necesidades?",
        "referencia": "Filipenses 4:6-7",
        "explicacion": "Con oración, ruego y gratitud, confiando en la paz de Dios."
      },
      {
        "pregunta": "¿Qué relación existe entre fe y oración?",
        "referencia": "Hebreos 11:6",
        "explicacion": "Acercarnos a Dios supone creer que existe y que responde a quienes le buscan."
      },
      {
        "pregunta": "¿Qué modelo dejó Jesús?",
        "referencia": "Mateo 6:9-13",
        "explicacion": "El Padrenuestro une adoración, dependencia, perdón y liberación del mal."
      },
      {
        "pregunta": "¿Cómo debemos entender las respuestas de Dios?",
        "referencia": "1 Juan 5:14",
        "explicacion": "La confianza cristiana reconoce que Dios escucha lo pedido conforme a su voluntad."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué enseñó Jesús sobre la oración personal?",
        "opciones": [
          "Orar sinceramente al Padre",
          "Orar solo en público",
          "Evitar la oración privada"
        ],
        "correcta": 0,
        "explicacion": "Invitó a buscar al Padre sin convertir la oración en espectáculo."
      },
      {
        "pregunta": "¿Cómo debemos presentar nuestras necesidades?",
        "opciones": [
          "Con gratitud y confianza",
          "Con amenazas a Dios",
          "Sin expresar necesidades"
        ],
        "correcta": 0,
        "explicacion": "Con oración, ruego y gratitud, confiando en la paz de Dios."
      },
      {
        "pregunta": "¿Qué relación existe entre fe y oración?",
        "opciones": [
          "Confiar en Dios al buscarlo",
          "Exigir resultados inmediatos",
          "Conocer todas las respuestas"
        ],
        "correcta": 0,
        "explicacion": "Acercarnos a Dios supone creer que existe y que responde a quienes le buscan."
      },
      {
        "pregunta": "¿Qué modelo dejó Jesús?",
        "opciones": [
          "El Padrenuestro",
          "Un rito secreto",
          "Una fórmula para enriquecerse"
        ],
        "correcta": 0,
        "explicacion": "El Padrenuestro une adoración, dependencia, perdón y liberación del mal."
      },
      {
        "pregunta": "¿Cómo debemos entender las respuestas de Dios?",
        "opciones": [
          "Conforme a su voluntad",
          "Siempre según nuestro calendario",
          "Solo cuando repetimos muchas veces"
        ],
        "correcta": 0,
        "explicacion": "La confianza cristiana reconoce que Dios escucha lo pedido conforme a su voluntad."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Marcos 11:24 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La oración y la fe» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la oración y la fe. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 4,
    "titulo": "La segunda venida de Jesucristo",
    "textoClave": "Juan 14:1-3",
    "introduccion": "La esperanza cristiana mira al regreso personal de Jesús. Su promesa sostiene al creyente mientras vive con fidelidad en el presente.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué prometió Jesús a sus discípulos?",
        "referencia": "Juan 14:1-3",
        "explicacion": "Volverá para recibir a los suyos y estar con ellos."
      },
      {
        "pregunta": "¿Cómo describe Hechos su regreso?",
        "referencia": "Hechos 1:9-11",
        "explicacion": "Los ángeles anunciaron que Jesús volverá de manera correspondiente a su ascensión."
      },
      {
        "pregunta": "¿Qué dice Apocalipsis de su manifestación?",
        "referencia": "Apocalipsis 1:7",
        "explicacion": "Presenta su venida como un acontecimiento visible y universal."
      },
      {
        "pregunta": "¿Qué sucede con los creyentes muertos en Cristo?",
        "referencia": "1 Tesalonicenses 4:16-17",
        "explicacion": "Resucitarán primero y, junto con los creyentes vivos, se reunirán con el Señor."
      },
      {
        "pregunta": "¿Cómo debemos prepararnos?",
        "referencia": "Mateo 24:42-44",
        "explicacion": "La vigilancia significa fidelidad cotidiana, no fijar fechas."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué prometió Jesús a sus discípulos?",
        "opciones": [
          "Volver para reunir a los suyos",
          "Abandonar definitivamente la tierra",
          "Enviar un nuevo evangelio"
        ],
        "correcta": 0,
        "explicacion": "Volverá para recibir a los suyos y estar con ellos."
      },
      {
        "pregunta": "¿Cómo describe Hechos su regreso?",
        "opciones": [
          "Como el mismo Jesús que ascendió",
          "Como un gobernante humano",
          "Solo como un recuerdo"
        ],
        "correcta": 0,
        "explicacion": "Los ángeles anunciaron que Jesús volverá de manera correspondiente a su ascensión."
      },
      {
        "pregunta": "¿Qué dice Apocalipsis de su manifestación?",
        "opciones": [
          "Todo ojo le verá",
          "Nadie lo percibirá",
          "Solo lo verá un grupo secreto"
        ],
        "correcta": 0,
        "explicacion": "Presenta su venida como un acontecimiento visible y universal."
      },
      {
        "pregunta": "¿Qué sucede con los creyentes muertos en Cristo?",
        "opciones": [
          "Resucitarán al venir Cristo",
          "Nunca volverán a vivir",
          "Se convertirán en ángeles"
        ],
        "correcta": 0,
        "explicacion": "Resucitarán primero y, junto con los creyentes vivos, se reunirán con el Señor."
      },
      {
        "pregunta": "¿Cómo debemos prepararnos?",
        "opciones": [
          "Vivir vigilantes y fieles",
          "Calcular una fecha exacta",
          "Abandonar toda responsabilidad"
        ],
        "correcta": 0,
        "explicacion": "La vigilancia significa fidelidad cotidiana, no fijar fechas."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Juan 14:1-3 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La segunda venida de Jesucristo» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la segunda venida de jesucristo. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 5,
    "titulo": "Las señales del regreso de Jesús",
    "textoClave": "Mateo 24:3-14",
    "introduccion": "Jesús describió crisis y engaños, pero advirtió que no debemos confundir cada acontecimiento con una fecha exacta del fin.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué peligro mencionó Jesús primero?",
        "referencia": "Mateo 24:4-5",
        "explicacion": "Advirtió contra quienes engañarían usando su nombre."
      },
      {
        "pregunta": "¿Qué dijo sobre guerras y rumores?",
        "referencia": "Mateo 24:6",
        "explicacion": "No debemos alarmarnos ni concluir que cada conflicto señala inmediatamente el fin."
      },
      {
        "pregunta": "¿Qué sucedería con el amor de muchos?",
        "referencia": "Mateo 24:12",
        "explicacion": "El aumento de la maldad enfriaría el amor de muchos."
      },
      {
        "pregunta": "¿Qué tarea anunció Jesús antes del fin?",
        "referencia": "Mateo 24:14",
        "explicacion": "El evangelio del reino sería anunciado como testimonio a todas las naciones."
      },
      {
        "pregunta": "¿Quién conoce el día y la hora?",
        "referencia": "Mateo 24:36",
        "explicacion": "Jesús enseñó que el momento exacto no está a disposición de los seres humanos."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué peligro mencionó Jesús primero?",
        "opciones": [
          "El engaño religioso",
          "La falta de caminos",
          "La desaparición de ciudades"
        ],
        "correcta": 0,
        "explicacion": "Advirtió contra quienes engañarían usando su nombre."
      },
      {
        "pregunta": "¿Qué dijo sobre guerras y rumores?",
        "opciones": [
          "No alarmarse ni fijar fechas",
          "Concluir que el fin es ese mismo día",
          "Ignorar el sufrimiento humano"
        ],
        "correcta": 0,
        "explicacion": "No debemos alarmarnos ni concluir que cada conflicto señala inmediatamente el fin."
      },
      {
        "pregunta": "¿Qué sucedería con el amor de muchos?",
        "opciones": [
          "Se enfriaría por la maldad",
          "Crecería automáticamente",
          "Dejaría de importar"
        ],
        "correcta": 0,
        "explicacion": "El aumento de la maldad enfriaría el amor de muchos."
      },
      {
        "pregunta": "¿Qué tarea anunció Jesús antes del fin?",
        "opciones": [
          "Proclamar el evangelio",
          "Ocultar las Escrituras",
          "Imponer la fe por fuerza"
        ],
        "correcta": 0,
        "explicacion": "El evangelio del reino sería anunciado como testimonio a todas las naciones."
      },
      {
        "pregunta": "¿Quién conoce el día y la hora?",
        "opciones": [
          "El Padre",
          "Los intérpretes de profecías",
          "Los líderes políticos"
        ],
        "correcta": 0,
        "explicacion": "Jesús enseñó que el momento exacto no está a disposición de los seres humanos."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Mateo 24:3-14 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «Las señales del regreso de Jesús» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre las señales del regreso de jesús. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 6,
    "titulo": "El origen del pecado",
    "textoClave": "1 Juan 3:4",
    "introduccion": "La Biblia describe el pecado como ruptura con la voluntad de Dios. El conflicto moral comienza con la rebelión y afecta a toda la humanidad.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Cómo define Juan el pecado?",
        "referencia": "1 Juan 3:4",
        "explicacion": "Lo relaciona con la transgresión de la ley."
      },
      {
        "pregunta": "¿Qué decisión aparece en Génesis 3?",
        "referencia": "Génesis 3:1-6",
        "explicacion": "La humanidad desobedeció la instrucción divina al confiar en la voz de la serpiente."
      },
      {
        "pregunta": "¿Qué consecuencia universal señala Pablo?",
        "referencia": "Romanos 5:12",
        "explicacion": "Por el pecado entró la muerte al mundo humano."
      },
      {
        "pregunta": "¿Qué revela Apocalipsis sobre el conflicto celestial?",
        "referencia": "Apocalipsis 12:7-9",
        "explicacion": "Describe la lucha de Miguel y sus ángeles contra el dragón, identificado con Satanás."
      },
      {
        "pregunta": "¿Qué esperanza ofrece Dios frente al pecado?",
        "referencia": "Romanos 6:23",
        "explicacion": "Aunque el pecado conduce a la muerte, Dios ofrece vida eterna en Jesucristo."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Cómo define Juan el pecado?",
        "opciones": [
          "Transgresión de la ley",
          "Simple desconocimiento científico",
          "Una emoción pasajera"
        ],
        "correcta": 0,
        "explicacion": "Lo relaciona con la transgresión de la ley."
      },
      {
        "pregunta": "¿Qué decisión aparece en Génesis 3?",
        "opciones": [
          "Desobedecer a Dios",
          "Construir un altar",
          "Salir de Egipto"
        ],
        "correcta": 0,
        "explicacion": "La humanidad desobedeció la instrucción divina al confiar en la voz de la serpiente."
      },
      {
        "pregunta": "¿Qué consecuencia universal señala Pablo?",
        "opciones": [
          "La muerte",
          "La inmortalidad natural",
          "La perfección moral"
        ],
        "correcta": 0,
        "explicacion": "Por el pecado entró la muerte al mundo humano."
      },
      {
        "pregunta": "¿Qué revela Apocalipsis sobre el conflicto celestial?",
        "opciones": [
          "Un conflicto contra Satanás",
          "Una disputa comercial",
          "Una guerra entre reinos humanos"
        ],
        "correcta": 0,
        "explicacion": "Describe la lucha de Miguel y sus ángeles contra el dragón, identificado con Satanás."
      },
      {
        "pregunta": "¿Qué esperanza ofrece Dios frente al pecado?",
        "opciones": [
          "Vida eterna en Cristo",
          "Salvación por riqueza",
          "Inmunidad a toda prueba"
        ],
        "correcta": 0,
        "explicacion": "Aunque el pecado conduce a la muerte, Dios ofrece vida eterna en Jesucristo."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer 1 Juan 3:4 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El origen del pecado» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el origen del pecado. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 7,
    "titulo": "La salvación por medio de Jesucristo",
    "textoClave": "Efesios 2:8-10",
    "introduccion": "Nadie puede comprar su salvación con méritos. La gracia nos recibe por medio de la fe y produce una vida transformada.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Cómo somos salvos según Efesios?",
        "referencia": "Efesios 2:8-9",
        "explicacion": "Por gracia, mediante la fe; la salvación es don de Dios y no motivo de orgullo."
      },
      {
        "pregunta": "¿Qué motivó la entrega del Hijo?",
        "referencia": "Juan 3:16",
        "explicacion": "El amor de Dios por el mundo."
      },
      {
        "pregunta": "¿Quién es el mediador entre Dios y los hombres?",
        "referencia": "1 Timoteo 2:5",
        "explicacion": "Jesucristo es presentado como el único mediador."
      },
      {
        "pregunta": "¿Qué hace Cristo por los pecadores?",
        "referencia": "Romanos 5:8",
        "explicacion": "Murió por nosotros cuando todavía éramos pecadores."
      },
      {
        "pregunta": "¿Para qué fuimos creados en Cristo?",
        "referencia": "Efesios 2:10",
        "explicacion": "Para buenas obras como fruto de la gracia, no como precio de salvación."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Cómo somos salvos según Efesios?",
        "opciones": [
          "Por gracia mediante la fe",
          "Por acumular riquezas",
          "Por linaje familiar"
        ],
        "correcta": 0,
        "explicacion": "Por gracia, mediante la fe; la salvación es don de Dios y no motivo de orgullo."
      },
      {
        "pregunta": "¿Qué motivó la entrega del Hijo?",
        "opciones": [
          "El amor de Dios",
          "El temor de Dios a los hombres",
          "La presión de los gobernantes"
        ],
        "correcta": 0,
        "explicacion": "El amor de Dios por el mundo."
      },
      {
        "pregunta": "¿Quién es el mediador entre Dios y los hombres?",
        "opciones": [
          "Jesucristo",
          "Moisés",
          "El apóstol Pedro"
        ],
        "correcta": 0,
        "explicacion": "Jesucristo es presentado como el único mediador."
      },
      {
        "pregunta": "¿Qué hace Cristo por los pecadores?",
        "opciones": [
          "Murió por nosotros",
          "Esperó que fuéramos perfectos",
          "Nos dejó sin esperanza"
        ],
        "correcta": 0,
        "explicacion": "Murió por nosotros cuando todavía éramos pecadores."
      },
      {
        "pregunta": "¿Para qué fuimos creados en Cristo?",
        "opciones": [
          "Para buenas obras",
          "Para ganar el amor de Dios",
          "Para vivir sin responsabilidad"
        ],
        "correcta": 0,
        "explicacion": "Para buenas obras como fruto de la gracia, no como precio de salvación."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Efesios 2:8-10 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La salvación por medio de Jesucristo» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la salvación por medio de jesucristo. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 8,
    "titulo": "El perdón y el arrepentimiento",
    "textoClave": "Hechos 3:19",
    "introduccion": "El arrepentimiento bíblico implica volver a Dios, reconocer el pecado y recibir su perdón. No es solo sentir culpa.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué llamó Pedro a hacer?",
        "referencia": "Hechos 3:19",
        "explicacion": "Arrepentirse y convertirse para que los pecados sean borrados."
      },
      {
        "pregunta": "¿Qué promete Dios al confesar nuestros pecados?",
        "referencia": "1 Juan 1:9",
        "explicacion": "Perdón y limpieza por su fidelidad y justicia."
      },
      {
        "pregunta": "¿Qué diferencia la tristeza según Dios?",
        "referencia": "2 Corintios 7:10",
        "explicacion": "Produce arrepentimiento que conduce a salvación."
      },
      {
        "pregunta": "¿Qué mostró el hijo pródigo?",
        "referencia": "Lucas 15:17-24",
        "explicacion": "Regresó al padre reconociendo su falta y fue recibido con misericordia."
      },
      {
        "pregunta": "¿Qué enseña Jesús sobre perdonar?",
        "referencia": "Mateo 6:14-15",
        "explicacion": "El perdón recibido debe reflejarse en nuestra disposición a perdonar."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué llamó Pedro a hacer?",
        "opciones": [
          "Arrepentirse y convertirse",
          "Ocultar las faltas",
          "Confiar en la reputación"
        ],
        "correcta": 0,
        "explicacion": "Arrepentirse y convertirse para que los pecados sean borrados."
      },
      {
        "pregunta": "¿Qué promete Dios al confesar nuestros pecados?",
        "opciones": [
          "Perdonar y limpiar",
          "Negar que exista pecado",
          "Impedir toda tentación futura"
        ],
        "correcta": 0,
        "explicacion": "Perdón y limpieza por su fidelidad y justicia."
      },
      {
        "pregunta": "¿Qué diferencia la tristeza según Dios?",
        "opciones": [
          "Conduce al arrepentimiento",
          "Conduce necesariamente a desesperación",
          "Elimina la responsabilidad"
        ],
        "correcta": 0,
        "explicacion": "Produce arrepentimiento que conduce a salvación."
      },
      {
        "pregunta": "¿Qué mostró el hijo pródigo?",
        "opciones": [
          "Regresar humildemente al padre",
          "Justificar su conducta",
          "Exigir su herencia otra vez"
        ],
        "correcta": 0,
        "explicacion": "Regresó al padre reconociendo su falta y fue recibido con misericordia."
      },
      {
        "pregunta": "¿Qué enseña Jesús sobre perdonar?",
        "opciones": [
          "Perdonar a otros",
          "Guardar rencor siempre",
          "Negar el daño causado"
        ],
        "correcta": 0,
        "explicacion": "El perdón recibido debe reflejarse en nuestra disposición a perdonar."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Hechos 3:19 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El perdón y el arrepentimiento» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el perdón y el arrepentimiento. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 9,
    "titulo": "La ley de Dios",
    "textoClave": "Éxodo 20:1-17",
    "introduccion": "Los diez mandamientos expresan principios de amor a Dios y al prójimo. La obediencia no compra salvación: responde a la gracia.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Dónde aparecen los diez mandamientos?",
        "referencia": "Éxodo 20:1-17",
        "explicacion": "En el pacto del Sinaí, pronunciados por Dios a Israel."
      },
      {
        "pregunta": "¿Cómo resumió Jesús la ley?",
        "referencia": "Mateo 22:37-40",
        "explicacion": "En amar a Dios y al prójimo."
      },
      {
        "pregunta": "¿Cómo describe Pablo la ley?",
        "referencia": "Romanos 7:12",
        "explicacion": "La llama santa, justa y buena."
      },
      {
        "pregunta": "¿Qué relación tiene la gracia con el pecado?",
        "referencia": "Romanos 6:1-2",
        "explicacion": "La gracia no es permiso para permanecer voluntariamente en pecado."
      },
      {
        "pregunta": "¿Qué dijo Jesús de guardar sus mandamientos?",
        "referencia": "Juan 14:15",
        "explicacion": "La obediencia surge del amor hacia él."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Dónde aparecen los diez mandamientos?",
        "opciones": [
          "Éxodo 20",
          "Hechos 2",
          "Apocalipsis 22"
        ],
        "correcta": 0,
        "explicacion": "En el pacto del Sinaí, pronunciados por Dios a Israel."
      },
      {
        "pregunta": "¿Cómo resumió Jesús la ley?",
        "opciones": [
          "Amar a Dios y al prójimo",
          "Cumplir rituales sin amor",
          "Evitar toda relación humana"
        ],
        "correcta": 0,
        "explicacion": "En amar a Dios y al prójimo."
      },
      {
        "pregunta": "¿Cómo describe Pablo la ley?",
        "opciones": [
          "Santa, justa y buena",
          "Mala y engañosa",
          "Inútil para mostrar el pecado"
        ],
        "correcta": 0,
        "explicacion": "La llama santa, justa y buena."
      },
      {
        "pregunta": "¿Qué relación tiene la gracia con el pecado?",
        "opciones": [
          "No autoriza perseverar en el pecado",
          "Hace innecesaria toda transformación",
          "Obliga a ganar la salvación"
        ],
        "correcta": 0,
        "explicacion": "La gracia no es permiso para permanecer voluntariamente en pecado."
      },
      {
        "pregunta": "¿Qué dijo Jesús de guardar sus mandamientos?",
        "opciones": [
          "Es expresión de amor",
          "Sustituye la fe",
          "Es solo una tradición humana"
        ],
        "correcta": 0,
        "explicacion": "La obediencia surge del amor hacia él."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Éxodo 20:1-17 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La ley de Dios» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la ley de dios. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 10,
    "titulo": "El sábado, día de reposo",
    "textoClave": "Génesis 2:1-3",
    "introduccion": "El sábado recuerda al Creador y ofrece descanso, adoración y comunión. La tradición adventista lo observa como el séptimo día.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué día bendijo Dios al terminar la creación?",
        "referencia": "Génesis 2:1-3",
        "explicacion": "El séptimo día fue bendecido y santificado."
      },
      {
        "pregunta": "¿Qué recuerda el cuarto mandamiento?",
        "referencia": "Éxodo 20:8-11",
        "explicacion": "El sábado como día santo, vinculado a la creación."
      },
      {
        "pregunta": "¿Qué costumbre tenía Jesús?",
        "referencia": "Lucas 4:16",
        "explicacion": "Asistía a la sinagoga el sábado."
      },
      {
        "pregunta": "¿Para quién fue hecho el sábado?",
        "referencia": "Marcos 2:27",
        "explicacion": "Jesús afirmó que fue hecho por causa del ser humano."
      },
      {
        "pregunta": "¿Qué día menciona el mandamiento?",
        "referencia": "Éxodo 20:10",
        "explicacion": "Identifica expresamente el séptimo día como sábado del Señor."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué día bendijo Dios al terminar la creación?",
        "opciones": [
          "El séptimo día",
          "El primero",
          "El tercero"
        ],
        "correcta": 0,
        "explicacion": "El séptimo día fue bendecido y santificado."
      },
      {
        "pregunta": "¿Qué recuerda el cuarto mandamiento?",
        "opciones": [
          "La creación de Dios",
          "La construcción del templo",
          "La coronación de David"
        ],
        "correcta": 0,
        "explicacion": "El sábado como día santo, vinculado a la creación."
      },
      {
        "pregunta": "¿Qué costumbre tenía Jesús?",
        "opciones": [
          "Asistir a la sinagoga en sábado",
          "Evitar toda enseñanza",
          "Viajar cada sábado a Roma"
        ],
        "correcta": 0,
        "explicacion": "Asistía a la sinagoga el sábado."
      },
      {
        "pregunta": "¿Para quién fue hecho el sábado?",
        "opciones": [
          "Para beneficio del ser humano",
          "Solo para los sacerdotes",
          "Para impedir hacer el bien"
        ],
        "correcta": 0,
        "explicacion": "Jesús afirmó que fue hecho por causa del ser humano."
      },
      {
        "pregunta": "¿Qué día menciona el mandamiento?",
        "opciones": [
          "El séptimo",
          "El primero",
          "El sexto"
        ],
        "correcta": 0,
        "explicacion": "Identifica expresamente el séptimo día como sábado del Señor."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Génesis 2:1-3 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El sábado, día de reposo» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el sábado, día de reposo. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 11,
    "titulo": "Cómo guardar el sábado",
    "textoClave": "Isaías 58:13-14",
    "introduccion": "Guardar el sábado no consiste solo en suspender labores: implica honrar a Dios, descansar, hacer el bien y compartir esperanza.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Cómo invita Isaías a considerar el sábado?",
        "referencia": "Isaías 58:13-14",
        "explicacion": "Como día santo y delicia, honrando al Señor."
      },
      {
        "pregunta": "¿Qué ejemplo dio Jesús en sábado?",
        "referencia": "Mateo 12:9-13",
        "explicacion": "Sanó a una persona y enseñó que es lícito hacer el bien."
      },
      {
        "pregunta": "¿Qué indica el cuarto mandamiento sobre los demás?",
        "referencia": "Éxodo 20:10",
        "explicacion": "El descanso incluye a hijos, trabajadores y extranjeros dentro del hogar."
      },
      {
        "pregunta": "¿Cuándo comienza el sábado en la práctica bíblica adventista?",
        "referencia": "Levítico 23:32",
        "explicacion": "El principio de tarde a tarde fundamenta la observancia desde la puesta del sol del viernes."
      },
      {
        "pregunta": "¿Qué actitud corresponde al día santo?",
        "referencia": "Isaías 58:13",
        "explicacion": "Honrar a Dios sin convertir el día en una rutina egoísta."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Cómo invita Isaías a considerar el sábado?",
        "opciones": [
          "Como delicia y día santo",
          "Como una carga sin sentido",
          "Como un día para explotar a otros"
        ],
        "correcta": 0,
        "explicacion": "Como día santo y delicia, honrando al Señor."
      },
      {
        "pregunta": "¿Qué ejemplo dio Jesús en sábado?",
        "opciones": [
          "Hacer el bien",
          "Prohibir toda misericordia",
          "Buscar conflictos por orgullo"
        ],
        "correcta": 0,
        "explicacion": "Sanó a una persona y enseñó que es lícito hacer el bien."
      },
      {
        "pregunta": "¿Qué indica el cuarto mandamiento sobre los demás?",
        "opciones": [
          "Compartir el descanso",
          "Descansar solo el dueño",
          "Exigir trabajo a todos"
        ],
        "correcta": 0,
        "explicacion": "El descanso incluye a hijos, trabajadores y extranjeros dentro del hogar."
      },
      {
        "pregunta": "¿Cuándo comienza el sábado en la práctica bíblica adventista?",
        "opciones": [
          "Al ponerse el sol del viernes",
          "Al mediodía del domingo",
          "Al amanecer del lunes"
        ],
        "correcta": 0,
        "explicacion": "El principio de tarde a tarde fundamenta la observancia desde la puesta del sol del viernes."
      },
      {
        "pregunta": "¿Qué actitud corresponde al día santo?",
        "opciones": [
          "Buscar comunión con Dios",
          "Usarlo solo para negocios",
          "Ignorar las necesidades ajenas"
        ],
        "correcta": 0,
        "explicacion": "Honrar a Dios sin convertir el día en una rutina egoísta."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Isaías 58:13-14 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «Cómo guardar el sábado» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre cómo guardar el sábado. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 12,
    "titulo": "El estado de los muertos",
    "textoClave": "Eclesiastés 9:5",
    "introduccion": "La esperanza bíblica no descansa en una supuesta inmortalidad inherente del alma, sino en la resurrección que Cristo promete.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué afirma Eclesiastés sobre los muertos?",
        "referencia": "Eclesiastés 9:5",
        "explicacion": "Dice que los muertos nada saben, en contraste con los vivos."
      },
      {
        "pregunta": "¿Con qué comparó Jesús la muerte de Lázaro?",
        "referencia": "Juan 11:11-14",
        "explicacion": "Con un sueño, antes de aclarar que Lázaro había muerto."
      },
      {
        "pregunta": "¿Quién posee inmortalidad por naturaleza?",
        "referencia": "1 Timoteo 6:15-16",
        "explicacion": "El pasaje atribuye inmortalidad a Dios."
      },
      {
        "pregunta": "¿Cuál es la esperanza de quienes murieron en Cristo?",
        "referencia": "1 Tesalonicenses 4:16",
        "explicacion": "La resurrección cuando el Señor vuelva."
      },
      {
        "pregunta": "¿Qué ocurrirá con la muerte al final?",
        "referencia": "Apocalipsis 21:4",
        "explicacion": "Dios promete que ya no habrá muerte ni dolor."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué afirma Eclesiastés sobre los muertos?",
        "opciones": [
          "Que nada saben",
          "Que gobiernan la tierra",
          "Que hablan con todos los vivos"
        ],
        "correcta": 0,
        "explicacion": "Dice que los muertos nada saben, en contraste con los vivos."
      },
      {
        "pregunta": "¿Con qué comparó Jesús la muerte de Lázaro?",
        "opciones": [
          "Con un sueño",
          "Con un viaje comercial",
          "Con una fiesta"
        ],
        "correcta": 0,
        "explicacion": "Con un sueño, antes de aclarar que Lázaro había muerto."
      },
      {
        "pregunta": "¿Quién posee inmortalidad por naturaleza?",
        "opciones": [
          "Dios",
          "Todos los seres humanos",
          "Todos los reyes"
        ],
        "correcta": 0,
        "explicacion": "El pasaje atribuye inmortalidad a Dios."
      },
      {
        "pregunta": "¿Cuál es la esperanza de quienes murieron en Cristo?",
        "opciones": [
          "La resurrección",
          "Reencarnar repetidamente",
          "Volverse omniscientes"
        ],
        "correcta": 0,
        "explicacion": "La resurrección cuando el Señor vuelva."
      },
      {
        "pregunta": "¿Qué ocurrirá con la muerte al final?",
        "opciones": [
          "Será eliminada",
          "Gobernará para siempre",
          "Será necesaria para la vida"
        ],
        "correcta": 0,
        "explicacion": "Dios promete que ya no habrá muerte ni dolor."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Eclesiastés 9:5 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El estado de los muertos» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el estado de los muertos. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 13,
    "titulo": "La resurrección y la vida eterna",
    "textoClave": "Juan 5:28-29",
    "introduccion": "La resurrección revela que la muerte no tiene la última palabra. Cristo promete restauración y vida eterna a quienes confían en él.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Quién se presenta como resurrección y vida?",
        "referencia": "Juan 11:25",
        "explicacion": "Jesús habló así a Marta antes de resucitar a Lázaro."
      },
      {
        "pregunta": "¿Qué anuncia Jesús acerca de los sepulcros?",
        "referencia": "Juan 5:28-29",
        "explicacion": "Los que están en los sepulcros oirán su voz y saldrán."
      },
      {
        "pregunta": "¿Qué acontecimiento fundamenta nuestra esperanza?",
        "referencia": "1 Corintios 15:20-22",
        "explicacion": "La resurrección de Cristo es garantía de la esperanza cristiana."
      },
      {
        "pregunta": "¿Qué se vestirá de inmortalidad?",
        "referencia": "1 Corintios 15:51-54",
        "explicacion": "En la resurrección, lo mortal será transformado."
      },
      {
        "pregunta": "¿Qué ofrece Dios en Cristo?",
        "referencia": "Romanos 6:23",
        "explicacion": "La vida eterna como regalo de Dios."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Quién se presenta como resurrección y vida?",
        "opciones": [
          "Jesús",
          "Elías",
          "Nicodemo"
        ],
        "correcta": 0,
        "explicacion": "Jesús habló así a Marta antes de resucitar a Lázaro."
      },
      {
        "pregunta": "¿Qué anuncia Jesús acerca de los sepulcros?",
        "opciones": [
          "Oirán su voz y saldrán",
          "Permanecerán olvidados por Dios",
          "Serán todos ángeles"
        ],
        "correcta": 0,
        "explicacion": "Los que están en los sepulcros oirán su voz y saldrán."
      },
      {
        "pregunta": "¿Qué acontecimiento fundamenta nuestra esperanza?",
        "opciones": [
          "La resurrección de Cristo",
          "La riqueza de Salomón",
          "La caída de Jericó"
        ],
        "correcta": 0,
        "explicacion": "La resurrección de Cristo es garantía de la esperanza cristiana."
      },
      {
        "pregunta": "¿Qué se vestirá de inmortalidad?",
        "opciones": [
          "Lo mortal transformado",
          "Los edificios de Jerusalén",
          "Las antiguas monedas"
        ],
        "correcta": 0,
        "explicacion": "En la resurrección, lo mortal será transformado."
      },
      {
        "pregunta": "¿Qué ofrece Dios en Cristo?",
        "opciones": [
          "Vida eterna",
          "Ausencia de decisiones",
          "Poder político"
        ],
        "correcta": 0,
        "explicacion": "La vida eterna como regalo de Dios."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Juan 5:28-29 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La resurrección y la vida eterna» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la resurrección y la vida eterna. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 14,
    "titulo": "El santuario celestial",
    "textoClave": "Hebreos 8:1-2",
    "introduccion": "El santuario ayuda a comprender el ministerio de Jesús como nuestro sumo sacerdote. El centro de la esperanza es Cristo, no un edificio.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Dónde ministra Cristo según Hebreos?",
        "referencia": "Hebreos 8:1-2",
        "explicacion": "En el verdadero tabernáculo celestial, como sumo sacerdote."
      },
      {
        "pregunta": "¿A quién señala el sacrificio del cordero?",
        "referencia": "Juan 1:29",
        "explicacion": "Juan identifica a Jesús como el Cordero de Dios que quita el pecado."
      },
      {
        "pregunta": "¿Qué hace Jesús por los que se acercan a Dios?",
        "referencia": "Hebreos 7:25",
        "explicacion": "Vive para interceder por ellos y puede salvar completamente."
      },
      {
        "pregunta": "¿Qué permite la obra de Cristo?",
        "referencia": "Hebreos 4:14-16",
        "explicacion": "Acercarnos con confianza al trono de la gracia para recibir misericordia."
      },
      {
        "pregunta": "¿Qué relación existe entre el santuario terrenal y el celestial?",
        "referencia": "Hebreos 8:5",
        "explicacion": "El servicio terrenal era figura y sombra de las realidades celestiales."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Dónde ministra Cristo según Hebreos?",
        "opciones": [
          "En el santuario celestial",
          "En un templo romano",
          "En el palacio de Herodes"
        ],
        "correcta": 0,
        "explicacion": "En el verdadero tabernáculo celestial, como sumo sacerdote."
      },
      {
        "pregunta": "¿A quién señala el sacrificio del cordero?",
        "opciones": [
          "A Jesucristo",
          "A Aarón",
          "A David"
        ],
        "correcta": 0,
        "explicacion": "Juan identifica a Jesús como el Cordero de Dios que quita el pecado."
      },
      {
        "pregunta": "¿Qué hace Jesús por los que se acercan a Dios?",
        "opciones": [
          "Intercede por ellos",
          "Los rechaza sin escucharlos",
          "Les exige comprar el perdón"
        ],
        "correcta": 0,
        "explicacion": "Vive para interceder por ellos y puede salvar completamente."
      },
      {
        "pregunta": "¿Qué permite la obra de Cristo?",
        "opciones": [
          "Acercarnos confiadamente a Dios",
          "Evitar toda oración",
          "Confiar solo en ritos humanos"
        ],
        "correcta": 0,
        "explicacion": "Acercarnos con confianza al trono de la gracia para recibir misericordia."
      },
      {
        "pregunta": "¿Qué relación existe entre el santuario terrenal y el celestial?",
        "opciones": [
          "Era figura y sombra",
          "Era superior a Cristo",
          "No tenía enseñanza espiritual"
        ],
        "correcta": 0,
        "explicacion": "El servicio terrenal era figura y sombra de las realidades celestiales."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Hebreos 8:1-2 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El santuario celestial» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el santuario celestial. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 15,
    "titulo": "El juicio investigador",
    "textoClave": "Daniel 7:9-10",
    "introduccion": "En la comprensión adventista, el juicio previo al regreso de Cristo manifiesta la justicia de Dios y la realidad de su gracia. El juicio no sustituye al Salvador.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué escena describe Daniel 7?",
        "referencia": "Daniel 7:9-10",
        "explicacion": "Un tribunal celestial con libros abiertos."
      },
      {
        "pregunta": "¿Qué afirma Eclesiastés sobre las obras humanas?",
        "referencia": "Eclesiastés 12:14",
        "explicacion": "Dios traerá toda obra a juicio, incluso lo oculto."
      },
      {
        "pregunta": "¿Quién es nuestro abogado ante el Padre?",
        "referencia": "1 Juan 2:1",
        "explicacion": "Jesucristo el justo es presentado como abogado de los creyentes."
      },
      {
        "pregunta": "¿Qué proclama el primer ángel?",
        "referencia": "Apocalipsis 14:6-7",
        "explicacion": "Anuncia que ha llegado la hora del juicio de Dios e invita a adorarlo."
      },
      {
        "pregunta": "¿Qué seguridad ofrece Romanos 8:1?",
        "referencia": "Romanos 8:1",
        "explicacion": "No hay condenación para quienes están en Cristo Jesús."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué escena describe Daniel 7?",
        "opciones": [
          "Un juicio celestial",
          "Una batalla naval",
          "Una ceremonia matrimonial"
        ],
        "correcta": 0,
        "explicacion": "Un tribunal celestial con libros abiertos."
      },
      {
        "pregunta": "¿Qué afirma Eclesiastés sobre las obras humanas?",
        "opciones": [
          "Serán consideradas en juicio",
          "No tienen valor moral",
          "Se olvidan automáticamente"
        ],
        "correcta": 0,
        "explicacion": "Dios traerá toda obra a juicio, incluso lo oculto."
      },
      {
        "pregunta": "¿Quién es nuestro abogado ante el Padre?",
        "opciones": [
          "Jesucristo",
          "El emperador",
          "El profeta Samuel"
        ],
        "correcta": 0,
        "explicacion": "Jesucristo el justo es presentado como abogado de los creyentes."
      },
      {
        "pregunta": "¿Qué proclama el primer ángel?",
        "opciones": [
          "La hora del juicio de Dios",
          "El fin de toda adoración",
          "La coronación de Roma"
        ],
        "correcta": 0,
        "explicacion": "Anuncia que ha llegado la hora del juicio de Dios e invita a adorarlo."
      },
      {
        "pregunta": "¿Qué seguridad ofrece Romanos 8:1?",
        "opciones": [
          "No hay condenación en Cristo",
          "No hace falta la gracia",
          "La fe nunca transforma"
        ],
        "correcta": 0,
        "explicacion": "No hay condenación para quienes están en Cristo Jesús."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Daniel 7:9-10 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El juicio investigador» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el juicio investigador. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 16,
    "titulo": "Las profecías de Daniel",
    "textoClave": "Daniel 2:44",
    "introduccion": "Daniel presenta la historia humana bajo la soberanía divina. Sus visiones llaman a confiar en el reino eterno de Dios y a interpretar con humildad.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué vio Nabucodonosor en su sueño?",
        "referencia": "Daniel 2:31-35",
        "explicacion": "Una gran estatua de diversos materiales y una piedra que la destruyó."
      },
      {
        "pregunta": "¿Qué representaba la cabeza de oro?",
        "referencia": "Daniel 2:37-38",
        "explicacion": "Daniel identificó al rey y su reino, Babilonia."
      },
      {
        "pregunta": "¿Qué sucedería después de Babilonia?",
        "referencia": "Daniel 2:39",
        "explicacion": "Se levantaría otro reino inferior, seguido de otros."
      },
      {
        "pregunta": "¿Qué hará Dios según Daniel 2:44?",
        "referencia": "Daniel 2:44",
        "explicacion": "Establecerá un reino que nunca será destruido."
      },
      {
        "pregunta": "¿Qué actitud conviene al estudiar profecía?",
        "referencia": "Daniel 2:27-28",
        "explicacion": "Daniel atribuyó a Dios la revelación de los misterios, no a su propia superioridad."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué vio Nabucodonosor en su sueño?",
        "opciones": [
          "Una estatua y una piedra",
          "Siete lámparas",
          "Un barco de guerra"
        ],
        "correcta": 0,
        "explicacion": "Una gran estatua de diversos materiales y una piedra que la destruyó."
      },
      {
        "pregunta": "¿Qué representaba la cabeza de oro?",
        "opciones": [
          "Babilonia",
          "Egipto",
          "Israel"
        ],
        "correcta": 0,
        "explicacion": "Daniel identificó al rey y su reino, Babilonia."
      },
      {
        "pregunta": "¿Qué sucedería después de Babilonia?",
        "opciones": [
          "Vendrían otros reinos",
          "Se acabaría inmediatamente la historia",
          "Volvería el Edén en ese momento"
        ],
        "correcta": 0,
        "explicacion": "Se levantaría otro reino inferior, seguido de otros."
      },
      {
        "pregunta": "¿Qué hará Dios según Daniel 2:44?",
        "opciones": [
          "Establecer un reino eterno",
          "Restaurar Babilonia",
          "Suprimir toda justicia"
        ],
        "correcta": 0,
        "explicacion": "Establecerá un reino que nunca será destruido."
      },
      {
        "pregunta": "¿Qué actitud conviene al estudiar profecía?",
        "opciones": [
          "Humildad y dependencia de Dios",
          "Orgullo por saber fechas",
          "Desprecio por otras personas"
        ],
        "correcta": 0,
        "explicacion": "Daniel atribuyó a Dios la revelación de los misterios, no a su propia superioridad."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Daniel 2:44 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «Las profecías de Daniel» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre las profecías de daniel. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 17,
    "titulo": "Los mensajes de los tres ángeles",
    "textoClave": "Apocalipsis 14:6-12",
    "introduccion": "Los mensajes de Apocalipsis 14 llaman al mundo a adorar al Creador, permanecer fiel a Cristo y discernir los sistemas que se oponen a Dios.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué anuncia el primer ángel?",
        "referencia": "Apocalipsis 14:6-7",
        "explicacion": "El evangelio eterno, el juicio y la adoración al Creador."
      },
      {
        "pregunta": "¿Qué anuncia el segundo ángel?",
        "referencia": "Apocalipsis 14:8",
        "explicacion": "La caída de Babilonia como símbolo de corrupción religiosa."
      },
      {
        "pregunta": "¿Sobre qué advierte el tercer ángel?",
        "referencia": "Apocalipsis 14:9-11",
        "explicacion": "Contra la adoración de la bestia y la recepción de su marca."
      },
      {
        "pregunta": "¿Cómo describe el pasaje a los santos?",
        "referencia": "Apocalipsis 14:12",
        "explicacion": "Guardan los mandamientos de Dios y la fe de Jesús."
      },
      {
        "pregunta": "¿Cuál es el tono central de la proclamación?",
        "referencia": "Apocalipsis 14:6",
        "explicacion": "Comienza con el evangelio eterno destinado a toda nación."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué anuncia el primer ángel?",
        "opciones": [
          "El evangelio eterno y la adoración",
          "Una nueva religión sin Cristo",
          "La superioridad de una nación"
        ],
        "correcta": 0,
        "explicacion": "El evangelio eterno, el juicio y la adoración al Creador."
      },
      {
        "pregunta": "¿Qué anuncia el segundo ángel?",
        "opciones": [
          "La caída de Babilonia",
          "La destrucción del Edén",
          "El nacimiento de Moisés"
        ],
        "correcta": 0,
        "explicacion": "La caída de Babilonia como símbolo de corrupción religiosa."
      },
      {
        "pregunta": "¿Sobre qué advierte el tercer ángel?",
        "opciones": [
          "La adoración de la bestia",
          "El estudio de las Escrituras",
          "La misericordia de Jesús"
        ],
        "correcta": 0,
        "explicacion": "Contra la adoración de la bestia y la recepción de su marca."
      },
      {
        "pregunta": "¿Cómo describe el pasaje a los santos?",
        "opciones": [
          "Guardan mandamientos y fe de Jesús",
          "Confían solo en poder humano",
          "Rechazan toda perseverancia"
        ],
        "correcta": 0,
        "explicacion": "Guardan los mandamientos de Dios y la fe de Jesús."
      },
      {
        "pregunta": "¿Cuál es el tono central de la proclamación?",
        "opciones": [
          "El evangelio eterno",
          "El miedo sin esperanza",
          "La violencia religiosa"
        ],
        "correcta": 0,
        "explicacion": "Comienza con el evangelio eterno destinado a toda nación."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Apocalipsis 14:6-12 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «Los mensajes de los tres ángeles» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre los mensajes de los tres ángeles. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 18,
    "titulo": "El bautismo bíblico",
    "textoClave": "Mateo 28:19-20",
    "introduccion": "El bautismo es respuesta pública de fe y arrepentimiento. Representa nuestra unión con Cristo en su muerte y resurrección.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Qué ordenó Jesús a sus discípulos?",
        "referencia": "Mateo 28:19-20",
        "explicacion": "Hacer discípulos, bautizar y enseñar a guardar sus mandamientos."
      },
      {
        "pregunta": "¿Qué precedió al bautismo en Pentecostés?",
        "referencia": "Hechos 2:37-38",
        "explicacion": "El llamado al arrepentimiento y la respuesta de fe."
      },
      {
        "pregunta": "¿Qué simboliza el bautismo según Romanos 6?",
        "referencia": "Romanos 6:3-4",
        "explicacion": "Participar simbólicamente de la muerte y resurrección de Cristo para andar en vida nueva."
      },
      {
        "pregunta": "¿Qué ocurrió con el etíope al comprender el evangelio?",
        "referencia": "Hechos 8:35-39",
        "explicacion": "Respondió al anuncio de Jesús y fue bautizado."
      },
      {
        "pregunta": "¿Qué importancia tiene la fe?",
        "referencia": "Marcos 16:16",
        "explicacion": "Jesús relacionó creer y bautizarse en la respuesta al evangelio."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Qué ordenó Jesús a sus discípulos?",
        "opciones": [
          "Hacer discípulos y bautizar",
          "Obligar a todos por fuerza",
          "Suspender toda enseñanza"
        ],
        "correcta": 0,
        "explicacion": "Hacer discípulos, bautizar y enseñar a guardar sus mandamientos."
      },
      {
        "pregunta": "¿Qué precedió al bautismo en Pentecostés?",
        "opciones": [
          "El arrepentimiento",
          "La compra de un permiso",
          "Un requisito de riqueza"
        ],
        "correcta": 0,
        "explicacion": "El llamado al arrepentimiento y la respuesta de fe."
      },
      {
        "pregunta": "¿Qué simboliza el bautismo según Romanos 6?",
        "opciones": [
          "Muerte al pecado y vida nueva",
          "Inmunidad frente al sufrimiento",
          "Ingreso a una familia política"
        ],
        "correcta": 0,
        "explicacion": "Participar simbólicamente de la muerte y resurrección de Cristo para andar en vida nueva."
      },
      {
        "pregunta": "¿Qué ocurrió con el etíope al comprender el evangelio?",
        "opciones": [
          "Fue bautizado",
          "Fue nombrado rey",
          "Construyó un templo"
        ],
        "correcta": 0,
        "explicacion": "Respondió al anuncio de Jesús y fue bautizado."
      },
      {
        "pregunta": "¿Qué importancia tiene la fe?",
        "opciones": [
          "Responder con fe",
          "Imitar sin comprender",
          "Confiar en un rito sin Cristo"
        ],
        "correcta": 0,
        "explicacion": "Jesús relacionó creer y bautizarse en la respuesta al evangelio."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Mateo 28:19-20 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «El bautismo bíblico» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre el bautismo bíblico. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 19,
    "titulo": "La vida cristiana y la salud",
    "textoClave": "1 Corintios 6:19-20",
    "introduccion": "Cuidar el cuerpo es una forma de mayordomía cristiana. La salud no es medida del valor espiritual de una persona ni garantía de ausencia de enfermedad.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Cómo describe Pablo el cuerpo del creyente?",
        "referencia": "1 Corintios 6:19-20",
        "explicacion": "Como templo del Espíritu Santo, llamado a glorificar a Dios."
      },
      {
        "pregunta": "¿Qué principio propone Pablo para comer y beber?",
        "referencia": "1 Corintios 10:31",
        "explicacion": "Hacerlo todo para la gloria de Dios."
      },
      {
        "pregunta": "¿Qué equilibrio muestra el descanso de Jesús?",
        "referencia": "Marcos 6:31",
        "explicacion": "Invitó a sus discípulos a apartarse y descansar un poco."
      },
      {
        "pregunta": "¿Cómo se relacionan fe y servicio?",
        "referencia": "Gálatas 5:13",
        "explicacion": "La libertad cristiana se expresa en servir por amor."
      },
      {
        "pregunta": "¿Qué actitud conviene frente a una persona enferma?",
        "referencia": "Mateo 25:36",
        "explicacion": "Jesús valora el cuidado y la visita a quien está enfermo."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Cómo describe Pablo el cuerpo del creyente?",
        "opciones": [
          "Templo del Espíritu Santo",
          "Objeto sin valor",
          "Propiedad del Estado"
        ],
        "correcta": 0,
        "explicacion": "Como templo del Espíritu Santo, llamado a glorificar a Dios."
      },
      {
        "pregunta": "¿Qué principio propone Pablo para comer y beber?",
        "opciones": [
          "Hacerlo para gloria de Dios",
          "Comer sin consideración alguna",
          "Buscar prestigio personal"
        ],
        "correcta": 0,
        "explicacion": "Hacerlo todo para la gloria de Dios."
      },
      {
        "pregunta": "¿Qué equilibrio muestra el descanso de Jesús?",
        "opciones": [
          "Dar lugar al descanso",
          "Evitar todo descanso",
          "Trabajar sin límite"
        ],
        "correcta": 0,
        "explicacion": "Invitó a sus discípulos a apartarse y descansar un poco."
      },
      {
        "pregunta": "¿Cómo se relacionan fe y servicio?",
        "opciones": [
          "Servir por amor",
          "Desentenderse del prójimo",
          "Imponer hábitos por fuerza"
        ],
        "correcta": 0,
        "explicacion": "La libertad cristiana se expresa en servir por amor."
      },
      {
        "pregunta": "¿Qué actitud conviene frente a una persona enferma?",
        "opciones": [
          "Acompañarla y cuidarla",
          "Culparla por enfermar",
          "Prometer curación inmediata"
        ],
        "correcta": 0,
        "explicacion": "Jesús valora el cuidado y la visita a quien está enfermo."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer 1 Corintios 6:19-20 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La vida cristiana y la salud» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la vida cristiana y la salud. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  },
  {
    "numero": 20,
    "titulo": "La iglesia de Cristo y nuestra decisión",
    "textoClave": "Apocalipsis 12:17",
    "introduccion": "Dios llama a formar parte de una comunidad que sigue a Jesús, estudia su Palabra y sirve al mundo. La decisión de fe debe ser libre y consciente.",
    "preguntasBiblicas": [
      {
        "pregunta": "¿Quién es la cabeza de la iglesia?",
        "referencia": "Efesios 5:23",
        "explicacion": "Cristo es presentado como cabeza de la iglesia."
      },
      {
        "pregunta": "¿Cómo describe Hechos a la comunidad cristiana?",
        "referencia": "Hechos 2:42-47",
        "explicacion": "Perseveraba en enseñanza, comunión, oración y ayuda mutua."
      },
      {
        "pregunta": "¿Qué rasgos menciona Apocalipsis 12:17?",
        "referencia": "Apocalipsis 12:17",
        "explicacion": "Guardar los mandamientos de Dios y tener el testimonio de Jesús."
      },
      {
        "pregunta": "¿Qué misión recibió la iglesia?",
        "referencia": "Mateo 28:19-20",
        "explicacion": "Hacer discípulos de todas las naciones y enseñar las palabras de Jesús."
      },
      {
        "pregunta": "¿Qué invitación hace Jesús?",
        "referencia": "Apocalipsis 3:20",
        "explicacion": "Llama a abrirle la puerta para tener comunión con él."
      }
    ],
    "evaluacion": [
      {
        "pregunta": "¿Quién es la cabeza de la iglesia?",
        "opciones": [
          "Jesucristo",
          "El emperador",
          "El rey David"
        ],
        "correcta": 0,
        "explicacion": "Cristo es presentado como cabeza de la iglesia."
      },
      {
        "pregunta": "¿Cómo describe Hechos a la comunidad cristiana?",
        "opciones": [
          "En enseñanza y comunión",
          "En aislamiento voluntario",
          "En rivalidad constante"
        ],
        "correcta": 0,
        "explicacion": "Perseveraba en enseñanza, comunión, oración y ayuda mutua."
      },
      {
        "pregunta": "¿Qué rasgos menciona Apocalipsis 12:17?",
        "opciones": [
          "Mandamientos de Dios y testimonio de Jesús",
          "Poder militar y riqueza",
          "Un idioma obligatorio"
        ],
        "correcta": 0,
        "explicacion": "Guardar los mandamientos de Dios y tener el testimonio de Jesús."
      },
      {
        "pregunta": "¿Qué misión recibió la iglesia?",
        "opciones": [
          "Hacer discípulos",
          "Buscar dominio político",
          "Excluir a quien pregunta"
        ],
        "correcta": 0,
        "explicacion": "Hacer discípulos de todas las naciones y enseñar las palabras de Jesús."
      },
      {
        "pregunta": "¿Qué invitación hace Jesús?",
        "opciones": [
          "Abrirle el corazón",
          "Posponer toda decisión para siempre",
          "Obedecer por amenaza humana"
        ],
        "correcta": 0,
        "explicacion": "Llama a abrirle la puerta para tener comunión con él."
      }
    ],
    "aplicacion": "Esta semana dedica tiempo a leer Apocalipsis 12:17 en su contexto. Pregúntate qué revela acerca de Dios, qué enseña sobre Jesucristo y qué cambio concreto puedes practicar en tu vida. Comparte lo aprendido con respeto y amor.",
    "llamado": "¿Deseas responder a la enseñanza de «La iglesia de Cristo y nuestra decisión» con fe, oración y una decisión práctica de seguir a Jesús?",
    "oracion": "Padre celestial, gracias por tu Palabra. Ayúdame a comprender y vivir la verdad que he estudiado sobre la iglesia de cristo y nuestra decisión. Fortalece mi fe en Jesucristo y guíame por tu Espíritu Santo. Amén."
  }
];

function progresoLocalLeccion(numero) {
    try { return JSON.parse(localStorage.getItem('luz_estudio_' + numero) || '{}'); }
    catch { return {}; }
}
function guardarProgresoLocalLeccion(numero, datos) {
    try { localStorage.setItem('luz_estudio_' + numero, JSON.stringify(datos)); return true; }
    catch { alert('No se pudo guardar en este navegador.'); return false; }
}
function elementoEstudio(etiqueta, contenido, clase) {
    const el = document.createElement(etiqueta);
    if (contenido !== undefined) el.textContent = contenido;
    if (clase) el.className = clase;
    return el;
}
function crearBotonEstudio(titulo, accion, secundario = false) {
    const b = elementoEstudio('button', titulo);
    b.type = 'button';
    if (secundario) b.className = 'secondary';
    b.addEventListener('click', accion);
    return b;
}
function renderizarListaLecciones() {
    const lista = document.getElementById('listaLecciones');
    if (!lista) return;
    lista.replaceChildren();
    actualizarProgresoCurso();
    const primera = elementoEstudio('div', undefined, 'card');
    primera.append(elementoEstudio('h3', '01. Lo que la Biblia enseña acerca de Dios'));
    if (leccionCompletada(1)) primera.append(elementoEstudio('p', '✓ Completada', 'muted'));
    primera.append(crearBotonEstudio(leccionCompletada(1) ? 'Repasar lección' : 'Comenzar estudio', () => abrirLeccion(1)));
    lista.append(primera);
    for (const l of LECCIONES_2_A_20) {
        const card = elementoEstudio('div', undefined, 'card');
        card.append(elementoEstudio('h3', String(l.numero).padStart(2, '0') + '. ' + l.titulo));
        const guardado = progresoLocalLeccion(l.numero);
        if (guardado.completado) card.append(elementoEstudio('p', '✓ Completada', 'muted'));
        const disponible = leccionCompletada(l.numero - 1);
        const boton = crearBotonEstudio(guardado.completado ? 'Repasar lección' : disponible ? 'Comenzar estudio' : '🔒 Completa el estudio anterior', () => abrirLeccion(l.numero));
        boton.disabled = !disponible;
        card.append(boton);
        lista.append(card);
    }
}

/* Textos biblicos incluidos desde el EPUB Reina-Valera 1909 facilitado por el usuario.
   No se necesita internet ni servicio externo para leer los pasajes. */
const TEXTOS_BIBLICOS_OFFLINE = {
  "1 Corintios 10:31": "1 Corintios 10:31 — Reina-Valera 1909\n\n31. Si pues coméis, ó bebéis, ó hacéis otra cosa, haced lo todo á gloria de Dios.",
  "1 Corintios 15:20-22": "1 Corintios 15:20-22 — Reina-Valera 1909\n\n20. Mas ahora Cristo ha resucitado de los muertos; primicias de los que durmieron es hecho.\n21. Porque por cuanto la muerte entró por un hombre, también por un hombre la resurrección de los muertos.\n22. Porque así como en Adam todos mueren, así también en Cristo todos serán vivificados.",
  "1 Corintios 15:51-54": "1 Corintios 15:51-54 — Reina-Valera 1909\n\n51. He aquí, os digo un misterio: Todos ciertamente no dormiremos, mas todos seremos transformados,\n52. En un momento, en un abrir de ojo, á la final trompeta; porque será tocada la trompeta, y los muertos serán levantados sin corrupción, y nosotros seremos transformados.\n53. Porque es menester que esto corruptible sea vestido de incorrupción, y esto mortal sea vestido de inmortalidad.\n54. Y cuando esto corruptible fuere vestido de incorrupción, y esto mortal fuere vestido de inmortalidad, entonces se efectuará la palabra que está escrita: Sorbida es la muerte con victoria.",
  "1 Corintios 6:19-20": "1 Corintios 6:19-20 — Reina-Valera 1909\n\n19. ¿O ignoráis que vuestro cuerpo es templo del Espíritu Santo, el cual está en vosotros, el cual tenéis de Dios, y que no sois vuestros?\n20. Porque comprados sois por precio: glorificad pues á Dios en vuestro cuerpo y en vuestro espíritu, los cuales son de Dios.",
  "1 Juan 1:9": "1 Juan 1:9 — Reina-Valera 1909\n\n9. Si confesamos nuestros pecados, él es fiel y justo para que nos perdone nuestros pecados, y nos limpie de toda maldad.",
  "1 Juan 2:1": "1 Juan 2:1 — Reina-Valera 1909\n\n1. HIJITOS míos, estas cosas os escribo, para que no pequéis; y si alguno hubiere pecado, abogado tenemos para con el Padre, á Jesucristo el justo;",
  "1 Juan 3:4": "1 Juan 3:4 — Reina-Valera 1909\n\n4. Cualquiera que hace pecado, traspasa también la ley; pues el pecado es transgresión de la ley.",
  "1 Juan 5:14": "1 Juan 5:14 — Reina-Valera 1909\n\n14. Y esta es la confianza que tenemos en él, que si demandáremos alguna cosa conforme á su voluntad, él nos oye.",
  "1 Tesalonicenses 4:16": "1 Tesalonicenses 4:16 — Reina-Valera 1909\n\n16. Porque el mismo Señor con aclamación, con voz de arcángel, y con trompeta de Dios, descenderá del cielo; y los muertos en Cristo resucitarán primero:",
  "1 Tesalonicenses 4:16-17": "1 Tesalonicenses 4:16-17 — Reina-Valera 1909\n\n16. Porque el mismo Señor con aclamación, con voz de arcángel, y con trompeta de Dios, descenderá del cielo; y los muertos en Cristo resucitarán primero:\n17. Luego nosotros, los que vivimos, los que quedamos, juntamente con ellos seremos arrebatados en las nubes á recibir al Señor en el aire, y así estaremos siempre con el Señor.",
  "1 Timoteo 2:5": "1 Timoteo 2:5 — Reina-Valera 1909\n\n5. Porque hay un Dios, asimismo un mediador entre Dios y los hombres, Jesucristo hombre;",
  "1 Timoteo 6:15-16": "1 Timoteo 6:15-16 — Reina-Valera 1909\n\n15. La cual á su tiempo mostrará el Bienaventurado y solo Poderoso, Rey de reyes, y Señor de señores;\n16. Quien sólo tiene inmortalidad, que habita en luz inaccesible; á quien ninguno de los hombres ha visto ni puede ver: al cual sea la honra y el imperio sempiterno. Amén.",
  "2 Corintios 7:10": "2 Corintios 7:10 — Reina-Valera 1909\n\n10. Porque el dolor que es según Dios, obra arrepentimiento saludable, de que no hay que arrepentirse; mas el dolor del siglo obra muerte.",
  "2 Pedro 1:21": "2 Pedro 1:21 — Reina-Valera 1909\n\n21. Porque la profecía no fué en los tiempos pasados traída por voluntad humana, sino los santos hombres de Dios hablaron siendo inspirados del Espíritu Santo.",
  "2 Timoteo 3:16": "2 Timoteo 3:16 — Reina-Valera 1909\n\n16. Toda Escritura es inspirada divinamente y útil para enseñar, para redargüir, para corregir, para instituir en justicia,",
  "Apocalipsis 12:17": "Apocalipsis 12:17 — Reina-Valera 1909\n\n17. Entonces el dragón fué airado contra la mujer; y se fué á hacer guerra contra los otros de la simiente de ella, los cuales guardan los mandamientos de Dios, y tienen el testimonio de Jesucristo.",
  "Apocalipsis 12:7-9": "Apocalipsis 12:7-9 — Reina-Valera 1909\n\n7. Y fué hecha una grande batalla en el cielo: Miguel y sus ángeles lidiaban contra el dragón; y lidiaba el dragón y sus ángeles,\n8. Y no prevalecieron, ni su lugar fué más hallado en el cielo.\n9. Y fué lanzado fuera aquel gran dragón, la serpiente antigua, que se llama Diablo y Satanás, el cual engaña á todo el mundo; fué arrojado en tierra, y sus ángeles fueron arrojados con él.",
  "Apocalipsis 14:12": "Apocalipsis 14:12 — Reina-Valera 1909\n\n12. Aquí está la paciencia de los santos; aquí están los que guardan los mandamientos de Dios, y la fe de Jesús.",
  "Apocalipsis 14:6": "Apocalipsis 14:6 — Reina-Valera 1909\n\n6. Y vi otro ángel volar por en medio del cielo, que tenía el evangelio eterno para predicarlo á los que moran en la tierra, y á toda nación y tribu y lengua y pueblo,",
  "Apocalipsis 14:6-7": "Apocalipsis 14:6-7 — Reina-Valera 1909\n\n6. Y vi otro ángel volar por en medio del cielo, que tenía el evangelio eterno para predicarlo á los que moran en la tierra, y á toda nación y tribu y lengua y pueblo,\n7. Diciendo en alta voz: Temed á Dios, y dadle honra; porque la hora de su juicio es venida; y adorad á aquel que ha hecho el cielo y la tierra y el mar y las fuentes de las aguas.",
  "Apocalipsis 14:8": "Apocalipsis 14:8 — Reina-Valera 1909\n\n8. Y otro ángel le siguió, diciendo: Ha caído, ha caído Babilonia, aquella grande ciudad, porque ella ha dado á beber á todas las naciones del vino del furor de su fornicación.",
  "Apocalipsis 14:9-11": "Apocalipsis 14:9-11 — Reina-Valera 1909\n\n9. Y el tercer ángel los siguió, diciendo en alta voz: Si alguno adora á la bestia y á su imagen, y toma la señal en su frente, ó en su mano,\n10. Este también beberá del vino de la ira de Dios, el cual está echado puro en el cáliz de su ira; y será atormentado con fuego y azufre delante de los santos ángeles, y delante del Cordero:\n11. Y el humo del tormento de ellos sube para siempre jamás. Y los que adoran á la bestia y á su imagen, no tienen reposo día ni noche, ni cualquiera que tomare la señal de su nombre.",
  "Apocalipsis 1:7": "Apocalipsis 1:7 — Reina-Valera 1909\n\n7. He aquí que viene con las nubes, y todo ojo le verá, y los que le traspasaron; y todos los linajes de la tierra se lamentarán sobre él. Así sea. Amén.",
  "Apocalipsis 21:4": "Apocalipsis 21:4 — Reina-Valera 1909\n\n4. Y limpiará Dios toda lágrima de los ojos de ellos; y la muerte no será más; y no habrá más llanto, ni clamor, ni dolor: porque las primeras cosas son pasadas.",
  "Apocalipsis 3:20": "Apocalipsis 3:20 — Reina-Valera 1909\n\n20. He aquí, yo estoy á la puerta y llamo: si alguno oyere mi voz y abriere la puerta, entraré á él, y cenaré con él, y él conmigo.",
  "Daniel 2:27-28": "Daniel 2:27-28 — Reina-Valera 1909\n\n27. Daniel respondió delante del rey, y dijo: El misterio que el rey demanda, ni sabios, ni astrólogos, ni magos, ni adivinos lo pueden enseñar al rey.\n28. Mas hay un Dios en los cielos, el cual revela los misterios, y él ha hecho saber al rey Nabucodonosor lo que ha de acontecer á cabo de días. Tu sueño, y las visiones de tu cabeza sobre tu cama, es esto:",
  "Daniel 2:31-35": "Daniel 2:31-35 — Reina-Valera 1909\n\n31. Tú, oh rey, veías, y he aquí una grande imagen. Esta imagen, que era muy grande, y cuya gloria era muy sublime, estaba en pie delante de ti, y su aspecto era terrible.\n32. La cabeza de esta imagen era de fino oro; sus pechos y sus brazos, de plata; su vientre y sus muslos, de metal;\n33. Sus piernas de hierro; sus pies, en parte de hierro, y en parte de barro cocido.\n34. Estabas mirando, hasta que una piedra fué cortada, no con mano, la cual hirió á la imagen en sus pies de hierro y de barro cocido, y los desmenuzó.\n35. Entonces fué también desmenuzado el hierro, el barro cocido, el metal, la plata y el oro, y se tornaron como tamo de las eras del verano: y levantólos el viento, y nunca más se les halló lugar. Mas la piedra que hirió á la imagen, fué hecha un gran monte, que hinchió toda la tierra.",
  "Daniel 2:37-38": "Daniel 2:37-38 — Reina-Valera 1909\n\n37. Tú, oh rey, eres rey de reyes; porque el Dios del cielo te ha dado reino, potencia, y fortaleza, y majestad.\n38. Y todo lo que habitan hijos de hombres, bestias del campo, y aves del cielo, él ha entregado en tu mano, y te ha hecho enseñorear sobre todo ello: tú eres aquella cabeza de oro.",
  "Daniel 2:39": "Daniel 2:39 — Reina-Valera 1909\n\n39. Y después de ti se levantará otro reino menor que tú; y otro tercer reino de metal, el cual se enseñoreará de toda la tierra.",
  "Daniel 2:44": "Daniel 2:44 — Reina-Valera 1909\n\n44. Y en los días de estos reyes, levantará el Dios del cielo un reino que nunca jamás se corromperá: y no será dejado á otro pueblo este reino; el cual desmenuzará y consumirá todos estos reinos, y él permanecerá para siempre.",
  "Daniel 7:9-10": "Daniel 7:9-10 — Reina-Valera 1909\n\n9. Estuve mirando hasta que fueron puestas sillas: y un Anciano de grande edad se sentó, cuyo vestido era blanco como la nieve, y el pelo de su cabeza como lana limpia; su silla llama de fuego, sus ruedas fuego ardiente.\n10. Un río de fuego procedía y salía de delante de él: millares de millares le servían, y millones de millones asistían delante de él: el Juez se sentó, y los libros se abrieron.",
  "Eclesiastés 12:14": "Eclesiastés 12:14 — Reina-Valera 1909\n\n14. Porque Dios traerá toda obra á juicio, el cual se hará sobre toda cosa oculta, buena ó mala.",
  "Eclesiastés 9:5": "Eclesiastés 9:5 — Reina-Valera 1909\n\n5. Porque los que viven saben que han de morir: mas los muertos nada saben, ni tienen más paga; porque su memoria es puesta en olvido.",
  "Efesios 2:10": "Efesios 2:10 — Reina-Valera 1909\n\n10. Porque somos hechura suya, criados en Cristo Jesús para buenas obras, las cuales Dios preparó para que anduviésemos en ellas.",
  "Efesios 2:8-9": "Efesios 2:8-9 — Reina-Valera 1909\n\n8. Porque por gracia sois salvos por la fe; y esto no de vosotros, pues es don de Dios:\n9. No por obras, para que nadie se gloríe.",
  "Efesios 5:23": "Efesios 5:23 — Reina-Valera 1909\n\n23. Porque el marido es cabeza de la mujer, así como Cristo es cabeza de la iglesia; y él es el que da la salud al cuerpo.",
  "Filipenses 4:6-7": "Filipenses 4:6-7 — Reina-Valera 1909\n\n6. Por nada estéis afanosos; sino sean notorias vuestras peticiones delante de Dios en toda oración y ruego, con hacimiento de gracias.\n7. Y la paz de Dios, que sobrepuja todo entendimiento, guardará vuestros corazones y vuestros entendimientos en Cristo Jesús.",
  "Gálatas 5:13": "Gálatas 5:13 — Reina-Valera 1909\n\n13. Porque vosotros, hermanos, á libertad habéis sido llamados; solamente que no uséis la libertad como ocasión á la carne, sino servíos por amor los unos á los otros.",
  "Génesis 2:1-3": "Génesis 2:1-3 — Reina-Valera 1909\n\n1. Y FUERON acabados los cielos y la tierra, y todo su ornamento.\n2. Y acabó Dios en el día séptimo su obra que hizo, y reposó el día séptimo de toda su obra que había hecho.\n3. Y bendijo Dios al día séptimo, y santificólo, porque en él reposó de toda su obra que había Dios criado y hecho.",
  "Génesis 3:1-6": "Génesis 3:1-6 — Reina-Valera 1909\n\n1. EMPERO la serpiente era astuta, más que todos los animales del campo que Jehová Dios había hecho; la cual dijo á la mujer: ¿Conque Dios os ha dicho: No comáis de todo árbol del huerto?\n2. Y la mujer respondió á la serpiente: Del fruto de los árboles del huerto comemos;\n3. Mas del fruto del árbol que está en medio del huerto dijo Dios: No comeréis de él, ni le tocaréis, porque no muráis.\n4. Entonces la serpiente dijo á la mujer: No moriréis;\n5. Mas sabe Dios que el día que comiereis de él, serán abiertos vuestros ojos, y seréis como dioses sabiendo el bien y el mal.\n6. Y vió la mujer que el árbol era bueno para comer, y que era agradable á los ojos, y árbol codiciable para alcanzar la sabiduría; y tomó de su fruto, y comió; y dió también á su marido, el cual comió así como ella.",
  "Hebreos 11:6": "Hebreos 11:6 — Reina-Valera 1909\n\n6. Empero sin fe es imposible agradar á Dios; porque es menester que el que á Dios se allega, crea que le hay, y que es galardonador de los que le buscan.",
  "Hebreos 4:14-16": "Hebreos 4:14-16 — Reina-Valera 1909\n\n14. Por tanto, teniendo un gran Pontífice, que penetró los cielos, Jesús el Hijo de Dios, retengamos nuestra profesión.\n15. Porque no tenemos un Pontífice que no se pueda compadecer de nuestras flaquezas; mas tentado en todo según nuestra semejanza, pero sin pecado.\n16. Lleguémonos pues confiadamente al trono de la gracia, para alcanzar misericordia, y hallar gracia para el oportuno socorro.",
  "Hebreos 7:25": "Hebreos 7:25 — Reina-Valera 1909\n\n25. Por lo cual puede también salvar eternamente á los que por él se allegan á Dios, viviendo siempre para interceder por ellos.",
  "Hebreos 8:1-2": "Hebreos 8:1-2 — Reina-Valera 1909\n\n1. ASÍ que, la suma acerca de lo dicho es : Tenemos tal pontífice que se asentó á la diestra del trono de la Majestad en los cielos;\n2. Ministro del santuario, y de aquel verdadero tabernáculo que el Señor asentó, y no hombre.",
  "Hebreos 8:5": "Hebreos 8:5 — Reina-Valera 1909\n\n5. Los cuales sirven de bosquejo y sombra de las cosas celestiales, como fué respondido á Moisés cuando había de acabar el tabernáculo: Mira, dice, haz todas las cosas conforme al dechado que te ha sido mostrado en el monte.",
  "Hechos 1:9-11": "Hechos 1:9-11 — Reina-Valera 1909\n\n9. Y habiendo dicho estas cosas, viéndo lo ellos, fué alzado; y una nube le recibió y le quitó de sus ojos.\n10. Y estando con los ojos puestos en el cielo, entre tanto que él iba, he aquí dos varones se pusieron junto á ellos en vestidos blancos;\n11. Los cuales también les dijeron: Varones Galileos, ¿qué estáis mirando al cielo? este mismo Jesús que ha sido tomado desde vosotros arriba en el cielo, así vendrá como le habéis visto ir al cielo.",
  "Hechos 2:37-38": "Hechos 2:37-38 — Reina-Valera 1909\n\n37. Entonces oído esto , fueron compungidos de corazón, y dijeron á Pedro y á los otros apóstoles: Varones hermanos, ¿qué haremos?\n38. Y Pedro les dice: Arrepentíos, y bautícese cada uno de vosotros en el nombre de Jesucristo para perdón de los pecados; y recibiréis el don del Espíritu Santo.",
  "Hechos 2:42-47": "Hechos 2:42-47 — Reina-Valera 1909\n\n42. Y perseveraban en la doctrina de los apóstoles, y en la comunión, y en el partimiento del pan, y en las oraciones.\n43. Y toda persona tenía temor: y muchas maravillas y señales eran hechas por los apóstoles.\n44. Y todos los que creían estaban juntos; y tenían todas las cosas comunes;\n45. Y vendían las posesiones, y las haciendas, y repartíanlas á todos, como cada uno había menester.\n46. Y perseverando unánimes cada día en el templo, y partiendo el pan en las casas, comían juntos con alegría y con sencillez de corazón,\n47. Alabando á Dios, y teniendo gracia con todo el pueblo. Y el Señor añadía cada día á la iglesia los que habían de ser salvos.",
  "Hechos 3:19": "Hechos 3:19 — Reina-Valera 1909\n\n19. Así que, arrepentíos y convertíos, para que sean borrados vuestros pecados; pues que vendrán los tiempos del refrigerio de la presencia del Señor,",
  "Hechos 8:35-39": "Hechos 8:35-39 — Reina-Valera 1909\n\n35. Entonces Felipe, abriendo su boca, y comenzando desde esta escritura, le anunció el evangelio de Jesús.\n36. Y yendo por el camino, llegaron á cierta agua; y dijo el eunuco: He aquí agua; ¿qué impide que yo sea bautizado?\n37. Y Felipe dijo: Si crees de todo corazón, bien puedes. Y respondiendo, dijo: Creo que Jesucristo es el Hijo de Dios.\n38. Y mandó parar el carro: y descendieron ambos al agua, Felipe y el eunuco; y bautizóle.\n39. Y como subieron del agua, el Espíritu del Señor arrebató á Felipe; y no le vió más el eunuco, y se fué por su camino gozoso.",
  "Isaías 58:13": "Isaías 58:13 — Reina-Valera 1909\n\n13. Si retrajeres del sábado tu pie, de hacer tu voluntad en mi día santo, y al sábado llamares delicias, santo, glorioso de Jehová; y lo venerares, no haciendo tus caminos, ni buscando tu voluntad, ni hablando tus palabras:",
  "Isaías 58:13-14": "Isaías 58:13-14 — Reina-Valera 1909\n\n13. Si retrajeres del sábado tu pie, de hacer tu voluntad en mi día santo, y al sábado llamares delicias, santo, glorioso de Jehová; y lo venerares, no haciendo tus caminos, ni buscando tu voluntad, ni hablando tus palabras:\n14. Entonces te deleitarás en Jehová; y yo te haré subir sobre las alturas de la tierra, y te daré á comer la heredad de Jacob tu padre: porque la boca de Jehová lo ha hablado.",
  "Juan 11:11-14": "Juan 11:11-14 — Reina-Valera 1909\n\n11. Dicho esto, díceles después: Lázaro nuestro amigo duerme; mas voy á despertarle del sueño.\n12. Dijeron entonces sus discípulos: Señor, si duerme, salvo estará.\n13. Mas esto decía Jesús de la muerte de él: y ellos pensaron que hablaba del reposar del sueño.\n14. Entonces, pues, Jesús les dijo claramente: Lázaro es muerto;",
  "Juan 11:25": "Juan 11:25 — Reina-Valera 1909\n\n25. Dícele Jesús: Yo soy la resurrección y la vida: el que cree en mí, aunque esté muerto, vivirá.",
  "Juan 14:1-3": "Juan 14:1-3 — Reina-Valera 1909\n\n1. NO se turbe vuestro corazón: creéis en Dios, creed también en mí.\n2. En la casa de mi Padre muchas moradas hay: de otra manera os lo hubiera dicho: voy, pues, á preparar lugar para vosotros.\n3. Y si me fuere, y os aparejare lugar, vendré otra vez, y os tomaré á mí mismo: para que donde yo estoy, vosotros también estéis.",
  "Juan 14:15": "Juan 14:15 — Reina-Valera 1909\n\n15. Si me amáis, guardad mis mandamientos;",
  "Juan 1:29": "Juan 1:29 — Reina-Valera 1909\n\n29. El siguiente día ve Juan á Jesús que venía á él, y dice: He aquí el Cordero de Dios, que quita el pecado del mundo.",
  "Juan 3:16": "Juan 3:16 — Reina-Valera 1909\n\n16. Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
  "Juan 5:28-29": "Juan 5:28-29 — Reina-Valera 1909\n\n28. No os maravilléis de esto; porque vendrá hora, cuando todos los que están en los sepulcros oirán su voz;\n29. Y los que hicieron bien, saldrán á resurrección de vida; mas los que hicieron mal, á resurrección de condenación.",
  "Juan 5:39": "Juan 5:39 — Reina-Valera 1909\n\n39. Escudriñad las Escrituras, porque á vosotros os parece que en ellas tenéis la vida eterna; y ellas son las que dan testimonio de mí.",
  "Levítico 23:32": "Levítico 23:32 — Reina-Valera 1909\n\n32. Sábado de reposo será á vosotros, y afligiréis vuestras almas, comenzando á los nueve del mes en la tarde: de tarde á tarde holgaréis vuestro sábado.",
  "Lucas 15:17-24": "Lucas 15:17-24 — Reina-Valera 1909\n\n17. Y volviendo en sí, dijo: ¡Cuántos jornaleros en casa de mi padre tienen abundancia de pan, y yo aquí perezco de hambre!\n18. Me levantaré, é iré á mi padre, y le diré: Padre, he pecado contra el cielo, y contra ti;\n19. Ya no soy digno de ser llamado tu hijo; hazme como á uno de tus jornaleros.\n20. Y levantándose, vino á su padre. Y como aun estuviese lejos, viólo su padre, y fué movido á misericordia, y corrió, y echóse sobre su cuello, y besóle.\n21. Y el hijo le dijo: Padre, he pecado contra el cielo, y contra ti, y ya no soy digno de ser llamado tu hijo.\n22. Mas el padre dijo á sus siervos: Sacad el principal vestido, y vestidle; y poned un anillo en su mano, y zapatos en sus pies.\n23. Y traed el becerro grueso, y matadlo, y comamos, y hagamos fiesta:\n24. Porque este mi hijo muerto era, y ha revivido; habíase perdido, y es hallado. Y comenzaron á regocijarse.",
  "Lucas 4:16": "Lucas 4:16 — Reina-Valera 1909\n\n16. Y vino á Nazaret, donde había sido criado; y entró, conforme á su costumbre, el día del sábado en la sinagoga, y se levantó á leer.",
  "Marcos 16:16": "Marcos 16:16 — Reina-Valera 1909\n\n16. El que creyere y fuere bautizado, será salvo; mas el que no creyere, será condenado.",
  "Marcos 2:27": "Marcos 2:27 — Reina-Valera 1909\n\n27. También les dijo: El sábado por causa del hombre es hecho; no el hombre por causa del sábado.",
  "Marcos 6:31": "Marcos 6:31 — Reina-Valera 1909\n\n31. Y él les dijo: Venid vosotros aparte al lugar desierto, y reposad un poco. Porque eran muchos los que iban y venían, que ni aun tenían lugar de comer.",
  "Mateo 12:9-13": "Mateo 12:9-13 — Reina-Valera 1909\n\n9. Y partiéndose de allí, vino á la sinagoga de ellos.\n10. Y he aquí había allí uno que tenía una mano seca: y le preguntaron, diciendo: ¿Es lícito curar en sábado? por acusarle.\n11. Y él les dijo: ¿Qué hombre habrá de vosotros, que tenga una oveja, y si cayere ésta en una fosa en sábado, no le eche mano, y la levante?\n12. Pues ¿cuánto más vale un hombre que una oveja? Así que, lícito es en los sábados hacer bien.\n13. Entonces dijo á aquel hombre: Extiende tu mano. Y él la extendió, y fué restituída sana como la otra.",
  "Mateo 22:37-40": "Mateo 22:37-40 — Reina-Valera 1909\n\n37. Y Jesús le dijo: Amarás al Señor tu Dios de todo tu corazón, y de toda tu alma, y de toda tu mente.\n38. Este es el primero y el grande mandamiento.\n39. Y el segundo es semejante á éste: Amarás á tu prójimo como á ti mismo.\n40. De estos dos mandamientos depende toda la ley y los profetas.",
  "Mateo 24:12": "Mateo 24:12 — Reina-Valera 1909\n\n12. Y por haberse multiplicado la maldad, la caridad de muchos se resfriará.",
  "Mateo 24:14": "Mateo 24:14 — Reina-Valera 1909\n\n14. Y será predicado este evangelio del reino en todo el mundo, por testimonio á todos los Gentiles; y entonces vendrá el fin.",
  "Mateo 24:36": "Mateo 24:36 — Reina-Valera 1909\n\n36. Empero del día y hora nadie sabe, ni aun los ángeles de los cielos, sino mi Padre solo.",
  "Mateo 24:4-5": "Mateo 24:4-5 — Reina-Valera 1909\n\n4. Y respondiendo Jesús, les dijo: Mirad que nadie os engañe.\n5. Porque vendrán muchos en mi nombre, diciendo: Yo soy el Cristo; y á muchos engañarán.",
  "Mateo 24:42-44": "Mateo 24:42-44 — Reina-Valera 1909\n\n42. Velad pues, porque no sabéis á qué hora ha de venir vuestro Señor.\n43. Esto empero sabed, que si el padre de la familia supiese á cuál vela el ladrón había de venir, velaría, y no dejaría minar su casa.\n44. Por tanto, también vosotros estad apercibidos; porque el Hijo del hombre ha de venir á la hora que no pensáis.",
  "Mateo 24:6": "Mateo 24:6 — Reina-Valera 1909\n\n6. Y oiréis guerras, y rumores de guerras: mirad que no os turbéis; porque es menester que todo esto acontezca; mas aún no es el fin.",
  "Mateo 25:36": "Mateo 25:36 — Reina-Valera 1909\n\n36. Desnudo, y me cubristeis; enfermo, y me visitasteis; estuve en la cárcel, y vinisteis á mí.",
  "Mateo 28:19-20": "Mateo 28:19-20 — Reina-Valera 1909\n\n19. Por tanto, id, y doctrinad á todos los Gentiles, bautizándolos en el nombre del Padre, y del Hijo, y del Espíritu Santo:\n20. Enseñándoles que guarden todas las cosas que os he mandado: y he aquí, yo estoy con vosotros todos los días, hasta el fin del mundo. Amén.",
  "Mateo 6:14-15": "Mateo 6:14-15 — Reina-Valera 1909\n\n14. Porque si perdonareis á los hombres sus ofensas, os perdonará también á vosotros vuestro Padre celestial.\n15. Mas si no perdonareis á los hombres sus ofensas, tampoco vuestro Padre os perdonará vuestras ofensas.",
  "Mateo 6:6": "Mateo 6:6 — Reina-Valera 1909\n\n6. Mas tú, cuando oras, éntrate en tu cámara, y cerrada tu puerta, ora á tu Padre que está en secreto; y tu Padre que ve en secreto, te recompensará en público.",
  "Mateo 6:9-13": "Mateo 6:9-13 — Reina-Valera 1909\n\n9. Vosotros pues, oraréis así: Padre nuestro que estás en los cielos, santificado sea tu nombre.\n10. Venga tu reino. Sea hecha tu voluntad, como en el cielo, así también en la tierra.\n11. Danos hoy nuestro pan cotidiano.\n12. Y perdónanos nuestras deudas, como también nosotros perdonamos á nuestros deudores.\n13. Y no nos metas en tentación, mas líbranos del mal: porque tuyo es el reino, y el poder, y la gloria, por todos los siglos. Amén.",
  "Romanos 5:12": "Romanos 5:12 — Reina-Valera 1909\n\n12. De consiguiente, vino la reconciliación por uno , así como el pecado entró en el mundo por un hombre, y por el pecado la muerte, y la muerte así pasó á todos los hombres, pues que todos pecaron.",
  "Romanos 5:8": "Romanos 5:8 — Reina-Valera 1909\n\n8. Mas Dios encarece su caridad para con nosotros, porque siendo aún pecadores, Cristo murió por nosotros.",
  "Romanos 6:1-2": "Romanos 6:1-2 — Reina-Valera 1909\n\n1. ¿PUES qué diremos? Perseveraremos en pecado para que la gracia crezca?\n2. En ninguna manera. Porque los que somos muertos al pecado, ¿cómo viviremos aún en él?",
  "Romanos 6:23": "Romanos 6:23 — Reina-Valera 1909\n\n23. Porque la paga del pecado es muerte: mas la dádiva de Dios es vida eterna en Cristo Jesús Señor nuestro.",
  "Romanos 6:3-4": "Romanos 6:3-4 — Reina-Valera 1909\n\n3. ¿O no sabéis que todos los que somos bautizados en Cristo Jesús, somos bautizados en su muerte?\n4. Porque somos sepultados juntamente con él á muerte por el bautismo; para que como Cristo resucitó de los muertos por la gloria del Padre, así también nosotros andemos en novedad de vida.",
  "Romanos 7:12": "Romanos 7:12 — Reina-Valera 1909\n\n12. De manera que la ley á la verdad es santa, y el mandamiento santo, y justo, y bueno.",
  "Romanos 8:1": "Romanos 8:1 — Reina-Valera 1909\n\n1. AHORA pues, ninguna condenación hay para los que están en Cristo Jesús, los que no andan conforme á la carne, mas conforme al espíritu.",
  "Salmo 119:105": "Salmo 119:105 — Reina-Valera 1909\n\n105. NUN. Lámpara es á mis pies tu palabra, y lumbrera á mi camino.",
  "Santiago 1:22": "Santiago 1:22 — Reina-Valera 1909\n\n22. Mas sed hacedores de la palabra, y no tan solamente oidores, engañándoos á vosotros mismos.",
  "Éxodo 20:1-17": "Éxodo 20:1-17 — Reina-Valera 1909\n\n1. Y HABLÓ Dios todas estas palabras, diciendo:\n2. Yo soy JEHOVÁ tu Dios, que te saqué de la tierra de Egipto, de casa de siervos.\n3. No tendrás dioses ajenos delante de mí.\n4. No te harás imagen, ni ninguna semejanza de cosa que esté arriba en el cielo, ni abajo en la tierra, ni en las aguas debajo de la tierra:\n5. No te inclinarás á ellas, ni las honrarás; porque yo soy Jehová tu Dios, fuerte, celoso, que visito la maldad de los padres sobre los hijos, sobre los terceros y sobre los cuartos, á los que me aborrecen,\n6. Y que hago misericordia en millares á los que me aman, y guardan mis mandamientos.\n7. No tomarás el nombre de Jehová tu Dios en vano; porque no dará por inocente Jehová al que tomare su nombre en vano.\n8. Acordarte has del día del reposo, para santificarlo:\n9. Seis días trabajarás, y harás toda tu obra;\n10. Mas el séptimo día será reposo para Jehová tu Dios: no hagas en él obra alguna, tú, ni tu hijo, ni tu hija, ni tu siervo, ni tu criada ni tu bestia, ni tu extranjero que está dentro de tus puertas:\n11. Porque en seis días hizo Jehová los cielos y la tierra, la mar y todas las cosas que en ellos hay, y reposó en el séptimo día: por tanto Jehová bendijo el día del reposo y lo santificó.\n12. Honra á tu padre y á tu madre, porque tus días se alarguen en la tierra que Jehová tu Dios te da.\n13. No matarás.\n14. No cometerás adulterio.\n15. No hurtarás.\n16. No hablarás contra tu prójimo falso testimonio.\n17. No codiciarás la casa de tu prójimo, no codiciarás la mujer de tu prójimo, ni su siervo, ni su criada, ni su buey, ni su asno, ni cosa alguna de tu prójimo.",
  "Éxodo 20:10": "Éxodo 20:10 — Reina-Valera 1909\n\n10. Mas el séptimo día será reposo para Jehová tu Dios: no hagas en él obra alguna, tú, ni tu hijo, ni tu hija, ni tu siervo, ni tu criada ni tu bestia, ni tu extranjero que está dentro de tus puertas:",
  "Éxodo 20:8-11": "Éxodo 20:8-11 — Reina-Valera 1909\n\n8. Acordarte has del día del reposo, para santificarlo:\n9. Seis días trabajarás, y harás toda tu obra;\n10. Mas el séptimo día será reposo para Jehová tu Dios: no hagas en él obra alguna, tú, ni tu hijo, ni tu hija, ni tu siervo, ni tu criada ni tu bestia, ni tu extranjero que está dentro de tus puertas:\n11. Porque en seis días hizo Jehová los cielos y la tierra, la mar y todas las cosas que en ellos hay, y reposó en el séptimo día: por tanto Jehová bendijo el día del reposo y lo santificó."
};
function cargarTextoBiblico(referencia, elemento) {
  elemento.textContent = TEXTOS_BIBLICOS_OFFLINE[referencia] ||
    ('Pasaje no incorporado: ' + referencia);
}

function renderizarLeccion(l) {
    const caja = document.getElementById('contenidoLeccionDinamica');
    if (!caja) return;
    caja.replaceChildren();
    caja.append(elementoEstudio('h2', '📖 Estudio ' + l.numero + ': ' + l.titulo));
    caja.append(elementoEstudio('p', 'Texto clave: ' + l.textoClave));
    caja.append(elementoEstudio('p', l.introduccion));
    caja.append(elementoEstudio('h3', 'Estudiemos la Biblia'));
    const estado = progresoLocalLeccion(l.numero);
    const respuestasAnteriores = Array.isArray(estado.respuestasAbiertas) ? estado.respuestasAbiertas : [];
    const campos = [];
    let aviso;
    function guardarBorrador() {
        const datos = progresoLocalLeccion(l.numero);
        const respuestasAbiertas = campos.map(c => c.value);
        // No perder un estudio completado por modificar un borrador.
        guardarProgresoLocalLeccion(l.numero, {...datos, respuestasAbiertas, completado: false});
        programarSincronizacion(l.numero);
        if (aviso) aviso.textContent = 'Respuestas guardadas en este navegador. Finaliza el estudio cuando termines.';
    }
    l.preguntasBiblicas.forEach((p, i) => {
        const bloque = elementoEstudio('div', undefined, 'estudio-pregunta');
        bloque.append(elementoEstudio('h3', (i + 1) + '. ' + p.pregunta));
        bloque.append(elementoEstudio('p', 'Lectura bíblica: ' + p.referencia));
        const versiculo = document.createElement('details');
        versiculo.append(elementoEstudio('summary', '📖 Leer versículo'));
        const lectura = elementoEstudio('p', 'Pulsa para leer el texto bíblico (Reina-Valera 1909).');
        lectura.className = 'texto-biblico-lectura';
        lectura.style.cssText = 'background:#f0f7f3;padding:12px;border-radius:8px;white-space:pre-wrap;line-height:1.7';
        versiculo.append(lectura);
        versiculo.addEventListener('toggle', () => {
            if (versiculo.open) cargarTextoBiblico(p.referencia, lectura);
        });
        bloque.append(versiculo);
        const etiqueta = elementoEstudio('label', 'Mi respuesta:');
        const campo = document.createElement('textarea');
        campo.placeholder = 'Escribe con tus propias palabras lo que comprendiste de este pasaje';
        campo.value = typeof respuestasAnteriores[i] === 'string' ? respuestasAnteriores[i] : '';
        campo.rows = 4;
        campo.addEventListener('input', guardarBorrador);
        bloque.append(etiqueta, campo);
        campos.push(campo);
        const explicacion = document.createElement('details');
        explicacion.append(elementoEstudio('summary', '📘 Ver explicación bíblica (después de responder)'));
        explicacion.append(elementoEstudio('p', p.explicacion));
        bloque.append(explicacion);
        caja.append(bloque);
    });
    caja.append(elementoEstudio('h3', '📘 Mi progreso'));
    aviso = elementoEstudio('p', (estado.completado ? '✓ Estudio completado. ' : 'Responde todas las preguntas para completar este estudio. ') + resumenProgresoCurso(), 'estudio-resultado');
    caja.append(aviso);
    caja.append(crearBotonEstudio('✓ Finalizar estudio', () => {
        const incompleta = campos.findIndex(c => !c.value.trim());
        if (incompleta !== -1) {
            aviso.textContent = 'Falta responder la pregunta ' + (incompleta + 1) + '.';
            campos[incompleta].focus(); return;
        }
        const respuestasAbiertas = campos.map(c => c.value.trim());
        const datos = progresoLocalLeccion(l.numero);
        if (!guardarProgresoLocalLeccion(l.numero, {...datos, respuestasAbiertas, completado: true})) return;
        aviso.textContent = '✅ ¡Estudio ' + l.numero + ' completado! ' + resumenProgresoCurso();
        actualizarProgresoCurso();
        sincronizarEstudio(l.numero);
        if (siguiente) siguiente.disabled = false;
        renderizarListaLecciones();
    }));
    const acciones = elementoEstudio('div', undefined, 'estudio-acciones');
    acciones.append(crearBotonEstudio('← Volver a las lecciones', () => {renderizarListaLecciones(); show('escuela');}, true));
    let siguiente = null;
    if (l.numero < 20) {
        siguiente = crearBotonEstudio('Siguiente estudio →', () => abrirLeccion(l.numero + 1));
        siguiente.disabled = !leccionCompletada(l.numero);
        acciones.append(siguiente);
    }
    caja.append(acciones);
    caja.append(elementoEstudio('small', 'Las respuestas se guardan en este navegador. Con la sesión de estudiante activa, se sincronizan también con Supabase. Completar no equivale a una calificación automática.'));
}
document.addEventListener('DOMContentLoaded', renderizarListaLecciones);


/* SINCRONIZACIÓN DE ESTUDIANTES: datos privados protegidos por RLS */
let sincronizacionEnCurso = null;
const pendientesSincronizacion = new Set();
let temporizadorSincronizacion = null;
function actualizarEstadoEstudiante(mensaje) {
  const caja = document.getElementById('estadoEstudiante');
  const registro = document.getElementById('registroEstudiante');
  if (!caja) return;
  const correo = sesionEstudiante?.usuario?.email;
 
    caja.textContent = typeof mensaje === 'string' && mensaje
        ? mensaje
        : (correo
            ? '✓ Sesión de estudiante: ' + correo + '. Progreso sincronizado cuando hay conexión.'
            : 'Estás estudiando como visitante. El progreso se guarda en este navegador. Inicia sesión para sincronizarlo.');

  if (registro) registro.classList.toggle('hide', !!correo);
}
function datosLocalesEstudio(numero) {
  if (numero === 1) return {
    respuestas: Array.from({length:6},(_,i)=>localStorage.getItem('luzparatualma_estudio1_respuesta'+(i+1))||''),
    completado: leccionCompletada(1)
  };
  const p = progresoLocalLeccion(numero);
  return {respuestas: Array.isArray(p.respuestasAbiertas)?p.respuestasAbiertas:[], completado:!!p.completado};
}
function escribirDatosEstudio(numero, respuestas, completado) {
  if (numero === 1) {
    respuestas.forEach((r,i)=>{if(i<6)localStorage.setItem('luzparatualma_estudio1_respuesta'+(i+1),r);});
    if (completado) localStorage.setItem('luzparatualma_estudio1_completado','true');
    for(let i=1;i<=6;i++){const c=document.getElementById('respuesta'+i);if(c)c.value=localStorage.getItem('luzparatualma_estudio1_respuesta'+i)||'';}
  } else {
    const anterior = progresoLocalLeccion(numero);
    guardarProgresoLocalLeccion(numero,{...anterior,respuestasAbiertas:respuestas,completado:!!completado});
  }
}
async function peticionEstudiante(ruta,opciones={}) {
  if (!sesionEstudiante?.access_token) throw Error('Inicia sesión para sincronizar.');
  const ejecutar=()=>apiPublica(ruta,{...opciones,headers:{...opciones.headers,Authorization:'Bearer '+sesionEstudiante.access_token}});
  try { return await ejecutar(); }
  catch (error) {
    if (!/401|JWT|expired|invalid/i.test(error.message)) throw error;
    const refresh=sesionEstudiante.refresh_token;
    if(!refresh)throw error;
    const nueva=await apiPublica('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:refresh})});
    sesionEstudiante={...sesionEstudiante,access_token:nueva.access_token,refresh_token:nueva.refresh_token||refresh};
    sessionStorage.setItem('luz_estudiante',JSON.stringify(sesionEstudiante));
    return ejecutar();
  }
}
function programarSincronizacion(numero) {
  pendientesSincronizacion.add(numero);
  if (!sesionEstudiante) return;
  clearTimeout(temporizadorSincronizacion);
  temporizadorSincronizacion=setTimeout(()=>{
    const numeros=[...pendientesSincronizacion]; pendientesSincronizacion.clear();
    numeros.forEach(n=>sincronizarEstudio(n));
  },1300);
}
async function sincronizarEstudio(numero) {
  if (!sesionEstudiante?.usuario?.id) return;
  const datos=datosLocalesEstudio(numero);
  try {
    await peticionEstudiante('/rest/v1/progreso_estudiantes?on_conflict=usuario_id,leccion',{method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({usuario_id:sesionEstudiante.usuario.id,leccion:numero,respuestas:datos.respuestas,completado:datos.completado})});
    actualizarEstadoEstudiante();
  } catch(error) {
    actualizarEstadoEstudiante('Guardado en este navegador. Sincronización pendiente: '+error.message);
    console.warn('Error sincronizando estudio',numero,error);
  }
}
async function iniciarSincronizacionEstudiante() {
  if (!sesionEstudiante?.usuario?.id) { actualizarEstadoEstudiante(); return; }
  if(sincronizacionEnCurso)return sincronizacionEnCurso;
  sincronizacionEnCurso=(async()=>{
    actualizarEstadoEstudiante('Conectando el progreso del estudiante...');
    try {
      // Verificar sesión antes de acceder a los datos privados.
      const usuario=await peticionEstudiante('/auth/v1/user');
      sesionEstudiante.usuario=usuario;
      sessionStorage.setItem('luz_estudiante',JSON.stringify(sesionEstudiante));
      const remotos=await peticionEstudiante('/rest/v1/progreso_estudiantes?select=leccion,respuestas,completado&order=leccion.asc');
      for(let n=1;n<=20;n++){
        const remoto=remotos.find(r=>r.leccion===n);
        const local=datosLocalesEstudio(n);
        if (!remoto) {
          if(local.completado||local.respuestas.some(r=>r.trim())) await sincronizarEstudio(n);
          continue;
        }
        // No descartar respuestas existentes: completar campos vacíos con las respuestas remotas.
        const longitud=Math.max(local.respuestas.length,remoto.respuestas?.length||0);
        const respuestas=Array.from({length:longitud},(_,i)=>local.respuestas[i]?.trim()?local.respuestas[i]:(remoto.respuestas?.[i]||''));
        const completado=local.completado||remoto.completado;
        escribirDatosEstudio(n,respuestas,completado);
        if(JSON.stringify(respuestas)!==JSON.stringify(remoto.respuestas)||completado!==remoto.completado)await sincronizarEstudio(n);
      }
      actualizarProgresoCurso(); renderizarListaLecciones();
      actualizarEstadoEstudiante();
    } catch(error){
      actualizarEstadoEstudiante('Progreso local disponible. No se pudo sincronizar: '+error.message);
      console.error('Sincronización de estudiante',error);
    }
  })();
  try{await sincronizacionEnCurso;}finally{sincronizacionEnCurso=null;}
}
document.addEventListener('DOMContentLoaded',actualizarEstadoEstudiante);
