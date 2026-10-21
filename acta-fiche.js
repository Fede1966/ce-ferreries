/*
 * acta-fiche.js
 * Lector de la "Ficha del Partido" (PDF original) de la Federació de Futbol de les Illes Balears.
 *
 * Es una adaptación a JavaScript del lector que ya se usa en el panel de scouting
 * (analysis/lector_pdf.py): lee el texto del PDF con su posición en la página,
 * separa las tres columnas (local · datos del partido · visitante) y devuelve
 * equipos, marcador, goles, alineaciones, cambios y tarjetas.
 * El color de las tarjetas se lee del icono, dibujando la página en un canvas.
 *
 * Uso:  const acta = await ActaFiche.parse(pdfDocumentDePdfJs, makeCanvas?);
 * Lanza ActaFiche.SinTextoError si el PDF no tiene texto (escaneo) o
 * ActaFiche.FormatoDesconocidoError si no es una ficha de la federación.
 */
(function (root) {
  "use strict";

  const LIMITE_IZQUIERDA = 210.0;
  const LIMITE_DERECHA = 393.0;
  const HUECO_ENTRE_COLUMNAS = 10.0;
  const ANCHO_A4 = 595.0;
  const PPP = 100; // resolución a la que se dibuja la página para mirar los iconos

  const CABECERAS = {
    "TITULARES": "titulares",
    "SUPLENTES": "suplentes",
    "CUERPO TÉCNICO": "tecnicos",
    "CUERPO TECNICO": "tecnicos",
    "SUSTITUCIONES": "cambios",
    "TARJETAS": "tarjetas"
  };

  const RE_JUGADOR = /^(\d{1,3})\s+(.+?)(?:\s*\((\d{1,3})'\))?$/;
  const RE_TARJETA = /^(.+?)\s*\((\d{1,3})'\)$/;
  const RE_GOL = /^(\d+)\s*-\s*(\d+)\s+(.+?)\s*\((\d{1,3})'\)$/;
  const RE_MARCADOR = /^(\d+)\s*-\s*(\d+)$/;

  class SinTextoError extends Error {}
  class FormatoDesconocidoError extends Error {}

  const centro = (p) => (p.y0 + p.y1) / 2;
  const banda = (x) => (x < LIMITE_IZQUIERDA ? "L" : x < LIMITE_DERECHA ? "C" : "R");

  // Palabras con posición (origen arriba-izquierda, en puntos de un A4 de 595 de ancho)
  function palabrasDePagina(content, viewport) {
    const k = ANCHO_A4 / viewport.width;
    const alto = viewport.height * k;
    const palabras = [];
    content.items.forEach((item) => {
      const texto = item.str;
      if (!texto || !texto.trim()) return;
      const x = item.transform[4] * k;
      const y = item.transform[5] * k;
      const ancho = (item.width || 0) * k;
      const altura = Math.abs(item.height || item.transform[3] || 8) * k;
      const total = texto.length;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(texto))) {
        const x0 = x + (ancho * m.index) / total;
        const x1 = x + (ancho * (m.index + m[0].length)) / total;
        const y1 = alto - y + altura * 0.2; // base del texto (algo por debajo de la línea base)
        palabras.push({ x0, x1, y0: y1 - altura, y1, t: m[0] });
      }
    });
    return palabras;
  }

  function agruparLineas(palabras) {
    palabras.forEach((p) => { p.banda = banda(p.x0); });
    // Una palabra pegada a la de su izquierda es la continuación de un nombre largo
    const porX = palabras.slice().sort((a, b) => a.x0 - b.x0);
    porX.forEach((p) => {
      const vecinas = porX.filter((q) => q !== p
        && Math.abs(centro(q) - centro(p)) < 2.0
        && p.x0 - q.x1 >= 0 && p.x0 - q.x1 <= HUECO_ENTRE_COLUMNAS);
      if (vecinas.length) p.banda = vecinas.reduce((a, b) => (b.x1 > a.x1 ? b : a)).banda;
    });
    const resultado = { L: [], C: [], R: [] };
    Object.keys(resultado).forEach((b) => {
      const lista = palabras.filter((p) => p.banda === b)
        .sort((p, q) => centro(p) - centro(q) || p.x0 - q.x0);
      const filas = [];
      lista.forEach((p) => {
        const ultima = filas[filas.length - 1];
        if (ultima) {
          const medio = ultima.reduce((s, q) => s + centro(q), 0) / ultima.length;
          if (Math.abs(medio - centro(p)) < 2.5) { ultima.push(p); return; }
        }
        filas.push([p]);
      });
      filas.forEach((fila) => {
        fila.sort((p, q) => p.x0 - q.x0);
        resultado[b].push({
          texto: fila.map((p) => p.t).join(" ").trim(),
          x0: fila[0].x0,
          y0: Math.min(...fila.map((p) => p.y0)),
          y1: Math.max(...fila.map((p) => p.y1))
        });
      });
      resultado[b].sort((l, m) => l.y0 - m.y0 || l.x0 - m.x0);
    });
    return resultado;
  }

  // Color del icono de tarjeta: se miran los píxeles a la izquierda del texto
  function colorTarjeta(imagen, linea) {
    const f = imagen.factor; // píxeles por punto A4
    const x0 = Math.max(0, Math.floor((linea.x0 - 30) * f));
    const x1 = Math.max(0, Math.floor((linea.x0 - 1) * f));
    const y0 = Math.max(0, Math.floor((linea.y0 - 2) * f));
    const y1 = Math.max(0, Math.floor((linea.y1 + 2) * f));
    if (x1 <= x0 || y1 <= y0) return "yellow";
    const { data } = imagen.ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    let rojos = 0, amarillos = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 180 && g < 90 && b < 90) rojos++;
      else if (r > 200 && g > 150 && b < 110) amarillos++;
    }
    if (rojos >= 4 && amarillos >= 4) return "yellow+red";
    if (rojos >= 4) return "red";
    return "yellow";
  }

  function leerEquipo(lineas, yInicio, imagenFn) {
    const datos = { starters: [], bench: [], coach: "", subs: [], cards: [] };
    let seccion = null;
    let previoTecnico = "";
    const entraPendiente = [];
    const tarjetas = [];
    lineas.forEach((linea) => {
      if (linea.y0 < yInicio) return;
      const texto = linea.texto;
      const clave = texto.toUpperCase().trim();
      if (CABECERAS[clave]) { seccion = CABECERAS[clave]; return; }
      if (seccion === "titulares" || seccion === "suplentes") {
        const m = RE_JUGADOR.exec(texto);
        if (m) (seccion === "titulares" ? datos.starters : datos.bench).push({ num: Number(m[1]), name: m[2].trim() });
      } else if (seccion === "tecnicos") {
        if (previoTecnico === "ENTRENADOR" && !datos.coach) datos.coach = texto;
        previoTecnico = clave;
      } else if (seccion === "cambios") {
        const m = RE_JUGADOR.exec(texto);
        if (!m) return;
        const nombre = m[2].trim();
        if (m[3] === undefined) entraPendiente.push(nombre);
        else datos.subs.push({ out: nombre, in: entraPendiente.shift() || "", minute: Number(m[3]) });
      } else if (seccion === "tarjetas") {
        const m = RE_TARJETA.exec(texto);
        if (m) tarjetas.push({ linea, nombre: m[1].trim(), minuto: Number(m[2]) });
      }
    });
    if (tarjetas.length) {
      const convocados = new Set([...datos.starters, ...datos.bench].map((p) => p.name));
      const imagen = imagenFn();
      tarjetas.forEach(({ linea, nombre, minuto }) => {
        if (!convocados.has(nombre)) return; // tarjetas a entrenadores o delegados
        const color = colorTarjeta(imagen, linea);
        (color === "yellow+red" ? ["yellow", "red"] : [color]).forEach((c) => {
          datos.cards.push({ minute: minuto, player: nombre, color: c });
        });
      });
    }
    return datos;
  }

  async function parse(pdf, makeCanvas) {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const palabras = palabrasDePagina(content, viewport);
    if (palabras.length < 40) throw new SinTextoError("El PDF no tiene texto legible (puede ser un escaneo).");
    const todo = palabras.map((p) => p.t).join(" ");
    if (!todo.includes("Ficha") || !todo.includes("TITULARES")) {
      throw new FormatoDesconocidoError("El PDF no parece una ficha de partido de la federación.");
    }
    const lineas = agruparLineas(palabras);

    const fecha = /Fecha:\s*(\d{2}-\d{2}-\d{4})/.exec(todo);
    const hora = /Hora:\s*(\d{1,2}:\d{2})/.exec(todo);
    const jornada = /Jornada\s+(\d+)/.exec(todo);
    const yTemporada = Math.max(0, ...palabras.filter((p) => p.t.startsWith("Temporada")).map((p) => p.y1));
    const titulares = palabras.filter((p) => p.t === "TITULARES").map((p) => p.y0);
    const yTitulares = titulares.length ? Math.min(...titulares) : yTemporada + 60;

    const cabecera = palabras.filter((p) => p.y0 > yTemporada && p.y0 < yTitulares).sort((p, q) => p.x0 - q.x0);
    const esMarcador = (p) => banda(p.x0) === "C" && /^(\d+|-|\d+-\d+)$/.test(p.t);
    const marcadorTxt = cabecera.filter(esMarcador).map((p) => p.t).join(" ");
    const resto = cabecera.filter((p) => !esMarcador(p));
    const local = resto.filter((p) => p.x0 < 297.5).map((p) => p.t).join(" ");
    const visitante = resto.filter((p) => p.x0 >= 297.5).map((p) => p.t).join(" ");
    const mm = RE_MARCADOR.exec(marcadorTxt.replace(/\s/g, ""));
    if (!(local && visitante && mm)) throw new FormatoDesconocidoError("No se encontraron los equipos o el marcador.");

    // Columna central: árbitros, goles, estadio y ciudad
    const bloqueGoles = [];
    let estadio = "", ciudad = "", seccion = null;
    lineas.C.filter((l) => l.y0 > yTemporada).forEach(({ texto }) => {
      if (texto.startsWith("ÁRBITROS") || texto.startsWith("ARBITROS")) { seccion = "arbitros"; return; }
      if (texto === "GOLES") { seccion = "goles"; return; }
      if (texto.startsWith("ESTADIO:")) { estadio = texto.split(":").slice(1).join(":").trim(); seccion = "estadio"; return; }
      if (texto.startsWith("Ciudad:")) { ciudad = texto.split(":").slice(1).join(":").trim(); seccion = null; return; }
      if (seccion === "estadio") estadio = `${estadio} ${texto}`.trim();
      else if (seccion === "goles") bloqueGoles.push(texto);
    });

    // Árbitros: cada palabra a la derecha de su etiqueta, asignada a la etiqueta más cercana en vertical
    const etiquetas = palabras.filter((p) => (p.t === "principal" || p.t === "asistente") && banda(p.x0) === "C")
      .sort((p, q) => centro(p) - centro(q));
    const nombresArb = etiquetas.map(() => []);
    if (etiquetas.length) {
      const xNombres = Math.max(...etiquetas.map((e) => e.x1)) + 1;
      const yMin = centro(etiquetas[0]) - 9;
      const yMax = centro(etiquetas[etiquetas.length - 1]) + 9;
      palabras.forEach((p) => {
        if (p.x0 > xNombres && p.banda === "C" && centro(p) > yMin && centro(p) < yMax) {
          let mejor = 0;
          etiquetas.forEach((e, k) => { if (Math.abs(centro(e) - centro(p)) < Math.abs(centro(etiquetas[mejor]) - centro(p))) mejor = k; });
          nombresArb[mejor].push(p);
        }
      });
    }
    let arbitro = "";
    const asistentes = [];
    etiquetas.forEach((e, i) => {
      const nombre = nombresArb[i].sort((p, q) => Math.round(centro(p)) - Math.round(centro(q)) || p.x0 - q.x0)
        .map((p) => p.t).join(" ").trim();
      if (e.t === "principal") arbitro = nombre;
      else if (nombre) asistentes.push(nombre);
    });

    // Imagen de la página (solo si hay tarjetas que colorear)
    let imagenCache = null;
    const imagenFn = () => {
      if (imagenCache) return imagenCache;
      const factor = PPP / 72.0; // píxeles por punto A4
      const vp = page.getViewport({ scale: (factor * ANCHO_A4) / viewport.width });
      const lienzo = makeCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      imagenCache = { ctx: lienzo.ctx, factor, pendiente: page.render({ canvasContext: lienzo.ctx, viewport: vp }).promise };
      return imagenCache;
    };
    // El dibujo es asíncrono: se espera antes de leer los colores
    const necesitaImagen = lineas.L.concat(lineas.R).some((l) => l.texto.toUpperCase().trim() === "TARJETAS");
    if (necesitaImagen && typeof makeCanvas === "function") { await imagenFn().pendiente; }
    const imagenSegura = () => (typeof makeCanvas === "function" ? imagenFn() : { ctx: { getImageData: () => ({ data: [], width: 0 }) }, factor: 1 });

    const lineups = {
      home: leerEquipo(lineas.L, yTemporada, imagenSegura),
      away: leerEquipo(lineas.R, yTemporada, imagenSegura)
    };

    // Goles: el equipo sale de qué número del marcador sube
    const nombres = {};
    ["home", "away"].forEach((lado) => { nombres[lado] = new Set([...lineups[lado].starters, ...lineups[lado].bench].map((p) => p.name)); });
    const goals = [];
    let anterior = [0, 0];
    bloqueGoles.forEach((texto) => {
      const g = RE_GOL.exec(texto);
      if (!g) return;
      const actual = [Number(g[1]), Number(g[2])];
      const lado = actual[0] > anterior[0] ? "home" : "away";
      anterior = actual;
      const gol = { minute: Number(g[4]), player: g[3].trim(), team: lado };
      const contrario = lado === "home" ? "away" : "home";
      if (nombres[contrario].has(gol.player) && !nombres[lado].has(gol.player)) gol.type = "own_goal";
      goals.push(gol);
    });

    return {
      home: local,
      away: visitante,
      score: `${Number(mm[1])}-${Number(mm[2])}`,
      date: fecha ? fecha[1] : "",
      time: hora ? hora[1] : "",
      round: jornada ? Number(jornada[1]) : 0,
      referee: arbitro,
      assistants: asistentes,
      stadium: estadio,
      city: ciudad,
      goals,
      lineups
    };
  }

  const api = { parse, SinTextoError, FormatoDesconocidoError };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ActaFiche = api;
})(typeof self !== "undefined" ? self : globalThis);
