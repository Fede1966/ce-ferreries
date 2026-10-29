// Lectura de las páginas públicas de jornada de la FFIB y descarga de actas.
// Pocas peticiones, de una en una y con pausa entre ellas.
import * as cheerio from "cheerio";
import { normalizeSearchText } from "./logica-app.mjs";

const BASE = "https://www.ffib.es/Fed/NPcd";
const PAUSA_MS = 1500;
const USER_AGENT = "CE Ferreries - importador semanal de actas";
let ultimaPeticion = 0;
export let peticiones = 0;

async function pedir(url) {
  const espera = ultimaPeticion + PAUSA_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaPeticion = Date.now();
  peticiones++;
  let ultimoError;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`FFIB respondió ${res.status}`);
      return res;
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
  const p = new URLSearchParams({
    cod_primaria: "1000110",
    CodCompeticion: competicion,
    CodGrupo: grupo || "",
    CodTemporada: temporada,
    CodJornada: String(jornada),
    Sch_Codigo_Delegacion: delegacion
  });
  return `${BASE}/NFG_CmpJornada?${p}`;
}

async function html(url) {
  const res = await pedir(url);
  return decodificar(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type"));
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

// Busca el grupo de una competición en el que juega el equipo
export async function buscarGrupo(comp, temporada) {
  const { grupos } = await leerJornada({ ...comp, grupo: "" }, temporada, 1);
  for (const g of grupos.filter((x) => x.valor)) {
    const { partidos } = await leerJornada({ ...comp, grupo: g.valor }, temporada, 1);
    if (partidos.some((p) => esDelEquipo(p, comp))) return g.valor;
  }
  return "";
}

export async function descargarActa(acta) {
  const p = new URLSearchParams({ cod_primaria: "1000110", CodActa: acta, cod_acta: acta, NPcd_Pdf: "1" });
  const res = await pedir(`${BASE}/NFG_CmpPartido?${p}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("La FFIB no ha devuelto un PDF");
  return bytes;
}
