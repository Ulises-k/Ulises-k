/* Cotizador Mauli — todo corre en el navegador, sin servidor. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEY_DRAFT = "mauli_borrador_v1";
  const KEY_SAVED = "mauli_cotizaciones_v1";
  const KEY_COMPANY = "mauli_empresa_v1";

  // ---------------------------------------------------------------- Defaults
  const DEFAULT_COMPANY = {
    logo: "",
    empresa: "Mauli",
    responsable: "Ulises Alexander Rivera Barahona",
    nombreCorto: "Ulises Barahona",
    dui: "06567792-7",
    contacto: "+503 7963-3970",
    gerente: "Ulises Alexander Rivera Barahona",
  };

  const DEFAULT_OBS = [
    "Una vez recibido el anticipo no se hacen devoluciones totales o parciales del mismo.",
    "Previo a la instalación de nuestros productos se requiere que los vanos estén totalmente terminados a escuadra plomo y nivel libres de cualquier residuo de mezcla o algún otro material. Caso contrario {empresa} se reserva el derecho de realizar la instalación. Se incluye limpieza del producto vendido al terminar la instalación cualquier limpieza adicional tendrá un costo por separado.",
    "El cliente se hace totalmente responsable por el pago de cualquier cambio o modificación que se requiera al presente contrato una vez empezada la fabricación.",
    "El cliente facilitará el abastecimiento adecuado de energía eléctrica para el uso de las herramientas de los instaladores.",
    "{empresa} no se hace responsable por daños ocasionados por terceros después de instalado el producto.",
    "Los productos y materiales de la presente obra son propiedad de {empresa} mientras no están cancelados en su totalidad. En caso de incumplimiento de pago del saldo contra entrega, nos reservamos el derecho de desmontar y retirar nuestros productos.",
    "En la oferta no está considerado el pago de fianzas, seguros, ni gastos contractuales, en caso de ser requeridos, el precio está sujeto a modificación.",
  ].join("\n");

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function newQuote() {
    return {
      id: null,
      numero: "",
      fecha: today(),
      tratamiento: "Sr.",
      cliente: "",
      direccion: "",
      telefono: "",
      propuesta: "Instalación de pasamanos de vidrio templado y pasamanos de acero inoxidable.",
      materiales: [
        { nombre: "Tubería", desc: "Tubo redondo de 2 pulgadas de acero inoxidable AISI 304" },
        { nombre: "Vidrio", desc: "Vidrio templado laminado negro de 10 milímetros" },
      ],
      productos: [
        {
          producto: "Pasamanos vidrio templado",
          cantidad: 1,
          desc:
            "Instalación de pasamanos con vidrio templado laminado negro de 10 milímetros y tubo pasamanos de 2 pulgadas\n" +
            "Todo fabricado con material de acero inoxidable AISI 304\n" +
            "1 metro de altura tendrá el pasamanos cuando esté terminado\n" +
            "Todas las uniones estarán soldadas con soldadura TIG para evitar quemaduras de piso, gradas e inmuebles.\n" +
            "Cada extremo del barandal en la parte superior será asegurado con soportes inoxidables tipo “J” sólidos.",
          medida: "",
          unidad: "metros",
          precio: "",
        },
      ],
      entrega: "35 días hábiles",
      entregaNota: "después de recibido el anticipo y rectificado las medidas de fabricación sujeto a avance de obra.",
      anticipo: 50,
      validez: "10 días calendario",
      cheque: "Ulises Alexander Rivera Barahona",
      garantia:
        "Garantía 10 años: cubre únicamente errores de fabricación e instalación y se podrá reclamar siempre y cuando presente la factura original o cotización firmada. Una vez recibido el anticipo no se hacen devoluciones totales o parciales del mismo. (Garantía cubre únicamente acero inoxidable y vidrio instalado).",
      observaciones: DEFAULT_OBS,
      tituloImagenes: "Imagen de referencia del trabajo a realizar",
      imagenes: [],
    };
  }

  // ---------------------------------------------------------------- Storage
  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function store(key, value, silent) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (!silent) toast("Memoria llena: borra cotizaciones viejas o usa menos imágenes.");
      return false;
    }
  }

  let company = Object.assign({}, DEFAULT_COMPANY, load(KEY_COMPANY, {}));
  let q = Object.assign(newQuote(), load(KEY_DRAFT, {}));

  // ---------------------------------------------------------------- Helpers
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => {
    const n = parseFloat(String(v).replace(/,/g, "."));
    return isFinite(n) ? n : 0;
  };
  const money = (n) => {
    const r = Math.round(n * 100) / 100;
    const dec = Number.isInteger(r) ? 0 : 2;
    return "$ " + r.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const fmtNum = (v) => {
    const n = num(v);
    return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  };
  const withCompany = (s) => esc(s).replace(/\{empresa\}/g, "<b>" + esc(company.empresa) + "</b>");

  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fechaLarga(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]} del ${y}`;
  }

  // Total de una fila: cantidad × medida × precio (si no hay medida: cantidad × precio)
  function rowTotal(p) {
    const cant = num(p.cantidad) || 1;
    const med = String(p.medida).trim() === "" ? 1 : num(p.medida);
    return cant * med * num(p.precio);
  }
  const grandTotal = () => q.productos.reduce((a, p) => a + rowTotal(p), 0);

  function singular(u) {
    const map = { metros: "metro", "metros²": "m²", "m²": "m²", "metros lineales": "metro lineal", unidades: "unidad", pies: "pie" };
    return map[u] || u;
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), msg.length > 60 ? 6000 : 2600);
  }

  // ---------------------------------------------------------------- Confirmar / guardar archivos
  // confirm() y las descargas directas no funcionan dentro de la página publicada en claude.ai,
  // por eso se usa un diálogo propio y la capacidad "downloads" cuando existe.
  function pedirConfirmacion(msg) {
    return new Promise((resolve) => {
      const d = $("dlgConfirm");
      $("confirmMsg").textContent = msg;
      const fin = (v) => { d.close(); resolve(v); };
      $("confirmSi").onclick = () => fin(true);
      $("confirmNo").onclick = () => fin(false);
      d.showModal();
    });
  }

  let downloadsApi = null;
  const enMarco = window.self !== window.top;
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("downloads").then((x) => { downloadsApi = x; }).catch(() => {});
  }

  async function guardarArchivo(blob, filename) {
    if (downloadsApi) {
      try {
        await downloadsApi.save({ filename, data: blob });
        return true;
      } catch (e) {
        if (e && e.code === "declined") return false;
        throw e;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }

  // ---------------------------------------------------------------- Imagenes
  // Decodifica la foto (createImageBitmap respeta la rotación del celular; si no existe, usa <img>).
  async function decodeImage(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* sigue */ }
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("decode"));
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function readImage(file, maxSide, keepPng) {
    const img = await decodeImage(file);
    const w = img.width, h = img.height;
    if (!w || !h) throw new Error("vacía");
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d");
    if (!keepPng) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    return keepPng ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
  }

  async function addImages(files) {
    if (!files.length) return;
    const estado = $("imgEstado");
    let ok = 0, fallas = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      estado.textContent = `Procesando foto ${i + 1} de ${files.length}…`;
      // Algunos celulares no indican el tipo del archivo: se intenta abrir igual.
      try {
        const data = await readImage(f, 1600, false);
        q.imagenes.push({ src: data, caption: "" });
        ok++;
        renderImages();
      } catch (e) {
        fallas++;
      }
    }
    estado.textContent = "";
    changed();
    if (fallas) {
      toast(fallas === 1 && !ok
        ? "No se pudo abrir esa foto. Si es HEIC (iPhone), conviértela a JPG o toma una captura de pantalla."
        : `Se agregaron ${ok}. ${fallas} no se pudieron abrir.`);
    } else {
      toast(ok === 1 ? "Imagen agregada" : `${ok} imágenes agregadas`);
    }
  }

  // ---------------------------------------------------------------- Form
  const SIMPLE = ["numero", "fecha", "tratamiento", "cliente", "direccion", "telefono", "propuesta",
    "entrega", "entregaNota", "anticipo", "validez", "cheque", "garantia", "observaciones", "tituloImagenes"];
  const COMPANY_FIELDS = ["empresa", "responsable", "nombreCorto", "dui", "contacto", "gerente"];

  function fillForm() {
    SIMPLE.forEach((k) => ($(k).value = q[k] == null ? "" : q[k]));
    COMPANY_FIELDS.forEach((k) => ($(k).value = company[k] || ""));
    const logo = company.logo || window.DEFAULT_LOGO || "";
    $("logoPreview").src = logo;
    $("topLogo").src = logo;
    renderMateriales();
    renderProductos();
    renderImages();
  }

  function renderMateriales() {
    const box = $("materiales");
    box.innerHTML = "";
    q.materiales.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = "row-item";
      el.innerHTML = `
        <div class="row-head">Material ${i + 1}
          <button type="button" class="btn small danger" data-del>Quitar</button></div>
        <label>Material <input data-k="nombre" value="${esc(m.nombre)}" placeholder="Ej. Tubería" /></label>
        <label>Descripción <input data-k="desc" value="${esc(m.desc)}" placeholder="Ej. Tubo redondo de 2 pulgadas AISI 304" /></label>`;
      el.querySelectorAll("[data-k]").forEach((inp) =>
        inp.addEventListener("input", () => { m[inp.dataset.k] = inp.value; changed(); }));
      el.querySelector("[data-del]").addEventListener("click", () => {
        q.materiales.splice(i, 1); renderMateriales(); changed();
      });
      box.appendChild(el);
    });
  }

  const UNIDADES = ["metros", "metros lineales", "m²", "unidades", "pies"];

  function renderProductos() {
    const box = $("productos");
    box.innerHTML = "";
    q.productos.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "row-item";
      const opts = UNIDADES.map((u) => `<option ${u === p.unidad ? "selected" : ""}>${u}</option>`).join("");
      el.innerHTML = `
        <div class="row-head">Producto ${i + 1}
          <button type="button" class="btn small danger" data-del>Quitar</button></div>
        <label>Producto <input data-k="producto" value="${esc(p.producto)}" placeholder="Ej. Pasamanos vidrio templado" /></label>
        <label>Descripción <small>(cada línea = un párrafo)</small>
          <textarea data-k="desc" rows="5">${esc(p.desc)}</textarea></label>
        <div class="grid3">
          <label>Cantidad <input data-k="cantidad" type="number" min="0" step="any" inputmode="decimal" value="${esc(p.cantidad)}" /></label>
          <label>Medidas <input data-k="medida" type="number" min="0" step="any" inputmode="decimal" value="${esc(p.medida)}" placeholder="12.9" /></label>
          <label>Unidad <select data-k="unidad">${opts}</select></label>
        </div>
        <label>Precio por ${esc(singular(p.unidad))} ($)
          <input data-k="precio" type="number" min="0" step="any" inputmode="decimal" value="${esc(p.precio)}" placeholder="345" /></label>
        <div class="row-total">Valor total: <b data-total>${money(rowTotal(p))}</b></div>`;
      el.querySelectorAll("[data-k]").forEach((inp) => {
        const ev = inp.tagName === "SELECT" ? "change" : "input";
        inp.addEventListener(ev, () => {
          p[inp.dataset.k] = inp.value;
          el.querySelector("[data-total]").textContent = money(rowTotal(p));
          if (inp.dataset.k === "unidad") renderProductos();
          changed();
        });
      });
      el.querySelector("[data-del]").addEventListener("click", () => {
        q.productos.splice(i, 1); renderProductos(); changed();
      });
      box.appendChild(el);
    });
  }

  function renderImages() {
    const box = $("imagenes");
    box.innerHTML = "";
    q.imagenes.forEach((im, i) => {
      const el = document.createElement("div");
      el.className = "thumb";
      el.innerHTML = `<img src="${im.src}" alt="" />
        <input placeholder="Pie de foto (opcional)" value="${esc(im.caption)}" />
        <button type="button" class="btn small danger">Quitar</button>`;
      el.querySelector("input").addEventListener("input", (e) => { im.caption = e.target.value; changed(); });
      el.querySelector("button").addEventListener("click", () => { q.imagenes.splice(i, 1); renderImages(); changed(); });
      box.appendChild(el);
    });
  }

  // ---------------------------------------------------------------- Documento
  function renderDoc() {
    const logo = company.logo || window.DEFAULT_LOGO || "";
    const total = grandTotal();
    const ant = Math.min(100, Math.max(0, num(q.anticipo)));
    const antMonto = (total * ant) / 100;
    const resto = total - antMonto;
    const nombreCliente = [q.tratamiento, q.cliente].filter(Boolean).join(" ");

    const units = [...new Set(q.productos.map((p) => p.unidad))];
    const precioHead = units.length === 1 ? `Precio por ${esc(singular(units[0]))}` : "Precio unitario";

    const mats = q.materiales.filter((m) => m.nombre || m.desc);
    const matsHtml = mats.length
      ? `<div class="box"><div class="box-title">Descripción de materiales</div>
          <table class="t mat">${mats.map((m) => `<tr><td>${esc(m.nombre)}</td><td>${esc(m.desc)}</td></tr>`).join("")}</table></div>`
      : "";

    const rows = q.productos.map((p) => {
      const paras = String(p.desc || "").split(/\n+/).filter((s) => s.trim()).map((s) => `<p>${esc(s)}</p>`).join("");
      const med = String(p.medida).trim() === "" ? "" : `${fmtNum(p.medida)} ${esc(p.unidad)}`;
      return `<tr>
        <td class="c">${esc(p.producto)}</td>
        <td class="c">${esc(p.cantidad)}</td>
        <td class="desc">${paras}</td>
        <td class="c">${med}</td>
        <td class="c">${p.precio === "" ? "" : money(num(p.precio))}</td>
        <td class="v">${money(rowTotal(p))}</td></tr>`;
    }).join("");

    const obs = String(q.observaciones || "").split(/\n+/).filter((s) => s.trim()).map((s) => `<p>${withCompany(s)}</p>`).join("");

    const pago = ant >= 100
      ? `Condición de pago: 100% anticipo (<span class="red">${money(total)}</span>).`
      : ant <= 0
        ? `Condición de pago: 100% contra entrega (<span class="red">${money(total)}</span>).`
        : `Condición de pago: ${fmtNum(ant)}% anticipo (<span class="red">${money(antMonto)}</span>) y ${fmtNum(100 - ant)}% contra entrega (<span class="red">${money(resto)}</span>), el restante se entregará al terminar la obra.`;

    const imgs = q.imagenes;
    const imgsHtml = imgs.length
      ? `<div class="page">
          <p class="img-title">${esc(q.tituloImagenes)}</p>
          ${imgs.map((im) => `<figure class="ref ${imgs.length > 1 ? "multi" : ""}"><img src="${im.src}" alt="" />${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`).join("")}
        </div>`
      : "";

    $("doc").innerHTML = `
      <div class="page">
        ${q.numero ? `<div class="doc-num">Cotización N° ${esc(q.numero)}</div>` : ""}
        ${logo ? `<div class="doc-logo"><img src="${logo}" alt="" /></div>` : ""}
        <div class="doc-client">
          <div><b>Cliente:</b> ${esc(q.cliente)}</div>
          <div class="r"><b>Fecha:</b> ${esc(fechaLarga(q.fecha))}</div>
          <div><b>Dirección:</b> ${esc(q.direccion)}</div>
          <div class="r"><b>Teléfono:</b> ${esc(q.telefono)}</div>
        </div>
        <p class="doc-intro">Estimado señor/a a su consideración sometemos la siguiente propuesta: <b>${esc(q.propuesta)}</b></p>
        ${matsHtml}
        <div class="box">
          <div class="box-title big">Propuesta</div>
          <table class="t prop">
            <colgroup><col class="col-prod"/><col class="col-cant"/><col/><col class="col-med"/><col class="col-pre"/><col class="col-tot"/></colgroup>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Descripción</th><th>Medidas</th><th>${precioHead}</th><th>Valor total</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="5" class="c">Total</td><td class="v"><b>${money(total)}</b></td></tr></tfoot>
          </table>
        </div>
      </div>

      <div class="page">
        <div class="obs">
          <p>OBSERVACIONES: ${pago}</p>
          <p>Tiempo estimado de entrega: <b>${esc(q.entrega)}</b> ${esc(q.entregaNota)} Validez de la oferta: ${esc(q.validez)}.</p>
          ${q.cheque ? `<p>Cheque a nombre de: ${esc(q.cheque)}.</p>` : ""}
          ${q.garantia ? `<p>${withCompany(q.garantia)}</p>` : ""}
          ${obs ? `<p class="u">ESTIMADO CLIENTE POR FAVOR TOMAR EN CUENTA LAS SIGUIENTES OBSERVACIONES</p>${obs}` : ""}
        </div>
        <div class="firmas">
          <b style="font-style:normal">Firma:</b>
          <div class="line"><span></span><b>${esc(company.responsable)}</b></div>
          <div class="line"><span></span><b>${esc(nombreCliente)}</b></div>
        </div>
        <div class="datos">
          ${company.nombreCorto ? `<div>${esc(company.nombreCorto)}</div>` : ""}
          ${company.dui ? `<div>Con n° de DUI: ${esc(company.dui)}</div>` : ""}
          ${company.contacto ? `<div>Contacto: ${esc(company.contacto)}</div>` : ""}
          ${company.gerente ? `<div>Gerente de proyecto: <i>${esc(company.gerente)}</i></div>` : ""}
          ${logo ? `<img class="mini-logo" src="${logo}" alt="" />` : ""}
        </div>
      </div>
      ${imgsHtml}`;

    $("totalForm").textContent = money(total);
    fitPreview();
  }

  function fitPreview() {
    const pane = $("previewPane");
    const scaleBox = $("previewScale");
    const docW = 816; // 8.5in a 96dpi
    const avail = pane.clientWidth - 32;
    const z = avail > 0 ? Math.min(1, avail / docW) : 1;
    scaleBox.style.zoom = z;
  }

  // ---------------------------------------------------------------- Cambios
  let saveT;
  function changed() {
    renderDoc();
    clearTimeout(saveT);
    saveT = setTimeout(() => store(KEY_DRAFT, q, true), 400);
  }

  function bindSimple() {
    SIMPLE.forEach((k) => {
      const el = $(k);
      const ev = el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
      el.addEventListener(ev, () => { q[k] = el.value; changed(); });
      if (ev === "change") el.addEventListener("input", () => { q[k] = el.value; changed(); });
    });
    COMPANY_FIELDS.forEach((k) => {
      $(k).addEventListener("input", () => {
        company[k] = $(k).value;
        store(KEY_COMPANY, company);
        renderDoc();
      });
    });
  }

  // ---------------------------------------------------------------- Guardadas
  function savedList() { return load(KEY_SAVED, []); }

  function guardar() {
    const list = savedList();
    if (!q.id) q.id = "c" + Date.now();
    q.guardado = new Date().toISOString();
    const i = list.findIndex((x) => x.id === q.id);
    const copy = JSON.parse(JSON.stringify(q));
    if (i >= 0) list[i] = copy; else list.unshift(copy);
    if (store(KEY_SAVED, list)) {
      store(KEY_DRAFT, q);
      toast("Cotización guardada");
    }
  }

  function abrirLista() {
    const list = savedList();
    const box = $("listaGuardadas");
    if (!list.length) {
      box.innerHTML = `<p class="hint">Aún no tienes cotizaciones guardadas.</p>`;
    } else {
      box.innerHTML = "";
      list.forEach((c) => {
        const tot = c.productos.reduce((a, p) => a + rowTotal(p), 0);
        const el = document.createElement("div");
        el.className = "saved";
        el.innerHTML = `<div><b>${esc(c.cliente || "(sin nombre)")}</b> ${c.numero ? "· " + esc(c.numero) : ""}
            <small>${esc(fechaLarga(c.fecha))} · ${money(tot)}</small></div>
          <div class="acts">
            <button type="button" class="btn small" data-a="open">Abrir</button>
            <button type="button" class="btn small" data-a="dup">Duplicar</button>
            <button type="button" class="btn small danger" data-a="del">Borrar</button>
          </div>`;
        el.addEventListener("click", (e) => {
          const a = e.target.dataset && e.target.dataset.a;
          if (!a) return;
          if (a === "open") {
            q = Object.assign(newQuote(), JSON.parse(JSON.stringify(c)));
            fillForm(); changed(); $("dlgGuardadas").close(); toast("Cotización abierta");
          } else if (a === "dup") {
            q = Object.assign(newQuote(), JSON.parse(JSON.stringify(c)), { id: null, fecha: today(), numero: "" });
            fillForm(); changed(); $("dlgGuardadas").close(); toast("Copia creada: cambia el cliente y guarda");
          } else if (a === "del") {
            $("dlgGuardadas").close();
            pedirConfirmacion("¿Borrar la cotización de " + (c.cliente || "(sin nombre)") + "?").then((ok) => {
              if (ok) store(KEY_SAVED, savedList().filter((x) => x.id !== c.id));
              abrirLista();
            });
          }
        });
        box.appendChild(el);
      });
    }
    if (!$("dlgGuardadas").open) $("dlgGuardadas").showModal();
  }

  function exportar() {
    const data = { empresa: company, cotizaciones: savedList() };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    guardarArchivo(blob, "respaldo-cotizaciones-" + today() + ".json").catch(() => toast("No se pudo exportar"));
  }

  function importar(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.empresa) { company = Object.assign({}, DEFAULT_COMPANY, data.empresa); store(KEY_COMPANY, company); }
        if (Array.isArray(data.cotizaciones)) {
          const list = savedList();
          data.cotizaciones.forEach((c) => { if (!list.some((x) => x.id === c.id)) list.push(c); });
          store(KEY_SAVED, list);
        }
        fillForm(); renderDoc(); abrirLista(); toast("Respaldo importado");
      } catch (e) {
        toast("Archivo no válido");
      }
    };
    r.readAsText(file);
  }

  // ---------------------------------------------------------------- PDF
  function nombreArchivo() {
    const limpio = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
    const prod = q.productos[0] ? limpio(q.productos[0].producto) : "";
    return ["Cotizacion", prod, limpio(q.cliente), q.fecha].filter(Boolean).join("_");
  }

  async function descargarPdf() {
    if (typeof window.html2pdf !== "function") {
      toast("Sin conexión para PDF directo: usa Imprimir → Guardar como PDF");
      imprimir();
      return;
    }
    const btn = $("btnPdf");
    btn.disabled = true;
    btn.textContent = "Generando…";
    const doc = $("doc");
    const scaleBox = $("previewScale");
    const prevZoom = scaleBox.style.zoom;
    scaleBox.style.zoom = 1;
    doc.classList.add("exporting");
    const sx = window.scrollX, sy = window.scrollY;
    window.scrollTo(0, 0);
    try {
      const blob = await window.html2pdf()
        .set({
          margin: [0.5, 0.55, 0.5, 0.55],
          filename: nombreArchivo() + ".pdf",
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], before: ".page + .page", avoid: ["tr", ".ref", ".obs p", ".firmas", ".datos", ".mat"] },
        })
        .from(doc)
        .outputPdf("blob");
      doc.classList.remove("exporting");
      scaleBox.style.zoom = prevZoom;
      window.scrollTo(sx, sy);
      const ok = await guardarArchivo(blob, nombreArchivo() + ".pdf");
      if (ok) toast("PDF descargado");
    } catch (e) {
      console.error(e);
      toast("No se pudo generar. Usa Imprimir → Guardar como PDF");
    } finally {
      doc.classList.remove("exporting");
      scaleBox.style.zoom = prevZoom;
      window.scrollTo(sx, sy);
      btn.disabled = false;
      btn.textContent = "Descargar PDF";
    }
  }

  function imprimir() {
    const old = document.title;
    document.title = nombreArchivo();
    window.print();
    setTimeout(() => (document.title = old), 1000);
  }

  // ---------------------------------------------------------------- Init
  function init() {
    fillForm();
    bindSimple();
    renderDoc();

    $("addMaterial").addEventListener("click", () => {
      q.materiales.push({ nombre: "", desc: "" }); renderMateriales(); changed();
    });
    $("addProducto").addEventListener("click", () => {
      q.productos.push({ producto: "", cantidad: 1, desc: "", medida: "", unidad: "metros", precio: "" });
      renderProductos(); changed();
    });

    // Imagenes de referencia
    $("imgInput").addEventListener("change", (e) => { addImages([...e.target.files]); e.target.value = ""; });
    const dz = $("dropZone");
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("over"));
    dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); addImages([...e.dataTransfer.files]); });

    // Logo
    $("logoInput").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      company.logo = await readImage(f, 700, true);
      store(KEY_COMPANY, company); fillForm(); renderDoc();
      e.target.value = "";
    });
    $("logoReset").addEventListener("click", () => {
      company.logo = ""; store(KEY_COMPANY, company); fillForm(); renderDoc();
    });

    // Barra
    $("btnNueva").addEventListener("click", () => {
      pedirConfirmacion("¿Empezar una cotización nueva? Lo que no guardaste se perderá.").then((ok) => {
        if (ok) { q = newQuote(); fillForm(); changed(); toast("Nueva cotización"); }
      });
    });
    $("btnGuardar").addEventListener("click", guardar);
    $("btnAbrir").addEventListener("click", abrirLista);
    $("cerrarDlg").addEventListener("click", () => $("dlgGuardadas").close());
    $("btnExportar").addEventListener("click", exportar);
    $("importInput").addEventListener("change", (e) => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ""; });
    $("btnPdf").addEventListener("click", descargarPdf);
    $("btnImprimir").addEventListener("click", imprimir);
    if (enMarco) $("btnImprimir").hidden = true; // imprimir no funciona dentro de la página publicada

    // Tabs móvil
    document.body.dataset.view = "form";
    document.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
        document.body.dataset.view = t.dataset.view;
        window.scrollTo(0, 0);
        fitPreview();
      }));

    window.addEventListener("resize", fitPreview);
    window.addEventListener("beforeprint", () => ($("previewScale").style.zoom = 1));
    window.addEventListener("afterprint", fitPreview);
  }

  init();
})();
