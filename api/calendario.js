// Calendario suscribible (.ics) de un equipo: /api/calendario?equipo=ce-ferreries-alevin-a
//
// Las familias lo añaden una vez al calendario del móvil y se actualiza solo: mientras la FFIB no da
// el horario, el partido sale como evento de todo el día en la fecha de la jornada; cuando hay día,
// hora y campo (o una corrección manual hecha en la app), pasa a ser un evento con hora.
// Solo usa datos públicos (función ferreries_portada de la base de datos).

const SUPABASE_URL = "https://vhmnyjmhnobqmxgulsag.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobW55am1obm9icW14Z3Vsc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzEyNTMsImV4cCI6MjA5NjI0NzI1M30.Li4R65j3sGHSrIdt7tiubHNDgKrzjXDqcT92BCqZfDA";
const SITE = "https://www.ceferreries.app";
const MATCH_MINUTES = 105; // duración del evento: partido + descanso

function normalizeSearchText(value) {
  return String(value || "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCaseTeam(name) {
  return String(name || "").toLocaleLowerCase("es").replace(/(^|[\s(.-])(\S)/g, (m, sep, ch) => sep + ch.toLocaleUpperCase("es"))
    .replace(/\bAtº\b/i, "Atº").replace(/\b(Cd|Ce|Cf|Ud|Sd|Fc|Rcd)\b/g, (w) => w.toUpperCase());
}

// Igual que en la app: "PEÑA DEPORTIVA \"A\"" → "Peña Deportiva A"
function prettyFfibName(name) {
  return titleCaseTeam(String(name || "").replace(/"/g, " ").replace(/\s+/g, " ").trim())
    .replace(/(?<=\s)(De|Del)(?=\s)/g, (w) => w.toLocaleLowerCase("es"))
    .replace(/\s([a-z])$/, (m, letter) => ` ${letter.toUpperCase()}`);
}

const isOwn = (name) => normalizeSearchText(name).includes("ferreries");

function ownSide(j) {
  if (isOwn(j.home) && !isOwn(j.away)) return "home";
  if (isOwn(j.away) && !isOwn(j.home)) return "away";
  return "home";
}

// Texto de iCalendar: escapar y partir líneas largas (máx. 75 bytes)
function esc(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const ymd = (iso) => iso.replace(/-/g, "");
const nextDay = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function localPlusMinutes(dateIso, time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m + minutes);
  return `${d.toISOString().slice(0, 10).replace(/-/g, "")}T${d.toISOString().slice(11, 16).replace(":", "")}00`;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE"
];

function buildCalendar(team, fixtures, results) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const shortName = String(team.name || "").replace(/^CE Ferreries\s*/i, "") || team.name;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CE Ferreries//Calendario de partidos//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`CE Ferreries · ${shortName}`)}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    `X-WR-CALDESC:${esc(`Partidos del ${team.name}. Se actualiza solo cuando cambian el día, la hora o el campo.`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE
  ];
  (fixtures?.competitions || []).forEach((comp) => {
    (comp.jornadas || []).forEach((j) => {
      const side = ownSide(j);
      const rivalRaw = side === "home" ? j.away : j.home;
      if (!rivalRaw || /descansa/i.test(rivalRaw)) return;
      const date = j.exact?.date || j.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return;
      const rival = prettyFfibName(rivalRaw);
      const kind = comp.kind === "cup" ? "cup" : "league";
      const result = (results || []).find((r) => r.teamId === team.id && (r.competition || "league") === kind && Number(r.round) === Number(j.round));
      const time = /^\d{1,2}:\d{2}$/.test(j.exact?.time || "") ? j.exact.time.padStart(5, "0") : "";
      const match = side === "home" ? `Ferreries vs ${rival}` : `${rival} vs Ferreries`;
      const summary = result?.score ? `${match} (${result.score})` : time ? match : `${match} · horario por confirmar`;
      const where = j.exact?.campo ? prettyFfibName(j.exact.campo) : "";
      const description = [
        `${comp.name || (kind === "cup" ? "Copa" : "Liga")} · Jornada ${j.round} · ${side === "home" ? "En casa" : "Fuera"}`,
        time ? "" : "La FFIB aún no ha publicado el día y la hora: se actualizará solo.",
        j.manual ? "Horario corregido por el club (pendiente de publicar en la FFIB)." : "",
        `${SITE}/?temporada=2026-2027&vista=matches&equipo=${team.id}`
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${team.id}-${kind}-${j.round}@ceferreries.app`,
        `DTSTAMP:${stamp}`,
        ...(time
          ? [`DTSTART;TZID=Europe/Madrid:${ymd(date)}T${time.replace(":", "")}00`, `DTEND;TZID=Europe/Madrid:${localPlusMinutes(date, time, MATCH_MINUTES)}`]
          : [`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(date))}`, "TRANSP:TRANSPARENT"]),
        `SUMMARY:${esc(summary)}`,
        ...(where ? [`LOCATION:${esc(where)}`] : []),
        `DESCRIPTION:${esc(description)}`,
        "END:VEVENT"
      );
    });
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

module.exports = async (req, res) => {
  const teamId = String(req.query?.equipo || "").trim();
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ferreries_portada`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error(`Supabase ${response.status}`);
    const data = await response.json();
    const team = (data?.teams || []).find((item) => item.id === teamId);
    if (!team) {
      res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send("Equipo no encontrado");
      return;
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${teamId}.ics"`);
    // Las plataformas de calendario consultan cada cierto tiempo; 15 minutos de caché es suficiente
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.status(200).send(buildCalendar(team, data.fixtures?.[teamId], data.results));
  } catch (error) {
    res.status(502).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send("No se ha podido leer el calendario en este momento");
  }
};

module.exports.buildCalendar = buildCalendar;
