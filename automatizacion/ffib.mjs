// Lectura de las páginas públicas de jornada de la FFIB y descarga de actas.
// Pocas peticiones, de una en una y con pausa entre ellas.
import * as cheerio from "cheerio";
import { normalizeSearchText } from "./logica-app.mjs";

const BASE = "https://www.ffib.es/Fed/NPcd";
const PAUSA_MS = 1500;
const USER_AGENT = "CE Ferreries - importador semanal de actas";
let ultimaPeticion = 0;
export let peticiones = 0;

// La FFIB exige una cookie de sesión: se guarda la que manda y se reenvía en cada petición
const cookies = new Map();
export const registroCookies = [];

function guardarCookies(res) {
  const lista = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of lista) {
    const [par] = c.split(";");
    const i = par.indexOf("=");
    if (i > 0) {
      cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
      registroCookies.push(par.slice(0, i).trim());
    }
  }
}

async function pedirUnaVez(url) {
  const espera = ultimaPeticion + PAUSA_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaPeticion = Date.now();
  peticiones++;
  let actual = url;
  for (let salto = 0; salto < 5; salto++) {
    const headers = { "User-Agent": USER_AGENT, "Accept-Language": "es-ES,es;q=0.9" };
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(actual, { headers, redirect: "manual" });
    guardarCookies(res);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      actual = new URL(res.headers.get("location"), actual).toString();
      continue;
    }
    if (!res.ok) throw new Error(`FFIB respondió ${res.status}`);
    return res;
  }
  throw new Error("FFIB: demasiadas redirecciones");
}

async function pedir(url) {
  let ultimoError;
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await pedirUnaVez(url);
    } catch (error) {
      ultimoError = error;
      await new Promise((r) => setTimeout(r, 4000 * (intento + 1)));
    }
  }
  throw ultimoError;
}

function decodificar(buffer, contentType) {
  const charset = /charset=([\w-]+)/i.exec(contentType || "")?.[1]?.toLowerCase();
  if (charset && charset !== "utf-8") return new TextDecoder(charset === "iso-8859-1" ? "windows-1252" : charset).decode(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export function urlJornada({ competicion, grupo, delegacion }, temporada, jornada) {
  const p = new URLSearchParams({ cod_primaria: "1000110", CodCompeticion: competicion });
  if (grupo) p.set("CodGrupo", grupo);
  p.set("CodTemporada", temporada);
  if (jornada) p.set("CodJornada", String(jornada));
  p.set("Sch_Codigo_Delegacion", delegacion);
  return `${BASE}/NFG_CmpJornada?${p}`;
}

async function html(url) {
  for (let intento = 0; intento < 2; intento++) {
    const res = await pedir(url);
    const texto = decodificar(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type"));
    if (!/No se ha aceptado el cookie/i.test(texto)) return texto;
    // Primera visita: la FFIB acaba de dar la cookie; se repite la petición con ella
    if (!cookies.size) await pedir("https://www.ffib.es/");
  }
  throw new Error("La FFIB no acepta la sesión (cookie): no se puede leer la página de jornada");
}

// Partidos de una página de jornada: fecha, hora, texto normalizado y número de acta
export async function leerJornada(comp, temporada, jornada) {
  const $ = cheerio.load(await html(urlJornada(comp, temporada, jornada)));
  const vistos = new Map();
  $("td > table").each((_, tabla) => {
    const texto = $(tabla).text().replace(/\s+/g, " ").trim();
    const fecha = /(\d{2})-(\d{2})-(\d{4})/.exec(texto);
    const enlace = $(tabla).find('a[href*="CodActa"]').first().attr("href") || "";
    const acta = /CodActa=(\d+)/i.exec(enlace)?.[1];
    if (!fecha || !acta) return;
    const hora = /\b(\d{1,2}):(\d{2})\b/.exec(texto.slice(fecha.index));
    const previo = vistos.get(acta);
    // Si una tabla contiene a otra, nos quedamos con la más pequeña (la fila del partido)
    if (previo && previo.texto.length <= texto.length) return;
    vistos.set(acta, {
      acta,
      fecha: `${fecha[3]}-${fecha[2]}-${fecha[1]}`,
      hora: hora ? `${hora[1].padStart(2, "0")}:${hora[2]}` : "",
      texto,
      textoNormalizado: normalizeSearchText(texto)
    });
  });
  const grupos = $("select[name=grupo] option").map((_, o) => ({ valor: $(o).attr("value"), texto: $(o).text().trim() })).get();
  return { partidos: [...vistos.values()], grupos };
}

export function esDelEquipo(partido, comp) {
  if (!partido.textoNormalizado.includes("ferreries")) return false;
  if (!comp.equipoFfib) return true;
  const sufijo = normalizeSearchText(comp.equipoFfib).replace(/^.*ferreries\s*/, "");
  if (!sufijo) return true;
  return new RegExp(`\\bferreries ${sufijo}\\b`).test(partido.textoNormalizado);
}

// Busca los grupos de una competición en los que juega el equipo
export async function buscarGrupos(comp, temporada) {
  const { grupos } = await leerJornada({ ...comp, grupo: "" }, temporada, 0);
  const encontrados = [];
  for (const g of grupos.filter((x) => x.valor && x.valor !== "0")) {
    for (const jornada of [1, 2]) {
      const { partidos } = await leerJornada({ ...comp, grupo: g.valor }, temporada, jornada);
      if (partidos.some((p) => esDelEquipo(p, comp))) { encontrados.push({ valor: g.valor, texto: g.texto }); break; }
    }
  }
  return encontrados;
}

export async function descargarActa(acta) {
  const p = new URLSearchParams({ cod_primaria: "1000110", CodActa: acta, cod_acta: acta, NPcd_Pdf: "1" });
  if (!cookies.size) await html(`${BASE}/NFG_CmpPartido?${new URLSearchParams({ cod_primaria: "1000110", CodActa: acta, cod_acta: acta })}`);
  const res = await pedir(`${BASE}/NFG_CmpPartido?${p}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("La FFIB no ha devuelto un PDF");
  return bytes;
}

// Solo para diagnosticar: cuenta lo que hay en una página de jornada
export async function leerJornadaCruda(comp, temporada, jornada) {
  const texto = await html(urlJornada(comp, temporada, jornada));
  const $ = cheerio.load(texto);
  const grupos = $("select[name=grupo] option").map((_, o) => ({ valor: $(o).attr("value"), texto: $(o).text().trim() })).get();
  const tablas = $("td > table").toArray().map((t) => $(t).text().replace(/\s+/g, " "));
  const conFecha = tablas.filter((t) => /\d{2}-\d{2}-\d{4}/.test(t)).length;
  const actas = $('a[href*="CodActa"], a[href*="codacta"], a[href*="cod_acta"]').length;
  const enlaces = new Set($("a[href]").toArray().map((a) => ($(a).attr("href") || "").replace(/\?.*/, "")).filter((h) => /NFG_/i.test(h)));
  const ferreries = normalizeSearchText($("body").text()).includes("ferreries");
  return {
    grupos,
    resumen: `${texto.length} car. «${texto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)}», grupos ${grupos.length}, filas con fecha ${conFecha}, enlaces de acta ${actas}, Ferreries ${ferreries ? "sí" : "no"}, páginas enlazadas: ${[...enlaces].slice(0, 6).join(" ")}`
  };
}
