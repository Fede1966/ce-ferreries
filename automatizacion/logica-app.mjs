// Lógica de importación de actas copiada de app.js (importación de varias actas).
// Si cambia la forma en que la app reparte minutos, goles o tarjetas, hay que cambiarla también aquí.

export const DEFAULT_FORMATION = "1442";
const PLAN_SECTIONS = ["offensive", "defensive", "offensiveTransition", "defensiveTransition", "offensiveSetPieces", "defensiveSetPieces"];
const MATCH_DURATION_BY_TEAM_KEYWORD = [
  ["prebenjamin", 40],
  ["benjamin", 48],
  ["alevin", 60],
  ["infantil", 72],
  ["cadete", 80]
];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function nonNegativeInteger(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameTokens(value) {
  return normalizeSearchText(value).split(" ").filter((token) => token.length >= 2);
}

// "APELLIDOS, NOMBRE" (acta) frente al nombre del jugador en la app, en cualquier orden.
export function nameMatches(actaName, playerName) {
  const [surnames, given = ""] = String(actaName).split(",");
  const S = nameTokens(surnames);
  const G = nameTokens(given);
  const A = new Set([...S, ...G]);
  const P = new Set(nameTokens(playerName));
  if (!P.size || !A.size) return false;
  if ([...A].every((token) => P.has(token))) return true;
  return P.size >= 2 && [...P].every((token) => A.has(token)) && (G.length === 0 || G.some((token) => P.has(token)));
}

export function actaDisplayName(actaName) {
  const [surnames, given = ""] = String(actaName).split(",");
  const cap = (text) => text.trim().toLocaleLowerCase("es").replace(/(^|[\s'-])(\S)/g, (m, sep, ch) => sep + ch.toLocaleUpperCase("es"));
  return `${cap(given)} ${cap(surnames)}`.trim();
}

export function titleCaseTeam(name) {
  return String(name || "").toLocaleLowerCase("es").replace(/(^|[\s(.-])(\S)/g, (m, sep, ch) => sep + ch.toLocaleUpperCase("es"))
    .replace(/\bAtº\b/i, "Atº").replace(/\b(Cd|Ce|Cf|Ud|Sd|Fc|Rcd)\b/g, (w) => w.toUpperCase());
}

export function defaultActaDuration(teamId) {
  const id = String(teamId || "").toLowerCase();
  const found = MATCH_DURATION_BY_TEAM_KEYWORD.find(([keyword]) => id.includes(keyword));
  return found ? found[1] : 90;
}

export function isQuarterTeam(teamId) {
  const id = String(teamId || "").toLowerCase();
  return ["infantil", "alevin", "benjamin"].some((keyword) => id.includes(keyword));
}

export function normalizeQuarters(value) {
  const list = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => (list[index] ? 1 : 0));
}

export function quartersMinutes(quarters, duration) {
  return normalizeQuarters(quarters).reduce((sum, played) => sum + played, 0) * (duration / 4);
}

export function emptyPlayerReport() {
  return {
    text: "", rating: 0, yellowCards: 0, redCards: 0, minutes: 0, youtube: "",
    completedPasses: 0, failedPasses: 0, losses: 0, recoveries: 0, goals: 0,
    assists: 0, shotsOnTarget: 0, goalPasses: 0, goalsConceded: null
  };
}

export function ensurePlayerReport(item, matchId) {
  item.reports ||= {};
  const current = item.reports[matchId];
  if (!current || typeof current !== "object") {
    item.reports[matchId] = { ...emptyPlayerReport(), ...(typeof current === "string" ? { text: current } : {}) };
  } else {
    item.reports[matchId] = { ...emptyPlayerReport(), ...current };
  }
  return item.reports[matchId];
}

export function normalizeTeamMatchStats(value) {
  return {
    yellowCards: nonNegativeInteger(value?.yellowCards),
    redCards: nonNegativeInteger(value?.redCards),
    penaltiesFor: nonNegativeInteger(value?.penaltiesFor),
    penaltiesAgainst: nonNegativeInteger(value?.penaltiesAgainst),
    chancesCreated: nonNegativeInteger(value?.chancesCreated ?? value?.foulsCommitted),
    chancesAgainst: nonNegativeInteger(value?.chancesAgainst ?? value?.foulsReceived)
  };
}

export function emptyPlan() {
  return Object.fromEntries(PLAN_SECTIONS.flatMap((type) => [[`${type}Text`, ""], [`${type}Videos`, []]]));
}

export function emptyRatings() {
  return { technical: 0, tactical: 0, conditional: 0, cognitive: 0 };
}

export function competitionKind(name) {
  return /^\s*copa/i.test(name || "") ? "cup" : /amistos/i.test(name || "") ? "friendly" : "league";
}

export function actaOwnSide(parsed) {
  const isOwn = (name) => normalizeSearchText(name).includes("ferreries");
  if (isOwn(parsed.home) && !isOwn(parsed.away)) return "home";
  if (isOwn(parsed.away) && !isOwn(parsed.home)) return "away";
  return null;
}

// Registro por jugador de nuestro lado, calculado solo con lo que dice el acta
export function computeOwnActaRecords(parsed, ownSide, duration, quarterMode = false) {
  const lineup = parsed.lineups[ownSide];
  const rec = new Map();
  const blank = () => ({ role: "none", entry: 0, exit: 0, goals: 0, yellowCards: 0, redCards: 0 });
  [...lineup.starters, ...lineup.bench].forEach((p) => rec.set(p.name, { ...blank(), num: p.num }));
  lineup.starters.forEach((p) => Object.assign(rec.get(p.name), { role: "starter", entry: 0, exit: duration }));
  lineup.subs.forEach((change) => {
    const out = rec.get(change.out);
    if (out) out.exit = Math.min(duration, change.minute);
    const incoming = change.in ? rec.get(change.in) : null;
    if (incoming) Object.assign(incoming, { role: "substitute", entry: Math.min(duration, change.minute), exit: duration });
  });
  parsed.goals.filter((goal) => goal.team === ownSide && goal.type !== "own_goal").forEach((goal) => {
    const r = rec.get(goal.player);
    if (r) r.goals += 1;
  });
  lineup.cards.forEach((card) => {
    const r = rec.get(card.player);
    if (!r) return;
    if (card.color === "red") {
      r.redCards = 1;
      if (r.role !== "none" && r.exit > card.minute) r.exit = card.minute;
    } else r.yellowCards = Math.min(2, r.yellowCards + 1);
  });
  if (quarterMode) {
    rec.forEach((r) => {
      if (r.role === "none" && r.goals > 0) r.role = "substitute";
      r.entry = 0;
      r.exit = 0;
      r.quarters = [0, 0, 0, 0];
    });
  }
  return rec;
}

// Partido ya existente en la app (mismo criterio que la importación de la app)
export function findExistingMatch(teamMatches, parsed, ownSide) {
  const competition = competitionKind(parsed.competition);
  const isoDate = parsed.date ? parsed.date.split("-").reverse().join("-") : "";
  const opponent = ownSide === "home" ? parsed.away : parsed.home;
  return teamMatches.find((m) =>
    ((m.competition || "league") === competition && competition !== "friendly" && m.round === parsed.round)
    || (m.date && m.date === isoDate && normalizeSearchText(ownSide === "home" ? m.away : m.home) === normalizeSearchText(opponent)));
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// ¿Se parece un jugador nuevo del acta a alguno que ya está en la plantilla?
// (mismo apellido principal, nombre casi igual o mismo dorsal con algún nombre en común)
export function looksLikeExistingPlayer(actaName, number, roster) {
  const [surnames, given = ""] = String(actaName).split(",");
  const S = nameTokens(surnames);
  const G = nameTokens(given);
  const full = [...G, ...S].join(" ");
  return roster.some((p) => {
    const P = nameTokens(p.name);
    if (!P.length) return false;
    const shared = [...S, ...G].filter((t) => P.includes(t));
    if (S[0] && P.includes(S[0]) && G.some((g) => P.some((t) => t[0] === g[0]))) return true;
    if (editDistance(full, P.join(" ")) <= 3) return true;
    if (number && Number(p.number) === Number(number) && shared.length) return true;
    return false;
  });
}
