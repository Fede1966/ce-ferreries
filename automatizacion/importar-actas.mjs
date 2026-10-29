// Importa en ceferreries.app las actas de la FFIB de los partidos ya jugados por el CE Ferreries.
//
// MODO=comprobar  Relee las actas que ya están en la app y compara (no toca la FFIB ni guarda nada).
// MODO=prueba     Busca en la FFIB y prepara la importación, pero no guarda nada.
// MODO=real       Busca, importa y guarda.
//
// Los partidos con dudas (jugadores nuevos que se parecen a uno de la plantilla, partido que ya
// existe, derbi A contra B, acta ilegible) NO se importan: quedan como «pendientes de revisar»
// en la app, con el PDF guardado, para confirmarlos desde la pantalla de importación de siempre.
//
// En los registros públicos de GitHub no se escriben nombres de jugadores.
import { readFile, appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  actaDisplayName, actaOwnSide, competitionKind, computeOwnActaRecords, defaultActaDuration, DEFAULT_FORMATION,
  emptyPlan, emptyRatings, ensurePlayerReport, findExistingMatch, isQuarterTeam, looksLikeExistingPlayer,
  nameMatches, normalizeSearchText, normalizeTeamMatchStats, titleCaseTeam
} from "./logica-app.mjs";
import { buscarGrupos, descargarActa, esDelEquipo, leerJornada, peticiones } from "./ffib.mjs";
import { descargarArchivo, guardarEstado, iniciarSesion, leerEstado, subirActa } from "./supabase.mjs";
import { leerActa } from "./lector.mjs";

const MODO_PEDIDO = (process.env.MODO || "prueba").trim();
const faltanClaves = MODO_PEDIDO === "real" && !(process.env.FERRERIES_EMAIL && process.env.FERRERIES_PASSWORD);
const SIMULACRO = MODO_PEDIDO === "simulacro";
const MODO = faltanClaves || SIMULACRO ? "prueba" : MODO_PEDIDO;

// Simulacro: hace como si faltara el último partido de cada equipo, para comprobar que
// el programa lo encuentra en la FFIB y lo prepararía igual que está guardado. No guarda nada.
function aplicarSimulacro(state) {
  if (!SIMULACRO) return state;
  const quitar = new Set();
  for (const team of state.teams) {
    const ultimo = state.matches
      .filter((m) => m.teamId === team.id && m.status === "Jugado" && (m.competition || "league") !== "friendly")
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (ultimo) quitar.add(ultimo.id);
  }
  state.matches = state.matches.filter((m) => !quitar.has(m.id));
  return state;
}
const config = JSON.parse(await readFile(new URL("./competiciones.json", import.meta.url), "utf8"));
const excluidos = (process.env.ACTAS_EXCLUIDOS || "").split(/[;\n]/).map((n) => normalizeSearchText(n)).filter(Boolean);
const resumen = [];
const log = (linea = "") => { console.log(linea); resumen.push(linea); };

const ahoraMadrid = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).format(new Date());
const HOY = ahoraMadrid.slice(0, 10);
const MINUTO_ACTUAL = Number(ahoraMadrid.slice(11, 13)) * 60 + Number(ahoraMadrid.slice(14, 16));

function partidoJugado(p) {
  if (p.fecha < HOY) return true;
  if (p.fecha > HOY || !p.hora) return false;
  const [h, m] = p.hora.split(":").map(Number);
  return MINUTO_ACTUAL >= h * 60 + m + 150; // empezó hace más de 2 h 30 min
}

function nombreEquipo(state, teamId) {
  return state.teams.find((t) => t.id === teamId)?.name || teamId;
}

async function escribirResumen() {
  if (!process.env.GITHUB_ACTIONS) return;
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${resumen.join("\n")}\n`);
  // También como aviso del trabajo, para poder leerlo desde la API de GitHub
  const texto = resumen.join("\n").replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  console.log(`::notice title=Resumen de actas::${texto}`);
}

// ------------------------------------------------------------------ comprobar
async function comprobar(state) {
  log(`## Comprobación del lector (${HOY})`);
  log("Relee las actas ya guardadas en la app y compara con lo que hay guardado. No toca la FFIB ni guarda nada.");
  log("");
  log("| Equipo | Actas | Leídas | Partidos idénticos | Jugadores con diferencias | Nombres sin emparejar |");
  log("|---|---|---|---|---|---|");
  let totalDif = 0;
  let totalLeidas = 0;
  const errores = [];
  for (const team of state.teams) {
    if (isQuarterTeam(team.id)) continue; // minutos por cuartos: los anota el entrenador
    const players = state.players.filter((p) => p.teamId === team.id);
    const matches = state.matches.filter((m) => m.teamId === team.id && m.actaFileUrl && Object.keys(m.actaPlayers || {}).length);
    if (!matches.length) continue;
    let leidas = 0, identicos = 0, dif = 0, sinEmparejar = 0;
    const campos = {};
    for (const m of matches) {
      try {
        const parsed = await leerActa(await descargarArchivo(m.actaFileUrl));
        leidas++;
        const own = actaOwnSide(parsed) || (normalizeSearchText(m.away).includes("ferreries") ? "away" : "home");
        const duration = Number(m.actaDuration) || defaultActaDuration(team.id);
        const records = computeOwnActaRecords(parsed, own, duration, false);
        let iguales = true;
        for (const [actaName, r] of records) {
          const player = players.find((p) => nameMatches(actaName, p.name));
          if (!player) { if (r.role !== "none") sinEmparejar++; continue; }
          const saved = m.actaPlayers[player.id];
          if (!saved) { if (r.role !== "none") { dif++; iguales = false; campos.ausente = (campos.ausente || 0) + 1; } continue; }
          const savedRole = saved.role || "none";
          const checks = {
            rol: savedRole === r.role,
            minutos: r.role === "none" || (Number(saved.exit) - Number(saved.entry)) === (r.exit - r.entry),
            goles: Number(saved.goals || 0) === r.goals,
            amarillas: Number(saved.yellowCards || 0) === r.yellowCards,
            rojas: Number(saved.redCards || 0) === r.redCards
          };
          const malos = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
          if (malos.length) { dif++; iguales = false; malos.forEach((k) => { campos[k] = (campos[k] || 0) + 1; }); }
        }
        if (iguales) identicos++;
      } catch (error) {
        errores.push(`${team.name} J${m.round}: ${error.message}`);
      }
    }
    totalDif += dif;
    totalLeidas += leidas;
    const detalle = Object.keys(campos).length ? ` (${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join(", ")})` : "";
    log(`| ${team.name} | ${matches.length} | ${leidas} | ${identicos} | ${dif}${detalle} | ${sinEmparejar} |`);
  }
  log("");
  if (errores.length) {
    log(`Actas que no se han podido leer: ${errores.length}`);
    errores.slice(0, 8).forEach((e) => log(`- ${e}`));
    log("");
  }
  if (!totalLeidas) log("No se ha podido leer ninguna acta: hay que revisar el lector.");
  else log(totalDif ? "Hay diferencias: pueden ser correcciones hechas a mano en la app." : "Todo coincide con lo guardado en la app.");
}

// ------------------------------------------------------------------ buscar en la FFIB
async function buscarCandidatos(state) {
  const candidatos = [];
  const avisos = [];
  const pendientes = new Set((state.autoImport?.pending || []).map((p) => String(p.acta)));
  for (const [teamId, comps] of Object.entries(config.equipos)) {
    if (!state.teams.some((t) => t.id === teamId)) continue;
    const teamMatches = state.matches.filter((m) => (m.teamId || "") === teamId);
    const actasHechas = new Set(teamMatches.map((m) => String(m.ffibActa || "")).filter(Boolean));
    for (const comp of comps) {
      if (comp.desde && comp.desde > HOY) continue;
      if (!comp.grupo) {
        const grupos = await buscarGrupos(comp, config.temporada);
        if (grupos.length !== 1) {
          avisos.push(grupos.length
            ? `${nombreEquipo(state, teamId)}: en ${comp.nombre} hay un Ferreries en varios grupos (${grupos.map((g) => `${g.texto} ${g.valor}`).join(", ")}); hay que indicar cuál en competiciones.json. No se importa.`
            : `${nombreEquipo(state, teamId)}: no encuentro su grupo en ${comp.nombre}.`);
          continue;
        }
        comp.grupo = grupos[0].valor;
        avisos.push(`${nombreEquipo(state, teamId)}: grupo de ${comp.nombre} = ${grupos[0].texto} ${comp.grupo} (conviene añadirlo a competiciones.json).`);
      }
      const tipo = competitionKind(comp.nombre);
      const rondas = new Set(teamMatches.filter((m) => (m.competition || "league") === tipo).map((m) => Number(m.round)));
      const max = Math.max(0, ...rondas);
      const huecos = [];
      for (let r = 1; r <= max; r++) if (!rondas.has(r)) huecos.push(r);
      const aMirar = [...huecos, ...Array.from({ length: 4 }, (_, i) => max + 1 + i)];
      for (const jornada of aMirar) {
        const { partidos } = await leerJornada(comp, config.temporada, jornada);
        if (!partidos.length) { if (jornada > max) break; continue; }
        const p = partidos.find((x) => esDelEquipo(x, comp));
        if (!p) continue; // descansa esta jornada
        if (!partidoJugado(p)) { if (jornada > max) break; continue; }
        if (pendientes.has(p.acta) || actasHechas.has(p.acta)) continue;
        candidatos.push({ teamId, comp, jornada, partido: p });
      }
    }
  }
  return { candidatos, avisos };
}

// ------------------------------------------------------------------ preparar e importar
function prepararPartido(state, cand, parsed) {
  const team = state.teams.find((t) => t.id === cand.teamId);
  const teamMatches = state.matches.filter((m) => m.teamId === cand.teamId);
  const ownSide = actaOwnSide(parsed);
  const base = {
    acta: cand.partido.acta, teamId: cand.teamId, round: parsed.round || cand.jornada,
    competition: competitionKind(parsed.competition), date: cand.partido.fecha, score: parsed.score
  };
  if (!ownSide) return { ...base, opponent: "", duda: "En el acta no se distingue qué equipo es el nuestro (¿derbi A contra B?)." };
  const opponent = ownSide === "home" ? parsed.away : parsed.home;
  Object.assign(base, { opponent: titleCaseTeam(opponent) });
  const existing = findExistingMatch(teamMatches, parsed, ownSide);
  if (existing) {
    if (Object.keys(existing.actaPlayers || {}).length) return { ...base, yaEsta: true };
    return { ...base, duda: "El partido ya existe en la app sin acta: confírmalo para rellenarlo." };
  }
  if (parsed.lineups[ownSide].starters.length < 7) return { ...base, sinCerrar: true };
  const quarter = isQuarterTeam(cand.teamId);
  const duration = defaultActaDuration(cand.teamId);
  const records = computeOwnActaRecords(parsed, ownSide, duration, quarter);
  const roster = state.players.filter((p) => p.teamId === cand.teamId);
  const nuevos = [];
  const jugadores = [];
  const parecidos = [];
  for (const [actaName, record] of records) {
    if (excluidos.includes(normalizeSearchText(actaDisplayName(actaName))) || excluidos.includes(normalizeSearchText(actaName))) continue;
    let player = roster.find((p) => nameMatches(actaName, p.name)) || nuevos.find((p) => nameMatches(actaName, p.name));
    if (!player) {
      if (looksLikeExistingPlayer(actaName, record.num, roster)) parecidos.push(record.num ? `dorsal ${record.num}` : "sin dorsal");
      player = { id: randomUUID(), teamId: cand.teamId, name: actaDisplayName(actaName), number: record.num || 0, nuevo: true };
      nuevos.push(player);
    }
    jugadores.push({ player, record });
  }
  const jugaron = jugadores.filter((j) => j.record.role !== "none");
  const nuevosQueJugaron = jugaron.filter((j) => j.player.nuevo).length;
  if (roster.length >= 5 && jugaron.length && nuevosQueJugaron / jugaron.length > 0.5) {
    return { ...base, duda: `${nuevosQueJugaron} de ${jugaron.length} jugadores no están en la plantilla: ¿es el acta de otro equipo del club?` };
  }
  if (parecidos.length) {
    return { ...base, duda: `Jugador nuevo parecido a uno de la plantilla (${parecidos.join(", ")}): confirma que no está repetido.` };
  }
  return { ...base, team, ownSide, parsed, duration, quarter, nuevos, jugadores };
}

function aplicarPartido(state, prep, actaInfo) {
  for (const n of prep.nuevos) {
    state.players.push({
      id: n.id, teamId: prep.teamId, name: n.name, number: n.number, birthdate: "", position: "Por definir",
      laterality: "Diestro", photo: "", photoPath: "", description: "", career: "", ratings: emptyRatings(), reports: {}
    });
  }
  const parsed = prep.parsed;
  const matchItem = {
    id: actaInfo.matchId, updatedAt: Date.now(), teamId: prep.teamId, competition: prep.competition,
    round: prep.competition === "friendly" ? 0 : parsed.round || prep.round,
    date: parsed.date ? parsed.date.split("-").reverse().join("-") : prep.date, time: parsed.time,
    home: prep.ownSide === "home" ? prep.team.name : titleCaseTeam(parsed.home),
    away: prep.ownSide === "away" ? prep.team.name : titleCaseTeam(parsed.away),
    status: "Jugado", score: parsed.score, teamStats: normalizeTeamMatchStats(), notes: "", videoUrl: "",
    actaDuration: prep.duration, actaPlayers: {}, actaFileUrl: actaInfo.url || "", actaFilePath: actaInfo.path || "",
    actaFileName: actaInfo.url ? actaInfo.fileName : "", actaFileType: actaInfo.url ? "application/pdf" : "",
    lineupSheets: null, lineup: {}, formation: DEFAULT_FORMATION, plan: emptyPlan(), ffibActa: String(prep.acta),
    importedAutomatically: true
  };
  state.matches.push(matchItem);
  const records = {};
  let yellowCards = 0, redCards = 0;
  for (const { player, record } of prep.jugadores) {
    const playerItem = state.players.find((p) => p.id === player.id);
    if (!playerItem) continue;
    const played = record.role !== "none";
    const report = ensurePlayerReport(playerItem, matchItem.id);
    report.minutes = played ? Math.max(0, record.exit - record.entry) : 0;
    report.goals = played ? record.goals : 0;
    report.yellowCards = record.yellowCards;
    report.redCards = record.redCards;
    yellowCards += report.yellowCards;
    redCards += report.redCards;
    records[playerItem.id] = {
      role: record.role, entry: played ? record.entry : 0, exit: played ? record.exit : 0,
      goals: report.goals, yellowCards: report.yellowCards, redCards: report.redCards
    };
    if (prep.quarter) {
      records[playerItem.id].quarters = [0, 0, 0, 0];
      records[playerItem.id].exit = 0;
      report.minutes = 0;
    }
  }
  matchItem.actaPlayers = records;
  matchItem.lineupSheets = { home: [], away: [] };
  matchItem.lineupSheets[prep.ownSide] = Object.entries(records)
    .filter(([, r]) => r.role !== "none")
    .map(([playerId, r]) => ({
      playerId,
      name: state.players.find((p) => p.id === playerId)?.name || "",
      role: r.role === "substitute" ? "substitute" : "starter",
      changeMinute: prep.quarter ? "" : r.role === "substitute" ? r.entry : r.exit < prep.duration ? r.exit : prep.duration
    }));
  matchItem.teamStats = { ...normalizeTeamMatchStats(), yellowCards, redCards };
  return matchItem;
}

async function importar() {
  log(`## Actas FFIB → ceferreries.app (${ahoraMadrid}, modo ${MODO})`);
  if (faltanClaves) log("⚠️ Faltan las claves FERRERIES_EMAIL y FERRERIES_PASSWORD en GitHub: se ejecuta en modo prueba, sin guardar.");
  let state = aplicarSimulacro((await leerEstado()).state);
  if (SIMULACRO) log("Simulacro: se hace como si faltara el último partido de cada equipo.");
  const { candidatos, avisos } = await buscarCandidatos(state);
  log(`Partidos nuevos encontrados en la FFIB: ${candidatos.length}.`);

  // Descargar y leer cada acta una sola vez
  const actas = new Map();
  for (const cand of candidatos) {
    try {
      const bytes = await descargarActa(cand.partido.acta);
      let parsed = null, errorLectura = "";
      try { parsed = await leerActa(bytes); } catch (error) { errorLectura = error.message; }
      actas.set(cand.partido.acta, { bytes, parsed, errorLectura });
    } catch (error) {
      avisos.push(`${nombreEquipo(state, cand.teamId)} J${cand.jornada}: no se pudo descargar el acta (${error.message}).`);
    }
  }

  const token = MODO === "real" ? await iniciarSesion(process.env.FERRERIES_EMAIL, process.env.FERRERIES_PASSWORD) : "";
  const subidas = new Map(); // acta -> {url, path, fileName} (para no subir dos veces si hay que repetir)

  for (let intento = 1; intento <= 3; intento++) {
    const leido = await leerEstado();
    state = aplicarSimulacro(leido.state);
    const anadidos = [], dudas = [], notas = [...avisos];
    for (const cand of candidatos) {
      const a = actas.get(cand.partido.acta);
      if (!a) continue;
      const equipo = nombreEquipo(state, cand.teamId);
      let prep;
      if (!a.parsed) {
        prep = { acta: cand.partido.acta, teamId: cand.teamId, round: cand.jornada, competition: competitionKind(cand.comp.nombre), date: cand.partido.fecha, opponent: "", score: "", duda: `No se pudo leer el PDF (${a.errorLectura}).` };
      } else {
        prep = prepararPartido(state, cand, a.parsed);
      }
      if (prep.yaEsta) continue;
      if (prep.sinCerrar) { notas.push(`${equipo} J${prep.round}: el acta aún no está completa; se intentará en la próxima pasada.`); continue; }
      const fileName = `${cand.teamId}-j${prep.round}-${cand.partido.acta}.pdf`;
      let archivo = subidas.get(cand.partido.acta);
      if (MODO === "real" && !archivo) {
        const matchId = randomUUID();
        const path = prep.duda ? `actas/pendientes/${cand.partido.acta}.pdf` : `actas/${matchId}/${Date.now()}-${fileName}`;
        try {
          archivo = { matchId, path, fileName, url: await subirActa(token, path, a.bytes) };
        } catch (error) {
          archivo = { matchId, path: "", fileName, url: "" };
          notas.push(`${equipo} J${prep.round}: datos guardados, pero el PDF no se pudo adjuntar (${error.message}).`);
        }
        subidas.set(cand.partido.acta, archivo);
      }
      archivo ||= { matchId: randomUUID(), fileName };
      if (prep.duda) {
        dudas.push({
          acta: String(prep.acta), teamId: prep.teamId, round: prep.round, competition: prep.competition, opponent: prep.opponent,
          score: prep.score, date: prep.date, reason: prep.duda, fileUrl: archivo.url || "", fileName, createdAt: new Date().toISOString()
        });
        continue;
      }
      aplicarPartido(state, prep, archivo);
      anadidos.push({ teamId: prep.teamId, round: prep.round, competition: prep.competition, opponent: prep.opponent, score: prep.score, ownSide: prep.ownSide, nuevos: prep.nuevos.length });
    }

    log("");
    if (anadidos.length) {
      log("| Equipo | Jornada | Rival | Resultado | Jugadores nuevos |");
      log("|---|---|---|---|---|");
      anadidos.forEach((x) => log(`| ${nombreEquipo(state, x.teamId)} | ${x.competition === "cup" ? "Copa " : ""}J${x.round} | ${x.opponent} (${x.ownSide === "home" ? "local" : "visitante"}) | ${x.score} | ${x.nuevos} |`));
    } else log("No hay partidos nuevos que importar.");
    if (dudas.length) {
      log("");
      log(`**Pendientes de revisar en la app (${dudas.length}):**`);
      dudas.forEach((d) => log(`- ${nombreEquipo(state, d.teamId)} J${d.round}${d.opponent ? ` contra ${d.opponent}` : ""}: ${d.reason}`));
    }
    if (notas.length) { log(""); notas.forEach((n) => log(`- ${n}`)); }

    if (MODO !== "real") { log(""); log("Modo prueba: no se ha guardado nada."); break; }
    if (!anadidos.length && !dudas.length) break;

    const anteriores = (state.autoImport?.pending || []).filter((p) => !dudas.some((d) => d.acta === p.acta));
    state.autoImport = {
      lastRun: { at: new Date().toISOString(), added: anadidos, pending: dudas.length, notes: notas },
      pending: [...anteriores, ...dudas]
    };
    state.lastModifiedAt = Date.now();
    if (await guardarEstado(token, state, leido.updatedAt)) {
      const comprobado = await leerEstado();
      const ids = new Set(comprobado.state.matches.map((m) => String(m.ffibActa || "")));
      const faltan = anadidos.length - candidatos.filter((c) => ids.has(String(c.partido.acta))).length;
      log("");
      log(faltan > 0 ? `⚠️ Tras guardar faltan ${faltan} partido(s) en la base de datos.` : `Guardado y comprobado en la base de datos (${anadidos.length} partido(s)).`);
      if (faltan > 0) process.exitCode = 1;
      break;
    }
    log("");
    log(`Alguien ha guardado cambios en la app mientras tanto; se repite (intento ${intento + 1}).`);
    if (intento === 3) { log("No se pudo guardar: la app se estaba modificando. Se intentará en la próxima pasada."); process.exitCode = 1; }
  }
  log("");
  log(`Peticiones a la FFIB: ${peticiones}.`);
}

async function diagnostico() {
  log(`## Diagnóstico de grupos FFIB (${HOY})`);
  const { leerJornadaCruda, leerJornada: lj, registroCookies } = await import("./ffib.mjs");
  const prueba = await lj(config.equipos["ce-ferreries-juvenil-nacional"][0], config.temporada, 8).catch((e) => ({ error: e.message, partidos: [] }));
  log(`- Juvenil Nacional J8: ${prueba.error || `${prueba.partidos.length} partidos, ${prueba.partidos.filter((p) => p.textoNormalizado.includes("ferreries")).length} del Ferreries`} · cookies: ${[...new Set(registroCookies)].join(", ") || "ninguna"}`);
  for (const [teamId, comps] of Object.entries(config.equipos)) {
    for (const comp of comps.filter((c) => !c.grupo)) {
      const r = await leerJornadaCruda({ ...comp, grupo: "" }, config.temporada, 0).catch((e) => ({ resumen: e.message, grupos: [] }));
      log(`- ${teamId} · ${comp.nombre}: ${r.resumen}`);
      for (const g of r.grupos.filter((x) => x.valor && x.valor !== "0").slice(0, 8)) {
        const rg = await leerJornadaCruda({ ...comp, grupo: g.valor }, config.temporada, 1).catch((e) => ({ resumen: e.message }));
        log(`  - grupo ${g.valor} «${g.texto}»: ${rg.resumen}`);
      }
    }
  }
}

try {
  if (MODO === "diagnostico") await diagnostico();
  else if (MODO === "comprobar") await comprobar((await leerEstado()).state);
  else await importar();
} catch (error) {
  log(`❌ Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await escribirResumen();
}
