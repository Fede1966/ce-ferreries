// Se ejecuta en una pestaña de www.ffib.es (navegador del Mac, tarea semanal).
// Lee el calendario del Ferreries en una competición y, de las próximas jornadas, el día, la hora y el campo.
// Uso: await calendarioFerreries({ competicion, grupo, delegacion, equipoFfib, jornadasDetalle: 2 })
async function calendarioFerreries({ competicion, grupo, delegacion = "1", equipoFfib = "", jornadasDetalle = 2 }) {
  const pausa = () => new Promise((r) => setTimeout(r, 1500));
  const leer = async (url) => {
    const res = await fetch(url, { credentials: "include" });
    const buf = await res.arrayBuffer();
    const tipo = res.headers.get("content-type") || "";
    const texto = new TextDecoder(/utf-8/i.test(tipo) ? "utf-8" : "windows-1252").decode(buf);
    return new DOMParser().parseFromString(texto, "text/html");
  };
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sufijo = norm(equipoFfib).replace(/^.*ferreries\s*/, "");
  const esNuestro = (nombre) => {
    const n = norm(nombre);
    if (!n.includes("ferreries")) return false;
    return !sufijo || new RegExp(`\\bferreries ${sufijo}\\b`).test(n);
  };
  const limpio = (t) => String(t || "").replace(/\s+/g, " ").trim();

  const cal = await leer(`/Fed/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000110&codtemporada=22&codcompeticion=${competicion}&codgrupo=${grupo}`);
  const jornadas = [];
  for (const tabla of cal.querySelectorAll("table")) {
    const m = /Jornada\s+(\d+)\s*\((\d{2})-(\d{2})-(\d{4})\)/.exec(tabla.querySelector("th")?.textContent || "");
    if (!m) continue;
    for (const tr of tabla.querySelectorAll("tr")) {
      const td = tr.querySelectorAll("td");
      if (td.length < 3) continue;
      const home = limpio(td[0].textContent), away = limpio(td[td.length - 1].textContent);
      if (esNuestro(home) || esNuestro(away)) jornadas.push({ round: Number(m[1]), date: `${m[4]}-${m[3]}-${m[2]}`, home, away });
    }
  }

  const proximas = jornadas.filter((j) => j.date >= new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)).slice(0, jornadasDetalle);
  for (const j of proximas) {
    await pausa();
    const doc = await leer(`/Fed/NPcd/NFG_CmpJornada?cod_primaria=1000110&CodCompeticion=${competicion}&CodGrupo=${grupo}&CodTemporada=22&CodJornada=${j.round}&Sch_Codigo_Delegacion=${delegacion}`);
    const fila = [...doc.querySelectorAll("td > table")]
      .filter((t) => /\d{2}-\d{2}-\d{4}/.test(t.textContent) && [...t.querySelectorAll(".font_widgetL a, .font_widgetV a")].some((a) => esNuestro(a.textContent)))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!fila) continue;
    const horario = [...fila.querySelectorAll("span.horario")].map((s) => limpio(s.textContent));
    const fecha = /(\d{2})-(\d{2})-(\d{4})/.exec(horario.join(" "));
    const hora = /\b(\d{1,2}):(\d{2})\b/.exec(horario.join(" "));
    const campoLink = fila.querySelector('a[href*="NFG_VisCampos"]');
    j.exact = {
      date: fecha ? `${fecha[3]}-${fecha[2]}-${fecha[1]}` : "",
      time: hora ? `${hora[1].padStart(2, "0")}:${hora[2]}` : "",
      campo: limpio(campoLink?.textContent),
      superficie: limpio(campoLink?.parentElement?.querySelector("span")?.textContent)
    };
  }
  return jornadas;
}
