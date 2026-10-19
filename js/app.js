/* PAGUU · interfaz del piloto (aspecto tipo panel oscuro, datos Epik, IGIC). */
(function () {
  'use strict';
  const PL = window.PaguuLogic;
  const KEY = 'paguu-pilot-v1';
  let S = null;
  let DRAFT = {};
  let SIG = null;
  let OPEN = { fac: true, ana: true, ope: true, ver: true, cfg: true };
  let factPage = 1;
  let factQ = '';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = c => PL.eur(c);
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  function toast(msg, kind) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.className = 'toast ' + (kind || 'ok');
    t.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { if (t) t.remove(); }, 3600);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('No se pudo guardar en este navegador', 'bad'); }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.version === 1 && Array.isArray(p.invoices) && p.company) return p;
      }
    } catch (e) { /* semilla nueva */ }
    return PL.prepare(window.PAGUU_SEED);
  }
  function parse() {
    const raw = (location.hash || '#/inicio').replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { name: parts[0] || 'inicio', id: parts[1] || '', rest: parts[2] || '', parts, q };
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  const client = id => PL.byId(S.clients, id);
  const supplier = id => PL.byId(S.suppliers, id);
  const findDoc = id => PL.byId(S.invoices, id) || PL.byId(S.albaranes, id);
  function statusChip(st) {
    const map = { emitida: ['Emitida', 'emitida'], cobrada: ['Cobrada', 'cobrada'], anulada: ['Anulada', 'anulada'], pendiente: ['Pendiente', 'pend'], pagada: ['Pagada', 'cobrada'] };
    const m = map[st] || [st || '—', 'mut'];
    return '<span class="chip ' + m[1] + '">' + m[0] + '</span>';
  }
  const statusLabel = st => ({ emitida: 'Emitida', cobrada: 'Cobrada', anulada: 'Anulada', pendiente: 'Pendiente', pagada: 'Pagada' }[st] || st);
  function opts(list, sel) {
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(x =>
      '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
  }
  function blankLine(rate) {
    const r = String(rate == null ? 0 : rate);
    return { desc: r === '7' ? 'Servicio de gestión' : 'Fruta y verdura', qty: '1', price: r === '7' ? '100,00' : '', rate: r, lot: 'L-' + todayISO().slice(0, 7), origin: 'Gran Canaria', pid: '' };
  }
  function defaultMonth() {
    const dates = S.invoices.map(i => i.date).sort();
    return (dates[dates.length - 1] || todayISO()).slice(0, 7);
  }

  const NAV = [
    { g: null, items: [['inicio', 'Inicio']] },
    { g: 'fac', title: 'FACTURACIÓN', items: [['clientes', 'Clientes'], ['proveedores', 'Proveedores'], ['facturas', 'Facturas'], ['recibidas', 'Recibidas'], ['relacion', 'Relación mensual'], ['cobros', 'Cobros y banco'], ['remesas', 'Remesas']] },
    { g: 'ana', title: 'ANÁLISIS', items: [['beneficios', 'Beneficios'], ['informes', 'Informes']] },
    { g: 'ope', title: 'OPERATIVA', items: [['albaranes', 'Albaranes'], ['fin', 'Fin de mes'], ['stock', 'Stock y cuadre'], ['conta', 'Contabilidad']] },
    { g: 'ver', title: 'VERIFACTU', items: [['verifactu', 'Cadena y registros'], ['actividad', 'Registro de actividad']] },
    { g: 'cfg', title: 'CONFIGURACIÓN', items: [['empresa', 'Empresa'], ['numeracion', 'Numeración'], ['importar', 'Importación']] }
  ];
  function navOn(name, route) {
    if (name === 'facturas' && (route.name === 'factura' || route.name === 'nueva' || route.name === 'firmar')) return true;
    if (name === 'albaranes' && (route.name === 'albaran' || route.name === 'nuevoalbaran')) return true;
    if (name === 'clientes' && route.name === 'cliente') return true;
    if (name === 'proveedores' && route.name === 'proveedor') return true;
    if (name === 'recibidas' && route.name === 'recibida') return true;
    return route.name === name;
  }
  function sidebar(route) {
    const links = NAV.map(group => {
      const inner = group.items.map(([id, label]) => {
        const cls = (id === 'inicio' ? 'nav-home' : '') + (navOn(id, route) ? ' on' : '');
        return '<a class="' + cls + '" href="#/' + id + '">' + label + '</a>';
      }).join('');
      if (!group.g) return '<nav class="nav">' + inner + '</nav>';
      const open = OPEN[group.g];
      return '<div class="navgrp"><button type="button" data-act="toggleGrp" data-g="' + group.g + '">' + group.title + '<span>' + (open ? '▾' : '▸') + '</span></button>'
        + (open ? '<nav class="nav">' + inner + '</nav>' : '') + '</div>';
    }).join('');
    const theme = document.documentElement.dataset.theme === 'light' ? 'Tema oscuro' : 'Tema claro';
    return '<a class="brand" href="#/inicio"><span class="mark">P</span><span>PAGUU<small>Facturación con IGIC</small></span></a>'
      + '<div class="co"><img src="logo-epik-seal.jpg" alt="Logo Epik Gestiones"><div><b>Epik Gestiones</b><small>Empresa activa</small></div></div>'
      + '<select class="sel" aria-label="Empresa"><option>Epik Gestiones · serie EG26</option></select>'
      + links
      + '<div class="side-foot"><button type="button" class="theme" data-act="theme">' + theme + '</button>'
      + '<div class="user"><span class="av">J</span> Jonathan Deniz</div></div>';
  }

  function head(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div><div class="row">' + (actions || '') + '</div></div>';
  }
  function invRow(inv) {
    const cl = client(inv.clientId);
    const t = PL.totals(inv);
    let name = cl ? cl.name : '—';
    if (inv.source === 'importada') name += ' · importada';
    else if (inv.source === 'albaranes') name += ' · relación';
    else if (inv.source === 'demo') name += '';
    const pend = inv.status === 'emitida' ? '<span class="pend">Pendiente ' + money(t.total) + '</span>' : (inv.status === 'cobrada' ? '<span class="pend">Cobrado</span>' : '');
    return '<a class="irow" href="#/factura/' + inv.id + '"><b>' + esc(inv.num) + '</b><span class="mut">' + PL.fd(inv.date) + '</span><span class="who">' + esc(name) + '</span><span class="right">' + statusChip(inv.status) + '<b class="amt">' + money(t.total) + '</b>' + pend + '</span></a>';
  }

  function shareText(doc, who) {
    const t = PL.totals(doc);
    const tipo = doc.num.indexOf(S.company.albSerie) === 0 && doc.num.indexOf(S.company.serie) !== 0 ? 'albarán' : 'factura';
    return 'Hola, te enviamos copia del ' + tipo + ' ' + doc.num + ' de ' + S.company.name + ' con fecha ' + PL.fd(doc.date) + ' por ' + money(t.total)
      + (doc.signed ? '. Firmado por ' + doc.signed.name + '.' : '')
      + ' Piloto PAGUU: documento local, no es un envío a la AEAT.';
  }
  function mailHref(email, subject, body) {
    return 'mailto:' + (email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function waHref(phone, body) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 9) d = '34' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(body);
  }

  const VIEWS = {};
  VIEWS.inicio = () => {
    const k = PL.kpis(S);
    const last = S.invoices.slice().sort((a, b) => b.n - a.n).slice(0, 5);
    const acts = S.log.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.n || 0) - (a.n || 0)).slice(0, 6);
    return '<div class="page-head"><div><div class="nif">' + esc(S.company.nif) + '</div><h1>' + esc(S.company.name) + '</h1><p class="sub">Próxima factura ' + esc(k.next) + '</p></div>'
      + '<a class="btn" href="#/nueva">Nueva factura</a></div>'
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Por cobrar</div><div class="val">' + money(k.cobrar) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Por pagar</div><div class="val">' + money(k.pagar) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Posición neta</div><div class="val">' + money(k.neta) + '</div><div class="hint">Cobros pendientes menos pagos pendientes</div></div></div>'
      + '<div class="sec-head"><h2>Últimas facturas</h2><a href="#/facturas">Ver todas</a></div>'
      + last.map(invRow).join('')
      + '<div class="sec-head"><h2>Actividad</h2><a href="#/actividad">Ver el registro</a></div><ul class="act">'
      + acts.map(a => '<li>' + esc(a.text) + ' · ' + PL.fd(a.date) + '</li>').join('') + '</ul>';
  };

  VIEWS.facturas = () => {
    const k = PL.kpis(S);
    let list = S.invoices.slice().sort((a, b) => b.n - a.n);
    const q = factQ.trim().toLowerCase();
    if (q) list = list.filter(inv => {
      const cl = client(inv.clientId);
      return inv.num.toLowerCase().includes(q) || (cl && cl.name.toLowerCase().includes(q));
    });
    const size = 20;
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (factPage > pages) factPage = pages;
    const slice = list.slice((factPage - 1) * size, factPage * size);
    return head('Facturas emitidas', 'Serie ' + esc(S.company.serie) + ' de Epik Gestiones. La siguiente será ' + esc(k.next) + '.', '<a class="btn" href="#/nueva">Nueva factura</a>')
      + '<div class="row" style="margin-bottom:12px"><input id="qfact" type="search" placeholder="Buscar número o cliente" value="' + esc(factQ) + '" data-act-input="factQ" style="max-width:360px"></div>'
      + (slice.map(invRow).join('') || '<p class="muted">No hay facturas con ese filtro.</p>')
      + '<div class="pager"><button class="btn ghost sm" data-act="factPage" data-d="-1"' + (factPage <= 1 ? ' disabled' : '') + '>Anterior</button><span class="muted">' + factPage + ' / ' + pages + '</span><button class="btn ghost sm" data-act="factPage" data-d="1"' + (factPage >= pages ? ' disabled' : '') + '>Siguiente</button></div>';
  };

  function lineTable(doc) {
    const rows = doc.lines.map(ln => {
      const a = PL.lineAmounts(ln);
      const note = [ln.note, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · ');
      return '<tr><td>' + esc(ln.desc) + (note ? '<div class="small muted">' + esc(note) + '</div>' : '') + '</td><td class="r">' + PL.qtyText(ln.qtyMilli) + '</td><td class="r">' + money(ln.price) + '</td><td class="r">' + money(a.base) + '</td><td class="r">' + (ln.rate || 0) + ' %</td><td class="r">' + money(a.total) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>Descripción</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Importe</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  VIEWS.factura = route => {
    const inv = PL.byId(S.invoices, route.id);
    if (!inv) return '<div class="card">Factura no encontrada. <a href="#/facturas">Volver</a></div>';
    const cl = client(inv.clientId) || { name: '—', nif: '', email: '', phone: '' };
    const t = PL.totals(inv);
    const alta = (S.chain || []).find(c => c.invoiceId === inv.id && c.tipo === 'Alta');
    const body = shareText(inv);
    const mail = mailHref(cl.email, S.company.name + ' · factura ' + inv.num, body);
    const wa = waHref(cl.phone, body);
    const groups = (inv.groups || []).map(id => PL.byId(S.albaranes, id)).filter(Boolean);
    const costs = inv.lines.map((ln, i) => '<div class="row"><span class="grow">' + esc(ln.desc) + '</span><input name="cost-' + i + '" placeholder="sin coste" value="' + (ln.cost == null ? '' : esc(PL.eurPlain(ln.cost))) + '" style="max-width:160px" inputmode="decimal"></div>').join('');
    return '<div class="page-head"><div><div class="nif">' + esc(S.company.name) + '</div><div class="hero-num">' + esc(inv.num) + '</div>' + statusChip(inv.status) + '</div>'
      + '<button class="btn" data-act="pdfInv" data-id="' + inv.id + '">Descargar PDF</button></div>'
      + '<div class="card party"><div><div class="small muted">CLIENTE</div><b>' + esc(cl.name) + '</b><div class="small">NIF/CIF ' + esc(cl.nif || '—') + '</div><div class="small muted">' + esc(PL.addr(cl)) + '</div></div>'
      + '<div><div class="small muted" style="text-align:right">Fecha ' + PL.fd(inv.date) + '</div><div class="bigmoney">' + money(t.total) + '</div><div class="small muted" style="text-align:right">Cobrado ' + money(inv.status === 'cobrada' ? t.total : 0) + '</div></div></div>'
      + '<div class="card" style="margin-top:14px">' + lineTable(inv) + '</div>'
      + (groups.length ? '<div class="card"><h3>Relación de albaranes</h3><ul class="act">' + groups.map(a => '<li><a href="#/albaran/' + a.id + '">' + esc(a.num) + '</a> · ' + PL.fd(a.date) + ' · ' + (a.signed ? 'firmado' : 'sin firmar') + '</li>').join('') + '</ul></div>' : '')
      + '<div class="card"><h3>Coste interno</h3><p class="hint">Sirve para Beneficios. Se puede cambiar después de emitir. No modifica el PDF, el IGIC ni la huella Verifactu. Vacío significa sin coste, no coste cero.</p><form data-form="costes" data-id="' + inv.id + '">' + costs + '<div class="row" style="margin-top:10px"><button class="btn" type="submit">Guardar costes</button></div></form></div>'
      + '<div class="card"><h3>Copia cero papel</h3><p class="hint">La firma en pantalla se guarda en este navegador. Correo abre tu programa de email; WhatsApp abre un chat con el texto. No se envía nada solo.</p><div class="row">'
      + (inv.signed ? '<span class="chip cobrada">Firmado · ' + esc(inv.signed.name) + '</span>' : '<a class="btn" href="#/firmar/' + inv.id + '">Firmar</a>')
      + '<a class="btn sec" href="' + esc(mail) + '">Correo</a>'
      + (wa ? '<a class="btn sec" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '<button class="btn sec" disabled title="Este contacto no tiene teléfono">WhatsApp</button>')
      + '<button class="btn ghost" data-act="printInv" data-id="' + inv.id + '">Imprimir</button></div>'
      + (inv.signed ? '<div class="row" style="margin-top:10px"><svg class="sig" viewBox="0 0 ' + inv.signed.w + ' ' + inv.signed.h + '">' + inv.signed.paths.map(d => '<path d="' + esc(d) + '" fill="none" stroke="#142033" stroke-width="2.4" stroke-linecap="round"/>').join('') + '</svg><div><div class="hash">SHA-256 ' + esc(inv.signed.hash) + '</div><div class="small">' + (PL.verifySign(inv) ? 'Integridad de la firma verificada en local.' : 'La firma no cuadra.') + '</div></div></div>' : '')
      + '</div>'
      + (alta ? '<div class="card"><h3>Registro Verifactu</h3><p class="hint">Huella encadenada en local. El QR apunta al entorno de pruebas de la AEAT y el registro no se ha enviado.</p><div class="row" style="align-items:flex-start"><div class="qrbox" data-qrid="' + inv.id + '"></div><div class="grow"><div>Alta · ' + (alta.aeat === 'simulado' ? 'envío simulado' : 'no enviado') + '</div><div class="hash">Huella ' + esc(alta.hash) + '</div><div class="hash">Anterior ' + esc(alta.prev) + '</div><button class="btn sec sm" data-act="simular" data-id="' + alta.id + '" style="margin-top:8px">Simular envío (no llama a la AEAT)</button></div></div></div>' : '')
      + '<div class="card"><h3>Anular</h3><p class="hint">Una factura emitida no se edita. La anulación deja constancia y alarga la cadena Verifactu. No se puede anular si ya tiene cobros.</p>'
      + (inv.status === 'anulada' ? '<div class="warnbox">Anulada el ' + PL.fd(inv.anulacion.date) + '. Motivo: ' + esc(inv.anulacion.motivo) + '</div>' : '<form data-form="anular" data-id="' + inv.id + '"><textarea name="motivo" placeholder="Motivo de la anulación" required></textarea><div class="row" style="margin-top:8px"><button class="btn bad" type="submit"' + (inv.status === 'cobrada' ? ' disabled' : '') + '>Anular factura</button></div></form>')
      + '</div>';
  };

  function editor(kind) {
    const D = DRAFT[kind];
    if (!D) return '';
    const prod = kind === 'alb';
    const lines = D.lines.map((ln, i) => '<div class="card" style="padding:10px;margin-top:8px"><div class="lrow">'
      + (prod ? '<select data-draft="' + kind + ':pid:' + i + '" aria-label="Producto"><option value="">Sin producto de stock</option>' + S.products.map(p => '<option value="' + p.id + '"' + (ln.pid === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' : '')
      + '<input data-draft="' + kind + ':desc:' + i + '" value="' + esc(ln.desc) + '" placeholder="Descripción" aria-label="Descripción">'
      + '<input data-draft="' + kind + ':qty:' + i + '" value="' + esc(ln.qty) + '" placeholder="Cantidad" inputmode="decimal" aria-label="Cantidad">'
      + '<input data-draft="' + kind + ':price:' + i + '" value="' + esc(ln.price) + '" placeholder="Precio €" inputmode="decimal" aria-label="Precio">'
      + '<select data-draft="' + kind + ':rate:' + i + '" aria-label="IGIC"><option value="0"' + (String(ln.rate) === '0' ? ' selected' : '') + '>0 % fruta / verdura</option><option value="7"' + (String(ln.rate) === '7' ? ' selected' : '') + '>7 % servicios</option></select>'
      + '<input data-draft="' + kind + ':lot:' + i + '" value="' + esc(ln.lot) + '" placeholder="Lote">'
      + '<input data-draft="' + kind + ':origin:' + i + '" value="' + esc(ln.origin) + '" placeholder="Origen">'
      + '<button type="button" class="x" data-act="delLine" data-k="' + kind + '" data-i="' + i + '" aria-label="Quitar">×</button></div></div>').join('');
    const tot = draftTotals(kind);
    return lines + '<div class="row" style="margin-top:8px"><button type="button" class="btn sec sm" data-act="addLine" data-k="' + kind + '">Añadir línea</button><button type="button" class="btn ghost sm" data-act="preset" data-k="' + kind + '" data-rate="7">Línea de servicio 7 %</button><button type="button" class="btn ghost sm" data-act="preset" data-k="' + kind + '" data-rate="0">Línea de fruta 0 %</button></div>'
      + '<div id="live" class="card" style="margin-top:10px"><div class="row"><span class="grow muted">Base</span><b>' + money(tot.base) + '</b></div><div class="row"><span class="grow muted">IGIC</span><b>' + money(tot.igic) + '</b></div><div class="row"><span class="grow">Total</span><b>' + money(tot.total) + '</b></div></div>';
  }
  function draftTotals(kind) {
    let base = 0, igic = 0;
    for (const ln of (DRAFT[kind] && DRAFT[kind].lines) || []) {
      const q = PL.parseQty(ln.qty), p = PL.parseEur(ln.price);
      if (q == null || p == null) continue;
      const b = Math.round(q * p / 1000);
      const g = Math.round(b * (Number(ln.rate) || 0) / 100);
      base += b; igic += g;
    }
    return { base, igic, total: base + igic };
  }
  VIEWS.nueva = () => {
    if (!DRAFT.fac) DRAFT.fac = { clientId: (S.clients[0] && S.clients[0].id) || '', date: todayISO(), lines: [blankLine(0)] };
    const D = DRAFT.fac;
    return head('Nueva factura', 'Numeración ' + esc(S.company.serie) + ' + entero, sin ceros a la izquierda. La próxima es ' + esc(S.company.serie + S.nextFac) + '.')
      + '<form class="card" data-form="emitir"><div class="two"><div><label class="f">Cliente</label><select data-draft="fac:client:0">' + opts(S.clients, D.clientId) + '</select></div>'
      + '<div><label class="f">Fecha</label><input type="date" data-draft="fac:date:0" value="' + esc(D.date) + '"></div></div>'
      + '<h3 style="margin:14px 0 6px">Líneas</h3><p class="hint">IGIC: fruta y verdura 0 %. Servicios 7 %. Esta factura no mueve stock; el albarán sí, cuando la línea lleva producto.</p>'
      + editor('fac')
      + '<div class="row" style="margin-top:12px"><button class="btn" type="submit">Emitir factura</button></div></form>';
  };

  VIEWS.clientes = () => head('Clientes', 'Fichas importadas de la configuración de Epik. No se guardan datos bancarios.')
    + '<div class="row" style="margin-bottom:10px"><a class="btn" href="#/cliente/nuevo">Nuevo cliente</a></div>'
    + '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>NIF/CIF</th><th>Población</th><th class="r">Pendiente</th></tr></thead><tbody>'
    + S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c => {
      let pend = 0, n = 0;
      for (const inv of S.invoices) if (inv.clientId === c.id && inv.status === 'emitida') { pend += PL.totals(inv).total; n++; }
      return '<tr><td><a href="#/cliente/' + c.id + '">' + esc(c.name) + '</a></td><td>' + esc(c.nif) + '</td><td>' + esc(c.city) + '</td><td class="r">' + money(pend) + (n ? ' <span class="small muted">(' + n + ')</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

  function contactForm(kind, rec) {
    const isNew = !rec;
    rec = rec || { id: '', name: '', nif: '', address: '', cp: '', city: '', province: 'Las Palmas', country: 'España', email: '', phone: '' };
    const fields = [['name', 'Razón social'], ['nif', 'NIF/CIF'], ['address', 'Dirección'], ['cp', 'Código postal'], ['city', 'Ciudad'], ['province', 'Provincia'], ['country', 'País'], ['email', 'Correo'], ['phone', 'Teléfono']];
    return '<form class="card" data-form="contacto" data-kind="' + kind + '" data-id="' + esc(rec.id) + '"><div class="two">'
      + fields.map(([k, lab]) => '<div><label class="f">' + lab + '</label><input name="' + k + '" value="' + esc(rec[k] || '') + '"' + (k === 'email' ? ' type="email"' : k === 'phone' ? ' type="tel"' : '') + '></div>').join('')
      + '</div><p class="hint">El banco ya tiene los datos de pago: esta ficha no guarda IBAN ni cuentas.</p><div class="row"><button class="btn" type="submit">' + (isNew ? 'Guardar' : 'Actualizar') + '</button>'
      + (isNew ? '' : '<button type="button" class="btn ghost" data-act="delContacto" data-kind="' + kind + '" data-id="' + esc(rec.id) + '">Eliminar</button>')
      + '</div></form>';
  }
  VIEWS.cliente = route => {
    if (route.id === 'nuevo') return head('Nuevo cliente', '') + contactForm('c', null);
    const c = client(route.id);
    if (!c) return '<div class="card">Cliente no encontrado.</div>';
    const docs = S.invoices.filter(i => i.clientId === c.id).sort((a, b) => b.n - a.n).slice(0, 30);
    return head(esc(c.name), esc(c.nif) + ' · ' + esc(PL.addr(c))) + contactForm('c', c)
      + '<div class="sec-head"><h2>Facturas</h2></div>' + (docs.map(invRow).join('') || '<p class="muted">Sin facturas.</p>');
  };
  VIEWS.proveedores = () => head('Proveedores', 'Importados con la ficha de Epik. Sin datos bancarios.')
    + '<div class="row" style="margin-bottom:10px"><a class="btn" href="#/proveedor/nuevo">Nuevo proveedor</a></div>'
    + '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>NIF/CIF</th><th>Población</th><th>Correo</th></tr></thead><tbody>'
    + S.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c => '<tr><td><a href="#/proveedor/' + c.id + '">' + esc(c.name) + '</a></td><td>' + esc(c.nif) + '</td><td>' + esc(c.city) + '</td><td>' + esc(c.email || '—') + '</td></tr>').join('')
    + '</tbody></table></div>';
  VIEWS.proveedor = route => {
    if (route.id === 'nuevo') return head('Nuevo proveedor', '') + contactForm('s', null);
    const c = supplier(route.id);
    if (!c) return '<div class="card">Proveedor no encontrado.</div>';
    const docs = (S.received || []).filter(i => i.supplierId === c.id);
    return head(esc(c.name), esc(c.nif)) + contactForm('s', c)
      + '<div class="sec-head"><h2>Facturas recibidas</h2></div>' + (docs.map(r => '<a class="irow" href="#/recibidas"><b>' + esc(r.num) + '</b><span class="mut">' + PL.fd(r.date) + '</span><span></span><span class="right">' + statusChip(r.status) + '<b>' + money(PL.totals(r).total) + '</b></span></a>').join('') || '<p class="muted">Sin facturas recibidas.</p>');
  };

  VIEWS.recibidas = () => head('Facturas recibidas', 'Compras a proveedores. Por pagar solo cuenta las que siguen pendientes.', '<a class="btn" href="#/recibida/nueva">Nueva recibida</a>')
    + ((S.received || []).slice().sort((a, b) => b.n - a.n).map(r => {
      const s = supplier(r.supplierId);
      const t = PL.totals(r);
      return '<a class="irow" href="#/recibidas"><b>' + esc(r.num) + '</b><span class="mut">' + PL.fd(r.date) + '</span><span class="who">' + esc(s ? s.name : '—') + '</span><span class="right">' + statusChip(r.status) + '<b>' + money(t.total) + '</b></span></a>';
    }).join('') || '<p class="muted">No hay facturas recibidas.</p>');

  VIEWS.recibida = () => {
    if (!DRAFT.rec) DRAFT.rec = { supplierId: (S.suppliers[0] && S.suppliers[0].id) || '', date: todayISO(), lines: [blankLine(0)] };
    const D = DRAFT.rec;
    return head('Nueva factura recibida', 'Queda pendiente de pago hasta que un cargo del banco coincida exactamente.')
      + '<form class="card" data-form="recibida"><div class="two"><div><label class="f">Proveedor</label><select data-draft="rec:supplier:0">' + opts(S.suppliers, D.supplierId) + '</select></div>'
      + '<div><label class="f">Fecha</label><input type="date" data-draft="rec:date:0" value="' + esc(D.date) + '"></div></div>'
      + editor('rec') + '<div class="row" style="margin-top:12px"><button class="btn" type="submit">Guardar recibida</button></div></form>';
  };

  function relQuery(route) {
    const ym = route.q.mes || defaultMonth();
    const agro = S.clients.find(c => c.name.indexOf('AGROARCHIPIELAGO') === 0);
    const clientId = route.q.cliente || (agro && agro.id) || (S.clients[0] && S.clients[0].id);
    return { ym, clientId };
  }
  VIEWS.relacion = route => {
    const { ym, clientId } = relQuery(route);
    const rel = PL.relacion(S, ym, clientId);
    const cl = client(clientId);
    const rows = rel.invs.map(inv => {
      const t = PL.totals(inv);
      const note = inv.lines.map(ln => [ln.desc, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · ')).join(' / ');
      return '<tr><td><a href="#/factura/' + inv.id + '">' + esc(inv.num) + '</a><div class="small muted">' + esc(note) + '</div></td><td>' + PL.fd(inv.date) + '</td><td class="r">' + money(t.base) + '</td><td class="r">' + money(t.igic) + '</td><td class="r">' + money(t.total) + '</td><td>' + statusLabel(inv.status) + '</td><td class="r">' + money(inv.status === 'emitida' ? t.total : 0) + '</td></tr>';
    }).join('');
    return head('Relación mensual', 'Facturas de Epik Gestiones. Un PDF por factura, con el membrete de la empresa. No se envía solo.',
      '<button class="btn ghost" data-act="excelRel">Excel</button><button class="btn" data-act="zipRel">ZIP de PDFs</button>')
      + '<form class="card" data-form="verRel"><div class="filters"><div><label class="f">Mes</label><input type="month" name="mes" value="' + esc(ym) + '"></div>'
      + '<div><label class="f">Relación de</label><select name="tipo"><option>Clientes</option></select></div>'
      + '<div><label class="f">Cliente</label><select name="cliente">' + opts(S.clients, clientId) + '</select></div>'
      + '<div><button class="btn" type="submit">Ver relación</button></div></div></form>'
      + '<div class="card"><div class="party"><div><h2>' + esc(cl ? cl.name : '') + '</h2><div class="small muted">' + esc(cl ? cl.nif : '') + '</div></div><button class="btn ghost sm" data-act="pdfRel">Descargar PDF</button></div>'
      + '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Número</th><th>Fecha</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Total</th><th>Estado</th><th class="r">Pendiente</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="7">Sin facturas en ese mes.</td></tr>') + '</tbody></table></div>'
      + '<div class="party" style="margin-top:12px"><div>Mes: base ' + money(rel.base) + ' · IGIC ' + money(rel.igic) + ' · total ' + money(rel.total) + ' · pendiente ' + money(rel.pendiente) + '</div><b>Saldo acumulado ' + money(rel.saldo) + '</b></div></div>';
  };

  VIEWS.cobros = () => {
    const libres = S.bank.filter(b => !b.invoiceId && !b.receivedId);
    const ingresos = libres.filter(b => b.amount > 0);
    const cargos = libres.filter(b => b.amount < 0);
    const emitidas = S.invoices.filter(i => i.status === 'emitida').sort((a, b) => b.n - a.n);
    const pendientes = (S.received || []).filter(r => r.status === 'pendiente');
    const casados = S.bank.filter(b => b.invoiceId || b.receivedId).slice(0, 40);
    const optB = ingresos.map(b => '<option value="' + b.id + '">' + PL.fd(b.date) + ' · ' + money(b.amount) + ' · ' + esc(b.concept) + '</option>').join('');
    const optI = emitidas.map(i => '<option value="' + i.id + '">' + esc(i.num) + ' · ' + money(PL.totals(i).total) + ' · ' + esc((client(i.clientId) || {}).name || '') + '</option>').join('');
    return head('Cobros y banco', 'Una factura pasa a cobrada solo si el ingreso del banco coincide en céntimos con el total.')
      + '<div class="two"><form class="card" data-form="casar"><h3>Casar cobro</h3><label class="f">Movimiento de ingreso</label><select name="bank">' + (optB || '<option value="">Sin ingresos libres</option>') + '</select>'
      + '<label class="f">Factura emitida</label><select name="inv">' + (optI || '<option value="">Sin facturas pendientes</option>') + '</select>'
      + '<button class="btn" type="submit" style="margin-top:10px">Casar si cuadra</button></form>'
      + '<form class="card" data-form="bank"><h3>Añadir movimiento simulado</h3><label class="f">Fecha</label><input type="date" name="date" value="' + todayISO() + '">'
      + '<label class="f">Concepto</label><input name="concept" placeholder="Transferencia…">'
      + '<label class="f">Importe €</label><input name="amount" inputmode="decimal" placeholder="107,00">'
      + '<label class="f">Tipo</label><select name="tipo"><option value="ingreso">Ingreso (cobro)</option><option value="pago">Cargo (pago a proveedor)</option></select>'
      + '<button class="btn sec" type="submit" style="margin-top:10px">Añadir al banco</button></form></div>'
      + (cargos.length && pendientes.length ? '<form class="card" data-form="casarPago"><h3>Casar pago a proveedor</h3><div class="two"><div><label class="f">Cargo</label><select name="bank">' + cargos.map(b => '<option value="' + b.id + '">' + money(b.amount) + ' · ' + esc(b.concept) + '</option>').join('') + '</select></div><div><label class="f">Recibida</label><select name="rec">' + pendientes.map(r => '<option value="' + r.id + '">' + esc(r.num) + ' · ' + money(PL.totals(r).total) + '</option>').join('') + '</select></div></div><button class="btn sec" style="margin-top:10px">Casar pago</button></form>' : '')
      + '<div class="card"><h3>Movimientos</h3><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Importe</th><th>Casado</th><th></th></tr></thead><tbody>'
      + S.bank.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map(b => {
        const inv = b.invoiceId ? PL.byId(S.invoices, b.invoiceId) : null;
        const rec = b.receivedId ? PL.byId(S.received, b.receivedId) : null;
        const link = inv ? '<a href="#/factura/' + inv.id + '">' + esc(inv.num) + '</a>' : (rec ? esc(rec.num) : '<span class="chip pend">Sin casar</span>');
        return '<tr><td>' + PL.fd(b.date) + '</td><td>' + esc(b.concept) + '</td><td class="r">' + money(b.amount) + '</td><td>' + link + '</td><td>' + (inv ? '<button class="btn ghost sm" data-act="descasar" data-id="' + b.id + '">Deshacer</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">Hay un ingreso simulado de 6,85 € que cuadra con EG26119, y otro de 250,00 € que no cuadra con ninguna factura.</p></div>';
  };

  VIEWS.remesas = () => {
    const emitidas = S.invoices.filter(i => i.status === 'emitida').sort((a, b) => b.n - a.n).slice(0, 40);
    return head('Remesas', 'Agrupa facturas pendientes en una remesa de cheques. No marca el cobro: eso solo ocurre si el banco cuadra el importe.')
      + '<form class="card" data-form="remesa"><label class="f">Concepto</label><input name="concept" value="Remesa de cheques">'
      + '<div style="margin-top:8px;max-height:320px;overflow:auto">' + emitidas.map(i => '<label class="check"><input type="checkbox" name="ids" value="' + i.id + '"><span>' + esc(i.num) + ' · ' + esc((client(i.clientId) || {}).name || '') + ' · ' + money(PL.totals(i).total) + '</span></label>').join('') + '</div>'
      + '<button class="btn" style="margin-top:8px">Preparar remesa</button></form>'
      + '<div class="card"><h3>Remesas preparadas</h3>' + ((S.remesas || []).map(r => '<div class="irow"><b>' + esc(r.id) + '</b><span class="mut">' + PL.fd(r.date) + '</span><span>' + esc(r.concept) + ' · ' + r.invoiceIds.length + ' facturas</span><span class="right"><span class="chip mut">preparada</span><b>' + money(r.total) + '</b></span></div>').join('') || '<p class="muted">Todavía no hay remesas.</p>') + '</div>';
  };

  function costCell(known, missing, cost) {
    if (!known) return 'sin coste';
    return money(cost) + (missing ? ' · parcial' : '');
  }
  function profitCell(base, known, missing, cost) {
    if (!known) return 'sin coste';
    return money(base - cost) + (missing ? ' · parcial' : '');
  }
  function marginCell(base, known, missing, cost) {
    if (!known || missing || !base) return known && !missing && base ? '0 %' : 'sin coste';
    return ((base - cost) / base * 100).toFixed(1).replace('.', ',') + ' %';
  }
  VIEWS.beneficios = route => {
    const desde = route.q.desde || (defaultMonth() + '-01');
    const hasta = route.q.hasta || PL.monthEnd(defaultMonth());
    const orden = route.q.orden || 'beneficio';
    const b = PL.beneficios(S, desde, hasta);
    let clients = b.byClient.slice();
    const nameOf = id => (client(id) || {}).name || '';
    if (orden === 'cliente') clients.sort((a, c) => nameOf(a.clientId).localeCompare(nameOf(c.clientId), 'es'));
    else if (orden === 'ventas') clients.sort((a, c) => c.base - a.base);
    else clients.sort((a, c) => (c.base - (c.known ? c.cost : 0)) - (a.base - (a.known ? a.cost : 0)));
    const big = v => '<div class="val">' + v + '</div>';
    return head('Beneficios', 'Ventas por la base imponible, coste interno y margen. Una línea sin coste no cuenta como coste cero: queda fuera del porcentaje.', '<button class="btn ghost" data-act="excelBen">Excel</button>')
      + '<form class="card" data-form="verBen"><div class="filters"><div><label class="f">Desde</label><input type="date" name="desde" value="' + esc(desde) + '"></div>'
      + '<div><label class="f">Hasta</label><input type="date" name="hasta" value="' + esc(hasta) + '"></div>'
      + '<div><label class="f">Empresas</label><select><option>Epik Gestiones</option></select></div>'
      + '<div><label class="f">Orden</label><select name="orden"><option value="beneficio"' + (orden === 'beneficio' ? ' selected' : '') + '>Beneficio</option><option value="ventas"' + (orden === 'ventas' ? ' selected' : '') + '>Ventas</option><option value="cliente"' + (orden === 'cliente' ? ' selected' : '') + '>Cliente</option></select></div></div>'
      + '<button class="btn" style="margin-top:10px">Calcular</button></form>'
      + '<div class="kpis k4"><div class="card kpi"><div class="lbl">VENTAS (BASE)</div>' + big(money(b.base)) + '</div>'
      + '<div class="card kpi"><div class="lbl">COSTE</div>' + big(b.none ? 'sin coste' : money(b.cost)) + '</div>'
      + '<div class="card kpi"><div class="lbl">BENEFICIO</div>' + big(b.none ? 'sin coste' : money(b.profit)) + '</div>'
      + '<div class="card kpi"><div class="lbl">MARGEN</div>' + big(b.none ? 'sin coste' : (b.margin == null ? 'parcial' : (b.margin.toFixed(1).replace('.', ',') + ' %'))) + '<div class="hint">' + (b.none ? money(b.base) + ' sin coste, fuera del %' : (b.full ? '' : 'Hay líneas sin coste')) + '</div></div></div>'
      + '<div class="sec-head"><h2>Por cliente</h2></div><div class="table-wrap"><table><thead><tr><th>Cliente</th><th class="r">Ventas</th><th class="r">Coste</th><th class="r">Beneficio</th><th class="r">Margen</th></tr></thead><tbody>'
      + clients.map(g => '<tr><td>' + esc(nameOf(g.clientId)) + '<div class="small muted">' + g.n + (g.n === 1 ? ' factura' : ' facturas') + '</div></td><td class="r">' + money(g.base) + '</td><td class="r">' + costCell(g.known, g.missing, g.cost) + '</td><td class="r">' + profitCell(g.base, g.known, g.missing, g.cost) + '</td><td class="r">' + marginCell(g.base, g.known, g.missing, g.cost) + '</td></tr>').join('')
      + '</tbody></table></div>'
      + '<div class="sec-head"><h2>Por factura</h2></div><div class="table-wrap"><table><thead><tr><th>Número</th><th>Cliente</th><th class="r">Base</th><th class="r">Coste</th><th class="r">Beneficio</th><th class="r">Margen</th></tr></thead><tbody>'
      + b.perInv.slice().sort((a, c) => c.t.base - a.t.base).map(row => '<tr><td><a href="#/factura/' + row.inv.id + '">' + esc(row.inv.num) + '</a></td><td>' + esc(nameOf(row.inv.clientId)) + '</td><td class="r">' + money(row.t.base) + '</td><td class="r">' + costCell(row.c.known, row.c.missing, row.c.cost) + '</td><td class="r">' + profitCell(row.t.base, row.c.known, row.c.missing, row.c.cost) + '</td><td class="r">' + marginCell(row.t.base, row.c.known, row.c.missing, row.c.cost) + '</td></tr>').join('')
      + '</tbody></table></div>';
  };

  VIEWS.informes = () => {
    const today = todayISO();
    const age = PL.aging(S, today);
    const ym = defaultMonth();
    const ig = PL.igicPeriod(S, ym + '-01', PL.monthEnd(ym));
    const tot = age.reduce((s, r) => s + r.total, 0);
    return head('Informes', 'Deuda de clientes e IGIC del mes con más facturas. Cálculo orientativo del piloto, no una liquidación presentada.')
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Deuda viva</div><div class="val">' + money(tot) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">IGIC repercutido ' + esc(ym) + '</div><div class="val">' + money(ig.rep) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Cuota orientativa</div><div class="val">' + money(ig.cuota) + '</div><div class="hint">Repercutido menos soportado</div></div></div>'
      + '<div class="card"><div class="row"><h3 class="grow">Antigüedad de deuda a ' + PL.fd(today) + '</h3><button class="btn ghost sm" data-act="excelDeuda">Excel</button></div>'
      + '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Cliente</th><th class="r">Facturas</th><th class="r">0-30</th><th class="r">31-60</th><th class="r">61-90</th><th class="r">+90</th><th class="r">Total</th></tr></thead><tbody>'
      + age.slice(0, 25).map(r => '<tr><td>' + esc((client(r.clientId) || {}).name || '') + '</td><td class="r">' + r.n + '</td><td class="r">' + money(r.b0) + '</td><td class="r">' + money(r.b30) + '</td><td class="r">' + money(r.b60) + '</td><td class="r">' + money(r.b90) + '</td><td class="r">' + money(r.total) + '</td></tr>').join('')
      + '</tbody></table></div></div>';
  };

  VIEWS.verifactu = () => {
    const v = PL.verifyChain(S);
    const rows = S.chain.slice().reverse().slice(0, 40);
    return head('Cadena y registros', 'Cada alta y cada anulación alarga una cadena SHA-256 en este navegador. El envío a la AEAT es simulado.')
      + '<div class="' + (v.ok ? 'okbox' : 'badbox') + '">' + (v.ok ? 'Cadena íntegra · ' + v.count + ' registros.' : 'La cadena no cuadra (' + esc(v.reason || '') + ').') + ' <span class="hash">' + esc((v.head || '').slice(0, 24)) + '…</span></div>'
      + '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Número</th><th>Fecha</th><th>Tipo</th><th>Total</th><th>AEAT</th><th>Huella</th></tr></thead><tbody>'
      + rows.map(r => '<tr><td>' + esc(r.num) + '</td><td>' + PL.fd(r.date) + '</td><td>' + esc(r.tipo) + '</td><td class="r">' + money(r.total) + '</td><td>' + (r.aeat === 'simulado' ? 'simulado' : 'no enviado') + '</td><td class="hash">' + esc(r.hash.slice(0, 18)) + '…</td></tr>').join('')
      + '</tbody></table></div><p class="hint">Se muestran los 40 registros más recientes. La verificación recorre la cadena entera.</p>';
  };
  VIEWS.actividad = () => head('Registro de actividad', 'Hechos guardados en este navegador.')
    + '<ul class="act">' + S.log.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.n || 0) - (a.n || 0)).slice(0, 200).map(a => '<li>' + esc(a.text) + ' · ' + PL.fd(a.date) + (a.ref ? ' · ' + esc(a.ref) : '') + '</li>').join('') + '</ul>';

  VIEWS.empresa = () => {
    const c = S.company;
    const fields = [['name', 'Razón social'], ['nif', 'NIF/CIF'], ['address', 'Dirección'], ['cp', 'CP'], ['city', 'Ciudad'], ['province', 'Provincia'], ['email', 'Correo'], ['phone', 'Teléfono'], ['mercantile', 'Registro mercantil'], ['iae', 'IAE'], ['iban', 'IBAN'], ['ibanBank', 'Banco del IBAN']];
    return head('Empresa', 'Este piloto carga solo Epik Gestiones 2015 SLU.')
      + '<form class="card" data-form="empresa"><div class="two">' + fields.map(([k, lab]) => '<div><label class="f">' + lab + '</label><input name="' + k + '" value="' + esc(c[k] || '') + '"></div>').join('') + '</div>'
      + '<p class="hint">El IAE figura como pendiente de confirmar. Cambiar el NIF no reescribe las huellas ya generadas: cada registro guarda el NIF usado en ese momento.</p><button class="btn">Guardar</button></form>'
      + '<div class="card"><img src="logo-epik-seal.jpg" alt="Logo Epik" style="width:120px;height:120px;border-radius:50%;background:#fff"></div>';
  };
  VIEWS.numeracion = () => {
    const max = S.invoices.reduce((m, i) => Math.max(m, i.n), 0);
    const series = (S.seriesInfo || []).map(s => '<li>' + esc(s.nombre) + ' · ' + esc(s.tipo) + ' · próxima en origen ' + esc(String(s.proxima_numeracion)) + '</li>').join('');
    return head('Numeración', 'La serie viva es EG26 + el entero, sin ceros a la izquierda. Ejemplo: EG26154.')
      + '<div class="card"><p>Última factura en datos: <b>EG26' + max + '</b>. Siguiente emisión: <b>' + esc(S.company.serie + S.nextFac) + '</b>.</p>'
      + '<p class="hint">EG26154 a EG26158 son facturas de demostración (servicio de gestión, 100 € + IGIC 7 %). Por eso la siguiente no vuelve a 154. El histórico importado ocupa EG261 a EG26153, sin huecos.</p>'
      + '<form data-form="nextNum" class="row"><input name="next" inputmode="numeric" value="' + S.nextFac + '" style="max-width:140px" aria-label="Siguiente número"><button class="btn sec">Fijar siguiente</button></form></div>'
      + '<div class="card"><h3>Otras series leídas de la configuración</h3><p class="hint">Este piloto emite solo en EG26. El resto se muestra como referencia y no se usa.</p><ul class="act">' + series + '</ul></div>';
  };
  VIEWS.importar = () => head('Importación', 'Los clientes, proveedores y la serie salen de la configuración de Epik. Las facturas EG261–EG26153 salen del histórico. EG26154–EG26158 son solo demo.')
    + '<div class="card"><p>En este navegador: <b>' + S.clients.length + '</b> clientes, <b>' + S.suppliers.length + '</b> proveedores, <b>' + S.invoices.length + '</b> facturas emitidas.</p>'
      + '<p class="hint">El histórico no trae desglose de IGIC: se importa como fruta y verdura al 0 % (base = total). Las de demo son servicio al 7 %.</p>'
      + '<div class="row"><label class="btn sec">Subir JSON o CSV<input type="file" accept=".json,.csv,text/csv,application/json" data-act-change="importFile" hidden></label>'
      + '<button class="btn bad" data-act="restore">Restaurar piloto Epik</button></div>'
      + '<p class="hint">JSON con clientes/proveedores (como la exportación de fichas) añade contactos por NIF. CSV con columnas numero;fecha;cliente;base;igic;total;estado añade facturas que aún no existan y las encadena al final.</p></div>';

  VIEWS.albaranes = () => head('Albaranes', 'Se firman en pantalla y, a fin de mes, los firmados del mismo cliente pasan a una factura con relación.', '<a class="btn" href="#/nuevoalbaran">Nuevo albarán</a>')
    + (S.albaranes.slice().sort((a, b) => b.n - a.n).map(a => {
      const cl = client(a.clientId);
      const t = PL.totals(a);
      const st = a.invoicedIn ? 'facturado' : (a.signed ? 'firmado' : 'sin firmar');
      return '<a class="irow" href="#/albaran/' + a.id + '"><b>' + esc(a.num) + '</b><span class="mut">' + PL.fd(a.date) + '</span><span class="who">' + esc(cl ? cl.name : '') + '</span><span class="right"><span class="chip ' + (a.signed ? 'cobrada' : 'pend') + '">' + st + '</span><b>' + money(t.total) + '</b></span></a>';
    }).join('') || '<p class="muted">No hay albaranes.</p>');

  VIEWS.albaran = route => {
    const a = PL.byId(S.albaranes, route.id);
    if (!a) return '<div class="card">Albarán no encontrado.</div>';
    const cl = client(a.clientId) || { name: '', email: '', phone: '', nif: '' };
    const body = shareText(a);
    const inv = a.invoicedIn ? PL.byId(S.invoices, a.invoicedIn) : null;
    return head('Albarán ' + esc(a.num), esc(cl.name) + ' · ' + PL.fd(a.date), '<button class="btn" data-act="printAlb" data-id="' + a.id + '">Imprimir</button>')
      + '<p class="hint">El albarán no entra en la cadena Verifactu. La factura de fin de mes sí.</p>'
      + '<div class="card">' + lineTable(a) + '<div class="row" style="margin-top:8px"><b>Total ' + money(PL.totals(a).total) + '</b></div></div>'
      + '<div class="card"><div class="row">' + (a.signed ? '<span class="chip cobrada">Firmado · ' + esc(a.signed.name) + '</span>' : '<a class="btn" href="#/firmar/' + a.id + '">Firmar</a>')
      + '<a class="btn sec" href="' + esc(mailHref(cl.email, 'Albarán ' + a.num, body)) + '">Correo</a>'
      + (waHref(cl.phone, body) ? '<a class="btn sec" target="_blank" rel="noopener" href="' + esc(waHref(cl.phone, body)) + '">WhatsApp</a>' : '')
      + (inv ? '<a class="btn ghost" href="#/factura/' + inv.id + '">Facturado en ' + esc(inv.num) + '</a>' : '')
      + '</div>' + (a.signed ? '<div class="hash" style="margin-top:8px">' + esc(a.signed.hash) + '</div>' : '') + '</div>';
  };
  VIEWS.nuevoalbaran = () => {
    if (!DRAFT.alb) DRAFT.alb = { clientId: (S.clients.find(c => c.name.indexOf('FLEITAS') >= 0) || S.clients[0] || {}).id || '', date: todayISO(), lines: [Object.assign(blankLine(0), { desc: 'Plátano', pid: 'platano', price: '1,40', qty: '10' })] };
    const D = DRAFT.alb;
    return head('Nuevo albarán', 'Si la línea lleva producto, descuenta stock al guardarlo.')
      + '<form class="card" data-form="albaran"><div class="two"><div><label class="f">Cliente</label><select data-draft="alb:client:0">' + opts(S.clients, D.clientId) + '</select></div>'
      + '<div><label class="f">Fecha</label><input type="date" data-draft="alb:date:0" value="' + esc(D.date) + '"></div></div>' + editor('alb')
      + '<button class="btn" style="margin-top:12px">Crear albarán</button></form>';
  };
  VIEWS.fin = () => {
    const pending = S.albaranes.filter(a => a.signed && !a.invoicedIn);
    const unsigned = S.albaranes.filter(a => !a.signed && !a.invoicedIn);
    const by = new Map();
    for (const a of pending) { if (!by.has(a.clientId)) by.set(a.clientId, []); by.get(a.clientId).push(a); }
    let blocks = '';
    for (const [cid, list] of by) {
      const cl = client(cid);
      blocks += '<form class="card" data-form="finmes"><h3>' + esc(cl ? cl.name : cid) + '</h3><input type="hidden" name="date" value="' + todayISO() + '">'
        + list.map(a => '<label class="check"><input type="checkbox" name="ids" value="' + a.id + '" checked><span>' + esc(a.num) + ' · ' + PL.fd(a.date) + ' · ' + money(PL.totals(a).total) + '</span></label>').join('')
        + '<button class="btn" style="margin-top:8px">Facturar seleccionados</button></form>';
    }
    return head('Fin de mes', 'Agrupa albaranes firmados del mismo cliente en una factura con relación. Los no firmados se quedan fuera.')
      + (blocks || '<div class="card">No hay albaranes firmados pendientes de facturar.</div>')
      + (unsigned.length ? '<div class="card"><h3>Sin firmar</h3><ul class="act">' + unsigned.map(a => '<li><a href="#/albaran/' + a.id + '">' + esc(a.num) + '</a> · falta la firma</li>').join('') + '</ul></div>' : '');
  };

  VIEWS.stock = () => {
    const rows = PL.cuadre(S);
    return head('Stock y cuadre', 'Existencias por lote (FIFO). El contado del plátano viene 3 kg por debajo a propósito, para ver la diferencia.')
      + '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="r">Entradas</th><th class="r">Salidas</th><th class="r">Teórico</th><th class="r">Contado</th><th class="r">Diferencia</th><th class="r">Valor</th></tr></thead><tbody>'
      + rows.map(r => '<tr><td>' + esc(r.p.name) + '<div class="small muted">' + r.lots.map(l => esc(l.lot) + ' · ' + esc(l.origin) + ' · queda ' + PL.qtyText(l.left)).join('<br>') + '</div></td><td class="r">' + PL.qtyText(r.entradas) + '</td><td class="r">' + PL.qtyText(r.salidas) + '</td><td class="r">' + PL.qtyText(r.left) + '</td><td class="r"><input data-count="' + r.p.id + '" value="' + (r.counted == null ? '' : esc(PL.qtyText(r.counted))) + '" style="max-width:90px" aria-label="Contado ' + esc(r.p.name) + '"></td><td class="r">' + (r.diff == null ? '—' : PL.qtyText(r.diff)) + '</td><td class="r">' + money(r.value) + '</td></tr>').join('')
      + '</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn sec" data-act="saveCounts">Guardar conteo</button></div>'
      + '<form class="card" data-form="entrada"><h3>Entrada de mercancía</h3><div class="filters"><div><label class="f">Producto</label><select name="pid">' + S.products.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select></div>'
      + '<div><label class="f">Cantidad</label><input name="qty" placeholder="50"></div><div><label class="f">Coste €/ud</label><input name="cost" placeholder="0,95"></div><div><label class="f">Lote</label><input name="lot" placeholder="L-2026-10"></div></div>'
      + '<div class="two" style="margin-top:8px"><div><label class="f">Origen</label><input name="origin" value="Gran Canaria"></div><div><label class="f">Fecha</label><input type="date" name="date" value="' + todayISO() + '"></div></div>'
      + '<button class="btn" style="margin-top:10px">Dar entrada</button></form>';
  };
  VIEWS.conta = () => {
    const t = PL.trial(S);
    const ing = t.list.filter(a => a.code === '700' || a.code === '705').reduce((s, a) => s + a.saldoHaber, 0);
    const gas = t.list.filter(a => a.code === '600').reduce((s, a) => s + a.saldoDebe, 0);
    return head('Contabilidad', 'Diario derivado de facturas, cobros y compras. Módulo básico de demo: no son libros oficiales.')
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Ingresos</div><div class="val">' + money(ing) + '</div></div><div class="card kpi"><div class="lbl">Compras</div><div class="val">' + money(gas) + '</div></div><div class="card kpi"><div class="lbl">Resultado orientativo</div><div class="val">' + money(ing - gas) + '</div></div></div>'
      + '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Cuenta</th><th class="r">Debe</th><th class="r">Haber</th></tr></thead><tbody>'
      + t.list.map(a => '<tr><td>' + esc(a.code) + ' ' + esc(a.name) + '</td><td class="r">' + money(a.saldoDebe) + '</td><td class="r">' + money(a.saldoHaber) + '</td></tr>').join('')
      + '<tr><td><b>Sumas</b></td><td class="r"><b>' + money(t.debe) + '</b></td><td class="r"><b>' + money(t.haber) + '</b></td></tr></tbody></table></div>'
      + (t.debe === t.haber ? '<p class="hint">El balance de sumas cuadra.</p>' : '<p class="badbox">Las sumas no cuadran.</p>');
  };

  VIEWS.firmar = route => {
    const doc = findDoc(route.id);
    if (!doc) return '<div class="card">Documento no encontrado.</div>';
    if (doc.signed) return '<div class="card">Ya está firmado. <a href="#' + (PL.byId(S.invoices, doc.id) ? '/factura/' : '/albaran/') + doc.id + '">Volver</a></div>';
    const who = client(doc.clientId);
    return head('Firmar', esc(doc.num) + ' · ' + esc(who ? who.name : '') + ' · ' + money(PL.totals(doc).total))
      + '<div class="card"><label class="f">Nombre de quien firma</label><input id="signer" placeholder="Nombre y apellidos" autocomplete="off">'
      + '<label class="f" style="margin-top:10px">Firma con el dedo o el ratón</label><canvas class="sign" id="sigcv"></canvas>'
      + '<div class="row" style="margin-top:10px"><button class="btn ghost" type="button" data-act="sigClear">Borrar</button><button class="btn" id="sigok" data-act="sigDo" data-id="' + doc.id + '" disabled>Guardar firma</button></div>'
      + '<p class="hint">Se guarda el trazo en este navegador y un hash del documento. No es una firma electrónica cualificada.</p></div>';
  };

  function sheetInvoice(inv) {
    const cl = client(inv.clientId) || {};
    const t = PL.totals(inv);
    const lines = inv.lines.map(ln => {
      const a = PL.lineAmounts(ln);
      const note = [ln.note, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · ');
      return '<tr><td>' + esc(ln.desc) + (note ? '<div class="small">' + esc(note) + '</div>' : '') + '</td><td class="r">' + PL.qtyText(ln.qtyMilli) + '</td><td class="r">' + PL.eurPlain(ln.price) + ' €</td><td class="r">' + PL.eurPlain(a.base) + ' €</td><td class="r">' + (ln.rate || 0) + ' %</td><td class="r">' + PL.eurPlain(a.total) + ' €</td></tr>';
    }).join('');
    return '<article class="sheet"><div class="top"><img class="logo" src="logo-epik-seal.jpg" alt=""><div class="who"><h2 style="font-size:18px;color:#142033">' + esc(S.company.name) + '</h2><div>CIF ' + esc(S.company.nif) + '</div><div>' + esc(S.company.address) + '</div><div>' + esc(S.company.cp) + ' ' + esc(S.company.city) + '</div><div>' + esc(S.company.email) + '</div></div><div class="doc"><h2>FACTURA</h2><div class="num">' + esc(inv.num) + '</div><div>Fecha ' + PL.fd(inv.date) + '</div><div>' + statusLabel(inv.status) + '</div></div></div>'
      + '<div class="client"><div class="small">CLIENTE</div><b>' + esc(cl.name || '') + '</b><div>NIF/CIF ' + esc(cl.nif || '') + ' ' + esc(PL.addr(cl)) + '</div></div>'
      + '<table><thead><tr><th>Descripción</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Importe</th></tr></thead><tbody>' + lines + '</tbody></table>'
      + '<p style="text-align:right"><b>Base ' + money(t.base) + ' · IGIC ' + money(t.igic) + ' · TOTAL ' + money(t.total) + '</b></p>'
      + '<div class="foot">' + esc(S.company.mercantile) + '<br>IBAN ' + esc(S.company.ibanBank) + ' ' + esc(S.company.iban) + '<br>IAE: ' + esc(S.company.iae)
      + '<br>Piloto PAGUU. Verifactu generado en local. Envío a la AEAT simulado, no realizado.</div></article>';
  }
  function doPrint(html) {
    document.getElementById('paper').innerHTML = html;
    window.print();
  }

  let logoCache = null;
  async function logoBytes() {
    if (logoCache) return logoCache;
    const r = await fetch('logo-epik-seal.jpg');
    logoCache = new Uint8Array(await r.arrayBuffer());
    return logoCache;
  }
  function qrMatrix(text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const rows = [];
    for (let r = 0; r < n; r++) {
      let s = '';
      for (let c = 0; c < n; c++) s += q.isDark(r, c) ? '1' : '0';
      rows.push(s);
    }
    return rows;
  }
  function qrSvg(text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  }
  async function invoicePdfBytes(inv) {
    const jpeg = await logoBytes();
    const cl = client(inv.clientId) || { name: '', nif: '' };
    const t = PL.totals(inv);
    const lines = inv.lines.map(ln => {
      const a = PL.lineAmounts(ln);
      return {
        desc: ln.desc,
        note: [ln.note, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · '),
        qty: PL.qtyText(ln.qtyMilli), price: PL.eurPlain(ln.price), base: PL.eurPlain(a.base), rate: (ln.rate || 0) + ' %', total: PL.eurPlain(a.total)
      };
    });
    let qr = null;
    try { qr = qrMatrix(PL.qrPayload(S, inv)); } catch (e) { qr = null; }
    return PaguuPdf.invoicePdf({
      company: { name: S.company.name, nif: S.company.nif, addressLines: [S.company.address, (S.company.cp + ' ' + S.company.city).trim(), S.company.email].filter(Boolean) },
      num: inv.num, date: 'Fecha ' + PL.fd(inv.date), status: statusLabel(inv.status),
      client: { name: cl.name || '', nifLine: 'NIF/CIF ' + (cl.nif || ''), addr: PL.addr(cl) },
      lines, base: PL.eurPlain(t.base) + ' €', igic: PL.eurPlain(t.igic) + ' €', total: PL.eurPlain(t.total) + ' €',
      footer: [S.company.mercantile, 'IBAN ' + S.company.ibanBank + ' ' + S.company.iban, 'IAE: ' + S.company.iae],
      disclaimer: 'Piloto PAGUU · Verifactu generado en local · envío a la AEAT simulado, no realizado.',
      qr
    }, jpeg);
  }
  function downloadBlob(name, bytes, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function csv(rows) {
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return '\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  }
  function log(date, text, ref, n) {
    S.log.push({ id: 'lg' + Date.now() + Math.random().toString(16).slice(2, 6), date: date || todayISO(), n: n || 0, text, ref: ref || '' });
  }

  const ACT = {
    toggleGrp(t) { OPEN[t.dataset.g] = !OPEN[t.dataset.g]; render(); },
    theme() {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('paguu-theme', next);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'light' ? '#eef3f8' : '#070b14');
      render();
    },
    nav() { document.getElementById('side').classList.toggle('open'); },
    factPage(t) { factPage += Number(t.dataset.d) || 0; if (factPage < 1) factPage = 1; render(); },
    async pdfInv(t) {
      const inv = PL.byId(S.invoices, t.dataset.id);
      toast('Generando PDF…');
      downloadBlob(inv.num + '.pdf', await invoicePdfBytes(inv), 'application/pdf');
    },
    printInv(t) { doPrint(sheetInvoice(PL.byId(S.invoices, t.dataset.id))); },
    printAlb(t) {
      const a = PL.byId(S.albaranes, t.dataset.id);
      doPrint(sheetInvoice(Object.assign({}, a, { status: a.signed ? 'firmado' : 'sin firmar' })).replace('FACTURA', 'ALBARÁN'));
    },
    simular(t) {
      const rec = S.chain.find(c => c.id === t.dataset.id);
      if (!rec) return;
      rec.aeat = 'simulado';
      log(todayISO(), 'Envío AEAT simulado (no se ha llamado a la AEAT)', rec.invoiceId, 0);
      save(); toast('Simulación hecha. No se ha llamado a la AEAT.'); render();
    },
    descasar(t) { PL.unmatchBank(S, t.dataset.id); save(); toast('Casación deshecha'); render(); },
    addLine(t) { const D = DRAFT[t.dataset.k]; if (!D) return; D.lines.push(blankLine(0)); render(); },
    delLine(t) { const D = DRAFT[t.dataset.k]; D.lines.splice(Number(t.dataset.i), 1); if (!D.lines.length) D.lines.push(blankLine(0)); render(); },
    preset(t) { DRAFT[t.dataset.k].lines.push(blankLine(t.dataset.rate)); render(); },
    delContacto(t) {
      const id = t.dataset.id;
      if (t.dataset.kind === 'c') {
        if (S.invoices.some(i => i.clientId === id) || S.albaranes.some(a => a.clientId === id)) throw new Error('Tiene documentos y no se elimina');
        S.clients = S.clients.filter(c => c.id !== id); save(); go('#/clientes');
      } else {
        if ((S.received || []).some(i => i.supplierId === id)) throw new Error('Tiene facturas recibidas y no se elimina');
        S.suppliers = S.suppliers.filter(c => c.id !== id); save(); go('#/proveedores');
      }
    },
    restore() {
      if (!confirm('Se sustituyen los datos de este navegador por el piloto Epik. ¿Continuar?')) return;
      S = PL.prepare(window.PAGUU_SEED); save(); toast('Piloto Epik restaurado'); go('#/inicio');
    },
    saveCounts() {
      document.querySelectorAll('[data-count]').forEach(el => {
        const v = el.value.trim();
        S.counts[el.dataset.count] = v === '' ? null : PL.parseQty(v);
      });
      save(); toast('Conteo guardado'); render();
    },
    excelRel() { downloadRel('csv'); },
    async zipRel() { await downloadRel('zip'); },
    async pdfRel() { await downloadRel('pdf'); },
    excelBen() {
      const route = parse();
      const b = PL.beneficios(S, route.q.desde || (defaultMonth() + '-01'), route.q.hasta || PL.monthEnd(defaultMonth()));
      const rows = [['Cliente', 'Facturas', 'Base', 'Coste', 'Beneficio']].concat(b.byClient.map(g => [(client(g.clientId) || {}).name, g.n, PL.eurPlain(g.base), g.known ? PL.eurPlain(g.cost) : '', g.known ? PL.eurPlain(g.base - g.cost) : '']));
      downloadBlob('beneficios.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
    },
    excelDeuda() {
      const age = PL.aging(S, todayISO());
      const rows = [['Cliente', 'Facturas', '0-30', '31-60', '61-90', '+90', 'Total']].concat(age.map(r => [(client(r.clientId) || {}).name, r.n, PL.eurPlain(r.b0), PL.eurPlain(r.b30), PL.eurPlain(r.b60), PL.eurPlain(r.b90), PL.eurPlain(r.total)]));
      downloadBlob('deuda.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
    },
    sigClear() { initSig(true); },
    sigDo(t) {
      const doc = findDoc(t.dataset.id);
      const name = document.getElementById('signer').value;
      const paths = SIG.strokes.map(s => 'M' + s.map(p => p[0] + ' ' + p[1]).join(' L'));
      PL.signDoc(doc, { name, paths, w: SIG.w, h: SIG.h });
      log(todayISO(), 'Documento firmado', doc.id, doc.n || 0);
      save(); toast('Firma guardada en este navegador');
      go((PL.byId(S.invoices, doc.id) ? '#/factura/' : '#/albaran/') + doc.id);
    }
  };

  async function downloadRel(kind) {
    const route = parse();
    const { ym, clientId } = relQuery(route);
    const rel = PL.relacion(S, ym, clientId);
    const cl = client(clientId);
    if (kind === 'csv') {
      const rows = [['Numero', 'Fecha', 'Base', 'IGIC', 'Total', 'Estado', 'Pendiente', 'Detalle']].concat(rel.invs.map(inv => {
        const t = PL.totals(inv);
        return [inv.num, PL.fd(inv.date), PL.eurPlain(t.base), PL.eurPlain(t.igic), PL.eurPlain(t.total), inv.status, inv.status === 'emitida' ? PL.eurPlain(t.total) : '0,00', inv.lines.map(l => l.desc).join(' / ')];
      }));
      downloadBlob('relacion-' + ym + '.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
      return;
    }
    if (kind === 'pdf') {
      const jpeg = await logoBytes();
      const bytes = PaguuPdf.relacionPdf({
        company: S.company.name + ' · CIF ' + S.company.nif,
        subtitle: 'Relación de ' + ym, party: cl ? cl.name : '', partyNif: cl ? cl.nif : '',
        rows: rel.invs.map(inv => {
          const t = PL.totals(inv);
          return { num: inv.num, date: PL.fd(inv.date), base: PL.eurPlain(t.base), igic: PL.eurPlain(t.igic), total: PL.eurPlain(t.total), status: statusLabel(inv.status), pend: PL.eurPlain(inv.status === 'emitida' ? t.total : 0), note: inv.lines.map(l => l.desc + (l.lot ? ' · Lote ' + l.lot : '')).join(' / ') };
        }),
        mes: 'Mes: base ' + PL.eurPlain(rel.base) + ' · IGIC ' + PL.eurPlain(rel.igic) + ' · total ' + PL.eurPlain(rel.total),
        saldo: 'Saldo acumulado ' + PL.eurPlain(rel.saldo) + ' EUR',
        disclaimer: 'Piloto PAGUU · documento local.'
      }, jpeg);
      downloadBlob('relacion-' + ym + '.pdf', bytes, 'application/pdf');
      return;
    }
    toast('Generando ZIP…');
    const files = [];
    for (const inv of rel.invs) {
      if (inv.status === 'anulada') continue;
      files.push({ name: inv.num + '.pdf', data: await invoicePdfBytes(inv) });
    }
    if (!files.length) throw new Error('No hay facturas en esta relación');
    downloadBlob('relacion-' + ym + '.zip', PaguuPdf.zipStore(files), 'application/zip');
  }

  const FORMS = {
    verRel(f) { go('#/relacion?mes=' + encodeURIComponent(f.mes.value) + '&cliente=' + encodeURIComponent(f.cliente.value)); },
    verBen(f) { go('#/beneficios?desde=' + encodeURIComponent(f.desde.value) + '&hasta=' + encodeURIComponent(f.hasta.value) + '&orden=' + encodeURIComponent(f.orden.value)); },
    costes(f) {
      const inv = PL.byId(S.invoices, f.dataset.id);
      inv.lines.forEach((ln, i) => {
        const v = f.querySelector('[name="cost-' + i + '"]').value.trim();
        if (!v) { ln.cost = null; return; }
        const c = PL.parseEur(v);
        if (c == null || c < 0) throw new Error('Coste no válido');
        ln.cost = c;
      });
      log(todayISO(), 'Coste interno actualizado', inv.id, inv.n);
      save(); toast('Coste interno guardado. No modifica la factura ni la huella.'); render();
    },
    anular(f) {
      PL.anular(S, f.dataset.id, f.motivo.value, todayISO());
      save(); toast('Factura anulada. La cadena se ha alargado en local.'); render();
    },
    emitir() {
      const inv = PL.emitirFactura(S, { clientId: DRAFT.fac.clientId, date: DRAFT.fac.date, lines: DRAFT.fac.lines });
      DRAFT.fac = null; save(); toast('Factura ' + inv.num + ' emitida. Registro Verifactu local, sin envío.'); go('#/factura/' + inv.id);
    },
    albaran() {
      const doc = PL.crearAlbaran(S, { clientId: DRAFT.alb.clientId, date: DRAFT.alb.date, lines: DRAFT.alb.lines });
      DRAFT.alb = null; save(); toast('Albarán ' + doc.num + ' creado'); go('#/albaran/' + doc.id);
    },
    recibida() {
      const rec = PL.crearRecibida(S, { supplierId: DRAFT.rec.supplierId, date: DRAFT.rec.date, lines: DRAFT.rec.lines });
      DRAFT.rec = null; save(); toast('Factura recibida ' + rec.num); go('#/recibidas');
    },
    casar(f) {
      if (!f.bank.value || !f.inv.value) throw new Error('Elige movimiento y factura');
      PL.matchBank(S, f.bank.value, f.inv.value);
      save(); toast('Cobro casado. La factura queda cobrada.'); render();
    },
    casarPago(f) { PL.matchPago(S, f.bank.value, f.rec.value); save(); toast('Pago casado'); render(); },
    bank(f) {
      const amount = PL.parseEur(f.amount.value);
      if (amount == null || amount <= 0) throw new Error('Importe no válido');
      const signed = f.tipo.value === 'pago' ? -amount : amount;
      S.bank.unshift({ id: 'b' + Date.now(), date: f.date.value || todayISO(), concept: f.concept.value.trim() || 'Movimiento simulado', amount: signed, invoiceId: null, receivedId: null, origin: 'simulado' });
      save(); toast('Movimiento añadido. Aún no cambia el estado de ninguna factura.'); render();
    },
    remesa(f) {
      const ids = [...f.querySelectorAll('input[name=ids]:checked')].map(x => x.value);
      if (!ids.length) throw new Error('Marca al menos una factura');
      let total = 0;
      ids.forEach(id => { total += PL.totals(PL.byId(S.invoices, id)).total; });
      S.remesas.unshift({ id: 'RM' + (S.remesas.length + 1), date: todayISO(), concept: f.concept.value.trim() || 'Remesa', invoiceIds: ids, total, status: 'preparada' });
      log(todayISO(), 'Remesa preparada (' + ids.length + ' facturas)', '', 0);
      save(); toast('Remesa preparada. Las facturas siguen pendientes hasta que el banco cuadre.'); render();
    },
    contacto(f) {
      const data = {};
      ['name', 'nif', 'address', 'cp', 'city', 'province', 'country', 'email', 'phone'].forEach(k => data[k] = f[k].value.trim());
      if (data.name.length < 2) throw new Error('Falta la razón social');
      if (!data.nif) throw new Error('Falta el NIF/CIF');
      const kind = f.dataset.kind;
      const list = kind === 'c' ? S.clients : S.suppliers;
      if (f.dataset.id) {
        const rec = list.find(x => x.id === f.dataset.id);
        Object.assign(rec, data);
        save(); toast('Ficha actualizada'); render();
      } else {
        const id = (kind === 'c' ? 'c' : 's') + data.nif.replace(/\s/g, '');
        if (list.some(x => x.id === id)) throw new Error('Ya existe una ficha con ese NIF');
        list.push(Object.assign({ id }, data));
        save(); go(kind === 'c' ? '#/cliente/' + id : '#/proveedor/' + id);
      }
    },
    empresa(f) {
      ['name', 'nif', 'address', 'cp', 'city', 'province', 'email', 'phone', 'mercantile', 'iae', 'iban', 'ibanBank'].forEach(k => { if (f[k]) S.company[k] = f[k].value.trim(); });
      save(); toast('Datos de empresa guardados en este navegador'); render();
    },
    nextNum(f) {
      const n = parseInt(f.next.value, 10);
      const max = S.invoices.reduce((m, i) => Math.max(m, i.n), 0);
      if (!n || n <= max) throw new Error('El número tiene que ser mayor que ' + max);
      S.nextFac = n; save(); toast(n === max + 1 ? 'Siguiente número actualizado' : 'Siguiente número actualizado. Quedará un hueco.'); render();
    },
    finmes(f) {
      const ids = [...f.querySelectorAll('input[name=ids]:checked')].map(x => x.value);
      const inv = PL.facturarAlbaranes(S, ids, f.date.value || todayISO());
      save(); toast('Factura ' + inv.num + ' emitida con la relación'); go('#/factura/' + inv.id);
    },
    entrada(f) {
      const qty = PL.parseQty(f.qty.value);
      const cost = PL.parseEur(f.cost.value);
      PL.addLot(S, { pid: f.pid.value, qtyMilli: qty, cost, lot: f.lot.value.trim(), origin: f.origin.value.trim(), date: f.date.value });
      save(); toast('Entrada registrada'); render();
    }
  };

  function onDraft(t) {
    const parts = (t.dataset.draft || '').split(':');
    const kind = parts[0], field = parts[1], idx = parts[2];
    const D = DRAFT[kind];
    if (!D) return;
    if (field === 'client') D.clientId = t.value;
    else if (field === 'supplier') D.supplierId = t.value;
    else if (field === 'date') D.date = t.value;
    else if (field === 'pid') {
      const ln = D.lines[+idx];
      ln.pid = t.value;
      const p = PL.byId(S.products, t.value);
      if (p) { ln.desc = p.name; ln.price = PL.eurPlain(p.price); ln.rate = '0'; ln.note = 'Fruta y verdura · IGIC 0 %'; }
      render();
      return;
    } else {
      D.lines[+idx][field] = t.value;
      if (field === 'rate') D.lines[+idx].note = t.value === '7' ? 'Servicios 7 %' : 'Fruta y verdura · IGIC 0 %';
    }
    const live = document.getElementById('live');
    if (live) {
      const tot = draftTotals(kind);
      live.innerHTML = '<div class="row"><span class="grow muted">Base</span><b>' + money(tot.base) + '</b></div><div class="row"><span class="grow muted">IGIC</span><b>' + money(tot.igic) + '</b></div><div class="row"><span class="grow">Total</span><b>' + money(tot.total) + '</b></div>';
    }
  }

  function initSig(reset) {
    const cv = document.getElementById('sigcv');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = cv.clientHeight || 220;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#142033';
    SIG = { w, h, strokes: [], cur: null };
    const btn = document.getElementById('sigok');
    const upd = () => { if (btn) btn.disabled = !((document.getElementById('signer').value || '').trim().length >= 2 && SIG.strokes.length); };
    if (reset) { upd(); return; }
    const pos = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10]; };
    cv.onpointerdown = e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} const p = pos(e); SIG.cur = [p]; g.beginPath(); g.moveTo(p[0], p[1]); };
    cv.onpointermove = e => { if (!SIG.cur) return; const p = pos(e); SIG.cur.push(p); g.lineTo(p[0], p[1]); g.stroke(); };
    const end = () => { if (SIG.cur && SIG.cur.length > 1) SIG.strokes.push(SIG.cur); SIG.cur = null; upd(); };
    cv.onpointerup = end; cv.onpointercancel = end;
    const name = document.getElementById('signer');
    if (name) name.oninput = upd;
  }

  async function importFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    if (text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      let n = 0;
      for (const row of data.clientes || []) {
        const id = 'c' + row.nif_cif;
        if (S.clients.some(c => c.id === id)) continue;
        S.clients.push({ id, name: row.razon_social, nif: row.nif_cif, address: row.direccion || '', cp: row.codigo_postal || '', city: row.ciudad || '', province: row.provincia || '', country: row.pais || 'España', email: row.email || '', phone: row.telefono || '' });
        n++;
      }
      for (const row of data.proveedores || []) {
        const id = 's' + row.nif_cif;
        if (S.suppliers.some(c => c.id === id)) continue;
        S.suppliers.push({ id, name: row.razon_social, nif: row.nif_cif, address: row.direccion || '', cp: row.codigo_postal || '', city: row.ciudad || '', province: row.provincia || '', country: row.pais || 'España', email: row.email || '', phone: row.telefono || '' });
        n++;
      }
      save(); toast(n ? ('Fichas nuevas: ' + n) : 'Esas fichas ya estaban'); render();
      return;
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const head = lines.shift().split(';').map(x => x.trim().toLowerCase());
    const ix = k => head.indexOf(k);
    let added = 0, skip = 0;
    for (const line of lines) {
      const col = line.split(';');
      const num = (col[ix('numero')] || '').trim();
      if (!num || S.invoices.some(i => i.num === num)) { skip++; continue; }
      const name = (col[ix('cliente')] || '').trim();
      const cl = S.clients.find(c => c.name === name);
      if (!cl) { skip++; continue; }
      const total = PL.parseEur(col[ix('total')] || '');
      const base = PL.parseEur(col[ix('base_imponible')] || col[ix('base')] || '');
      const igic = PL.parseEur(col[ix('igic')] || '');
      let price, rate;
      if (base != null && igic != null) { price = base; rate = base ? Math.round(igic / base * 100) : 0; }
      else { price = total; rate = 0; }
      if (price == null) { skip++; continue; }
      const parts = (col[ix('fecha')] || '').split('/');
      const date = parts.length === 3 ? parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0') : todayISO();
      const nMatch = new RegExp('^' + S.company.serie + '(\\d+)$').exec(num);
      const n = nMatch ? parseInt(nMatch[1], 10) : S.nextFac;
      const estado = (col[ix('estado')] || '').toLowerCase();
      const inv = {
        id: 'imp' + n + '-' + added, n, num, date, clientId: cl.id,
        lines: [{ desc: rate === 7 ? 'Servicio' : 'Fruta y verdura', qtyMilli: 1000, price, rate: rate === 7 ? 7 : 0, lot: 'L-' + date.slice(0, 7), origin: 'Gran Canaria', note: rate === 7 ? 'Servicios 7 %' : 'Fruta y verdura · IGIC 0 %', cost: null, pid: null }],
        status: estado.indexOf('cobrad') >= 0 ? 'emitida' : 'emitida', source: 'importada', groups: [], signed: null, anulacion: null
      };
      if (n >= S.nextFac) S.nextFac = n + 1;
      S.invoices.push(inv);
      const t = PL.totals(inv);
      const prev = S.chain.length ? S.chain[S.chain.length - 1].hash : PL.ZERO;
      const rec = { id: 'chimp' + n, invoiceId: inv.id, num, date, tipo: 'Alta', nif: S.company.nif, base: t.base, igic: t.igic, total: t.total, prev, motivo: '', aeat: 'no-enviado' };
      rec.hash = PL.sha256(PL.canon(rec));
      S.chain.push(rec); inv.huella = rec.hash; inv.huellaPrev = prev;
      if (estado.indexOf('cobrad') >= 0) {
        S.bank.push({ id: 'bimp' + n, date, concept: 'Cobro importado ' + num, amount: t.total, invoiceId: null, receivedId: null, origin: 'importado' });
        try { PL.matchBank(S, 'bimp' + n, inv.id); } catch (e) { /* deja el ingreso sin casar si no cuadra */ }
      }
      log(date, 'Factura importada', inv.id, n);
      added++;
    }
    save(); toast('Importadas ' + added + ' facturas. Omitidas ' + skip + '.'); render();
  }

  function render() {
    const route = parse();
    document.getElementById('side').innerHTML = sidebar(route);
    const view = document.getElementById('view');
    const fn = VIEWS[route.name] || VIEWS.inicio;
    let html = '';
    try { html = fn(route); }
    catch (err) { console.error(err); html = '<div class="badbox">' + esc(err.message) + '</div>'; }
    view.innerHTML = html;
    view.querySelectorAll('[data-qrid]').forEach(el => {
      const inv = PL.byId(S.invoices, el.dataset.qrid);
      if (!inv) return;
      try { el.innerHTML = qrSvg(PL.qrPayload(S, inv)); }
      catch (e) { el.textContent = 'QR no disponible'; }
    });
    if (view.querySelector('#sigcv')) initSig(false);
    const titles = { inicio: 'Inicio', facturas: 'Facturas', factura: 'Factura', nueva: 'Nueva factura', beneficios: 'Beneficios', relacion: 'Relación', verifactu: 'Verifactu', clientes: 'Clientes', cobros: 'Cobros' };
    document.title = 'PAGUU · ' + (titles[route.name] || 'facturación con IGIC');
  }

  document.body.addEventListener('click', e => {
    const a = e.target.closest('#side a');
    if (a) document.getElementById('side').classList.remove('open');
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = ACT[t.dataset.act];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve().then(() => fn(t, e)).catch(err => { console.error(err); toast(err.message || 'No se pudo completar', 'bad'); });
  });
  document.body.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (!fn) return;
    try { fn(f); }
    catch (err) { console.error(err); toast(err.message || 'Revisa los datos', 'bad'); }
  });
  document.body.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset && t.dataset.draft) onDraft(t);
    if (t.dataset && t.dataset.actInput === 'factQ') { factQ = t.value; factPage = 1; const pos = t.selectionStart; render(); const n = document.getElementById('qfact'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.body.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.draft) onDraft(t);
    if (t.dataset && t.dataset.actChange === 'importFile') importFile(t).catch(err => toast(err.message, 'bad'));
  });
  window.addEventListener('hashchange', render);

  const theme = localStorage.getItem('paguu-theme') || 'dark';
  document.documentElement.dataset.theme = theme;
  S = load();
  if (!localStorage.getItem(KEY)) save();
  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
