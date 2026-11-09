// Se ejecuta en una pestaña de www.ffib.es (navegador del Mac, tarea semanal).
// Lee la clasificación oficial (última jornada) de una competición. Las cifras de esta página van en texto normal.
async function clasificacionFfib({ competicion, grupo }) {
  const res = await fetch(`/Fed/NPcd/NFG_VisClasificacion?cod_primaria=1000110&codcompeticion=${competicion}&codgrupo=${grupo}`, { credentials: "include" });
  const tipo = res.headers.get("content-type") || "";
  const doc = new DOMParser().parseFromString(new TextDecoder(/utf-8/i.test(tipo) ? "utf-8" : "windows-1252").decode(await res.arrayBuffer()), "text/html");
  const limpio = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const tabla = [...doc.querySelectorAll("table")].find((t) => /Partidos Casa/i.test(t.textContent) && t.querySelectorAll("a[href*=codequipo]").length > 1);
  if (!tabla) return { rows: [] };
  const rows = [];
  for (const tr of tabla.querySelectorAll("tr")) {
    const enlace = tr.querySelector("a[href*=codequipo]");
    if (!enlace) continue;
    const celdas = [...tr.children].map((c) => limpio(c.textContent));
    const i = celdas.findIndex((c) => c === limpio(enlace.textContent));
    // Solo enteros: en fútbol 8 hay además una columna Pts/PJ con decimales ("3,0000")
    const n = celdas.slice(i + 1).filter((c) => /^\d+$/.test(c)).slice(0, 11).map(Number);
    if (n.length < 11) continue;
    const [points, hJ, hG, hE, hP, aJ, aG, aE, aP, goalsFor, goalsAgainst] = n;
    rows.push({ name: limpio(enlace.textContent), points, played: hJ + aJ, won: hG + aG, drawn: hE + aE, lost: hP + aP, goalsFor, goalsAgainst });
  }
  return { rows };
}
