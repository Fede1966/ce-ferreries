const STORAGE_KEY = "athletic-club-technical-app-v1";
const STORAGE_BACKUP_KEY = `${STORAGE_KEY}-backup`;
const ACTIVE_SEASON_KEY = "ce-ferreries-active-season";
const LEGACY_SEASON = "2025-2026";
const NEW_SEASON = "2026-2027";
const SEASON_STORAGE_KEYS = {
  [LEGACY_SEASON]: STORAGE_KEY,
  [NEW_SEASON]: "ce-ferreries-technical-app-2026-2027"
};
const SEASON_BACKUP_KEYS = {
  [LEGACY_SEASON]: `${STORAGE_KEY}-automatic-backup`,
  [NEW_SEASON]: "ce-ferreries-technical-app-2026-2027-automatic-backup"
};
const SUPABASE_URL = "https://vhmnyjmhnobqmxgulsag.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobW55am1obm9icW14Z3Vsc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzEyNTMsImV4cCI6MjA5NjI0NzI1M30.Li4R65j3sGHSrIdt7tiubHNDgKrzjXDqcT92BCqZfDA";
const PLAYER_PHOTOS_BUCKET = "player-photos";
const AUTH_SESSION_KEY = "ce-ferreries-auth-session";
const ADMIN_EMAIL = "calagaldana@gmail.com";
const TEAM_LOGIN_ACCOUNTS = {
  regional: { email: "calagaldana+regional@gmail.com", teamId: "ce-ferreries-regional-preferente" },
  "juvenil-nacional": { email: "calagaldana+juvenil-nacional@gmail.com", teamId: "ce-ferreries-juvenil-nacional" },
  "juvenil-b": { email: "calagaldana+juvenil-b@gmail.com", teamId: "ce-ferreries-juvenil-preferente-b" },
  cadete: { email: "calagaldana+cadete@gmail.com", teamId: "ce-ferreries-cadete-preferente" },
  infantil: { email: "calagaldana+infantil@gmail.com", teamId: "ce-ferreries-infantil-preferente" },
  "alevin-a": { email: "calagaldana+alevin-a@gmail.com", teamId: "ce-ferreries-alevin-a" },
  "alevin-b": { email: "calagaldana+alevin-b@gmail.com", teamId: "ce-ferreries-alevin-b" },
  "benjamin-a": { email: "calagaldana+benjamin-a@gmail.com", teamId: "ce-ferreries-benjamin-a" },
  "benjamin-b": { email: "calagaldana+benjamin-b@gmail.com", teamId: "ce-ferreries-benjamin-b" },
  prebenjamin: { email: "calagaldana+prebenjamin@gmail.com", teamId: "ce-ferreries-prebenjamin" }
};
let authSession = loadAuthSession();

function loadAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
    if (!session?.access_token) return null;
    if (session.expires_at && Number(session.expires_at) * 1000 <= Date.now()) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function refreshSession() {
  if (!authSession?.refresh_token) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: authSession.refresh_token })
    });
    if (!response.ok) return;
    const result = await response.json();
    if (!result.access_token) return;
    authSession = result;
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(result));
  } catch {
    // silently ignore refresh errors
  }
}

async function getValidAccessToken() {
  if (!authSession?.access_token) return getSupabaseAnonKey();
  const expiresAt = authSession.expires_at ? Number(authSession.expires_at) * 1000 : Infinity;
  if (expiresAt - Date.now() < 60_000) {
    await refreshSession();
  }
  return authSession?.access_token || getSupabaseAnonKey();
}

function canEdit() {
  if (!authSession?.access_token) return false;
  const email = authSession.user?.email?.toLocaleLowerCase("es") || "";
  if (email === ADMIN_EMAIL) return true;
  const assignedTeamId = Object.values(TEAM_LOGIN_ACCOUNTS)
    .find((account) => account.email === email)?.teamId;
  return Boolean(assignedTeamId && assignedTeamId === state?.activeTeamId);
}
const TEAM_NAME = "Athletic Club";
const DEFAULT_TEAM_ID = "athletic-club";
const DEFAULT_TEAMS_VERSION = 2;
const DEFAULT_VISIBLE_TEAM = {
  id: "ce-ferreries-cadete-preferente",
  name: "CE Ferreries Cadete Preferente"
};
const DEFAULT_VISIBLE_TEAMS = [
  DEFAULT_VISIBLE_TEAM,
  { id: "ce-ferreries-infantil-preferente", name: "CE Ferreries Infantil Preferente" },
  { id: "ce-ferreries-alevin-a", name: "CE Ferreries Alevín A" },
  { id: "ce-ferreries-alevin-b", name: "CE Ferreries Alevín B" },
  { id: "ce-ferreries-benjamin-a", name: "CE Ferreries Benjamín A" },
  { id: "ce-ferreries-benjamin-b", name: "CE Ferreries Benjamín B" },
  { id: "ce-ferreries-prebenjamin", name: "CE Ferreries Prebenjamín" }
];
const TEAM_RELEVANCE = [
  "regional",
  "juvenil-nacional",
  "juvenil-b",
  "cadete",
  "infantil",
  "alevin-a",
  "alevin-b",
  "benjamin-a",
  "benjamin-b",
  "prebenjamin"
];
const DEFAULT_FORMATION = "1442";
const FORMATION_STORAGE_KEY = "__formation";
const APP_STATE_MATCH_ID = "__app_state__";
const NEW_SEASON_APP_STATE_MATCH_ID = "__app_state_2026_2027__";
const REMOVED_TEAM_IDS = new Set(["athletic-club", "ce-ferreries-cadete-a"]);
const REMOVED_MATCH_IDS = new Set(["b7023b94-d831-4795-aab4-c861b3a7a7cd"]);
const FINAL_STANDINGS = [
  { name: 'CF SPORTING DE MAHON "A"', played: 14, won: 11, drawn: 1, lost: 2, points: 34 },
  { name: 'UD MAHON "A"', played: 14, won: 9, drawn: 0, lost: 5, points: 27 },
  { name: 'CIUTADELLA C.E. "A"', played: 14, won: 9, drawn: 0, lost: 5, points: 27 },
  { name: 'CE FERRERIES "A"', played: 14, won: 8, drawn: 2, lost: 4, points: 26 },
  { name: 'PENYA CIUTADELLA ESPORTIVA "A"', played: 14, won: 5, drawn: 4, lost: 5, points: 19 },
  { name: 'CD MENORCA "B"', played: 14, won: 4, drawn: 2, lost: 8, points: 14 },
  { name: "CE ALAIOR", played: 14, won: 3, drawn: 3, lost: 8, points: 12 },
  { name: 'CE MERCADAL "B"', played: 14, won: 0, drawn: 2, lost: 12, points: 2 }
];
const PLAN_SECTIONS = [
  ["offensive", "Acciones ofensivas"],
  ["defensive", "Acciones defensivas"],
  ["offensiveTransition", "Transiciones ofensivas"],
  ["defensiveTransition", "Transiciones defensivas"],
  ["offensiveSetPieces", "ABP ofensivas"],
  ["defensiveSetPieces", "ABP defensivas"]
];
const FORMATIONS = {
  "1442": {
    label: "1-4-4-2",
    slots: formationSlots([1, 4, 4, 2], [90, 72, 49, 24])
  },
  "1352": {
    label: "1-3-5-2",
    slots: formationSlots([1, 3, 5, 2], [90, 72, 49, 24])
  },
  "1433": {
    label: "1-4-3-3",
    slots: formationSlots([1, 4, 3, 3], [90, 72, 49, 24])
  },
  "14231": {
    label: "1-4-2-3-1",
    slots: formationSlots([1, 4, 2, 3, 1], [90, 72, 56, 38, 19])
  }
};

const initialState = {
  lastModifiedAt: 0,
  defaultTeamsVersion: DEFAULT_TEAMS_VERSION,
  teams: structuredClone(DEFAULT_VISIBLE_TEAMS),
  activeTeamId: DEFAULT_VISIBLE_TEAM.id,
  staff: [],
  matchVideos: [],
  players: [
    player("p1", "Unai Simón", 1, "1997-06-11", "Portero", "Diestro"),
    player("p2", "Aitor Paredes", 4, "2000-04-29", "Defensa", "Diestro"),
    player("p3", "Yeray Álvarez", 5, "1995-01-24", "Defensa", "Diestro"),
    player("p4", "Dani Vivian", 3, "1999-07-05", "Defensa", "Diestro"),
    player("p5", "Yuri Berchiche", 17, "1990-02-10", "Defensa", "Zurdo"),
    player("p6", "Ander Herrera", 21, "1989-08-14", "Centrocampista", "Diestro"),
    player("p7", "Mikel Vesga", 6, "1993-05-21", "Centrocampista", "Zurdo"),
    player("p8", "Oihan Sancet", 8, "2000-04-25", "Centrocampista", "Diestro"),
    player("p9", "Nico Williams", 11, "2002-07-12", "Delantero", "Diestro"),
    player("p10", "Iñaki Williams", 9, "1994-06-15", "Delantero", "Diestro"),
    player("p11", "Gorka Guruzeta", 12, "1996-09-12", "Delantero", "Diestro"),
    player("p12", "Álex Berenguer", 7, "1995-07-04", "Delantero", "Ambos"),
    player("p13", "Beñat Prados", 24, "2001-02-08", "Centrocampista", "Diestro"),
    player("p14", "Julen Agirrezabala", 13, "2000-12-26", "Portero", "Diestro"),
    player("p15", "Óscar de Marcos", 18, "1989-04-14", "Defensa", "Diestro")
  ],
  matches: [
    match("m1", 1, TEAM_NAME, "Osasuna", "", "Preparación", ""),
    match("m2", 2, "Betis", TEAM_NAME, "", "Preparación", "")
  ],
  selectedMatchId: "m1",
  selectedPlayerId: "p1",
  activeView: "squad",
  activeDetailTab: "plan",
  activePlayerTab: "statistics"
};

const requestedSeason = new URLSearchParams(window.location.search).get("temporada");
const requestedView = new URLSearchParams(window.location.search).get("vista");
const isLandingPage = !requestedSeason;
let activeSeason = requestedSeason === NEW_SEASON ? NEW_SEASON : LEGACY_SEASON;
let state = loadState();
const recoveredCadeteMatchCount = recoverCadeteSeasonFromLocalBackups();
repairMissingTeams();
recoverKnown2026SeasonData();
if (["squad", "matches", "standings", "statistics"].includes(requestedView)) {
  state.activeView = requestedView;
}
document.querySelector("#landing-page").hidden = !isLandingPage;
document.querySelector("#technical-app").hidden = isLandingPage;
let draggedPlayerId = null;
let remoteSaveTimer = null;
let isPullingRemote = false;
let supportsRemotePlayerProfiles = false;
let returnToPlayerReportsAfterMatchSave = false;

const views = {
  squad: document.querySelector("#squad-view"),
  matches: document.querySelector("#matches-view"),
  standings: document.querySelector("#standings-view"),
  statistics: document.querySelector("#statistics-view"),
  playerDetail: document.querySelector("#player-detail-view"),
  detail: document.querySelector("#match-detail-view")
};

const pageTitle = document.querySelector("#page-title");
const seasonLabel = document.querySelector("#season-label");
const contextActionButton = document.querySelector("#context-action-button");
const createMatchFromActaButton = document.querySelector("#create-match-from-acta-button");
const createMatchActaInput = document.querySelector("#create-match-acta-input");
const bulkActaButton = document.querySelector("#bulk-acta-button");
const bulkActaInput = document.querySelector("#bulk-acta-input");
const bulkActaDialog = document.querySelector("#bulk-acta-dialog");
const toolbarTeamSelectorWrap = document.querySelector("#toolbar-team-selector-wrap");
const toolbarTeamSelector = document.querySelector("#toolbar-team-selector");
const playerDialog = document.querySelector("#player-dialog");
const playerForm = document.querySelector("#player-form");
const matchDialog = document.querySelector("#match-dialog");
const matchForm = document.querySelector("#match-form");
const teamDialog = document.querySelector("#team-dialog");
const teamForm = document.querySelector("#team-form");
const deleteTeamButton = document.querySelector("#delete-team-button");
const playerPhotoInput = document.querySelector("#player-photo");
const playerPhotoFileInput = document.querySelector("#player-photo-file");
const playerPhotoPreview = document.querySelector("#player-photo-preview");
const playerFormSaveStatus = document.querySelector("#player-form-save-status");
const deletePlayerModalButton = document.querySelector("#delete-player-modal-button");
const staffDialog = document.querySelector("#staff-dialog");
const staffForm = document.querySelector("#staff-form");
const deleteStaffButton = document.querySelector("#delete-staff-button");
const staffPhotoInput = document.querySelector("#staff-photo");
const staffPhotoFileInput = document.querySelector("#staff-photo-file");
const staffPhotoPreview = document.querySelector("#staff-photo-preview");
const addMatchVideoButton = document.querySelector("#add-match-video-button");
const matchVideoDialog = document.querySelector("#match-video-dialog");
const matchVideoForm = document.querySelector("#match-video-form");
const loginDialog = document.querySelector("#login-dialog");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const passwordRecoveryDialog = document.querySelector("#password-recovery-dialog");
const passwordRecoveryForm = document.querySelector("#password-recovery-form");
const passwordRecoveryStatus = document.querySelector("#password-recovery-status");
const matchReportImportDialog = document.querySelector("#match-report-import-dialog");
const matchReportImportForm = document.querySelector("#match-report-import-form");
const actaFileInput = document.querySelector("#acta-file");

document.querySelectorAll(".nav-button").forEach((button) => {
  if (button.dataset.view) button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll(".login-nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (canEdit()) {
      if (confirm("¿Cerrar la sesión de edición?")) {
        authSession = null;
        localStorage.removeItem(AUTH_SESSION_KEY);
        updateLoginButtons();
        render();
      }
      return;
    }
    loginForm.reset();
    document.querySelector("#login-password").type = "password";
    document.querySelector("#toggle-login-password").textContent = "Ver";
    document.querySelector("#toggle-login-password").setAttribute("aria-pressed", "false");
    loginStatus.textContent = "";
    loginDialog.showModal();
  });
});

document.querySelector("#close-login-button").addEventListener("click", () => loginDialog.close());
document.querySelector("#cancel-login-button").addEventListener("click", () => loginDialog.close());
document.querySelector("#toggle-login-password").addEventListener("click", (event) => {
  const passwordInput = document.querySelector("#login-password");
  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  event.currentTarget.textContent = isVisible ? "Ver" : "Ocultar";
  event.currentTarget.setAttribute("aria-pressed", String(!isVisible));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.querySelector("#login-username").value.trim().toLocaleLowerCase("es");
  const password = document.querySelector("#login-password").value;
  const email = username === ADMIN_EMAIL
    ? ADMIN_EMAIL
    : TEAM_LOGIN_ACCOUNTS[username]?.email || "";
  const submitButton = loginForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  loginStatus.textContent = "Comprobando credenciales...";
  try {
    if (!email) throw new Error("Este usuario todavía no está activado");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) throw new Error("Usuario o contraseña incorrectos");
    authSession = result;
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(result));
    loginDialog.close();
    updateLoginButtons(username);
    render();
    if (recoveredCadeteMatchCount) pushRemoteState();
  } catch (error) {
    loginStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

const recoveryParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const recoveryAccessToken = recoveryParams.get("type") === "recovery"
  ? recoveryParams.get("access_token")
  : "";

if (recoveryAccessToken) {
  passwordRecoveryDialog.showModal();
} else if (recoveryParams.get("error_description")) {
  loginStatus.textContent = decodeURIComponent(recoveryParams.get("error_description"));
  loginDialog.showModal();
}

passwordRecoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#recovery-password").value;
  const confirmation = document.querySelector("#recovery-password-confirmation").value;
  const submitButton = passwordRecoveryForm.querySelector('[type="submit"]');
  passwordRecoveryStatus.textContent = "";

  if (password !== confirmation) {
    passwordRecoveryStatus.textContent = "Las contraseñas no coinciden";
    return;
  }

  submitButton.disabled = true;
  passwordRecoveryStatus.textContent = "Guardando la contraseña...";
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${recoveryAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });
    const user = await response.json();
    if (!response.ok) throw new Error(user.msg || user.message || "No se pudo cambiar la contraseña");

    const expiresIn = Number(recoveryParams.get("expires_in")) || 3600;
    authSession = {
      access_token: recoveryAccessToken,
      refresh_token: recoveryParams.get("refresh_token") || "",
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    passwordRecoveryStatus.textContent = "Contraseña actualizada correctamente";
    setTimeout(() => {
      passwordRecoveryDialog.close();
      updateLoginButtons(user.email?.split("@")[0] || "");
      render();
    }, 900);
  } catch (error) {
    passwordRecoveryStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#close-match-report-import").addEventListener("click", () => matchReportImportDialog.close());
document.querySelector("#cancel-match-report-import").addEventListener("click", () => matchReportImportDialog.close());

actaFileInput.addEventListener("change", async () => {
  const file = actaFileInput.files[0];
  const preview = document.querySelector("#acta-file-preview");
  if (!file) return;
  if (file.type.startsWith("image/")) {
    preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Vista previa del acta" /><span>${escapeHtml(file.name)}</span>`;
  } else {
    preview.innerHTML = `<span>PDF seleccionado: ${escapeHtml(file.name)}</span>`;
  }
  if (file.type.startsWith("image/")) await analyzeActaImage(file);
  else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) await analyzeActaPdf(file);
});

async function parseActaFichePdf(file) {
  if (!window.pdfjsLib || !window.ActaFiche) throw new Error("No se ha podido cargar el lector de PDF.");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  return ActaFiche.parse(pdf, (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true }) };
  });
}

// Lado del acta (home/away) que corresponde a nuestro equipo
function actaOwnSide(parsed, matchItem) {
  const club = normalizeSearchText(currentTeam()?.name || TEAM_NAME).includes("ferreries") ? "ferreries" : "";
  const isOwn = (name) => club && normalizeSearchText(name).includes(club);
  if (isOwn(parsed.home) && !isOwn(parsed.away)) return "home";
  if (isOwn(parsed.away) && !isOwn(parsed.home)) return "away";
  return matchItem ? ownTeamSide(matchItem) : "home";
}

// Rellena la tabla del diálogo "Importar acta" con lo leído de la ficha. Devuelve un resumen.
function applyParsedActaToDialog(parsed, ownSide) {
  const lineup = parsed.lineups[ownSide];
  const rows = [...document.querySelectorAll("#acta-player-rows tr")].map((row) => {
    const player = state.players.find((item) => item.id === row.dataset.playerId);
    return { row, name: player?.name || "", number: Number(player?.number) || 0, tokens: nameTokens(player?.name) };
  });
  const find = (actaName, number) => {
    const named = rows.filter((entry) => nameMatches(actaName, entry.name));
    if (named.length) return named.sort((a, b) => b.tokens.length - a.tokens.length)[0];
    const byNumber = rows.filter((entry) => entry.number === Number(number) && !entry.name.trim());
    return byNumber.length === 1 ? byNumber[0] : null;
  };
  const numbers = new Map([...lineup.starters, ...lineup.bench].map((p) => [p.name, p.num]));
  const sin = [];
  const set = (entry, selector, value) => { entry.row.querySelector(selector).value = value; };
  rows.forEach((entry) => {
    set(entry, "[data-acta-role]", "none");
    set(entry, "[data-acta-entry]", "");
    set(entry, "[data-acta-exit]", "");
    set(entry, "[data-acta-goals]", 0);
    set(entry, "[data-acta-yellow]", 0);
    set(entry, "[data-acta-red]", 0);
  });
  const duration = Number(document.querySelector("#acta-duration").value) || 90;
  lineup.starters.forEach((p) => {
    const entry = find(p.name, p.num);
    if (!entry) { sin.push(p.name); return; }
    set(entry, "[data-acta-role]", "starter");
    set(entry, "[data-acta-entry]", 0);
  });
  lineup.subs.forEach((change) => {
    const out = find(change.out, numbers.get(change.out));
    const incoming = change.in ? find(change.in, numbers.get(change.in)) : null;
    if (out) set(out, "[data-acta-exit]", change.minute);
    else sin.push(change.out);
    if (incoming) {
      set(incoming, "[data-acta-role]", "substitute");
      set(incoming, "[data-acta-entry]", change.minute);
    } else if (change.in) sin.push(change.in);
  });
  parsed.goals.filter((goal) => goal.team === ownSide && goal.type !== "own_goal").forEach((goal) => {
    const entry = find(goal.player, numbers.get(goal.player));
    if (!entry) { sin.push(goal.player); return; }
    set(entry, "[data-acta-goals]", Number(entry.row.querySelector("[data-acta-goals]").value || 0) + 1);
  });
  lineup.cards.forEach((card) => {
    const entry = find(card.player, numbers.get(card.player));
    if (!entry) { sin.push(card.player); return; }
    const selector = card.color === "red" ? "[data-acta-red]" : "[data-acta-yellow]";
    set(entry, selector, Number(entry.row.querySelector(selector).value || 0) + 1);
    // El expulsado deja de jugar en el minuto de la roja (si no salió antes por un cambio)
    const exitInput = entry.row.querySelector("[data-acta-exit]");
    if (card.color === "red" && (exitInput.value === "" || Number(exitInput.value) > card.minute)) exitInput.value = card.minute;
  });
  document.querySelector("#acta-score").value = parsed.score;
  void duration;
  const ownGoals = parsed.goals.filter((goal) => goal.team !== ownSide && goal.type === "own_goal").length;
  return { starters: lineup.starters.length, subs: lineup.subs.length, sin: [...new Set(sin)], ownGoals };
}

function describeActaResult(result) {
  const parts = [`PDF leído: ${result.starters} titulares y ${result.subs} cambios.`];
  if (result.ownGoals) parts.push(`${result.ownGoals} gol(es) en propia puerta del rival.`);
  if (result.sin.length) parts.push(`No he encontrado en tu plantilla a: ${result.sin.join(", ")}. Revísalos a mano.`);
  parts.push("Revisa la tabla y confirma el acta.");
  return parts.join(" ");
}

async function analyzeActaPdf(file) {
  const status = document.querySelector("#acta-import-status");
  status.textContent = "Leyendo el PDF original...";
  try {
    const parsed = await parseActaFichePdf(file);
    const matchItem = state.matches.find((item) => item.id === document.querySelector("#acta-match-id").value);
    const result = applyParsedActaToDialog(parsed, actaOwnSide(parsed, matchItem));
    status.textContent = describeActaResult(result);
  } catch (error) {
    console.error("Error leyendo el PDF del acta", error);
    status.textContent = error instanceof Error && /escaneo|ficha de partido/.test(error.message)
      ? error.message + " Descarga el PDF original de la FFIB e inténtalo de nuevo."
      : "No se ha podido leer este PDF. Prueba con el archivo original descargado de la FFIB.";
  }
}

createMatchFromActaButton.addEventListener("click", () => {
  createMatchActaInput.value = "";
  createMatchActaInput.click();
});

createMatchActaInput.addEventListener("change", async () => {
  const file = createMatchActaInput.files[0];
  if (!file) return;
  let parsed;
  try {
    parsed = await parseActaFichePdf(file);
  } catch (error) {
    console.error("Error leyendo el acta", error);
    alert(error instanceof Error && /escaneo|ficha de partido/.test(error.message)
      ? `${error.message} Descarga el PDF original de la FFIB (no una foto) e inténtalo de nuevo.`
      : "No se ha podido leer este PDF. Prueba con el archivo original descargado de la FFIB.");
    return;
  }
  const ownSide = actaOwnSide(parsed, null);
  const opponent = ownSide === "home" ? parsed.away : parsed.home;
  const isoDate = parsed.date ? parsed.date.split("-").reverse().join("-") : "";
  const ownName = currentTeam().name;
  const competitionType = /^\s*copa/i.test(parsed.competition) ? "cup" : /amistos/i.test(parsed.competition) ? "friendly" : "league";
  const duplicate = activeMatches().find((item) =>
    (parsed.round && item.round === parsed.round && (item.competition || "league") === competitionType && competitionType !== "friendly")
    || (item.date && item.date === isoDate && normalizeSearchText(ownSide === "home" ? item.away : item.home) === normalizeSearchText(opponent)));
  let matchItem = duplicate;
  if (duplicate) {
    if (!confirm(`Ya existe un partido de la jornada ${duplicate.round} (${duplicate.home} - ${duplicate.away}) en ${currentTeam().name}. ¿Quieres cargar este acta en ese partido en vez de crear uno nuevo?`)) return;
  } else {
    matchItem = {
      id: crypto.randomUUID(),
      updatedAt: Date.now(),
      teamId: state.activeTeamId,
      competition: competitionType,
      round: competitionType === "friendly" ? 0 : parsed.round || nextRound(),
      date: isoDate,
      time: parsed.time,
      home: ownSide === "home" ? ownName : titleCaseTeam(parsed.home),
      away: ownSide === "away" ? ownName : titleCaseTeam(parsed.away),
      status: "Jugado",
      score: parsed.score,
      teamStats: normalizeTeamMatchStats(),
      notes: "",
      videoUrl: "",
      actaDuration: defaultActaDuration(state.activeTeamId),
      actaPlayers: {},
      actaFileUrl: "",
      actaFilePath: "",
      actaFileName: "",
      actaFileType: "",
      lineupSheets: null,
      lineup: {},
      formation: DEFAULT_FORMATION,
      plan: emptyPlan()
    };
    state.matches.push(matchItem);
  }
  Object.assign(matchItem, { date: isoDate || matchItem.date, time: parsed.time || matchItem.time, status: "Jugado" });
  state.selectedMatchId = matchItem.id;
  saveState();
  render();
  openMatchReportImport(matchItem);
  const transfer = new DataTransfer();
  transfer.items.add(file);
  actaFileInput.files = transfer.files;
  document.querySelector("#acta-file-preview").innerHTML = `<span>PDF seleccionado: ${escapeHtml(file.name)}</span>`;
  const result = applyParsedActaToDialog(parsed, ownSide);
  document.querySelector("#acta-import-status").textContent =
    `${duplicate ? "Acta cargada en el partido existente" : `Partido creado (${parsed.competition || "sin competición"}, jornada ${matchItem.round}) contra ${opponent}`}. ${describeActaResult(result)}`;
});


// ---------- Comparación de nombres entre actas y plantilla ----------
function nameTokens(value) {
  return normalizeSearchText(value).split(" ").filter((token) => token.length >= 2);
}

// "APELLIDOS, NOMBRE" (acta) frente al nombre del jugador en la app, en cualquier orden.
// Dos hermanos o primos con los mismos apellidos NO se confunden: el nombre de pila tiene que coincidir.
function nameMatches(actaName, playerName) {
  const [surnames, given = ""] = String(actaName).split(",");
  const S = nameTokens(surnames);
  const G = nameTokens(given);
  const A = new Set([...S, ...G]);
  const P = new Set(nameTokens(playerName));
  if (!P.size || !A.size) return false;
  if ([...A].every((token) => P.has(token))) return true;
  return P.size >= 2 && [...P].every((token) => A.has(token)) && (G.length === 0 || G.some((token) => P.has(token)));
}

function actaDisplayName(actaName) {
  const [surnames, given = ""] = String(actaName).split(",");
  const cap = (text) => text.trim().toLocaleLowerCase("es").replace(/(^|[\s'-])(\S)/g, (m, sep, ch) => sep + ch.toLocaleUpperCase("es"));
  return `${cap(given)} ${cap(surnames)}`.trim();
}

// Registro por jugador de nuestro lado, calculado solo con lo que dice el acta
function computeOwnActaRecords(parsed, ownSide, duration) {
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
  return rec;
}

// ---------- Importación de varias actas ----------
let bulkPlan = null;

bulkActaButton.addEventListener("click", () => {
  bulkActaInput.value = "";
  bulkActaInput.click();
});

bulkActaInput.addEventListener("change", async () => {
  const files = [...bulkActaInput.files];
  if (!files.length) return;
  document.querySelector("#bulk-acta-body").innerHTML = "";
  document.querySelector("#confirm-bulk-acta").disabled = true;
  document.querySelector("#bulk-acta-status").textContent = `Leyendo ${files.length} PDF...`;
  bulkActaDialog.showModal();
  const items = [];
  for (const file of files) {
    try {
      items.push({ file, parsed: await parseActaFichePdf(file) });
    } catch (error) {
      items.push({ file, error: error instanceof Error ? error.message : "No se ha podido leer este PDF." });
    }
  }
  bulkPlan = buildBulkPlan(items);
  renderBulkPlan(bulkPlan);
});

function buildBulkPlan(items) {
  const roster = activePlayers().map((p) => ({ ref: p, name: p.name, existing: true }));
  const created = [];
  const resolve = (actaName, num) => {
    const found = roster.find((entry) => nameMatches(actaName, entry.name));
    if (found) { if (num) found.lastNumber = num; return found; }
    const entry = {
      ref: null, existing: false, name: actaDisplayName(actaName), lastNumber: num,
      id: crypto.randomUUID()
    };
    roster.push(entry);
    created.push(entry);
    return entry;
  };
  const duration = defaultActaDuration(state.activeTeamId);
  const seen = new Set();
  const plan = { matches: [], created, errors: [] };
  items
    .filter((item) => item.parsed)
    .sort((a, b) => (a.parsed.date || "").split("-").reverse().join("").localeCompare((b.parsed.date || "").split("-").reverse().join("")) || a.parsed.round - b.parsed.round)
    .forEach((item) => {
      const parsed = item.parsed;
      const ownSide = actaOwnSide(parsed, null);
      const competition = /^\s*copa/i.test(parsed.competition) ? "cup" : /amistos/i.test(parsed.competition) ? "friendly" : "league";
      const isoDate = parsed.date ? parsed.date.split("-").reverse().join("-") : "";
      const opponent = ownSide === "home" ? parsed.away : parsed.home;
      const key = `${competition}|${parsed.round}|${normalizeSearchText(opponent)}`;
      if (seen.has(key)) { plan.errors.push(`${item.file.name}: repetida en este lote (${opponent}, jornada ${parsed.round}); se ignora.`); return; }
      seen.add(key);
      const existing = activeMatches().find((m) =>
        ((m.competition || "league") === competition && competition !== "friendly" && m.round === parsed.round)
        || (m.date && m.date === isoDate && normalizeSearchText(ownSide === "home" ? m.away : m.home) === normalizeSearchText(opponent)));
      const records = computeOwnActaRecords(parsed, ownSide, duration);
      const players = [...records.entries()].map(([actaName, record]) => ({ actaName, record, entry: resolve(actaName, record.num) }));
      plan.matches.push({ file: item.file, parsed, ownSide, competition, isoDate, opponent, existing, players, duration });
    });
  items.filter((item) => item.error).forEach((item) => plan.errors.push(`${item.file.name}: ${item.error}`));
  return plan;
}

function renderBulkPlan(plan) {
  const own = currentTeam().name;
  const newByMatch = (m) => m.players.filter((p) => !p.entry.existing && p.record.role !== "none").length;
  const rows = plan.matches.map((m) => `
    <tr>
      <td>${m.parsed.round}</td>
      <td>${escapeHtml(m.parsed.competition || "")}</td>
      <td>${escapeHtml(m.opponent)}</td>
      <td>${escapeHtml(m.parsed.score)} ${m.ownSide === "home" ? "(local)" : "(visitante)"}</td>
      <td>${escapeHtml(m.parsed.date)}</td>
      <td>${m.existing ? "Ya existe: se rellenará" : "Partido nuevo"}</td>
    </tr>`).join("");
  const newPlayers = plan.created.map((p) => `<li>${p.lastNumber ? `#${p.lastNumber} ` : ""}${escapeHtml(p.name)}</li>`).join("");
  document.querySelector("#bulk-acta-body").innerHTML = `
    <p class="meta">Equipo activo: <strong>${escapeHtml(own)}</strong>. Se leen ${plan.matches.length} acta(s). Revisa antes de importar.</p>
    ${plan.errors.length ? `<div class="login-status">${plan.errors.map(escapeHtml).join("<br>")}</div>` : ""}
    <div class="acta-table-wrap"><table class="acta-table">
      <thead><tr><th>Jornada</th><th>Competición</th><th>Rival</th><th>Resultado</th><th>Fecha</th><th>Acción</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <h3>Jugadores nuevos que se crearán (${plan.created.length})</h3>
    ${plan.created.length ? `<ul class="bulk-new-players">${newPlayers}</ul><p class="meta">Se crean solo con nombre y dorsal. Posición, fecha de nacimiento y foto los completas después.</p>` : `<p class="meta">Todos los jugadores del acta ya están en tu plantilla.</p>`}
    <p class="meta">Los jugadores con apellidos iguales se distinguen por su nombre de pila. Si ves nombres duplicados en la lista, cancela y avísame.</p>`;
  void newByMatch;
  document.querySelector("#confirm-bulk-acta").disabled = !plan.matches.length;
  document.querySelector("#bulk-acta-status").textContent = plan.matches.length ? "" : "No hay ningún acta válida para importar.";
}

document.querySelector("#close-bulk-acta").addEventListener("click", () => bulkActaDialog.close());
document.querySelector("#cancel-bulk-acta").addEventListener("click", () => bulkActaDialog.close());

document.querySelector("#confirm-bulk-acta").addEventListener("click", async () => {
  if (!bulkPlan) return;
  const button = document.querySelector("#confirm-bulk-acta");
  const status = document.querySelector("#bulk-acta-status");
  button.disabled = true;
  let uploadFailures = 0;
  // 1. Jugadores nuevos
  bulkPlan.created.forEach((entry) => {
    const playerItem = {
      id: entry.id, teamId: state.activeTeamId, name: entry.name, number: entry.lastNumber || 0,
      birthdate: "", position: "Por definir", laterality: "Diestro", photo: "", photoPath: "",
      description: "", career: "", ratings: normalizePlayerRatings(), reports: {}
    };
    state.players.push(playerItem);
    entry.ref = playerItem;
  });
  // 2. Partidos
  for (const [index, m] of bulkPlan.matches.entries()) {
    status.textContent = `Importando ${index + 1} de ${bulkPlan.matches.length}...`;
    const parsed = m.parsed;
    let matchItem = m.existing;
    if (!matchItem) {
      matchItem = {
        id: crypto.randomUUID(), updatedAt: Date.now(), teamId: state.activeTeamId, competition: m.competition,
        round: m.competition === "friendly" ? 0 : parsed.round || nextRound(), date: m.isoDate, time: parsed.time,
        home: m.ownSide === "home" ? currentTeam().name : titleCaseTeam(parsed.home),
        away: m.ownSide === "away" ? currentTeam().name : titleCaseTeam(parsed.away),
        status: "Jugado", score: parsed.score, teamStats: normalizeTeamMatchStats(), notes: "", videoUrl: "",
        actaDuration: m.duration, actaPlayers: {}, actaFileUrl: "", actaFilePath: "", actaFileName: "", actaFileType: "",
        lineupSheets: null, lineup: {}, formation: DEFAULT_FORMATION, plan: emptyPlan()
      };
      state.matches.push(matchItem);
    }
    Object.assign(matchItem, { date: m.isoDate || matchItem.date, time: parsed.time || matchItem.time, status: "Jugado", score: parsed.score, actaDuration: m.duration });
    const uploaded = await uploadActaFile(m.file, matchItem.id);
    if (uploaded) Object.assign(matchItem, { actaFileUrl: uploaded.url, actaFilePath: uploaded.path, actaFileName: m.file.name, actaFileType: m.file.type });
    else uploadFailures++;
    const records = {};
    let yellowCards = 0;
    let redCards = 0;
    m.players.forEach(({ record, entry }) => {
      const playerItem = entry.ref;
      if (!playerItem) return;
      const played = record.role !== "none";
      const report = ensurePlayerReport(playerItem, matchItem.id);
      report.minutes = played ? Math.max(0, record.exit - record.entry) : 0;
      report.goals = played ? record.goals : 0;
      // Las tarjetas a suplentes que no llegaron a jugar también cuentan
      report.yellowCards = record.yellowCards;
      report.redCards = record.redCards;
      yellowCards += report.yellowCards;
      redCards += report.redCards;
      records[playerItem.id] = {
        role: record.role, entry: played ? record.entry : 0, exit: played ? record.exit : 0,
        goals: report.goals, yellowCards: report.yellowCards, redCards: report.redCards
      };
    });
    matchItem.actaPlayers = records;
    matchItem.lineupSheets = normalizeLineupSheets(matchItem.lineupSheets, matchItem);
    matchItem.lineupSheets[m.ownSide] = Object.entries(records)
      .filter(([, r]) => r.role !== "none")
      .map(([playerId, r]) => ({
        playerId,
        name: state.players.find((p) => p.id === playerId)?.name || "",
        role: r.role === "substitute" ? "substitute" : "starter",
        changeMinute: r.role === "substitute" ? r.entry : r.exit < m.duration ? r.exit : ""
      }));
    matchItem.teamStats = { ...normalizeTeamMatchStats(matchItem.teamStats), yellowCards, redCards };
    markMatchUpdated(matchItem);
  }
  saveState();
  bulkActaDialog.close();
  bulkPlan = null;
  render();
  if (uploadFailures) alert(`Los datos se han guardado, pero ${uploadFailures} acta(s) no han podido subirse como archivo. Puedes adjuntarlas después sin repetir los datos.`);
});

function titleCaseTeam(name) {
  return String(name || "").toLocaleLowerCase("es").replace(/(^|[\s(.-])(\S)/g, (m, sep, ch) => sep + ch.toLocaleUpperCase("es"))
    .replace(/\bAtº\b/i, "Atº").replace(/\b(Cd|Ce|Cf|Ud|Sd|Fc|Rcd)\b/g, (w) => w.toUpperCase());
}

function pdfTextLines(items) {
  const rows = [];
  items.filter((item) => item?.str?.trim()).forEach((item) => {
    const y = Number(item.transform?.[5] || 0);
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x: Number(item.transform?.[4] || 0), text: item.str.trim() });
  });
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "));
}

async function analyzeActaImage(file) {
  const status = document.querySelector("#acta-import-status");
  if (!window.Tesseract) {
    status.textContent = "No se ha podido cargar el lector automático. Puedes completar la tabla manualmente.";
    return;
  }
  status.textContent = "Leyendo el acta: 0%";
  try {
    const worker = await Tesseract.createWorker("spa", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          status.textContent = `Leyendo el acta: ${Math.round((message.progress || 0) * 100)}%`;
        }
      }
    });
    const sourceImage = await loadActaImage(file);
    const matchItem = state.matches.find((item) => item.id === document.querySelector("#acta-match-id").value);
    const ownSide = matchItem ? ownTeamSide(matchItem) : "home";
    const teamColumn = ownSide === "away"
      ? { left: .57, width: .42 }
      : { left: .25, width: .38 };
    const rosterImage = preprocessActaRegion(sourceImage, {
      left: teamColumn.left,
      top: .035,
      width: teamColumn.width,
      height: .62
    });
    const substitutionsImage = preprocessActaRegion(sourceImage, {
      left: teamColumn.left,
      top: .61,
      width: teamColumn.width,
      height: .39
    });
    const goalsImage = preprocessActaRegion(sourceImage, { left: 0, top: .18, width: .34, height: .3 });
    await worker.setParameters({
      tessedit_pageseg_mode: "3",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300"
    });
    const result = await worker.recognize(file);
    status.textContent = "Analizando alineaciones y cambios...";
    await worker.setParameters({ tessedit_pageseg_mode: "6" });
    const rosterResult = await worker.recognize(rosterImage);
    const substitutionsResult = await worker.recognize(substitutionsImage);
    const goalsResult = await worker.recognize(goalsImage);
    await worker.terminate();
    const filled = populateActaFromOcr(result.data.text || "", {
      roster: rosterResult.data.text || "",
      substitutions: substitutionsResult.data.text || "",
      goals: goalsResult.data.text || ""
    });
    status.textContent = filled
      ? "Lectura terminada. Revisa los datos antes de confirmar."
      : "No se han identificado jugadores con suficiente seguridad. Completa la tabla manualmente.";
  } catch (error) {
    console.error("Error leyendo el acta", error);
    status.textContent = "No se ha podido leer automáticamente. Completa la tabla manualmente.";
  }
}

function loadActaImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function preprocessActaRegion(image, region) {
  const sourceWidth = Math.round(image.naturalWidth * region.width);
  const sourceHeight = Math.round(image.naturalHeight * region.height);
  const scale = image.naturalWidth < 1800 ? 3 : 2;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth * scale;
  canvas.height = sourceHeight * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    Math.round(image.naturalWidth * region.left),
    Math.round(image.naturalHeight * region.top),
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = Math.round(
      pixels.data[index] * .299 + pixels.data[index + 1] * .587 + pixels.data[index + 2] * .114
    );
    const enhanced = gray < 205 ? Math.max(0, gray * .55) : 255;
    pixels.data[index] = enhanced;
    pixels.data[index + 1] = enhanced;
    pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

function populateActaFromOcr(text, regions = {}) {
  const rosterLines = (regions.roster || text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const substitutionLines = (regions.substitutions || text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const goalLines = (regions.goals || text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const score = text.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
  if (score) document.querySelector("#acta-score").value = `${score[1]}-${score[2]}`;
  const playerRows = [...document.querySelectorAll("#acta-player-rows tr")];
  const players = playerRows.map((row) => {
    const player = state.players.find((item) => item.id === row.dataset.playerId);
    return {
      row,
      player,
      number: Number(player?.number) || 0,
      tokens: normalizeSearchText(player?.name).split(" ").filter((token) => token.length > 2)
    };
  });
  const matchPlayer = (value) => {
    const normalized = normalizeSearchText(value);
    const numberMatch = String(value).match(/^\s*(\d{1,2})(?:\s|[.,:;-])/);
    const byNumber = numberMatch
      ? players.find((entry) => entry.number === Number(numberMatch[1]))
      : null;
    if (byNumber) return byNumber;
    return players
      .map((entry) => ({
        entry,
        hits: entry.tokens.filter((token) => normalized.includes(token)).length,
        longest: Math.max(0, ...entry.tokens.filter((token) => normalized.includes(token)).map((token) => token.length))
      }))
      .filter((candidate) => candidate.hits >= 2 || candidate.longest >= 5)
      .sort((a, b) => b.hits - a.hits || b.longest - a.longest)[0]?.entry;
  };
  const titularesIndex = rosterLines.findIndex((line) => normalizeSearchText(line).includes("titulares"));
  const suplentesIndex = rosterLines.findIndex((line, index) => index > titularesIndex && normalizeSearchText(line).includes("suplentes"));
  const technicalIndex = rosterLines.findIndex((line, index) => index > suplentesIndex && normalizeSearchText(line).includes("cuerpo tecnico"));
  const starterLines = rosterLines.slice(Math.max(0, titularesIndex + 1), suplentesIndex > 0 ? suplentesIndex : rosterLines.length);
  const substituteRosterLines = suplentesIndex >= 0
    ? rosterLines.slice(suplentesIndex + 1, technicalIndex > suplentesIndex ? technicalIndex : rosterLines.length)
    : [];
  let filled = 0;
  starterLines.forEach((line) => {
    const starter = matchPlayer(line);
    if (!starter || starter.row.querySelector("[data-acta-role]").value === "starter") return;
    starter.row.querySelector("[data-acta-role]").value = "starter";
    starter.row.querySelector("[data-acta-entry]").value = 0;
    filled++;
  });
  substituteRosterLines.forEach((line) => {
    const substitute = matchPlayer(line);
    if (substitute && substitute.row.querySelector("[data-acta-role]").value !== "starter") {
      substitute.row.querySelector("[data-acta-role]").value = "none";
    }
  });
  substitutionLines.forEach((line, index) => {
    const minuteMatch = line.match(/\((\d{1,3})\s*['’]?\)/);
    if (!minuteMatch) return;
    const minute = Number(minuteMatch[1]);
    const outgoing = matchPlayer(line);
    const incoming = matchPlayer(substitutionLines[index - 1] || "");
    if (outgoing) outgoing.row.querySelector("[data-acta-exit]").value = minute;
    if (incoming && incoming !== outgoing) {
      incoming.row.querySelector("[data-acta-role]").value = "substitute";
      incoming.row.querySelector("[data-acta-entry]").value = minute;
      filled++;
    }
  });
  goalLines.forEach((line) => {
    if (!/\b\d+\s*-\s*\d+\b/.test(line)) return;
    const scorer = matchPlayer(line.replace(/^.*?\d+\s*-\s*\d+/, ""));
    if (!scorer) return;
    const goalsInput = scorer.row.querySelector("[data-acta-goals]");
    goalsInput.value = Number(goalsInput.value || 0) + 1;
  });
  const cardsStart = substitutionLines.findIndex((line) => normalizeSearchText(line).includes("tarjetas"));
  if (cardsStart >= 0) {
    substitutionLines.slice(cardsStart + 1).forEach((line) => {
      const cardedPlayer = matchPlayer(line);
      if (!cardedPlayer || !/\d{1,3}/.test(line)) return;
      const isRed = normalizeSearchText(line).includes("roja");
      cardedPlayer.row.querySelector(isRed ? "[data-acta-red]" : "[data-acta-yellow]").value = 1;
    });
  }
  return filled;
}

matchReportImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const matchId = document.querySelector("#acta-match-id").value;
  const matchItem = state.matches.find((item) => item.id === matchId);
  if (!matchItem) return;
  const submitButton = matchReportImportForm.querySelector('[type="submit"]');
  const file = actaFileInput.files[0];
  submitButton.disabled = true;
  let actaUploadFailed = false;
  if (file) {
    document.querySelector("#acta-import-status").textContent = "Subiendo el acta...";
    const uploadedActa = await uploadActaFile(file, matchId);
    if (!uploadedActa) {
      actaUploadFailed = true;
    } else {
      matchItem.actaFileUrl = uploadedActa.url;
      matchItem.actaFilePath = uploadedActa.path;
      matchItem.actaFileName = file.name;
      matchItem.actaFileType = file.type;
    }
  }
  const duration = clamp(nonNegativeInteger(document.querySelector("#acta-duration").value), 1, 130);
  const records = {};
  let yellowCards = 0;
  let redCards = 0;
  document.querySelectorAll("#acta-player-rows tr").forEach((row) => {
    const playerId = row.dataset.playerId;
    const role = row.querySelector("[data-acta-role]").value;
    const playerItem = state.players.find((item) => item.id === playerId);
    if (!playerItem) return;
    const entry = role === "starter" ? 0 : clamp(nonNegativeInteger(row.querySelector("[data-acta-entry]").value), 0, duration);
    const exitValue = row.querySelector("[data-acta-exit]").value;
    const exit = role === "none" ? 0 : exitValue === "" ? duration : clamp(nonNegativeInteger(exitValue), entry, duration);
    const goals = role === "none" ? 0 : nonNegativeInteger(row.querySelector("[data-acta-goals]").value);
    const yellows = role === "none" ? 0 : normalizeCardCount(row.querySelector("[data-acta-yellow]").value, 2);
    const reds = role === "none" ? 0 : normalizeCardCount(row.querySelector("[data-acta-red]").value, 1);
    const report = ensurePlayerReport(playerItem, matchId);
    report.minutes = role === "none" ? 0 : Math.max(0, exit - entry);
    report.goals = goals;
    report.yellowCards = yellows;
    report.redCards = reds;
    yellowCards += yellows;
    redCards += reds;
    records[playerId] = { role, entry, exit, goals, yellowCards: yellows, redCards: reds };
  });
  matchItem.actaDuration = duration;
  matchItem.actaPlayers = records;
  const ownSide = ownTeamSide(matchItem);
  matchItem.lineupSheets = normalizeLineupSheets(matchItem.lineupSheets, matchItem);
  matchItem.lineupSheets[ownSide] = Object.entries(records)
    .filter(([, record]) => record.role !== "none")
    .map(([playerId, record]) => ({
      playerId,
      name: state.players.find((playerItem) => playerItem.id === playerId)?.name || "",
      role: record.role === "substitute" ? "substitute" : "starter",
      changeMinute: record.role === "substitute"
        ? record.entry
        : record.exit < duration ? record.exit : ""
    }));
  matchItem.score = document.querySelector("#acta-score").value.trim();
  matchItem.teamStats = { ...normalizeTeamMatchStats(matchItem.teamStats), yellowCards, redCards };
  saveMatchState(matchItem);
  matchReportImportDialog.close();
  submitButton.disabled = false;
  render();
  if (actaUploadFailed) {
    alert("Los datos del acta se han guardado correctamente, pero el archivo no ha podido subirse. Puedes volver a adjuntarlo más adelante sin repetir los datos.");
  }
});

function updateLoginButtons(username = "") {
  const label = canEdit()
    ? username || authSession?.user?.email?.split("@")[0] || "Cerrar sesión"
    : "Login";
  document.querySelectorAll(".login-nav-button").forEach((button) => {
    button.textContent = label;
    button.classList.toggle("authenticated", canEdit());
  });
}

document.querySelectorAll(".season-tab").forEach((button) => {
  button.addEventListener("click", () => switchSeason(button.dataset.season));
});

toolbarTeamSelector.addEventListener("change", (event) => {
  state.activeTeamId = event.target.value;
  state.selectedPlayerId = activePlayers()[0]?.id || "";
  state.selectedMatchId = activeMatches()[0]?.id || "";
  saveState();
  render();
});

staffPhotoFileInput.addEventListener("change", async () => {
  const file = staffPhotoFileInput.files[0];
  if (!file) return updateStaffPhotoPreview(staffPhotoInput.value);
  updateStaffPhotoPreview(await readFileAsDataUrl(file));
});

staffForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const id = document.querySelector("#staff-id").value || crypto.randomUUID();
  const currentMember = state.staff.find((item) => item.id === id);
  const photoFile = staffPhotoFileInput.files[0];
  const uploadedPhoto = photoFile ? await savePlayerPhoto(photoFile, `staff-${id}`) : null;
  const member = {
    id,
    teamId: state.activeTeamId,
    name: document.querySelector("#staff-name").value.trim(),
    role: document.querySelector("#staff-role").value,
    photo: uploadedPhoto?.url || staffPhotoInput.value || currentMember?.photo || "",
    photoPath: uploadedPhoto?.path || currentMember?.photoPath || ""
  };
  if (!member.name) return;
  const index = state.staff.findIndex((item) => item.id === id);
  if (index >= 0) state.staff[index] = member;
  else state.staff.push(member);
  if (!saveState()) return;
  staffDialog.close();
  render();
});

deleteStaffButton.addEventListener("click", () => {
  const id = document.querySelector("#staff-id").value;
  if (!id) return;
  const member = state.staff.find((item) => item.id === id);
  if (!member || !confirm(`¿Eliminar a ${member.name} del staff?`)) return;
  state.staff = state.staff.filter((item) => item.id !== id);
  saveState();
  staffDialog.close();
  render();
});

addMatchVideoButton.addEventListener("click", () => {
  matchVideoForm.reset();
  matchVideoDialog.showModal();
});

matchVideoForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const title = document.querySelector("#match-video-title").value.trim();
  const url = safeExternalUrl(document.querySelector("#match-video-link").value);
  if (!title || !url) return;
  state.matchVideos.push({ id: crypto.randomUUID(), teamId: state.activeTeamId, title, url });
  saveState();
  matchVideoDialog.close();
  render();
});

teamForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const teamId = document.querySelector("#team-id").value;
  const name = document.querySelector("#team-name").value.trim();
  if (!name) return;
  if (teamId) {
    renameTeam(teamId, name);
  } else {
    const id = uniqueTeamId(name);
    state.teams.push({ id, name });
    state.activeTeamId = id;
    state.selectedPlayerId = "";
    state.selectedMatchId = "";
  }
  saveState();
  teamDialog.close();
  render();
});

deleteTeamButton.addEventListener("click", () => {
  const teamId = document.querySelector("#team-id").value;
  if (teamId) deleteTeam(teamId);
});

contextActionButton.addEventListener("click", () => {
  if (state.activeView === "matches") openMatchDialog();
  else openPlayerDialog();
});

playerPhotoFileInput.addEventListener("change", async () => {
  const file = playerPhotoFileInput.files[0];
  if (!file) return updatePhotoPreview(playerPhotoInput.value);
  updatePhotoPreview(await readFileAsDataUrl(file));
});

playerForm.addEventListener("input", autosaveExistingPlayerEdits);
playerForm.addEventListener("change", autosaveExistingPlayerEdits);

function autosaveExistingPlayerEdits() {
  const id = document.querySelector("#player-id").value;
  if (!id) return;
  const item = state.players.find((playerItem) => playerItem.id === id);
  if (!item) return;

  const name = document.querySelector("#player-name").value.trim();
  const number = Number(document.querySelector("#player-number").value);
  item.name = name || item.name;
  if (number >= 1 && number <= 99) item.number = number;
  item.birthdate = document.querySelector("#player-birthdate").value;
  item.position = document.querySelector("#player-position").value;
  item.laterality = document.querySelector("#player-laterality").value;

  if (saveState()) {
    playerFormSaveStatus.textContent = "Cambios guardados automáticamente";
    playerFormSaveStatus.classList.add("saved");
  } else {
    playerFormSaveStatus.textContent = "No se han podido guardar los cambios";
    playerFormSaveStatus.classList.remove("saved");
  }
}

deletePlayerModalButton.addEventListener("click", () => {
  const id = document.querySelector("#player-id").value;
  if (!id) return;
  deletePlayer(id);
  playerDialog.close();
});

playerForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const photoFile = playerPhotoFileInput.files[0];
  const playerId = document.querySelector("#player-id").value || crypto.randomUUID();
  const currentPlayer = state.players.find((item) => item.id === playerId);
  const uploadedPhoto = photoFile ? await savePlayerPhoto(photoFile, playerId) : null;
  const formPlayer = {
    id: playerId,
    teamId: state.activeTeamId,
    name: document.querySelector("#player-name").value.trim(),
    number: Number(document.querySelector("#player-number").value),
    birthdate: document.querySelector("#player-birthdate").value,
    position: document.querySelector("#player-position").value,
    laterality: document.querySelector("#player-laterality").value,
    photo: uploadedPhoto?.url || playerPhotoInput.value,
    photoPath: uploadedPhoto?.path || currentPlayer?.photoPath || "",
    description: currentPlayer?.description || "",
    career: currentPlayer?.career || "",
    ratings: normalizePlayerRatings(currentPlayer?.ratings),
    reports: normalizePlayerReports(currentPlayer?.reports)
  };

  const index = state.players.findIndex((item) => item.id === formPlayer.id);
  if (index >= 0) state.players[index] = formPlayer;
  else state.players.push(formPlayer);
  if (!saveState()) return;
  playerDialog.close();
  render();
});

matchForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const id = document.querySelector("#match-id").value || crypto.randomUUID();
  const existing = state.matches.find((item) => item.id === id);
  const competition = document.querySelector("#match-competition").value;
  const formMatch = {
    id,
    updatedAt: Date.now(),
    teamId: state.activeTeamId,
    competition,
    round: competition === "friendly" ? 0 : Number(document.querySelector("#match-round").value),
    date: document.querySelector("#match-date").value,
    time: document.querySelector("#match-time").value,
    home: document.querySelector("#match-home").value.trim(),
    away: document.querySelector("#match-away").value.trim(),
    status: document.querySelector("#match-status").value,
    score: document.querySelector("#match-score").value.trim(),
    teamStats: {
      yellowCards: nonNegativeInteger(document.querySelector("#match-yellow-cards").value),
      redCards: nonNegativeInteger(document.querySelector("#match-red-cards").value),
      penaltiesFor: nonNegativeInteger(document.querySelector("#match-penalties-for").value),
      penaltiesAgainst: nonNegativeInteger(document.querySelector("#match-penalties-against").value),
      chancesCreated: nonNegativeInteger(document.querySelector("#match-chances-created").value),
      chancesAgainst: nonNegativeInteger(document.querySelector("#match-chances-against").value)
    },
    notes: existing?.notes || "",
    videoUrl: existing?.videoUrl || "",
    actaDuration: resolveActaDuration(existing?.actaDuration, existing?.teamId || state.activeTeamId, existing?.actaPlayers),
    actaPlayers: existing?.actaPlayers || {},
    actaFileUrl: existing?.actaFileUrl || "",
    actaFilePath: existing?.actaFilePath || "",
    actaFileName: existing?.actaFileName || "",
    actaFileType: existing?.actaFileType || "",
    lineupSheets: existing?.lineupSheets || null,
    lineup: existing?.lineup || {},
    formation: existing?.formation || DEFAULT_FORMATION,
    plan: existing?.plan || emptyPlan()
  };

  const index = state.matches.findIndex((item) => item.id === id);
  if (index >= 0) state.matches[index] = formMatch;
  else state.matches.push(formMatch);
  if (returnToPlayerReportsAfterMatchSave) {
    const selectedPlayer = state.players.find((item) => item.id === state.selectedPlayerId);
    if (selectedPlayer) {
      formMatch.teamId = selectedPlayer.teamId || state.activeTeamId;
      ensurePlayerReport(selectedPlayer, id);
    }
  }
  state.selectedMatchId = id;
  state.activeDetailTab = "plan";
  saveState();
  matchDialog.close();
  if (returnToPlayerReportsAfterMatchSave) {
    returnToPlayerReportsAfterMatchSave = false;
    state.activeView = "playerDetail";
    state.activePlayerTab = "reports";
    saveState();
    render();
  } else {
    setView("detail");
  }
});

document.querySelector("#match-competition").addEventListener("change", updateMatchRoundVisibility);

function updateMatchRoundVisibility() {
  const competition = document.querySelector("#match-competition").value;
  const roundField = document.querySelector("#match-round-field");
  const roundInput = document.querySelector("#match-round");
  const needsRound = competition !== "friendly";
  roundField.hidden = !needsRound;
  roundInput.required = needsRound;
  if (!needsRound) roundInput.value = "";
}

matchDialog.addEventListener("close", () => {
  if (matchDialog.returnValue === "cancel") {
    returnToPlayerReportsAfterMatchSave = false;
  }
});

render();
if (!isLandingPage) {
  initializeSupabase();
}

function player(id, name, number, birthdate, position, laterality = "Diestro", teamId = DEFAULT_TEAM_ID) {
  return {
    id,
    teamId,
    name,
    number,
    birthdate,
    position,
    laterality,
    photo: "",
    photoPath: "",
    description: "",
    career: "",
    ratings: defaultPlayerRatings(),
    reports: {}
  };
}

function match(id, round, home, away, date, status, score, teamId = DEFAULT_TEAM_ID) {
  return {
    id,
    updatedAt: 0,
    teamId,
    round,
    home,
    away,
    date,
    status,
    score,
    teamStats: emptyTeamMatchStats(),
    notes: "",
    lineupSheets: null,
    lineup: defaultLineup(),
    formation: DEFAULT_FORMATION,
    plan: emptyPlan()
  };
}

function defaultLineup() {
  return {
    p1: { x: 50, y: 90 },
    p5: { x: 14, y: 72 },
    p4: { x: 38, y: 72 },
    p2: { x: 62, y: 72 },
    p15: { x: 86, y: 72 },
    p9: { x: 14, y: 49 },
    p7: { x: 38, y: 49 },
    p8: { x: 62, y: 49 },
    p12: { x: 86, y: 49 },
    p11: { x: 22, y: 24 },
    p10: { x: 78, y: 24 }
  };
}

function emptyPlan() {
  return Object.fromEntries(
    PLAN_SECTIONS.flatMap(([type]) => [
      [`${type}Text`, ""],
      [`${type}Videos`, []]
    ])
  );
}

function normalizePlan(value) {
  const plan = emptyPlan();
  PLAN_SECTIONS.forEach(([type]) => {
    plan[`${type}Text`] = value?.[`${type}Text`] || "";
    plan[`${type}Videos`] = Array.isArray(value?.[`${type}Videos`])
      ? value[`${type}Videos`].filter((video) => video && !video.__expandedPlan)
      : [];
  });
  return plan;
}

function mergeDefaultVisibleTeams(teams, currentVersion = 0) {
  const visibleTeams = (teams?.length ? teams : structuredClone(DEFAULT_VISIBLE_TEAMS)).filter(
    (item) => !REMOVED_TEAM_IDS.has(item.id)
  );
  if (Number(currentVersion) >= DEFAULT_TEAMS_VERSION) return visibleTeams;

  const knownIds = new Set(visibleTeams.map((item) => item.id));
  DEFAULT_VISIBLE_TEAMS.forEach((item) => {
    if (!knownIds.has(item.id) && !REMOVED_TEAM_IDS.has(item.id)) {
      visibleTeams.push(structuredClone(item));
      knownIds.add(item.id);
    }
  });
  return visibleTeams;
}

function emptySeasonState() {
  return {
    ...structuredClone(initialState),
    lastModifiedAt: 0,
    teams: structuredClone(DEFAULT_VISIBLE_TEAMS),
    activeTeamId: DEFAULT_VISIBLE_TEAM.id,
    players: [],
    matches: [],
    staff: [],
    matchVideos: [],
    selectedMatchId: "",
    selectedPlayerId: "",
    activeView: "squad"
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SEASON_STORAGE_KEYS[activeSeason]));
    if (!saved) return activeSeason === NEW_SEASON ? emptySeasonState() : structuredClone(initialState);
    const activeView = ["lineups", "gameplan"].includes(saved.activeView) ? "matches" : saved.activeView;
    const teams = mergeDefaultVisibleTeams(saved.teams, saved.defaultTeamsVersion);
    const activeTeamId = teams.some((item) => item.id === saved.activeTeamId) ? saved.activeTeamId : teams[0].id;
    return {
      ...structuredClone(initialState),
      ...saved,
      lastModifiedAt: Number(saved.lastModifiedAt) || 1,
      defaultTeamsVersion: DEFAULT_TEAMS_VERSION,
      activeView,
      teams,
      activeTeamId,
      staff: Array.isArray(saved.staff)
        ? saved.staff.filter((item) => item?.id && item?.name).map((item) => ({
            id: String(item.id),
            teamId: item.teamId || activeTeamId,
            name: String(item.name),
            role: String(item.role || "Otro"),
            photo: item.photo || "",
            photoPath: item.photoPath || ""
          }))
        : [],
      matchVideos: Array.isArray(saved.matchVideos)
        ? saved.matchVideos.filter((item) => item?.id && item?.title && safeExternalUrl(item.url)).map((item) => ({
            id: String(item.id),
            teamId: item.teamId || activeTeamId,
            title: String(item.title),
            url: safeExternalUrl(item.url)
          }))
        : [],
      players: saved.players?.map((item) => ({
        ...item,
        teamId: item.teamId || DEFAULT_TEAM_ID,
        laterality: item.laterality || "Diestro",
        photoPath: item.photoPath || item.photo_path || "",
        description: item.description || "",
        career: item.career || "",
        ratings: normalizePlayerRatings(item.ratings),
        reports: normalizePlayerReports(item.reports)
      })) || structuredClone(initialState.players),
      matches:
        saved.matches
          ?.filter((item) => !REMOVED_MATCH_IDS.has(item.id))
          .map((item) => ({
            ...item,
            updatedAt: Number(item.updatedAt) || 0,
            teamId: item.teamId || DEFAULT_TEAM_ID,
            competition: item.competition || "league",
            time: item.time || "",
            actaDuration: resolveActaDuration(item.actaDuration, item.teamId || DEFAULT_TEAM_ID, item.actaPlayers),
            actaPlayers: item.actaPlayers || {},
            actaFileUrl: item.actaFileUrl || "",
            actaFilePath: item.actaFilePath || "",
            actaFileName: item.actaFileName || "",
            actaFileType: item.actaFileType || "",
            teamStats: normalizeTeamMatchStats(item.teamStats),
            notes: item.notes || "",
            videoUrl: item.videoUrl || "",
            lineupSheets: normalizeLineupSheets(item.lineupSheets, item),
            lineup: item.lineup || {},
            formation: item.formation || DEFAULT_FORMATION,
            plan: normalizePlan(item.plan)
          })) || structuredClone(initialState.matches)
    };
  } catch {
    return structuredClone(initialState);
  }
}

function recoverCadeteSeasonFromLocalBackups() {
  if (activeSeason !== LEGACY_SEASON) return 0;
  const isTargetMatch = (item) => {
    const round = Number(item?.round);
    const identity = normalizeSearchText(`${item?.teamId || ""} ${item?.teamName || ""} ${item?.home || ""} ${item?.away || ""}`);
    return round >= 1 && round <= 14 && identity.includes("cadete") && identity.includes("preferente");
  };
  const candidates = [];
  const playerCandidates = [];
  try {
    const automatic = JSON.parse(localStorage.getItem(SEASON_BACKUP_KEYS[LEGACY_SEASON]));
    if (Array.isArray(automatic?.matches)) candidates.push(...automatic.matches);
    if (Array.isArray(automatic?.players)) playerCandidates.push(...automatic.players);
  } catch (error) {
    console.warn("No se pudo leer la copia automática", error);
  }
  try {
    const beforePull = JSON.parse(localStorage.getItem(STORAGE_BACKUP_KEY));
    if (Array.isArray(beforePull?.state?.matches)) candidates.push(...beforePull.state.matches);
    if (Array.isArray(beforePull?.state?.players)) playerCandidates.push(...beforePull.state.players);
  } catch (error) {
    console.warn("No se pudo leer la copia anterior a la sincronización", error);
  }
  const existingIds = new Set(state.matches.map((item) => item.id));
  const existingRounds = new Set(state.matches.filter(isTargetMatch).map((item) => Number(item.round)));
  const recovered = [];
  let recoveredActas = 0;
  const actaWeight = (item) =>
    Object.values(item?.actaPlayers || {}).filter((record) => record?.role && record.role !== "none").length * 10 +
    (item?.actaFileUrl || item?.actaFileName ? 5 : 0) +
    Object.keys(item?.lineup || {}).filter((id) => !id.startsWith("__")).length;
  candidates.forEach((item) => {
    if (!isTargetMatch(item)) return;
    const current = state.matches.find((matchItem) => matchItem.id === item.id) ||
      state.matches.find((matchItem) => isTargetMatch(matchItem) && Number(matchItem.round) === Number(item.round));
    if (current) {
      if (actaWeight(item) <= actaWeight(current)) return;
      ["actaDuration", "actaPlayers", "actaFileUrl", "actaFilePath", "actaFileName", "actaFileType", "lineupSheets", "lineup", "teamStats"].forEach((key) => {
        if (item[key] != null) current[key] = structuredClone(item[key]);
      });
      current.updatedAt = Math.max(Number(current.updatedAt) || 0, Number(item.updatedAt) || 0, Date.now());
      recoveredActas++;
      return;
    }
    if (!existingIds.has(item.id) && !existingRounds.has(Number(item.round))) {
      recovered.push(item);
      existingIds.add(item.id);
      existingRounds.add(Number(item.round));
    }
  });
  state.matches.push(...recovered);
  const targetMatchIds = new Set(candidates.filter(isTargetMatch).map((item) => item.id));
  let recoveredReports = 0;
  state.players.forEach((playerItem) => {
    const versions = playerCandidates.filter((candidate) => candidate.id === playerItem.id);
    versions.forEach((candidate) => {
      Object.entries(candidate.reports || {}).forEach(([matchId, report]) => {
        if (!targetMatchIds.has(matchId) || !playerReportHasData(normalizePlayerReports({ [matchId]: report })[matchId])) return;
        const current = normalizePlayerReports({ [matchId]: playerItem.reports?.[matchId] })[matchId];
        if (playerItem.reports?.[matchId] && playerReportHasData(current)) return;
        playerItem.reports ||= {};
        playerItem.reports[matchId] = report;
        recoveredReports++;
      });
    });
  });
  if (!recovered.length && !recoveredActas && !recoveredReports) return 0;
  state.lastModifiedAt = Date.now();
  localStorage.setItem(SEASON_STORAGE_KEYS[LEGACY_SEASON], JSON.stringify(state));
  return recovered.length + recoveredActas + recoveredReports;
}

function saveState() {
  state.lastModifiedAt = Date.now();
  const storageKey = SEASON_STORAGE_KEYS[activeSeason];
  try {
    localStorage.setItem(SEASON_BACKUP_KEYS[activeSeason], JSON.stringify(recoverySnapshot()));
  } catch (error) {
    console.warn("No se pudo actualizar la copia de recuperación", error);
  }
  const serializedState = JSON.stringify(state);
  try {
    localStorage.setItem(storageKey, serializedState);
  } catch (error) {
    console.error("No se pudo guardar el estado", error);
    try {
      localStorage.removeItem(SEASON_BACKUP_KEYS[activeSeason]);
      localStorage.setItem(storageKey, serializedState);
    } catch (retryError) {
      console.error("El guardado sigue sin espacio", retryError);
      alert("No se ha podido guardar. El almacenamiento del navegador está lleno. El formulario seguirá abierto para que no parezca guardado cuando no lo está.");
      return false;
    }
  }
  queueRemoteSave();
  return true;
}

function recoverySnapshot() {
  return {
    createdAt: Date.now(),
    season: activeSeason,
    teams: structuredClone(state.teams || []),
    players: (state.players || []).map((item) => ({ ...item, photo: "", photoPath: "" })),
    staff: (state.staff || []).map((item) => ({ ...item, photo: "", photoPath: "" })),
    matches: structuredClone(state.matches || []),
    matchVideos: structuredClone(state.matchVideos || [])
  };
}

function switchSeason(season) {
  if (!SEASON_STORAGE_KEYS[season] || season === activeSeason) return;
  clearTimeout(remoteSaveTimer);
  localStorage.setItem(ACTIVE_SEASON_KEY, season);
  const destination = new URL(window.location.href);
  destination.searchParams.set("temporada", season);
  window.location.assign(destination.href);
}

function backupLocalState(reason) {
  try {
    localStorage.setItem(
      STORAGE_BACKUP_KEY,
      JSON.stringify({
        reason,
        createdAt: Date.now(),
        state
      })
    );
  } catch (error) {
    console.error(error);
  }
}

function markMatchUpdated(item) {
  item.updatedAt = Date.now();
}

function saveMatchState(item) {
  markMatchUpdated(item);
  saveState();
}

function getSupabaseAnonKey() {
  return SUPABASE_ANON_KEY;
}

function hasSupabaseConfig() {
  return Boolean(getSupabaseAnonKey());
}

function queueRemoteSave() {
  if (!hasSupabaseConfig()) { console.warn("[Sync] Sin config Supabase"); return; }
  if (!canEdit()) { console.warn("[Sync] Push omitido: NO ESTÁS LOGUEADO"); return; }
  if (isPullingRemote) { console.warn("[Sync] Push omitido: pull en curso"); return; }
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(() => {
    pushRemoteState();
  }, 500);
}

async function initializeSupabase() {
  if (!hasSupabaseConfig()) return;
  await pullRemoteState();
  if (recoveredCadeteMatchCount && canEdit()) await pushRemoteState();
}

async function pullRemoteState() {
  if (!hasSupabaseConfig()) return;
  if (activeSeason === NEW_SEASON) return pullNewSeasonRemoteState();
  const seasonAtStart = activeSeason;
  try {
    isPullingRemote = true;
    backupLocalState("before-remote-pull");
    const results = await Promise.allSettled([
      supabaseRequest("players?select=*&order=number.asc"),
      supabaseRequest("matches?select=*&order=round.asc"),
      supabaseRequest("lineups?select=*"),
      supabaseRequest("game_plans?select=*")
    ]);
    const players = settledValue(results[0], []);
    const matches = settledValue(results[1], []);
    const lineups = settledValue(results[2], []);
    const plans = settledValue(results[3], []);
    if (activeSeason !== seasonAtStart) return;
    const requiredFailure = results.slice(0, 3).find((result) => result.status === "rejected");
    if (requiredFailure) throw requiredFailure.reason;
    supportsRemotePlayerProfiles = players.some((item) => Object.hasOwn(item, "profile_data"));

    const remoteAppState = parseRemoteAppState(
      lineups.find((item) => item.match_id === APP_STATE_MATCH_ID)?.lineup
    );
    const remoteUpdatedAt = Number(remoteAppState?.updatedAt) || 0;
    const preferLocal = Number(state.lastModifiedAt) > remoteUpdatedAt;
    const visibleMatches = matches.filter(
      (item) => item.id !== APP_STATE_MATCH_ID && !REMOVED_MATCH_IDS.has(item.id)
    );
    const visibleLineups = lineups.filter((item) => item.match_id !== APP_STATE_MATCH_ID);
    const lineupByMatch = Object.fromEntries(
      visibleLineups.map((item) => [item.match_id, parseRemoteLineup(item.lineup)])
    );
    const planByMatch = {};
    plans.forEach((item) => {
      planByMatch[item.match_id] = parseRemotePlan(item);
    });

    const hasRemotePlayers = players.length > 0;
    const hasRemoteMatches = visibleMatches.length > 0;
    if (hasRemotePlayers) {
      const localPlayers = new Map(state.players.map((item) => [item.id, item]));
      const remotePlayerIds = new Set(players.map((item) => item.id));
      state.players = [
        ...players.map((item) => fromRemotePlayer(item, localPlayers.get(item.id))),
        ...state.players.filter((item) => !remotePlayerIds.has(item.id))
      ];
    }
    if (hasRemoteMatches) {
      const localMatches = new Map(state.matches.map((item) => [item.id, item]));
      const remoteMatchIds = new Set(visibleMatches.map((item) => item.id));
      state.matches = [
        ...visibleMatches.map((item) => {
          const remoteMatch = fromRemoteMatch(item, lineupByMatch[item.id], planByMatch[item.id]);
          const localMatch = localMatches.get(item.id);
          return shouldKeepLocalMatch(localMatch, remoteMatch, preferLocal) ? localMatch : remoteMatch;
        }),
        ...state.matches.filter(
          (item) => !remoteMatchIds.has(item.id) && !REMOVED_MATCH_IDS.has(item.id)
        )
      ];
    } else if (!state.matches.length) {
      state.matches = structuredClone(initialState.matches);
    }
    if (remoteAppState) {
      applyRemoteAppState(remoteAppState, preferLocal);
      state.lastModifiedAt = Math.max(Number(state.lastModifiedAt) || 0, remoteUpdatedAt);
    }
    syncTeamsFromData();
    state.selectedMatchId = selectedMatch()?.id || "";
    localStorage.setItem(SEASON_STORAGE_KEYS[activeSeason], JSON.stringify(state));
    render();
  } catch (error) {
    console.error(error);
  } finally {
    isPullingRemote = false;
  }
}

function settledValue(result, fallback) {
  if (result.status === "fulfilled") return result.value || fallback;
  console.error(result.reason);
  return fallback;
}

function shouldKeepLocalMatch(localMatch, remoteMatch, preferLocal) {
  if (!localMatch) return false;
  if (preferLocal) return true;
  const localUpdatedAt = Number(localMatch.updatedAt) || 0;
  const remoteUpdatedAt = Number(remoteMatch.updatedAt) || 0;
  return Boolean(localUpdatedAt && remoteUpdatedAt && localUpdatedAt > remoteUpdatedAt);
}

async function pushRemoteState(throwOnError = false) {
  if (!hasSupabaseConfig() || !canEdit()) return;
  if (activeSeason === NEW_SEASON) return pushNewSeasonRemoteState(throwOnError);
  try {
    state.matches = state.matches.filter((item) => !REMOVED_MATCH_IDS.has(item.id));
    await supabaseUpsert("players", state.players.map(toRemotePlayer), "id");
    await supabaseUpsert("matches", [...state.matches.map(toRemoteMatch), toRemoteAppStateMatch()], "id");
    await supabaseUpsert("lineups", [...state.matches.map(toRemoteLineup), toRemoteAppStateLineup()], "match_id");
    await supabaseUpsert("game_plans", state.matches.map(toRemotePlan), "match_id");
  } catch (error) {
    console.error(error);
    if (throwOnError) throw error;
  }
}

async function pullNewSeasonRemoteState() {
  try {
    isPullingRemote = true;
    const rows = await supabaseRequest(
      `lineups?match_id=eq.${encodeURIComponent(NEW_SEASON_APP_STATE_MATCH_ID)}&select=*`
    );
    const remoteState = rows?.[0]?.lineup?.__seasonState;
    if (!remoteState) {
      isPullingRemote = false;
      await pushNewSeasonRemoteState();
      return;
    }

    const remoteModifiedAt = Number(remoteState.lastModifiedAt) || 0;
    const localModifiedAt = Number(state.lastModifiedAt) || 0;
    if (remoteModifiedAt > localModifiedAt) {
      localStorage.setItem(SEASON_STORAGE_KEYS[NEW_SEASON], JSON.stringify(remoteState));
      state = loadState();
      repairMissingTeams();
      render();
    } else if (localModifiedAt > remoteModifiedAt) {
      isPullingRemote = false;
      await pushNewSeasonRemoteState();
      return;
    }
  } catch (error) {
    console.error("No se pudo sincronizar la temporada 2026-2027", error);
  } finally {
    isPullingRemote = false;
  }
}

function setSyncStatus(status, msg) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  el.className = "sync-status " + status;
  el.textContent = msg;
  if (status === "ok") setTimeout(() => { el.className = "sync-status"; el.textContent = ""; }, 4000);
  if (status === "error") el.onclick = () => alert("Error de sincronización:\n" + msg);
}

async function pushNewSeasonRemoteState(throwOnError = false) {
  if (!hasSupabaseConfig() || !canEdit()) { console.warn("[Sync] pushNewSeasonRemoteState omitido: no config o no autenticado"); return; }
  try {
    setSyncStatus("syncing", "Guardando...");
    console.log("[Sync] Guardando estado en Supabase...");
    await supabaseUpsert(
      "matches",
      [{
        id: NEW_SEASON_APP_STATE_MATCH_ID,
        round: 0,
        home: "Estado temporada 2026-2027",
        away: "Estado temporada 2026-2027",
        date: null,
        status: "Sistema",
        score: "",
        updated_at: new Date().toISOString()
      }],
      "id"
    );
    await supabaseUpsert(
      "lineups",
      [{
        match_id: NEW_SEASON_APP_STATE_MATCH_ID,
        lineup: { __seasonState: state },
        updated_at: new Date().toISOString()
      }],
      "match_id"
    );
    setSyncStatus("ok", "✓ Guardado");
    console.log("[Sync] Estado guardado en Supabase ✓");
  } catch (error) {
    setSyncStatus("error", String(error));
    console.error("[Sync] ERROR al guardar en Supabase:", error);
    if (throwOnError) throw error;
  }
}

async function supabaseRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const authorizationToken = method === "GET"
    ? getSupabaseAnonKey()
    : await getValidAccessToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${authorizationToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function supabaseUpsert(table, rows, conflictColumn) {
  if (!rows.length) return;
  await supabaseRequest(`${table}?on_conflict=${conflictColumn}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
}

async function supabaseDelete(table, column, value) {
  if (!hasSupabaseConfig() || !canEdit()) return;
  try {
    await supabaseRequest(`${table}?${column}=eq.${encodeURIComponent(value)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  } catch (error) {
    console.error(error);
  }
}

async function supabaseDeletePlayerPhoto(path) {
  if (!hasSupabaseConfig() || !canEdit() || !path) return;
  try {
    await supabaseStorageRequest(`object/${PLAYER_PHOTOS_BUCKET}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] })
    });
  } catch (error) {
    console.error(error);
  }
}

async function supabaseStorageRequest(path, options = {}) {
  const accessToken = await getValidAccessToken();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? JSON.parse(text) : text;
}

async function savePlayerPhoto(file, playerId) {
  if (!hasSupabaseConfig()) {
    return { url: await readFileAsDataUrl(file), path: "" };
  }

  try {
    const path = `${playerId}/${Date.now()}-${safeFileName(file.name)}`;
    await supabaseStorageRequest(`object/${PLAYER_PHOTOS_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });
    return {
      path,
      url: `${SUPABASE_URL}/storage/v1/object/public/${PLAYER_PHOTOS_BUCKET}/${encodeStoragePath(path)}`
    };
  } catch (error) {
    console.error(error);
    alert("No se pudo subir la foto. El jugador se guardará sin la nueva imagen.");
    return null;
  }
}

async function uploadActaFile(file, matchId) {
  if (!hasSupabaseConfig() || !canEdit()) return null;
  try {
    const path = `actas/${matchId}/${Date.now()}-${safeFileName(file.name)}`;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${PLAYER_PHOTOS_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: getSupabaseAnonKey(),
        Authorization: `Bearer ${getSupabaseAnonKey()}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      },
      body: file
    });
    if (!response.ok) throw new Error(await response.text());
    return {
      path,
      url: `${SUPABASE_URL}/storage/v1/object/public/${PLAYER_PHOTOS_BUCKET}/${encodeStoragePath(path)}`
    };
  } catch (error) {
    console.error("No se pudo subir el acta", error);
    return null;
  }
}

function toRemotePlayer(item) {
  return {
    id: item.id,
    name: item.name,
    number: item.number,
    birthdate: item.birthdate,
    position: item.position,
    laterality: item.laterality || "Diestro",
    photo: item.photo || "",
    photo_path: item.photoPath || "",
    ...(supportsRemotePlayerProfiles
      ? {
          profile_data: {
            teamId: item.teamId || DEFAULT_TEAM_ID,
            teamName: teamName(item.teamId),
            description: item.description || "",
            career: item.career || "",
            ratings: normalizePlayerRatings(item.ratings),
            reports: item.reports || {}
          }
        }
      : {}),
    updated_at: new Date().toISOString()
  };
}

function fromRemotePlayer(item, localItem = {}) {
  const remoteProfile = item.profile_data || {};
  return {
    id: item.id,
    teamId: remoteProfile.teamId || localItem.teamId || DEFAULT_TEAM_ID,
    teamName: remoteProfile.teamName || localItem.teamName || "",
    name: item.name,
    number: item.number,
    birthdate: item.birthdate,
    position: item.position,
    laterality: item.laterality || "Diestro",
    photo: item.photo || localItem.photo || "",
    photoPath: item.photo_path || localItem.photoPath || "",
    description: remoteProfile.description || localItem.description || "",
    career: remoteProfile.career || localItem.career || "",
    ratings: normalizePlayerRatings(remoteProfile.ratings || localItem.ratings),
    reports: normalizePlayerReports({ ...(localItem.reports || {}), ...(remoteProfile.reports || {}) })
  };
}

function playerProfileSnapshot(item) {
  return {
    teamId: item.teamId || DEFAULT_TEAM_ID,
    teamName: teamName(item.teamId),
    description: item.description || "",
    career: item.career || "",
    ratings: normalizePlayerRatings(item.ratings),
    reports: normalizePlayerReports(item.reports)
  };
}

function toRemoteAppStateMatch() {
  return {
    id: APP_STATE_MATCH_ID,
    round: 0,
    home: "Estado de la aplicación",
    away: "Estado de la aplicación",
    date: null,
    status: "Sistema",
    score: "",
    updated_at: new Date().toISOString()
  };
}

function toRemoteAppStateLineup() {
  return {
    match_id: APP_STATE_MATCH_ID,
    lineup: {
      __appState: {
        version: 1,
        updatedAt: Number(state.lastModifiedAt) || Date.now(),
        defaultTeamsVersion: Number(state.defaultTeamsVersion) || DEFAULT_TEAMS_VERSION,
        teams: state.teams,
        staff: state.staff,
        matchVideos: state.matchVideos,
        activeTeamId: state.activeTeamId,
        playerProfiles: Object.fromEntries(
          state.players.map((item) => [item.id, playerProfileSnapshot(item)])
        )
      }
    },
    updated_at: new Date().toISOString()
  };
}

function parseRemoteAppState(value) {
  const appState = value?.__appState;
  return appState && typeof appState === "object" ? appState : null;
}

function applyRemoteAppState(remoteAppState, preferLocal) {
  if (Array.isArray(remoteAppState.teams) && remoteAppState.teams.length) {
    const remoteTeams = remoteAppState.teams
      .filter((item) => item?.id && item?.name)
      .filter((item) => !REMOVED_TEAM_IDS.has(String(item.id)))
      .map((item) => ({ id: String(item.id), name: String(item.name) }));
    const teamsById = new Map(
      (preferLocal ? [...remoteTeams, ...state.teams] : [...state.teams, ...remoteTeams]).map((item) => [
        item.id,
        item
      ])
    );
    const defaultTeamsVersion = Math.max(
      Number(state.defaultTeamsVersion) || 0,
      Number(remoteAppState.defaultTeamsVersion) || 0
    );
    state.teams = mergeDefaultVisibleTeams([...teamsById.values()], defaultTeamsVersion);
    state.defaultTeamsVersion = DEFAULT_TEAMS_VERSION;
  }
  if (!preferLocal && state.teams.some((item) => item.id === remoteAppState.activeTeamId)) {
    state.activeTeamId = remoteAppState.activeTeamId;
  }
  if (!preferLocal && Array.isArray(remoteAppState.staff)) {
    state.staff = remoteAppState.staff.filter((item) => item?.id && item?.name);
  }
  if (!preferLocal && Array.isArray(remoteAppState.matchVideos)) {
    state.matchVideos = remoteAppState.matchVideos.filter((item) => item?.id && item?.title && safeExternalUrl(item.url));
  }
  const profiles = remoteAppState.playerProfiles || {};
  state.players = state.players.map((item) => {
    const profile = profiles[item.id];
    if (!profile) return item;
    const reports = preferLocal
      ? { ...(profile.reports || {}), ...(item.reports || {}) }
      : { ...(item.reports || {}), ...(profile.reports || {}) };
    const primary = preferLocal ? item : profile;
    const secondary = preferLocal ? profile : item;
    return {
      ...item,
      teamId: primary.teamId || secondary.teamId || DEFAULT_TEAM_ID,
      teamName: primary.teamName || secondary.teamName || "",
      description: primary.description || secondary.description || "",
      career: primary.career || secondary.career || "",
      ratings: normalizePlayerRatings(primary.ratings || secondary.ratings),
      reports: normalizePlayerReports(reports)
    };
  });
}

function toRemoteMatch(item) {
  return {
    id: item.id,
    round: item.round,
    home: item.home,
    away: item.away,
    date: item.date || null,
    status: item.status,
    score: item.score || "",
    updated_at: new Date().toISOString()
  };
}

function fromRemoteMatch(item, lineupData, plan) {
  return {
    id: item.id,
    updatedAt: Math.max(
      Date.parse(item.updated_at) || 0,
      Number(lineupData?.updatedAt) || 0,
      Date.parse(plan?.updated_at) || 0
    ),
    teamId: lineupData?.teamId || DEFAULT_TEAM_ID,
    teamName: lineupData?.teamName || "",
    round: item.round,
    home: item.home,
    away: item.away,
    date: item.date || "",
    time: lineupData?.time || "",
    actaDuration: resolveActaDuration(lineupData?.actaDuration, lineupData?.teamId || DEFAULT_TEAM_ID, lineupData?.actaPlayers),
    actaPlayers: lineupData?.actaPlayers || {},
    actaFileUrl: lineupData?.actaFileUrl || "",
    actaFilePath: lineupData?.actaFilePath || "",
    actaFileName: lineupData?.actaFileName || "",
    actaFileType: lineupData?.actaFileType || "",
    status: item.status,
    score: item.score || "",
    teamStats: normalizeTeamMatchStats(lineupData?.teamStats),
    notes: lineupData?.notes || "",
    videoUrl: lineupData?.videoUrl || "",
    lineupSheets: normalizeLineupSheets(lineupData?.lineupSheets, {
      ...item,
      teamId: lineupData?.teamId || DEFAULT_TEAM_ID,
      lineup: lineupData?.lineup || {}
    }),
    lineup: lineupData?.lineup || {},
    formation: lineupData?.formation || DEFAULT_FORMATION,
    plan: normalizePlan(plan)
  };
}

function toRemoteLineup(item) {
  return {
    match_id: item.id,
    lineup: {
      ...(item.lineup || {}),
      [FORMATION_STORAGE_KEY]: item.formation || DEFAULT_FORMATION,
      __teamId: item.teamId || DEFAULT_TEAM_ID,
      __teamName: teamName(item.teamId),
      __teamStats: normalizeTeamMatchStats(item.teamStats),
      __competition: item.competition || "league",
      __matchTime: item.time || "",
      __actaDuration: resolveActaDuration(item.actaDuration, item.teamId || DEFAULT_TEAM_ID, item.actaPlayers),
      __actaPlayers: item.actaPlayers || {},
      __actaFile: {
        url: item.actaFileUrl || "",
        path: item.actaFilePath || "",
        name: item.actaFileName || "",
        type: item.actaFileType || ""
      },
      __matchNotes: item.notes || "",
      __matchVideoUrl: item.videoUrl || "",
      __lineupSheets: normalizeLineupSheets(item.lineupSheets, item),
      __updatedAt: Number(item.updatedAt) || Date.now()
    },
    updated_at: new Date().toISOString()
  };
}

function parseRemoteLineup(value) {
  const lineup = { ...(value || {}) };
  const formation = FORMATIONS[lineup[FORMATION_STORAGE_KEY]] ? lineup[FORMATION_STORAGE_KEY] : DEFAULT_FORMATION;
  const teamId = lineup.__teamId || DEFAULT_TEAM_ID;
  const remoteTeamName = lineup.__teamName || "";
  const teamStats = normalizeTeamMatchStats(lineup.__teamStats);
  const competition = lineup.__competition || "league";
  const time = lineup.__matchTime || "";
  const actaDuration = resolveActaDuration(lineup.__actaDuration, lineup.__teamId, lineup.__actaPlayers);
  const actaPlayers = lineup.__actaPlayers || {};
  const actaFile = lineup.__actaFile || {};
  const notes = lineup.__matchNotes || "";
  const videoUrl = lineup.__matchVideoUrl || "";
  const lineupSheets = lineup.__lineupSheets || null;
  const updatedAt = Number(lineup.__updatedAt) || 0;
  delete lineup[FORMATION_STORAGE_KEY];
  delete lineup.__teamId;
  delete lineup.__teamName;
  delete lineup.__teamStats;
  delete lineup.__competition;
  delete lineup.__matchTime;
  delete lineup.__actaDuration;
  delete lineup.__actaPlayers;
  delete lineup.__actaFile;
  delete lineup.__matchNotes;
  delete lineup.__matchVideoUrl;
  delete lineup.__lineupSheets;
  delete lineup.__updatedAt;
  return {
    lineup, formation, teamId, teamName: remoteTeamName, teamStats, competition, time,
    actaDuration, actaPlayers, actaFileUrl: actaFile.url || "", actaFilePath: actaFile.path || "",
    actaFileName: actaFile.name || "", actaFileType: actaFile.type || "", notes, videoUrl,
    lineupSheets, updatedAt
  };
}

function toRemotePlan(item) {
  const plan = normalizePlan(item.plan);
  const expandedPlan = Object.fromEntries(
    PLAN_SECTIONS.slice(2).flatMap(([type]) => [
      [`${type}Text`, plan[`${type}Text`]],
      [`${type}Videos`, plan[`${type}Videos`]]
    ])
  );
  return {
    match_id: item.id,
    offensive_text: plan.offensiveText,
    defensive_text: plan.defensiveText,
    offensive_videos: [...plan.offensiveVideos, { __expandedPlan: expandedPlan }],
    defensive_videos: plan.defensiveVideos,
    updated_at: new Date().toISOString()
  };
}

function parseRemotePlan(item) {
  const offensiveVideos = Array.isArray(item.offensive_videos) ? item.offensive_videos : [];
  const expandedPlan = offensiveVideos.find((video) => video?.__expandedPlan)?.__expandedPlan || {};
  return normalizePlan({
    offensiveText: item.offensive_text || "",
    defensiveText: item.defensive_text || "",
    offensiveVideos,
    defensiveVideos: item.defensive_videos || [],
    ...expandedPlan
  });
}

function setView(view) {
  state.activeView = view;
  saveState();
  render();
}

function currentTeam() {
  return state.teams.find((item) => item.id === state.activeTeamId) || state.teams[0];
}

function teamName(teamId = state.activeTeamId) {
  return state.teams.find((item) => item.id === teamId)?.name || TEAM_NAME;
}

function playerTeamName(item) {
  if (item?.teamName && item.teamName !== TEAM_NAME) return item.teamName;

  const linkedTeam = state.teams.find((team) => team.id === item?.teamId);
  if (linkedTeam && linkedTeam.id !== DEFAULT_TEAM_ID) return linkedTeam.name;

  const matchingPlayer = state.players.find(
    (candidate) =>
      candidate.id !== item?.id &&
      candidate.name === item?.name &&
      candidate.birthdate === item?.birthdate &&
      (candidate.teamName || (candidate.teamId && candidate.teamId !== DEFAULT_TEAM_ID))
  );
  if (matchingPlayer?.teamName) return matchingPlayer.teamName;

  const matchingTeam = state.teams.find((team) => team.id === matchingPlayer?.teamId);
  return matchingTeam?.name || currentTeam()?.name || linkedTeam?.name || TEAM_NAME;
}

function activePlayers() {
  return state.players.filter((item) => (item.teamId || DEFAULT_TEAM_ID) === state.activeTeamId);
}

function activeMatches() {
  return state.matches.filter((item) => (item.teamId || DEFAULT_TEAM_ID) === state.activeTeamId);
}

function playerParticipatedInMatch(playerItem, matchItem) {
  const actaRole = matchItem.actaPlayers?.[playerItem.id]?.role;
  return Boolean(
    (actaRole && actaRole !== "none") ||
    playerReport(playerItem, matchItem.id).minutes > 0 ||
    matchItem.lineup?.[playerItem.id]
  );
}

function playerStartedMatch(playerItem, matchItem) {
  const actaRole = matchItem.actaPlayers?.[playerItem.id]?.role;
  if (actaRole) return actaRole === "starter";
  const sheets = normalizeLineupSheets(matchItem.lineupSheets, matchItem);
  return sheets[ownTeamSide(matchItem)].some(
    (row) => row.playerId === playerItem.id && row.role === "starter"
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueTeamId(name) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "equipo";
  let id = base;
  let suffix = 2;
  while (state.teams.some((item) => item.id === id)) id = `${base}-${suffix++}`;
  return id;
}

function openTeamDialog(teamId = "") {
  const item = state.teams.find((team) => team.id === teamId);
  document.querySelector("#team-modal-title").textContent = item ? "Editar equipo" : "Nuevo equipo";
  document.querySelector("#team-id").value = item?.id || "";
  document.querySelector("#team-name").value = item?.name || "";
  document.querySelector("#save-team-button").textContent = item ? "Guardar cambios" : "Crear equipo";
  deleteTeamButton.style.display = item ? "inline-flex" : "none";
  teamDialog.showModal();
}

function renameTeam(teamId, name) {
  const item = state.teams.find((team) => team.id === teamId);
  if (!item || item.name === name) return;
  const previousName = item.name;
  item.name = name;
  state.players
    .filter((playerItem) => playerItem.teamId === teamId)
    .forEach((playerItem) => {
      playerItem.teamName = name;
    });
  state.matches
    .filter((matchItem) => matchItem.teamId === teamId)
    .forEach((matchItem) => {
      matchItem.teamName = name;
      if (matchItem.home === previousName) matchItem.home = name;
      if (matchItem.away === previousName) matchItem.away = name;
    });
}

async function deleteTeam(teamId) {
  const item = state.teams.find((team) => team.id === teamId);
  if (!item) return;
  if (state.teams.length === 1) {
    alert("Debe existir al menos un equipo.");
    return;
  }
  const players = state.players.filter((playerItem) => playerItem.teamId === teamId);
  const matches = state.matches.filter((matchItem) => matchItem.teamId === teamId);
  const staff = state.staff.filter((staffItem) => staffItem.teamId === teamId);
  const message = `¿Eliminar ${item.name}? También se eliminarán ${players.length} jugadores y ${matches.length} partidos de este equipo.`;
  if (!confirm(message)) return;

  state.players = state.players.filter((playerItem) => playerItem.teamId !== teamId);
  state.matches = state.matches.filter((matchItem) => matchItem.teamId !== teamId);
  state.staff = state.staff.filter((staffItem) => staffItem.teamId !== teamId);
  state.matchVideos = state.matchVideos.filter((videoItem) => videoItem.teamId !== teamId);
  state.teams = state.teams.filter((team) => team.id !== teamId);
  state.activeTeamId = state.teams[0].id;
  state.selectedPlayerId = activePlayers()[0]?.id || "";
  state.selectedMatchId = activeMatches()[0]?.id || "";
  saveState();
  teamDialog.close();
  render();

  if (activeSeason === LEGACY_SEASON) {
    await Promise.allSettled([
      ...players.map((playerItem) => supabaseDelete("players", "id", playerItem.id)),
      ...matches.map((matchItem) => supabaseDelete("matches", "id", matchItem.id))
    ]);
  }
}

function syncTeamsFromData() {
  const known = new Map(state.teams.map((item) => [item.id, item]));
  [...state.players, ...state.matches, ...(state.staff || []), ...(state.matchVideos || [])].forEach((item) => {
    const id = item.teamId || DEFAULT_TEAM_ID;
    if (REMOVED_TEAM_IDS.has(id)) return;
    if (!known.has(id)) {
      const team = { id, name: item.teamName || recoveredTeamName(id) };
      state.teams.push(team);
      known.set(id, team);
    }
  });
  if (!state.teams.some((item) => item.id === state.activeTeamId)) {
    state.activeTeamId = state.teams[0]?.id || DEFAULT_TEAM_ID;
  }
}

function recoveredTeamName(id) {
  const knownNames = {
    "juvenil-b": "Juvenil B",
    "juvenil-nacional": "Juvenil Nacional",
    "regional-preferente": "Regional Preferente",
    "ce-ferreries-juvenil-b": "Juvenil B",
    "ce-ferreries-juvenil-nacional": "Juvenil Nacional",
    "ce-ferreries-regional-preferente": "Regional Preferente"
  };
  if (knownNames[id]) return knownNames[id];
  if (id === DEFAULT_TEAM_ID) return TEAM_NAME;
  return String(id)
    .replace(/^ce-ferreries-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function teamRelevance(item) {
  const value = `${item.id} ${item.name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
  const category = value.includes("regional")
    ? "regional"
    : value.includes("juvenil") && value.includes("nacional")
      ? "juvenil-nacional"
      : value.includes("juvenil") && (value.includes("-b") || /\bb\b/.test(value))
        ? "juvenil-b"
        : value.includes("cadete")
          ? "cadete"
          : value.includes("infantil")
            ? "infantil"
            : value.includes("alevin") && /\ba\b/.test(value)
              ? "alevin-a"
              : value.includes("alevin") && /\bb\b/.test(value)
                ? "alevin-b"
                : value.includes("prebenjamin")
                  ? "prebenjamin"
                  : value.includes("benjamin") && /\ba\b/.test(value)
                    ? "benjamin-a"
                    : value.includes("benjamin") && /\bb\b/.test(value)
                      ? "benjamin-b"
                      : "";
  const priority = TEAM_RELEVANCE.indexOf(category);
  return priority === -1 ? TEAM_RELEVANCE.length : priority;
}

function repairMissingTeams() {
  const before = JSON.stringify(state.teams || []);
  syncTeamsFromData();
  if (JSON.stringify(state.teams || []) !== before) {
    localStorage.setItem(SEASON_STORAGE_KEYS[activeSeason], JSON.stringify(state));
  }
}

function recoverKnown2026SeasonData() {
  if (activeSeason !== NEW_SEASON) return;
  if (Number(state.recovery2026RosterVersion) >= 1) return;
  let changed = false;

  const recoveredTeams = [
    { id: "ce-ferreries-juvenil-nacional", name: "CE Ferreries Juvenil Nacional" },
    { id: "ce-ferreries-juvenil-preferente-b", name: "CE Ferreries Juvenil Preferente B" },
    { id: "ce-ferreries-regional-preferente", name: "CE Ferreries Regional Preferente" }
  ];
  recoveredTeams.forEach((team) => {
    if (!state.teams.some((item) => item.id === team.id)) {
      state.teams.push(team);
      changed = true;
    }
  });

  const teamId = "ce-ferreries-juvenil-nacional";
  const recoveredPlayers = [
    ["Oliver Anglada Newport", 1, "2010-05-31", "Portero", "Diestro"],
    ["Hugo Pérez", 0, "", "Por definir", "Por definir"],
    ["Maricio", 0, "", "Por definir", "Por definir"],
    ["Nofre Janer", 7, "2008-01-01", "Defensa", "Diestro"],
    ["Luca", 0, "", "Por definir", "Por definir"],
    ["Julián Calzada", 0, "", "Por definir", "Por definir"],
    ["Carmona", 0, "", "Por definir", "Por definir"],
    ["Elies", 0, "", "Por definir", "Por definir"],
    ["Guillem Roselló", 0, "", "Por definir", "Por definir"],
    ["Liam", 0, "", "Por definir", "Por definir"],
    ["Yasser", 0, "", "Por definir", "Por definir"],
    ["Pau Anglés", 0, "", "Por definir", "Por definir"],
    ["Mohamed", 0, "", "Por definir", "Por definir"],
    ["Teo Triay", 0, "", "Por definir", "Por definir"],
    ["Youssef", 0, "", "Por definir", "Por definir"],
    ["Toni Bosch", 0, "", "Por definir", "Por definir"]
  ];
  const normalizedExistingNames = new Set(
    state.players.map((item) => item.name.trim().toLocaleLowerCase("es"))
  );
  recoveredPlayers.forEach(([name, number, birthdate, position, laterality], index) => {
    if (normalizedExistingNames.has(name.toLocaleLowerCase("es"))) return;
    state.players.push({
      id: `recovered-2026-juvenil-nacional-${index + 1}`,
      teamId,
      teamName: "CE Ferreries Juvenil Nacional",
      name,
      number,
      birthdate,
      position,
      laterality,
      photo: "",
      photoPath: "",
      description: "",
      career: "",
      ratings: defaultPlayerRatings(),
      reports: {}
    });
    changed = true;
  });
  if (!state.staff.some((item) => item.teamId === teamId && item.name.trim().toLocaleLowerCase("es") === "joan barber")) {
    state.staff.push({
      id: "recovered-2026-juvenil-nacional-staff-1",
      teamId,
      name: "Joan Barber",
      role: "Primer entrenador",
      photo: "",
      photoPath: ""
    });
    changed = true;
  }
  if (changed) {
    state.activeTeamId = teamId;
    state.selectedPlayerId = state.players.find((item) => item.teamId === teamId)?.id || "";
  }
  state.recovery2026RosterVersion = 1;
  localStorage.setItem(SEASON_STORAGE_KEYS[activeSeason], JSON.stringify(state));
}

function render() {
  seasonLabel.textContent = `Temporada ${activeSeason}`;
  document.title = `CE Ferreries | Temporada ${activeSeason}`;
  document.querySelectorAll(".season-tab").forEach((button) => {
    const isActive = button.dataset.season === activeSeason;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === normalizedMainView());
  });

  Object.values(views).forEach((view) => view.classList.remove("active"));
  if (state.activeView === "detail") views.detail.classList.add("active");
  else if (state.activeView === "playerDetail") views.playerDetail.classList.add("active");
  else views[state.activeView].classList.add("active");

  contextActionButton.textContent = state.activeView === "matches" ? "Añadir partido" : "Añadir jugador";
  contextActionButton.style.display = ["detail", "playerDetail", "standings", "statistics"].includes(state.activeView) ? "none" : "inline-flex";
  createMatchFromActaButton.hidden = !(state.activeView === "matches" && canEdit());
  bulkActaButton.hidden = createMatchFromActaButton.hidden;
  addMatchVideoButton.style.display = state.activeView === "matches" ? "inline-flex" : "none";
  toolbarTeamSelectorWrap.style.display = state.activeView === "squad" ? "flex" : "none";
  toolbarTeamSelector.innerHTML = [...state.teams]
    .sort((first, second) => teamRelevance(first) - teamRelevance(second) || first.name.localeCompare(second.name, "es"))
    .map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === state.activeTeamId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  pageTitle.textContent = pageTitleForView(state.activeView);

  renderSquad();
  renderMatches();
  renderStandings();
  renderStatistics();
  renderPlayerDetail();
  renderMatchDetail();
  applyAccessMode();
}

function applyAccessMode() {
  const editable = canEdit();
  document.body.classList.toggle("read-only-mode", !editable);
  updateLoginButtons();
  document.querySelectorAll(".main-content input, .main-content textarea, .main-content select").forEach((control) => {
    control.disabled = !editable;
  });
  document.querySelectorAll(".main-content button").forEach((button) => {
    const navigationOnly = button.matches(
      "[data-open-player], [data-open-match], [data-player-tab], [data-detail-tab], #back-to-matches"
    );
    if (!navigationOnly) button.disabled = !editable;
  });
  toolbarTeamSelector.disabled = false;
  contextActionButton.hidden = !editable;
  addMatchVideoButton.hidden = !editable;
}

function normalizedMainView() {
  if (state.activeView === "detail") return "matches";
  if (state.activeView === "playerDetail") return "squad";
  return state.activeView;
}

function pageTitleForView(view) {
  const titles = {
    squad: "Equipos",
    matches: "Partidos",
    standings: "Clasificación",
    statistics: "Estadísticas",
    playerDetail: "Ficha del jugador",
    detail: "Detalle de partido"
  };
  return titles[view] || "Equipos";
}

function renderSquad() {
  const players = activePlayers();
  const staff = activeStaff();
  const positionGroups = [
    ["Portero", "Porteros"],
    ["Defensa", "Defensas"],
    ["Centrocampista", "Centrocampistas"],
    ["Delantero", "Delanteros"]
  ];
  const groupedPlayerIds = new Set(
    players.filter((item) => positionGroups.some(([position]) => item.position === position)).map((item) => item.id)
  );
  const pendingPlayers = players.filter((item) => !groupedPlayerIds.has(item.id));
  views.squad.innerHTML = `
    <div class="team-switcher panel">
      <div class="team-switcher-summary">
        <strong>${escapeHtml(currentTeam().name)}</strong>
        <span class="meta">${players.length} jugadores · ${activeMatches().length} partidos</span>
      </div>
      <div class="team-switcher-actions">
        <button class="secondary-button" id="edit-team-button" type="button">Editar equipo</button>
        <button class="primary-button" id="add-team-button" type="button">Añadir equipo</button>
      </div>
    </div>
    <div class="squad-position-groups">
      ${positionGroups
        .map(([position, title]) => renderSquadPositionGroup(title, players.filter((item) => item.position === position)))
        .join("")}
      ${pendingPlayers.length ? renderSquadPositionGroup("Posición pendiente", pendingPlayers, true) : ""}
    </div>
    ${players.length ? "" : `<div class="empty-state">Este equipo aún no tiene jugadores. Usa “Añadir jugador” para crear su plantilla.</div>`}
    <section class="staff-section panel">
      <div class="staff-section-header">
        <div>
          <p class="eyebrow">Equipo de trabajo</p>
          <h2>Staff técnico</h2>
        </div>
        <button class="primary-button" id="add-staff-button" type="button">Añadir miembro del staff</button>
      </div>
      <div class="staff-grid">
        ${staff.map(renderStaffCard).join("")}
      </div>
      ${staff.length ? "" : `<div class="empty-state staff-empty">Todavía no se ha añadido ningún miembro del staff.</div>`}
    </section>
  `;

  views.squad.querySelector("#edit-team-button").addEventListener("click", () => openTeamDialog(state.activeTeamId));
  views.squad.querySelector("#add-team-button").addEventListener("click", () => openTeamDialog());
  views.squad.querySelector("#add-staff-button").addEventListener("click", () => openStaffDialog());
  views.squad.querySelectorAll("[data-edit-staff]").forEach((button) => {
    button.addEventListener("click", () => openStaffDialog(button.dataset.editStaff));
  });
  views.squad.querySelectorAll("[data-edit-player]").forEach((button) => {
    button.addEventListener("click", () => openPlayerDialog(button.dataset.editPlayer));
  });
  views.squad.querySelectorAll("[data-open-player]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPlayerId = button.dataset.openPlayer;
      state.activePlayerTab = "statistics";
      setView("playerDetail");
    });
  });
}

function renderSquadPositionGroup(title, players, pending = false) {
  return `
    <section class="squad-position-group ${pending ? "pending" : ""}">
      <div class="squad-position-heading">
        <h2>${escapeHtml(title)}</h2>
        <span>${players.length} ${players.length === 1 ? "jugador" : "jugadores"}</span>
      </div>
      ${
        players.length
          ? `<div class="squad-grid">${players
              .slice()
              .sort((a, b) => (a.number || 999) - (b.number || 999) || a.name.localeCompare(b.name, "es"))
              .map(renderPlayerCard)
              .join("")}</div>`
          : `<div class="position-empty-state">Sin jugadores</div>`
      }
    </section>
  `;
}

function activeStaff() {
  return (state.staff || []).filter((item) => item.teamId === state.activeTeamId);
}

function renderStaffCard(item) {
  const photoStyle = item.photo ? `style="background-image:url('${escapeAttr(item.photo)}')"` : "";
  return `
    <article class="staff-card player-card">
      <div class="player-main">
        <div class="avatar" ${photoStyle}>${item.photo ? "" : initials(item.name)}</div>
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <div class="meta">${escapeHtml(item.role)}</div>
        </div>
      </div>
      <div class="row-actions">
        <button class="secondary-button" data-edit-staff="${escapeAttr(item.id)}" type="button">Editar</button>
      </div>
    </article>
  `;
}

function openStaffDialog(id = "") {
  const member = state.staff.find((item) => item.id === id);
  document.querySelector("#staff-modal-title").textContent = member ? "Editar miembro del staff" : "Añadir miembro del staff";
  document.querySelector("#staff-id").value = member?.id || "";
  document.querySelector("#staff-name").value = member?.name || "";
  document.querySelector("#staff-role").value = member?.role || "Primer entrenador";
  staffPhotoInput.value = member?.photo || "";
  staffPhotoFileInput.value = "";
  updateStaffPhotoPreview(member?.photo || "");
  deleteStaffButton.style.display = member ? "inline-flex" : "none";
  staffDialog.showModal();
}

function updateStaffPhotoPreview(photo) {
  staffPhotoPreview.classList.toggle("has-photo", Boolean(photo));
  staffPhotoPreview.style.backgroundImage = photo ? `url("${photo}")` : "";
}

function renderPlayerCard(item) {
  const photoStyle = item.photo ? `style="background-image:url('${escapeAttr(item.photo)}')"` : "";
  return `
    <article class="player-card">
      <div class="player-main">
        <div class="avatar" ${photoStyle}>${item.photo ? "" : initials(item.name)}</div>
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <div class="meta">${item.number ? `Dorsal ${item.number}` : "Dorsal pendiente"} · ${escapeHtml(item.position || "Por definir")}</div>
          <div class="meta">Lateralidad: ${escapeHtml(item.laterality || "Por definir")}</div>
          <div class="meta">Nac. ${item.birthdate ? formatDate(item.birthdate) : "pendiente"}</div>
        </div>
      </div>
      <div class="row-actions">
        <button class="primary-button" data-open-player="${item.id}" type="button">Ver ficha</button>
        <button class="secondary-button" data-edit-player="${item.id}" type="button">Editar</button>
      </div>
    </article>
  `;
}

function renderPlayerDetail() {
  const item = activePlayers().find((playerItem) => playerItem.id === state.selectedPlayerId) || activePlayers()[0];
  if (!item) {
    views.playerDetail.innerHTML = `<div class="empty-state">Todavía no hay jugadores en la plantilla.</div>`;
    return;
  }
  state.selectedPlayerId = item.id;
  const photoStyle = item.photo ? `style="background-image:url('${escapeAttr(item.photo)}')"` : "";

  views.playerDetail.innerHTML = `
    <div class="player-profile-header">
      <button class="secondary-button" id="back-to-squad" type="button">Volver a equipos</button>
      <div class="row-actions">
        <button class="primary-button" id="download-player-pdf" type="button">Descargar PDF</button>
        <button class="secondary-button" data-edit-player="${item.id}" type="button">Editar jugador</button>
      </div>
    </div>
    <section class="player-profile-card player-profile-hero">
      <div class="player-number-watermark">${item.number}</div>
      <div class="player-profile-photo" ${photoStyle}>${item.photo ? "" : initials(item.name)}</div>
      <div class="player-profile-main">
        <div class="player-profile-title">
          <div>
            <p class="player-position-label">${escapeHtml(item.position)}</p>
            <h2>${escapeHtml(item.name)}</h2>
            <p class="player-full-name">Dorsal ${item.number} · ${escapeHtml(item.laterality || "Diestro")}</p>
          </div>
        </div>
        <div class="player-info-grid">
          ${renderPlayerInfo("Nombre completo", item.name)}
          ${renderPlayerInfo("Fecha de nacimiento", formatDate(item.birthdate))}
          ${renderPlayerInfo("Edad", `${calculateAge(item.birthdate)} años`)}
          ${renderPlayerInfo("Lateralidad", item.laterality || "Diestro")}
          ${renderPlayerInfo("Posición", item.position)}
          ${renderPlayerInfo("Partidos registrados", activeMatches().length)}
        </div>
        <label class="profile-description">
          Descripción del jugador
          <textarea id="player-description" maxlength="2000" placeholder="Describe sus características técnicas, físicas, tácticas y personales...">${escapeHtml(item.description || "")}</textarea>
        </label>
        <section class="player-ratings-section">
          <div class="ratings-heading">
            <div>
              <h3>Valoración del jugador</h3>
              <p class="meta">Escala de 0 a 10. El valor 0 indica que aún no está valorado.</p>
            </div>
          </div>
          <div class="player-ratings-grid">
            ${Object.entries(playerRatingLabels())
              .map(([key, label]) => renderPlayerRating(key, label, item.ratings?.[key] || 0))
              .join("")}
          </div>
        </section>
      </div>
    </section>
    <div class="detail-tabs player-detail-tabs">
      <button class="detail-tab ${state.activePlayerTab === "statistics" ? "active" : ""}" data-player-tab="statistics" type="button">Estadísticas</button>
      <button class="detail-tab ${state.activePlayerTab === "career" ? "active" : ""}" data-player-tab="career" type="button">Trayectoria</button>
      <button class="detail-tab ${state.activePlayerTab === "reports" ? "active" : ""}" data-player-tab="reports" type="button">Informes de cada partido</button>
    </div>
    <div id="player-tab-body"></div>
  `;

  views.playerDetail.querySelector("#back-to-squad").addEventListener("click", () => setView("squad"));
  views.playerDetail.querySelector("#download-player-pdf").addEventListener("click", () => downloadPlayerPdf(item));
  views.playerDetail.querySelector("[data-edit-player]").addEventListener("click", () => openPlayerDialog(item.id));
  views.playerDetail.querySelector("#player-description").addEventListener("input", (event) => {
    item.description = event.target.value;
    saveState();
  });
  views.playerDetail.querySelectorAll("[data-player-rating]").forEach((input) => {
    input.addEventListener("input", () => {
      item.ratings = normalizePlayerRatings(item.ratings);
      item.ratings[input.dataset.playerRating] = Number(input.value);
      const output = views.playerDetail.querySelector(`[data-rating-output="${input.dataset.playerRating}"]`);
      output.textContent = formatRating(input.value);
      saveState();
    });
  });
  views.playerDetail.querySelectorAll("[data-player-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePlayerTab = button.dataset.playerTab;
      saveState();
      render();
    });
  });

  const body = views.playerDetail.querySelector("#player-tab-body");
  if (state.activePlayerTab === "career") renderPlayerCareer(item, body);
  else if (state.activePlayerTab === "reports") renderPlayerReports(item, body);
  else renderPlayerStatistics(item, body);
}

function renderPlayerStatistics(item, body) {
  const appearances = activeMatches().filter((matchItem) => playerParticipatedInMatch(item, matchItem));
  const starts = activeMatches().filter((matchItem) => playerStartedMatch(item, matchItem)).length;
  const totals = playerReportTotals(item);
  const officialMatches = appearances.length;
  const totalPasses = totals.completedPasses + totals.failedPasses;
  const passAccuracy = totalPasses ? (totals.completedPasses / totalPasses) * 100 : 0;
  const latestAppearance = appearances
    .slice()
    .sort((a, b) => b.round - a.round)[0];

  body.innerHTML = `
    <section class="player-tab-page player-statistics-page">
      <div class="player-statistics-toolbar">
        <div>
          <h2>Estadísticas del jugador</h2>
          <p class="meta">Totales acumulados desde sus informes de partido.</p>
        </div>
        <div class="statistics-filters">
          <span class="filter-chip">Temporada ${activeSeason}</span>
          <span class="filter-chip">Todas las competiciones</span>
        </div>
      </div>
      <div class="player-stat-cards">
        ${renderFeaturedPlayerStat(officialMatches, totals.minutes, starts)}
        ${renderPlayerStatCard("Goles marcados", totals.goals, "GO")}
        ${renderPlayerStatCard("Asistencias de gol", totals.assists, "AS")}
        ${renderPlayerStatCard("Contribuciones de gol", totals.goals + totals.assists, "CG", [
          `${totals.goals} goles + ${totals.assists} asistencias`
        ])}
        ${renderPlayerStatCard("Tiros a puerta", totals.shotsOnTarget, "TP", [
          `${formatPerMatch(totals.shotsOnTarget, officialMatches)} por partido`
        ])}
        ${renderPlayerStatCard("Pases", totals.completedPasses + totals.failedPasses, "PA", [
          `${totals.completedPasses} correctos`,
          `${totals.failedPasses} fallados`,
          `${formatPercentage(passAccuracy)} de acierto`
        ])}
        ${renderPlayerStatCard("Pases de gol", totals.goalPasses, "PG", [
          `${formatPerMatch(totals.goalPasses, officialMatches)} por partido`
        ])}
        ${renderPlayerStatCard("Balones ganados", totals.recoveries, "BG", [
          `${formatPerMatch(totals.recoveries, officialMatches)} por partido`,
          `${totals.losses} pérdidas`
        ])}
        ${renderPlayerStatCard("Tarjetas", totals.yellowCards + totals.redCards, "TA", [
          `${totals.yellowCards} amarillas`,
          `${totals.redCards} rojas`
        ])}
      </div>
      <div class="player-stat-summary">
        <div>
          <span>Última aparición</span>
          <strong>${latestAppearance ? `Jornada ${latestAppearance.round}` : "Sin apariciones"}</strong>
        </div>
        <div>
          <span>Posición principal</span>
          <strong>${escapeHtml(item.position)}</strong>
        </div>
        <div>
          <span>Lateralidad</span>
          <strong>${escapeHtml(item.laterality || "Diestro")}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderFeaturedPlayerStat(matches, minutes, starts) {
  return `
    <article class="player-stat-card featured">
      <div class="player-stat-card-title"><span>PO</span> Partidos oficiales</div>
      <strong>${matches}</strong>
      <div class="player-stat-card-details">
        <span>${minutes.toLocaleString("es-ES")} min. jugados</span>
        <span>${starts} titularidades</span>
      </div>
    </article>
  `;
}

function formatPerMatch(total, matches) {
  if (!matches) return "0";
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(total / matches);
}

function formatPercentage(value) {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)}%`;
}

function renderPlayerStatCard(title, value, icon, details = []) {
  return `
    <article class="player-stat-card">
      <div class="player-stat-card-title"><span>${icon}</span> ${escapeHtml(title)}</div>
      <strong>${value.toLocaleString("es-ES")}</strong>
      ${
        details.length
          ? `<div class="player-stat-card-details">${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}</div>`
          : ""
      }
    </article>
  `;
}

function renderPlayerCareer(item, body) {
  body.innerHTML = `
    <section class="panel player-tab-page">
      <div class="section-intro">
        <div>
          <h2>Trayectoria</h2>
          <p class="meta">Clubes, temporadas, categorías y evolución deportiva.</p>
        </div>
      </div>
      <div class="current-club-card">
        <div class="crest small-crest">AC</div>
        <div>
          <strong>${escapeHtml(currentTeam().name)}</strong>
          <div class="meta">Temporada ${activeSeason} · ${escapeHtml(item.position)}</div>
        </div>
      </div>
      <label class="career-editor">
        Historial del jugador
        <textarea id="player-career" maxlength="5000" placeholder="Ejemplo: 2024-2026 Athletic Club · Primer equipo&#10;2022-2024 Bilbao Athletic...">${escapeHtml(item.career || "")}</textarea>
      </label>
    </section>
  `;

  body.querySelector("#player-career").addEventListener("input", (event) => {
    item.career = event.target.value;
    saveState();
  });
}

function renderPlayerReports(item, body) {
  const linkedReportMatchIds = new Set(Object.keys(normalizePlayerReports(item.reports)));
  const activeTeamName = normalizeSearchText(currentTeam().name);
  const matches = state.matches
    .filter(
      (matchItem) => {
        const homeName = normalizeSearchText(matchItem.home);
        const awayName = normalizeSearchText(matchItem.away);
        const belongsToCurrentTeamByName =
          (homeName && (homeName.includes(activeTeamName) || activeTeamName.includes(homeName))) ||
          (awayName && (awayName.includes(activeTeamName) || activeTeamName.includes(awayName)));
        return (
          (matchItem.teamId || DEFAULT_TEAM_ID) === state.activeTeamId ||
          linkedReportMatchIds.has(matchItem.id) ||
          belongsToCurrentTeamByName
        );
      }
    )
    .slice()
    .sort((a, b) => a.round - b.round);
  body.innerHTML = `
    <section class="panel player-tab-page">
      <div class="section-intro">
        <div>
          <h2>Informes de cada partido</h2>
          <p class="meta">Valoración técnica individual para cada jornada · Temporada ${activeSeason}.</p>
        </div>
        <button class="primary-button" id="add-player-match-report" type="button">Añadir informe de partido</button>
      </div>
      <div class="player-reports-list">
        ${
          matches.length
            ? matches
                .map((matchItem) => {
                  const inLineup = playerParticipatedInMatch(item, matchItem);
                  const report = playerReport(item, matchItem.id);
                  const videoEmbedUrl = youtubeEmbedUrl(report.youtube);
                  return `
                    <article class="player-report-card">
                      <div class="player-report-heading">
                        <div>
                          <span class="tag">${escapeHtml(matchStageLabel(matchItem))}</span>
                          <h3>${escapeHtml(matchItem.home)} vs ${escapeHtml(matchItem.away)}</h3>
                          <p class="meta">${formatMatchSchedule(matchItem)} · ${escapeHtml(matchItem.score || "Sin resultado")}</p>
                        </div>
                        <div class="player-report-heading-actions">
                          <label class="match-rating-control">
                            Valoración
                            <span>
                              <input data-player-report-rating="${matchItem.id}" type="number" min="1" max="10" step="0.5" value="${report.rating || ""}" placeholder="-" />
                              <small>/ 10</small>
                            </span>
                          </label>
                          <span class="report-status ${inLineup ? "included" : ""}">${inLineup ? "En alineación" : "No alineado"}</span>
                        </div>
                      </div>
                      <label>
                        Informe individual
                        <textarea data-player-report-text="${matchItem.id}" maxlength="3000" placeholder="Rendimiento, aspectos destacados y puntos de mejora...">${escapeHtml(report.text)}</textarea>
                      </label>
                      <div class="report-data-grid">
                        ${renderReportStatInput(matchItem.id, "completedPasses", "Pases correctos", report.completedPasses)}
                        ${renderReportStatInput(matchItem.id, "failedPasses", "Pases fallados", report.failedPasses)}
                        ${renderReportStatInput(matchItem.id, "losses", "Pérdidas", report.losses)}
                        ${renderReportStatInput(matchItem.id, "recoveries", "Recuperaciones", report.recoveries)}
                        ${renderReportStatInput(matchItem.id, "minutes", "Minutos jugados", report.minutes, 130)}
                        ${renderReportStatInput(matchItem.id, "goals", "Goles", report.goals)}
                        ${renderReportStatInput(matchItem.id, "assists", "Asistencias de gol", report.assists)}
                        ${renderReportStatInput(matchItem.id, "shotsOnTarget", "Tiros a puerta", report.shotsOnTarget)}
                        ${renderReportStatInput(matchItem.id, "goalPasses", "Pases de gol", report.goalPasses)}
                        ${renderReportStatInput(matchItem.id, "yellowCards", "Tarjetas amarillas", report.yellowCards, 2)}
                        ${renderReportStatInput(matchItem.id, "redCards", "Tarjetas rojas", report.redCards, 1)}
                        <label>
                          Vídeo de YouTube
                          <input data-player-report-youtube="${matchItem.id}" type="url" value="${escapeAttr(report.youtube)}" placeholder="https://www.youtube.com/watch?v=..." />
                        </label>
                      </div>
                      ${
                        videoEmbedUrl
                          ? `<div class="youtube-video">
                              <iframe src="${escapeAttr(videoEmbedUrl)}" title="Vídeo del informe de ${escapeAttr(item.name)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                            </div>`
                          : report.youtube
                            ? `<p class="video-url-error">El enlace no parece ser un vídeo válido de YouTube.</p>`
                            : ""
                      }
                      <div class="report-save-row">
                        <span class="report-save-status" data-report-save-status="${matchItem.id}">Cambios guardados automáticamente</span>
                        ${
                          playerReportHasData(report)
                            ? `<button class="danger-button" data-delete-player-report="${matchItem.id}" type="button">Eliminar informe</button>`
                            : ""
                        }
                        <button class="primary-button" data-save-player-report="${matchItem.id}" type="button">Guardar informe</button>
                      </div>
                    </article>
                  `;
                })
                .join("")
            : `<div class="empty-state">
                <p>Este equipo todavía no tiene partidos. Crea el primero para rellenar el informe y las estadísticas de ${escapeHtml(item.name)}.</p>
                <button class="primary-button" id="create-match-from-player-report" type="button">Crear primer partido</button>
              </div>`
        }
      </div>
    </section>
  `;

  body.querySelector("#add-player-match-report").addEventListener("click", () => {
    openMatchDialog("", true);
  });

  body.querySelector("#create-match-from-player-report")?.addEventListener("click", () => {
    openMatchDialog("", true);
  });
  body.querySelectorAll("[data-player-report-text]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const report = ensurePlayerReport(item, textarea.dataset.playerReportText);
      report.text = textarea.value;
      saveState();
      markPlayerReportPending(body, textarea.dataset.playerReportText);
    });
  });
  body.querySelectorAll("[data-player-report-stat]").forEach((input) => {
    input.addEventListener("input", () => {
      const report = ensurePlayerReport(item, input.dataset.playerReportStat);
      const key = input.dataset.reportStat;
      const maximum = key === "minutes" ? 130 : key === "yellowCards" ? 2 : key === "redCards" ? 1 : 9999;
      report[key] = clamp(Math.round(Number(input.value) || 0), 0, maximum);
      saveState();
      markPlayerReportPending(body, input.dataset.playerReportStat);
    });
  });
  body.querySelectorAll("[data-player-report-rating]").forEach((input) => {
    input.addEventListener("input", () => {
      const report = ensurePlayerReport(item, input.dataset.playerReportRating);
      report.rating = input.value === "" ? 0 : clamp(Number(input.value) || 0, 1, 10);
      saveState();
      markPlayerReportPending(body, input.dataset.playerReportRating);
    });
  });
  body.querySelectorAll("[data-player-report-youtube]").forEach((input) => {
    input.addEventListener("input", () => {
      const report = ensurePlayerReport(item, input.dataset.playerReportYoutube);
      report.youtube = input.value.trim();
      saveState();
      markPlayerReportPending(body, input.dataset.playerReportYoutube);
    });
    input.addEventListener("change", render);
  });
  body.querySelectorAll("[data-save-player-report]").forEach((button) => {
    button.addEventListener("click", async () => {
      const matchId = button.dataset.savePlayerReport;
      const status = body.querySelector(`[data-report-save-status="${matchId}"]`);
      button.disabled = true;
      button.textContent = "Guardando...";
      status.textContent = "Guardando informe...";
      status.classList.remove("pending", "saved", "error");
      saveState();
      clearTimeout(remoteSaveTimer);
      try {
        await pushRemoteState(true);
        status.textContent = "Informe guardado";
        status.classList.add("saved");
      } catch (error) {
        console.error(error);
        status.textContent = "Guardado en este dispositivo; pendiente de sincronizar";
        status.classList.add("error");
      } finally {
        button.disabled = false;
        button.textContent = "Guardar informe";
      }
    });
  });
  body.querySelectorAll("[data-delete-player-report]").forEach((button) => {
    button.addEventListener("click", async () => {
      const matchId = button.dataset.deletePlayerReport;
      const matchItem = matches.find((candidate) => candidate.id === matchId);
      const matchLabel = matchItem
        ? `${matchStageLabel(matchItem)}: ${matchItem.home} vs ${matchItem.away}`
        : "este partido";
      if (!confirm(`¿Eliminar el informe de ${item.name} para ${matchLabel}? Se borrarán también sus estadísticas, valoración y vídeo.`)) {
        return;
      }

      item.reports = normalizePlayerReports(item.reports);
      delete item.reports[matchId];
      saveState();
      clearTimeout(remoteSaveTimer);
      try {
        await pushRemoteState(true);
      } catch (error) {
        console.error(error);
        alert("El informe se ha eliminado en este dispositivo, pero queda pendiente de sincronizar.");
      }
      render();
    });
  });
}

function markPlayerReportPending(body, matchId) {
  const status = body.querySelector(`[data-report-save-status="${matchId}"]`);
  if (!status) return;
  status.textContent = "Cambios pendientes de confirmar";
  status.classList.remove("saved", "error");
  status.classList.add("pending");
}

function renderReportStatInput(matchId, key, label, value, max = 9999) {
  const displayValue = ["yellowCards", "redCards"].includes(key) ? value : value || "";
  return `
    <label>
      ${escapeHtml(label)}
      <input
        data-player-report-stat="${matchId}"
        data-report-stat="${key}"
        type="number"
        min="0"
        max="${max}"
        value="${displayValue}"
        placeholder="0"
      />
    </label>
  `;
}

function renderPlayerInfo(label, value) {
  return `
    <div class="player-info-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderPlayerRating(key, label, value) {
  return `
    <label class="player-rating-item">
      <span>${escapeHtml(label)}</span>
      <div class="rating-control">
        <input data-player-rating="${key}" type="range" min="0" max="10" step="0.5" value="${value}" />
        <output data-rating-output="${key}">${formatRating(value)}</output>
      </div>
    </label>
  `;
}

function renderMatches() {
  const matches = activeMatches();
  const videos = (state.matchVideos || []).filter((item) => item.teamId === state.activeTeamId);
  views.matches.innerHTML = `
    <div class="active-team-context">
      <span class="eyebrow">Equipo seleccionado</span>
      <strong>${escapeHtml(currentTeam().name)}</strong>
    </div>
    <div class="match-grid">
      ${matches
        .slice()
        .sort((a, b) => a.round - b.round)
        .map(renderMatchCard)
        .join("")}
    </div>
    ${matches.length ? "" : `<div class="empty-state">Este equipo todavía no tiene partidos.</div>`}
    <section class="match-video-library panel">
      <div class="section-intro">
        <div>
          <p class="eyebrow">Contenido audiovisual</p>
          <h2>Vídeos del equipo</h2>
        </div>
      </div>
      <div class="match-video-grid">
        ${videos.map(renderTeamMatchVideo).join("")}
      </div>
      ${videos.length ? "" : `<div class="empty-state">Todavía no hay vídeos. Usa “Añadir vídeo” para guardar el primero.</div>`}
    </section>
  `;

  views.matches.querySelectorAll("[data-open-match]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMatchId = button.dataset.openMatch;
      state.activeDetailTab = "plan";
      setView("detail");
    });
  });
  views.matches.querySelectorAll("[data-edit-match]").forEach((button) => {
    button.addEventListener("click", () => openMatchDialog(button.dataset.editMatch));
  });
  views.matches.querySelectorAll("[data-delete-match]").forEach((button) => {
    button.addEventListener("click", () => deleteMatch(button.dataset.deleteMatch));
  });
  views.matches.querySelectorAll("[data-delete-team-video]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteTeamVideo;
      const video = state.matchVideos.find((item) => item.id === id);
      if (!video || !confirm(`¿Eliminar el vídeo “${video.title}”?`)) return;
      state.matchVideos = state.matchVideos.filter((item) => item.id !== id);
      saveState();
      render();
    });
  });
}

function renderTeamMatchVideo(item) {
  const embedUrl = youtubeEmbedUrl(item.url);
  return `
    <article class="match-video-card">
      ${
        embedUrl
          ? `<div class="youtube-video"><iframe src="${escapeAttr(embedUrl)}" title="${escapeAttr(item.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
          : `<a class="match-video-placeholder" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">Abrir vídeo</a>`
      }
      <div class="match-video-card-footer">
        <strong>${escapeHtml(item.title)}</strong>
        <button class="danger-button" data-delete-team-video="${escapeAttr(item.id)}" type="button">Eliminar</button>
      </div>
    </article>
  `;
}

function matchStageLabel(item) {
  if (item.competition === "friendly") return "Amistoso";
  const competition = item.competition === "cup" ? "Copa" : "Liga";
  return `${competition} · Jornada ${item.round || "-"}`;
}

function formatMatchSchedule(item) {
  const dateLabel = item.date ? formatDate(item.date) : "Fecha pendiente";
  return item.time ? `${dateLabel} · ${item.time} h` : dateLabel;
}

function renderMatchCard(item) {
  return `
    <article class="match-card">
      <div class="match-title">
        <div>
          <span class="tag">${escapeHtml(matchStageLabel(item))}</span>
          <h3>${escapeHtml(item.home)} vs ${escapeHtml(item.away)}</h3>
        </div>
        <strong>${escapeHtml(item.score || "-")}</strong>
      </div>
      <div class="meta">${formatMatchSchedule(item)} · ${escapeHtml(item.status)}</div>
      <div class="row-actions">
        <button class="primary-button" data-open-match="${item.id}" type="button">Abrir</button>
        <button class="secondary-button" data-edit-match="${item.id}" type="button">Editar</button>
        <button class="danger-button" data-delete-match="${item.id}" type="button">Eliminar</button>
      </div>
    </article>
  `;
}

function renderMatchDetail() {
  const item = activeMatches().find((matchItem) => matchItem.id === state.selectedMatchId) || activeMatches()[0];
  if (!item) {
    views.detail.innerHTML = `<div class="empty-state">Todavía no hay partidos creados.</div>`;
    return;
  }
  state.selectedMatchId = item.id;

  views.detail.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">
        <p class="eyebrow">${escapeHtml(matchStageLabel(item))}</p>
        <h2>${escapeHtml(item.home)} vs ${escapeHtml(item.away)}</h2>
        <div class="meta">${formatMatchSchedule(item)} · ${escapeHtml(item.status)} · Resultado ${escapeHtml(item.score || "-")}</div>
      </div>
      <div class="detail-actions">
        <button class="secondary-button" id="back-to-matches" type="button">Volver</button>
        <button class="primary-button" id="import-match-report" type="button">Importar acta</button>
        ${matchItemActaLink(item)}
        <button class="secondary-button" data-edit-match="${item.id}" type="button">Editar partido</button>
      </div>
    </div>
    <div class="detail-tabs">
      <button class="detail-tab ${state.activeDetailTab === "plan" ? "active" : ""}" data-detail-tab="plan" type="button">Plan de partido</button>
      <button class="detail-tab ${state.activeDetailTab === "lineup" ? "active" : ""}" data-detail-tab="lineup" type="button">Alineación</button>
      <button class="detail-tab ${state.activeDetailTab === "information" ? "active" : ""}" data-detail-tab="information" type="button">Información del partido</button>
      <button class="detail-tab ${state.activeDetailTab === "video" ? "active" : ""}" data-detail-tab="video" type="button">Vídeo</button>
      <button class="detail-tab ${state.activeDetailTab === "stats" ? "active" : ""}" data-detail-tab="stats" type="button">Estadísticas</button>
    </div>
    <div id="detail-body"></div>
  `;

  views.detail.querySelector("#back-to-matches").addEventListener("click", () => setView("matches"));
  views.detail.querySelector("#import-match-report").addEventListener("click", () => openMatchReportImport(item));
  views.detail.querySelector("[data-edit-match]").addEventListener("click", () => openMatchDialog(item.id));
  views.detail.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeDetailTab = button.dataset.detailTab;
      saveState();
      render();
    });
  });

  const body = views.detail.querySelector("#detail-body");
  if (state.activeDetailTab === "plan") renderPlan(item, body);
  else if (state.activeDetailTab === "information") renderMatchInformation(item, body);
  else if (state.activeDetailTab === "video") renderMatchVideo(item, body);
  else if (state.activeDetailTab === "stats") renderMatchStats(item, body);
  else renderLineupEditor(item, body);
}

function renderMatchStats(item, body) {
  const players = activePlayers().slice().sort(
    (a, b) => (a.number || 999) - (b.number || 999) || a.name.localeCompare(b.name, "es")
  );

  if (players.length === 0) {
    body.innerHTML = `<div class="empty-state">No hay jugadores en la plantilla.</div>`;
    return;
  }

  const duration = resolveActaDuration(item.actaDuration, item.teamId, item.actaPlayers);

  const playerData = players.map((playerItem) => {
    const acta = item.actaPlayers?.[playerItem.id];
    const report = playerReport(playerItem, item.id);
    // Si el jugador figura en la alineación del partido pero no tiene registro de acta, se usa la alineación
    const sheetRow = (item.lineupSheets?.[ownTeamSide(item)] || []).find((row) => row.playerId === playerItem.id);
    const sheetMinute = sheetRow && sheetRow.changeMinute !== "" && sheetRow.changeMinute != null ? Number(sheetRow.changeMinute) : null;
    const role = acta?.role || (sheetRow ? (sheetRow.role === "substitute" ? "substitute" : "starter") : report.minutes > 0 ? "starter" : "none");
    let entry = Number(acta?.entry) || 0;
    // Un titular sin cambio juega todo el partido: una salida vacía o en 0 no significa "0 minutos"
    let exitVal = Number(acta?.exit) > 0 ? Number(acta.exit) : duration;
    if (role === "starter") {
      entry = 0;
      if (!(Number(acta?.exit) > 0) && sheetMinute != null && sheetMinute > 0) exitVal = sheetMinute;
    } else if (role === "substitute" && !(Number(acta?.entry) > 0) && sheetMinute != null) {
      entry = sheetMinute;
    }
    const minutes = role !== "none" && (acta?.role || sheetRow)
      ? Math.max(0, Math.min(duration, exitVal) - entry)
      : report.minutes;
    return {
      playerItem,
      role,
      minutes,
      goals: acta?.goals != null ? Number(acta.goals) : report.goals,
      assists: report.assists,
      yellowCards: acta?.yellowCards != null ? Number(acta.yellowCards) : report.yellowCards,
      redCards: acta?.redCards != null ? Number(acta.redCards) : report.redCards
    };
  });

  const pid = (d) => escapeAttr(d.playerItem.id);

  const roleCell = (d) => `
    <select class="mstat-select" data-pid="${pid(d)}" data-stat="role">
      <option value="none" ${d.role === "none" ? "selected" : ""}>—</option>
      <option value="starter" ${d.role === "starter" ? "selected" : ""}>Titular</option>
      <option value="substitute" ${d.role === "substitute" ? "selected" : ""}>Suplente</option>
    </select>`;

  const numCell = (d, stat, val, max, extraCls = "") => `<input class="mstat-input ${extraCls}" type="number" min="0"${max != null ? ` max="${max}"` : ""} data-pid="${pid(d)}" data-stat="${stat}" value="${val}" />`;

  body.innerHTML = `
    <div class="mstat-wrap">
      <div class="mstat-toolbar">
        <button class="primary-button" id="mstat-save" type="button">Guardar estadísticas</button>
        <span class="mstat-status" id="mstat-status"></span>
      </div>
      <div class="mstat-scroll">
        <table class="mstat-table">
          <thead>
            <tr>
              <th class="mstat-col-player">Jugador</th>
              <th class="mstat-col-stat">Titular</th>
              <th class="mstat-col-stat">Minutos</th>
              <th class="mstat-col-stat">Goles</th>
              <th class="mstat-col-stat">Asistencias</th>
              <th class="mstat-col-stat mstat-col-card">TA</th>
              <th class="mstat-col-stat mstat-col-card">TR</th>
            </tr>
          </thead>
          <tbody>
            ${playerData.map((d) => `
              <tr class="${d.role === "none" ? "mstat-row-out" : ""}">
                <td class="mstat-col-player">
                  ${d.playerItem.number ? `<span class="mstat-dorsal">${escapeHtml(String(d.playerItem.number))}</span>` : ""}
                  <span class="mstat-fullname">${escapeHtml(d.playerItem.name)}</span>
                </td>
                <td class="mstat-cell">${roleCell(d)}</td>
                <td class="mstat-cell">${numCell(d, "minutes", d.minutes, duration)}</td>
                <td class="mstat-cell">${numCell(d, "goals", d.goals, null)}</td>
                <td class="mstat-cell">${numCell(d, "assists", d.assists, null)}</td>
                <td class="mstat-cell">${numCell(d, "yellowCards", d.yellowCards, 2, "mstat-input-yellow")}</td>
                <td class="mstat-cell">${numCell(d, "redCards", d.redCards, 1, "mstat-input-red")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  body.querySelector("#mstat-save").addEventListener("click", () => {
    const records = {};
    let totalYellows = 0;
    let totalReds = 0;

    players.forEach((playerItem) => {
      const get = (stat) => {
        const el = body.querySelector(`[data-stat="${stat}"][data-pid="${CSS.escape(playerItem.id)}"]`);
        return el ? el.value : "0";
      };
      const role = get("role") || "none";
      const minutes = clamp(nonNegativeInteger(get("minutes")), 0, duration);
      const goals = nonNegativeInteger(get("goals"));
      const assists = nonNegativeInteger(get("assists"));
      const yellows = normalizeCardCount(get("yellowCards"), 2);
      const reds = normalizeCardCount(get("redCards"), 1);
      const exit = role !== "none" ? minutes : 0;

      const report = ensurePlayerReport(playerItem, item.id);
      report.minutes = role === "none" ? 0 : minutes;
      report.goals = goals;
      report.assists = assists;
      report.yellowCards = yellows;
      report.redCards = reds;

      records[playerItem.id] = { role, entry: 0, exit, goals, yellowCards: yellows, redCards: reds };
      totalYellows += yellows;
      totalReds += reds;
    });

    item.actaPlayers = records;
    item.actaDuration = item.actaDuration || duration;
    item.teamStats = { ...normalizeTeamMatchStats(item.teamStats), yellowCards: totalYellows, redCards: totalReds };

    const ownSide = ownTeamSide(item);
    item.lineupSheets = normalizeLineupSheets(item.lineupSheets, item);
    item.lineupSheets[ownSide] = Object.entries(records)
      .filter(([, r]) => r.role !== "none")
      .map(([playerId, r]) => ({
        playerId,
        name: state.players.find((p) => p.id === playerId)?.name || "",
        role: r.role === "substitute" ? "substitute" : "starter",
        changeMinute: r.role === "substitute" ? r.exit : (r.exit < duration ? r.exit : "")
      }));

    saveMatchState(item);
    render();
  });
}

function matchItemActaLink(item) {
  return item.actaFileUrl
    ? `<a class="secondary-button" href="${escapeAttr(item.actaFileUrl)}" target="_blank" rel="noopener noreferrer">Ver acta</a>`
    : "";
}

// Duración reglamentaria por categoría (minutos). Juvenil y Regional: 90.
// Importante: "prebenjamin" va antes que "benjamin" porque lo contiene.
const MATCH_DURATION_BY_TEAM_KEYWORD = [
  ["prebenjamin", 40], // 4 cuartos de 10
  ["benjamin", 48],    // 4 cuartos de 12
  ["alevin", 60],      // 4 cuartos de 15
  ["infantil", 72],    // 4 cuartos de 18
  ["cadete", 80]
];
function defaultActaDuration(teamId) {
  const id = String(teamId || "").toLowerCase();
  const found = MATCH_DURATION_BY_TEAM_KEYWORD.find(([keyword]) => id.includes(keyword));
  return found ? found[1] : 90;
}
// Si no hay duración guardada usa la de la categoría. Un 80 guardado por el antiguo valor
// por defecto en una categoría que no es Cadete, sin acta importada, se corrige a la de su categoría.
function resolveActaDuration(stored, teamId, actaPlayers) {
  const saved = Number(stored) || 0;
  const fallback = defaultActaDuration(teamId);
  if (!saved) return fallback;
  if (saved === 80 && fallback !== 80 && !Object.keys(actaPlayers || {}).length) return fallback;
  return saved;
}

function openMatchReportImport(matchItem) {
  const duration = resolveActaDuration(matchItem.actaDuration, matchItem.teamId, matchItem.actaPlayers);
  actaFileInput.value = "";
  document.querySelector("#acta-match-id").value = matchItem.id;
  document.querySelector("#acta-duration").value = duration;
  document.querySelector("#acta-score").value = matchItem.score || "";
  document.querySelector("#acta-import-status").textContent = "";
  document.querySelector("#acta-file-preview").innerHTML = matchItem.actaFileUrl
    ? matchItem.actaFileType?.startsWith("image/")
      ? `<a href="${escapeAttr(matchItem.actaFileUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeAttr(matchItem.actaFileUrl)}" alt="Acta adjunta" /></a><span>${escapeHtml(matchItem.actaFileName || "Acta adjunta")}</span>`
      : `<a href="${escapeAttr(matchItem.actaFileUrl)}" target="_blank" rel="noopener noreferrer">Abrir ${escapeHtml(matchItem.actaFileName || "acta adjunta")}</a>`
    : "";
  document.querySelector("#acta-player-rows").innerHTML = activePlayers()
    .slice()
    .sort((a, b) => (a.number || 999) - (b.number || 999) || a.name.localeCompare(b.name, "es"))
    .map((playerItem) => {
      const saved = matchItem.actaPlayers?.[playerItem.id];
      const report = playerReport(playerItem, matchItem.id);
      const role = saved?.role || (report.minutes ? "starter" : "none");
      return `
        <tr data-player-id="${escapeAttr(playerItem.id)}">
          <td><strong>${playerItem.number || "-"}. ${escapeHtml(playerItem.name)}</strong></td>
          <td><select data-acta-role><option value="none" ${role === "none" ? "selected" : ""}>No participó</option><option value="starter" ${role === "starter" ? "selected" : ""}>Titular</option><option value="substitute" ${role === "substitute" ? "selected" : ""}>Suplente</option></select></td>
          <td><input data-acta-entry type="number" min="0" max="${duration}" value="${saved?.entry ?? (role === "starter" ? 0 : "")}" placeholder="-" /></td>
          <td><input data-acta-exit type="number" min="0" max="${duration}" value="${saved?.exit ?? (report.minutes && role === "starter" ? report.minutes : "")}" placeholder="${duration}" /></td>
          <td><input data-acta-goals type="number" min="0" value="${saved?.goals ?? report.goals}" /></td>
          <td><input data-acta-yellow type="number" min="0" max="2" value="${saved?.yellowCards ?? report.yellowCards}" /></td>
          <td><input data-acta-red type="number" min="0" max="1" value="${saved?.redCards ?? report.redCards}" /></td>
        </tr>`;
    })
    .join("");
  matchReportImportDialog.showModal();
}

function renderStandings() {
  const table = activeSeason === LEGACY_SEASON ? FINAL_STANDINGS : [];
  const isHistoricalSeason = activeSeason === LEGACY_SEASON;

  views.standings.innerHTML = `
    <div class="section-intro">
      <div>
        <h2>${isHistoricalSeason ? "Clasificación final · Cadete Preferente" : `Clasificación · ${activeSeason}`}</h2>
        <p class="meta">${isHistoricalSeason ? "Clasificación definitiva de la categoría Cadete Preferente." : "La clasificación de la nueva temporada aparecerá aquí cuando se incorporen sus datos."}</p>
      </div>
      ${isHistoricalSeason ? `<span class="tag">14 jornadas</span>` : ""}
    </div>
    ${
      table.length
        ? `<div class="table-panel">
            <div class="data-table-scroll">
              <table class="data-table standings-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Equipo</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>E</th>
                    <th>P</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  ${table
                    .map(
                      (team, index) => `
                        <tr class="${team.name === currentTeam().name ? "highlight-row" : ""}">
                          <td><strong>${index + 1}</strong></td>
                          <td class="team-cell">${escapeHtml(team.name)}</td>
                          <td>${team.played}</td>
                          <td>${team.won}</td>
                          <td>${team.drawn}</td>
                          <td>${team.lost}</td>
                          <td><strong>${team.points}</strong></td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>`
        : `<div class="empty-state">Todavía no hay datos de clasificación para la temporada ${activeSeason}.</div>`
    }
  `;
}

function renderStatistics() {
  const matches = parsedMatches();
  const teamStats = calculateTeamStats(matches);
  const extraStats = calculateTeamMatchStats();
  const playerRows = buildPlayerStatistics();
  const rankingCards = [
    { title: "Partidos", key: "played", suffix: "" },
    { title: "Minutos", key: "minutes", suffix: "" },
    { title: "Goles", key: "goals", suffix: "" },
    { title: "Asistencias de gol", key: "assists", suffix: "" },
    { title: "Tiros a puerta", key: "shotsOnTarget", suffix: "" },
    { title: "Recuperaciones", key: "recoveries", suffix: "" }
  ];

  views.statistics.innerHTML = `
    <div class="club-statistics-page">
      <div class="statistics-filters">
        <span class="filter-chip">Temporada 2026</span>
        <span class="filter-chip">Todos los partidos</span>
      </div>
      <section class="team-summary-strip">
        ${renderTeamSummary("Partidos", "▣", teamStats.played, [
          [teamStats.won, "ganados"],
          [teamStats.drawn, "empatados"],
          [teamStats.lost, "perdidos"]
        ], true)}
        ${renderTeamSummary("Goles", "⚽", teamStats.goalsFor, [
          [teamStats.goalsFor, "marcados"],
          [teamStats.goalsAgainst, "encajados"]
        ])}
        ${renderTeamSummary("Tarjetas", "▱", 0, [
          [extraStats.yellowCards, "amarillas", "yellow"],
          [extraStats.redCards, "rojas", "red"]
        ])}
        ${renderTeamSummary("Penaltis", "◎", 0, [
          [extraStats.penaltiesFor, "a favor"],
          [extraStats.penaltiesAgainst, "en contra"]
        ])}
        ${renderTeamSummary("Ocasiones de gol", "⌁", 0, [
          [extraStats.chancesCreated, "generadas"],
          [extraStats.chancesAgainst, "recibidas"]
        ])}
      </section>

      <section class="rankings-section">
        <div class="statistics-title-row">
          <div>
            <p class="eyebrow">Rendimiento individual</p>
            <h2>Rankings</h2>
          </div>
          <span class="meta">Datos de alineaciones e informes registrados</span>
        </div>
        <div class="ranking-cards">
          ${rankingCards.map((ranking) => renderRankingCard(ranking, playerRows)).join("")}
        </div>
      </section>

      <section class="players-statistics-section">
        <div class="statistics-title-row">
          <div>
            <p class="eyebrow">${escapeHtml(currentTeam().name)} · 2026</p>
            <h2>Estadísticas jugadores</h2>
          </div>
          <span class="meta">Totales acumulados desde los informes de partido</span>
        </div>
        <div class="table-panel">
          <div class="data-table-scroll">
            <table class="data-table player-statistics-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Titularidades</th>
                  <th>Jugados</th>
                  <th>Minutos</th>
                  <th>Goles</th>
                  <th>Asistencias de gol</th>
                  <th>Tiros a puerta</th>
                  <th>Pases de gol</th>
                  <th>Pases correctos</th>
                  <th>Pases fallados</th>
                  <th>Pérdidas</th>
                  <th>Recuperaciones</th>
                  <th>Amarillas</th>
                  <th>Rojas</th>
                </tr>
              </thead>
              <tbody>
                ${playerRows.map(renderPlayerStatisticsRow).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderTeamSummary(label, icon, value, details, featured = false) {
  return `
    <article class="team-summary-card ${featured ? "featured" : ""}">
      <div class="team-summary-title">
        <span class="team-summary-icon" aria-hidden="true">${icon}</span>
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="team-summary-content">
        ${featured ? `<strong class="team-summary-total">${value}</strong>` : ""}
        <div class="team-summary-details">
          ${details
            .map(
              ([number, text, badge]) => `
                <div>
                  <strong>${number}</strong>
                  <span>${escapeHtml(text)}</span>
                  ${badge ? `<i class="stat-color-badge ${badge}" aria-hidden="true"></i>` : ""}
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </article>
  `;
}

function renderRankingCard(ranking, playerRows) {
  const rows = playerRows
    .slice()
    .sort((a, b) => b[ranking.key] - a[ranking.key] || a.number - b.number)
    .slice(0, 5);
  const leader = rows[0];
  const photoStyle = leader?.photo ? `style="background-image:url('${escapeAttr(leader.photo)}')"` : "";

  return `
    <article class="ranking-card">
      <div class="ranking-hero">
        <span class="ranking-title">${escapeHtml(ranking.title)}</span>
        <div class="ranking-watermark">AC</div>
        ${
          leader
            ? `<div class="ranking-leader">
                <div class="ranking-player-photo" ${photoStyle}>${leader.photo ? "" : initials(leader.name)}</div>
                <div>
                  <strong>${escapeHtml(shortName(leader.name))}</strong>
                  <span>${leader[ranking.key]}${ranking.suffix}</span>
                </div>
              </div>`
            : ""
        }
      </div>
      <ol class="ranking-list">
        ${rows
          .map(
            (playerItem) => `
              <li>
                <span>${escapeHtml(playerItem.name)}</span>
                <strong>${playerItem[ranking.key]}${ranking.suffix}</strong>
              </li>
            `
          )
          .join("")}
      </ol>
    </article>
  `;
}

function renderPlayerStatisticsRow(item) {
  const photoStyle = item.photo ? `style="background-image:url('${escapeAttr(item.photo)}')"` : "";
  return `
    <tr>
      <td class="statistics-player-cell">
        <div class="statistics-player-photo" ${photoStyle}>${item.photo ? "" : initials(item.name)}</div>
        <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.position)}</span></div>
      </td>
      <td>${item.starts}</td>
      <td>${item.played}</td>
      <td>${item.minutes}</td>
      <td>${item.goals}</td>
      <td>${item.assists}</td>
      <td>${item.shotsOnTarget}</td>
      <td>${item.goalPasses}</td>
      <td>${item.completedPasses}</td>
      <td>${item.failedPasses}</td>
      <td>${item.losses}</td>
      <td>${item.recoveries}</td>
      <td>${item.yellowCards}</td>
      <td>${item.redCards}</td>
    </tr>
  `;
}

function normalizeLineupSheets(value, matchItem) {
  const normalizeRows = (rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({
      playerId: row?.playerId || "",
      name: row?.name || "",
      role: row?.role === "substitute" ? "substitute" : "starter",
      changeMinute: row?.changeMinute === "" || row?.changeMinute == null
        ? ""
        : clamp(nonNegativeInteger(row.changeMinute), 0, 130)
    }));
  if (value?.home || value?.away) {
    return {
      home: normalizeRows(value.home),
      away: normalizeRows(value.away)
    };
  }

  const ownRows = Object.keys(matchItem?.lineup || {})
    .filter((playerId) => !playerId.startsWith("__"))
    .map((playerId) => ({ playerId, name: "", role: "starter", changeMinute: "" }));
  return ownTeamSide(matchItem) === "away"
    ? { home: [], away: ownRows }
    : { home: ownRows, away: [] };
}

function ownTeamSide(item) {
  const selectedTeamName = teamName(item?.teamId);
  return item?.away === selectedTeamName ? "away" : "home";
}

function renderLineupEditor(item, body) {
  item.lineupSheets = normalizeLineupSheets(item.lineupSheets, item);
  body.innerHTML = `
    <div class="lineup-editor-grid">
      ${renderTeamLineupSheet(item, "home", item.home)}
      ${renderTeamLineupSheet(item, "away", item.away)}
    </div>
  `;

  body.querySelectorAll("[data-add-lineup-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const side = button.dataset.addLineupRow;
      const rows = item.lineupSheets[side];
      const ownSide = ownTeamSide(item);
      if (side === ownSide) {
        const used = new Set(rows.map((row) => row.playerId));
        const available = activePlayers().find((playerItem) => !used.has(playerItem.id));
        if (!available) return alert("No quedan jugadores disponibles para añadir.");
        rows.push({
          playerId: available.id,
          name: "",
          role: rows.filter((row) => row.role === "starter").length < 11 ? "starter" : "substitute",
          changeMinute: ""
        });
      } else {
        rows.push({
          playerId: "",
          name: "",
          role: rows.filter((row) => row.role === "starter").length < 11 ? "starter" : "substitute",
          changeMinute: ""
        });
      }
      syncLegacyLineup(item);
      saveMatchState(item);
      render();
    });
  });

  body.querySelectorAll("[data-lineup-player]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = item.lineupSheets[input.dataset.lineupSide][Number(input.dataset.lineupPlayer)];
      if (input.tagName === "SELECT") row.playerId = input.value;
      else row.name = input.value.trim();
      syncLegacyLineup(item);
      saveMatchState(item);
    });
  });

  body.querySelectorAll("[data-lineup-role]").forEach((select) => {
    select.addEventListener("change", () => {
      const side = select.dataset.lineupSide;
      const rowIndex = Number(select.dataset.lineupRole);
      const rows = item.lineupSheets[side];
      if (select.value === "starter" && rows.filter((row, index) => index !== rowIndex && row.role === "starter").length >= 11) {
        select.value = "substitute";
        alert("Solo puede haber 11 titulares por equipo.");
      }
      rows[rowIndex].role = select.value;
      syncLegacyLineup(item);
      saveMatchState(item);
      render();
    });
  });

  body.querySelectorAll("[data-lineup-minute]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = item.lineupSheets[input.dataset.lineupSide][Number(input.dataset.lineupMinute)];
      row.changeMinute = input.value === "" ? "" : clamp(nonNegativeInteger(input.value), 0, 130);
      saveMatchState(item);
    });
  });

  body.querySelectorAll("[data-remove-lineup-row]").forEach((button) => {
    button.addEventListener("click", () => {
      item.lineupSheets[button.dataset.lineupSide].splice(Number(button.dataset.removeLineupRow), 1);
      syncLegacyLineup(item);
      saveMatchState(item);
      render();
    });
  });
}

function renderTeamLineupSheet(item, side, name) {
  const rows = item.lineupSheets[side];
  const isOwnTeam = side === ownTeamSide(item);
  const starters = rows.filter((row) => row.role === "starter").length;
  return `
    <section class="panel lineup-sheet">
      <div class="lineup-sheet-heading">
        <div>
          <span class="eyebrow">${side === "home" ? "Equipo local" : "Equipo visitante"}</span>
          <h2>${escapeHtml(name)}</h2>
        </div>
        <span class="lineup-count ${starters === 11 ? "complete" : ""}">${starters}/11 titulares</span>
      </div>
      <div class="lineup-sheet-labels">
        <span>Jugador</span>
        <span>Condición</span>
        <span>Minuto cambio</span>
        <span></span>
      </div>
      <div class="lineup-sheet-rows">
        ${
          rows.length
            ? rows.map((row, index) => renderLineupSheetRow(row, index, side, isOwnTeam)).join("")
            : `<div class="empty-state">Todavía no hay jugadores añadidos.</div>`
        }
      </div>
      <button class="secondary-button" data-add-lineup-row="${side}" type="button">Añadir jugador</button>
    </section>
  `;
}

function renderLineupSheetRow(row, index, side, isOwnTeam) {
  const playerControl = isOwnTeam
    ? `<select data-lineup-player="${index}" data-lineup-side="${side}">
        ${activePlayers()
          .map((playerItem) => `<option value="${playerItem.id}" ${playerItem.id === row.playerId ? "selected" : ""}>${playerItem.number}. ${escapeHtml(playerItem.name)}</option>`)
          .join("")}
      </select>`
    : `<input data-lineup-player="${index}" data-lineup-side="${side}" value="${escapeAttr(row.name)}" maxlength="80" placeholder="Nombre del jugador" />`;
  return `
    <div class="lineup-sheet-row">
      ${playerControl}
      <select data-lineup-role="${index}" data-lineup-side="${side}">
        <option value="starter" ${row.role === "starter" ? "selected" : ""}>Titular</option>
        <option value="substitute" ${row.role === "substitute" ? "selected" : ""}>Suplente</option>
      </select>
      <input data-lineup-minute="${index}" data-lineup-side="${side}" type="number" min="0" max="130" value="${row.changeMinute}" placeholder="-" />
      <button class="icon-button" data-remove-lineup-row="${index}" data-lineup-side="${side}" type="button" aria-label="Quitar jugador">×</button>
    </div>
  `;
}

function syncLegacyLineup(item) {
  const ownRows = item.lineupSheets[ownTeamSide(item)] || [];
  const previous = item.lineup || {};
  item.lineup = {};
  ownRows.forEach((row, index) => {
    if (!row.playerId) return;
    item.lineup[row.playerId] = previous[row.playerId] || FORMATIONS[DEFAULT_FORMATION].slots[index % 11];
  });
}

function renderMatchInformation(item, body) {
  body.innerHTML = `
    <section class="panel match-information-panel">
      <div class="section-intro">
        <div>
          <p class="eyebrow">Apuntes del entrenador</p>
          <h2>Información del partido</h2>
        </div>
        <span class="meta">Los cambios se guardan automáticamente</span>
      </div>
      <label>
        Notas y observaciones
        <textarea id="match-notes" maxlength="12000" placeholder="Análisis del partido, incidencias, conclusiones y aspectos a mejorar...">${escapeHtml(item.notes || "")}</textarea>
      </label>
    </section>
  `;
  body.querySelector("#match-notes").addEventListener("input", (event) => {
    item.notes = event.target.value;
    saveMatchState(item);
  });
}

function renderMatchVideo(item, body) {
  const videoUrl = safeExternalUrl(item.videoUrl);
  const videoEmbedUrl = youtubeEmbedUrl(videoUrl);
  body.innerHTML = `
    <section class="panel match-information-panel">
      <div class="section-intro">
        <div>
          <p class="eyebrow">Contenido audiovisual</p>
          <h2>Vídeo del partido</h2>
          <p class="meta">Añade un enlace de YouTube para guardarlo y reproducirlo dentro de la ficha.</p>
        </div>
        <span class="meta">Los cambios se guardan automáticamente</span>
      </div>
      <div class="match-video-field">
        <label>
          Enlace del vídeo
          <input id="match-video-url" type="url" value="${escapeAttr(item.videoUrl || "")}" placeholder="https://www.youtube.com/watch?v=..." />
        </label>
        ${
          videoEmbedUrl
            ? `<div class="youtube-video"><iframe src="${escapeAttr(videoEmbedUrl)}" title="Vídeo del partido" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
            : videoUrl
              ? `<a class="secondary-button match-video-link" href="${escapeAttr(videoUrl)}" target="_blank" rel="noopener noreferrer">Abrir vídeo</a>`
              : ""
        }
      </div>
    </section>
  `;
  body.querySelector("#match-video-url").addEventListener("input", (event) => {
    item.videoUrl = event.target.value.trim();
    saveMatchState(item);
  });
  body.querySelector("#match-video-url").addEventListener("change", render);
}

function renderLineup(item, body) {
  const lineupIds = new Set(Object.keys(item.lineup || {}));
  const bench = activePlayers().filter((playerItem) => !lineupIds.has(playerItem.id));
  const selectedFormation = FORMATIONS[item.formation] ? item.formation : DEFAULT_FORMATION;

  body.innerHTML = `
    <div class="lineup-layout">
      <div class="panel">
        <div class="lineup-heading">
          <div>
            <h2>Campo</h2>
            <p class="meta">Elige un sistema y ajusta las posiciones arrastrando las fichas.</p>
          </div>
          <label class="formation-control">
            Sistema
            <select id="formation-selector">
              ${Object.entries(FORMATIONS)
                .map(([value, formation]) => `<option value="${value}" ${selectedFormation === value ? "selected" : ""}>${formation.label}</option>`)
                .join("")}
            </select>
          </label>
        </div>
        <div class="pitch" id="pitch">
          <div class="goal goal-top"></div>
          <div class="goal goal-bottom"></div>
          <div class="goal-area goal-area-top"></div>
          <div class="goal-area goal-area-bottom"></div>
          <div class="penalty-spot penalty-spot-top"></div>
          <div class="penalty-spot penalty-spot-bottom"></div>
          <div class="penalty-arc penalty-arc-top"></div>
          <div class="penalty-arc penalty-arc-bottom"></div>
          <div class="center-circle"></div>
          <div class="center-spot"></div>
          ${Object.entries(item.lineup || {})
            .map(([playerId, position]) => renderLineupToken(playerId, position))
            .join("")}
        </div>
      </div>
      <aside class="panel">
        <h2>Suplentes y no convocados</h2>
        <div class="bench-list">
          ${bench.length ? bench.map(renderBenchPlayer).join("") : `<div class="empty-state">Todos los jugadores están situados en el campo.</div>`}
        </div>
      </aside>
    </div>
  `;

  body.querySelector("#formation-selector").addEventListener("change", (event) => {
    applyFormation(item, event.target.value);
    saveMatchState(item);
    render();
  });

  const pitch = body.querySelector("#pitch");
  pitch.addEventListener("dragover", (event) => event.preventDefault());
  pitch.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggedPlayerId) return;
    const rect = pitch.getBoundingClientRect();
    const displayX = clamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95);
    const displayY = clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 93);
    const x = displayY;
    const y = 100 - displayX;
    item.lineup[draggedPlayerId] = { x, y };
    draggedPlayerId = null;
    saveMatchState(item);
    render();
  });

  body.querySelectorAll("[draggable='true']").forEach((node) => {
    node.addEventListener("dragstart", () => {
      draggedPlayerId = node.dataset.playerId;
    });
  });

  body.querySelectorAll("[data-remove-lineup]").forEach((button) => {
    button.addEventListener("click", () => {
      delete item.lineup[button.dataset.removeLineup];
      saveMatchState(item);
      render();
    });
  });

  body.querySelectorAll("[data-place-player]").forEach((button) => {
    button.addEventListener("click", () => {
      item.lineup[button.dataset.placePlayer] = nextLineupSlot(item);
      saveMatchState(item);
      render();
    });
  });
}

function renderLineupToken(playerId, position) {
  const item = activePlayers().find((playerItem) => playerItem.id === playerId);
  if (!item) return "";
  const displayX = 100 - position.y;
  const displayY = position.x;
  return `
    <div class="lineup-token" draggable="true" data-player-id="${item.id}" style="left:${displayX}%;top:${displayY}%">
      <span>${item.number}</span>
      <small>${escapeHtml(shortName(item.name))}</small>
      <button class="icon-button token-remove" data-remove-lineup="${item.id}" type="button" aria-label="Quitar de alineación">×</button>
    </div>
  `;
}

function renderBenchPlayer(item) {
  return `
    <div class="bench-player" draggable="true" data-player-id="${item.id}">
      <span class="number-badge">${item.number}</span>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <div class="meta">${escapeHtml(item.position)}</div>
      </div>
      <button class="secondary-button" data-place-player="${item.id}" type="button">Colocar</button>
    </div>
  `;
}

function renderPlan(item, body) {
  item.plan = normalizePlan(item.plan);
  body.innerHTML = `
    <div class="plan-grid">
      ${PLAN_SECTIONS.map(([type, title]) => renderPlanPanel(item, type, title)).join("")}
    </div>
  `;

  body.querySelectorAll("textarea").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      item.plan[`${textarea.dataset.planType}Text`] = textarea.value;
      saveState();
    });
  });

  body.querySelectorAll("[data-add-video]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".panel").querySelector("[data-video-url]");
      addVideo(item, button.dataset.addVideo, input.value.trim());
    });
  });

  body.querySelectorAll("[data-video-file]").forEach((input) => {
    input.addEventListener("change", () => addVideoFile(item, input.dataset.videoFile, input.files[0]));
  });

  body.querySelectorAll("[data-remove-video]").forEach((button) => {
    button.addEventListener("click", () => {
      const [type, index] = button.dataset.removeVideo.split(":");
      item.plan[`${type}Videos`].splice(Number(index), 1);
      saveState();
      render();
    });
  });
}

function renderPlanPanel(item, type, title) {
  const videos = item.plan[`${type}Videos`] || [];
  return `
    <section class="panel">
      <h2>${title}</h2>
      <label>
        Plan
        <textarea data-plan-type="${type}" placeholder="Escribe aquí las indicaciones de ${title.toLowerCase()}...">${escapeHtml(item.plan[`${type}Text`] || "")}</textarea>
      </label>
      <div class="video-row">
        <input data-video-url type="url" placeholder="URL de vídeo" />
        <button class="secondary-button" data-add-video="${type}" type="button">Añadir URL</button>
      </div>
      <label>
        Subir vídeo
        <input data-video-file="${type}" type="file" accept="video/*" />
      </label>
      <div class="video-list">
        ${videos.length ? videos.map((video, index) => renderVideoItem(video, type, index)).join("") : `<div class="empty-state">Sin vídeos añadidos.</div>`}
      </div>
    </section>
  `;
}

function renderVideoItem(video, type, index) {
  const label = video.name || video.url;
  const link = video.url ? `<a href="${escapeAttr(video.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>` : `<strong>${escapeHtml(label)}</strong>`;
  return `
    <div class="video-item">
      ${link}
      <button class="icon-button" data-remove-video="${type}:${index}" type="button" aria-label="Eliminar vídeo">×</button>
    </div>
  `;
}

function addVideo(item, type, url) {
  if (!url) return;
  item.plan[`${type}Videos`].push({ type: "url", url, name: url });
  saveState();
  render();
}

function addVideoFile(item, type, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      item.plan[`${type}Videos`].push({
        type: "file",
        name: file.name,
        url: reader.result
      });
      saveState();
      render();
    } catch {
      alert("El vídeo es demasiado grande para guardarlo en este navegador. Prueba con una URL o un archivo más pequeño.");
    }
  });
  reader.readAsDataURL(file);
}

function openPlayerDialog(id) {
  const item = state.players.find((playerItem) => playerItem.id === id);
  playerFormSaveStatus.textContent = item ? "Los cambios se guardan automáticamente" : "Pulsa Guardar para crear el jugador";
  playerFormSaveStatus.classList.remove("saved");
  document.querySelector("#player-modal-title").textContent = item ? "Editar jugador" : "Nuevo jugador";
  deletePlayerModalButton.style.display = item ? "inline-flex" : "none";
  document.querySelector("#player-id").value = item?.id || "";
  document.querySelector("#player-name").value = item?.name || "";
  document.querySelector("#player-number").value = item?.number || "";
  document.querySelector("#player-birthdate").value = item?.birthdate || "";
  document.querySelector("#player-position").value = item?.position || "Defensa";
  document.querySelector("#player-laterality").value = item?.laterality || "Diestro";
  playerPhotoInput.value = item?.photo || "";
  playerPhotoFileInput.value = "";
  updatePhotoPreview(item?.photo || "");
  playerDialog.showModal();
}

function openMatchDialog(id, returnToPlayerReports = false) {
  returnToPlayerReportsAfterMatchSave = returnToPlayerReports;
  const item = state.matches.find((matchItem) => matchItem.id === id);
  document.querySelector("#match-modal-title").textContent = item ? "Editar partido" : "Nuevo partido";
  document.querySelector("#match-id").value = item?.id || "";
  document.querySelector("#match-competition").value = item?.competition || "league";
  document.querySelector("#match-round").value = item?.round || nextRound();
  document.querySelector("#match-date").value = item?.date || "";
  document.querySelector("#match-time").value = item?.time || "";
  document.querySelector("#match-home").value = item?.home || currentTeam().name;
  document.querySelector("#match-away").value = item?.away || "";
  document.querySelector("#match-status").value = item?.status || "Preparación";
  document.querySelector("#match-score").value = item?.score || "";
  const teamStats = normalizeTeamMatchStats(item?.teamStats);
  document.querySelector("#match-yellow-cards").value = teamStats.yellowCards;
  document.querySelector("#match-red-cards").value = teamStats.redCards;
  document.querySelector("#match-penalties-for").value = teamStats.penaltiesFor;
  document.querySelector("#match-penalties-against").value = teamStats.penaltiesAgainst;
  document.querySelector("#match-chances-created").value = teamStats.chancesCreated;
  document.querySelector("#match-chances-against").value = teamStats.chancesAgainst;
  updateMatchRoundVisibility();
  matchDialog.showModal();
}

function deletePlayer(id) {
  const item = state.players.find((playerItem) => playerItem.id === id);
  if (!item || !confirm(`¿Eliminar a ${item.name}?`)) return;
  state.players = state.players.filter((playerItem) => playerItem.id !== id);
  activeMatches().forEach((matchItem) => {
    delete matchItem.lineup[id];
    if (matchItem.lineupSheets) {
      const side = ownTeamSide(matchItem);
      matchItem.lineupSheets[side] = matchItem.lineupSheets[side].filter((row) => row.playerId !== id);
    }
  });
  saveState();
  if (activeSeason === LEGACY_SEASON) supabaseDelete("players", "id", id);
  render();
}

function deleteMatch(id) {
  const item = state.matches.find((matchItem) => matchItem.id === id);
  if (!item || !confirm(`¿Eliminar la jornada ${item.round}?`)) return;
  state.matches = state.matches.filter((matchItem) => matchItem.id !== id);
  state.selectedMatchId = activeMatches()[0]?.id || "";
  saveState();
  if (activeSeason === LEGACY_SEASON) supabaseDelete("matches", "id", id);
  render();
}

function selectedMatch() {
  const item = activeMatches().find((matchItem) => matchItem.id === state.selectedMatchId) || activeMatches()[0];
  if (item) state.selectedMatchId = item.id;
  return item;
}

function nextRound() {
  return Math.max(0, ...activeMatches().map((item) => item.round)) + 1;
}

function updatePhotoPreview(photo) {
  playerPhotoPreview.classList.toggle("has-photo", Boolean(photo));
  playerPhotoPreview.style.backgroundImage = photo ? `url("${photo}")` : "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function safeFileName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "foto-jugador";
}

function encodeStoragePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function nextLineupSlot(item) {
  const slots = FORMATIONS[item.formation]?.slots || FORMATIONS[DEFAULT_FORMATION].slots;
  const used = Object.keys(item.lineup || {}).length;
  return slots[used % slots.length];
}

function formationSlots(lines, yPositions) {
  return lines.flatMap((count, lineIndex) => {
    if (count === 1) return [{ x: 50, y: yPositions[lineIndex] }];
    const sideMargin = count >= 5 ? 10 : count === 4 ? 14 : 22;
    const step = (100 - sideMargin * 2) / (count - 1);
    return Array.from({ length: count }, (_, index) => ({
      x: sideMargin + step * index,
      y: yPositions[lineIndex]
    }));
  });
}

function applyFormation(item, formationId) {
  const formation = FORMATIONS[formationId];
  if (!formation) return;

  const playerIds = Object.entries(item.lineup || {})
    .sort(([, first], [, second]) => second.y - first.y || first.x - second.x)
    .map(([playerId]) => playerId)
    .slice(0, formation.slots.length);

  item.formation = formationId;
  playerIds.forEach((playerId, index) => {
    item.lineup[playerId] = { ...formation.slots[index] };
  });
}

function playerRatingLabels() {
  return {
    technical: "Técnica",
    tactical: "Táctica",
    conditional: "Condicional",
    cognitive: "Cognitiva"
  };
}

function defaultPlayerRatings() {
  return Object.fromEntries(Object.keys(playerRatingLabels()).map((key) => [key, 0]));
}

function normalizePlayerRatings(ratings) {
  return Object.fromEntries(
    Object.keys(playerRatingLabels()).map((key) => [
      key,
      clamp(Number(ratings?.[key]) || 0, 0, 10)
    ])
  );
}

function formatRating(value) {
  const rating = Number(value) || 0;
  return rating ? `${rating.toLocaleString("es-ES")} / 10` : "Sin valorar";
}

function normalizePlayerReports(reports) {
  return Object.fromEntries(
    Object.entries(reports || {}).map(([matchId, value]) => {
      if (typeof value === "string") {
        return [matchId, { ...emptyPlayerReport(), text: value }];
      }
      return [
        matchId,
        {
          ...emptyPlayerReport(),
          text: value?.text || "",
          rating: clamp(Number(value?.rating) || 0, 0, 10),
          yellowCards: normalizeCardCount(value?.yellowCards ?? value?.yellowCard, 2),
          redCards: normalizeCardCount(value?.redCards ?? value?.redCard, 1),
          minutes: clamp(Number(value?.minutes) || 0, 0, 130),
          youtube: value?.youtube || "",
          completedPasses: nonNegativeInteger(value?.completedPasses),
          failedPasses: nonNegativeInteger(value?.failedPasses),
          losses: nonNegativeInteger(value?.losses),
          recoveries: nonNegativeInteger(value?.recoveries),
          goals: nonNegativeInteger(value?.goals),
          assists: nonNegativeInteger(value?.assists),
          shotsOnTarget: nonNegativeInteger(value?.shotsOnTarget),
          goalPasses: nonNegativeInteger(value?.goalPasses)
        }
      ];
    })
  );
}

function emptyPlayerReport() {
  return {
    text: "",
    rating: 0,
    yellowCards: 0,
    redCards: 0,
    minutes: 0,
    youtube: "",
    completedPasses: 0,
    failedPasses: 0,
    losses: 0,
    recoveries: 0,
    goals: 0,
    assists: 0,
    shotsOnTarget: 0,
    goalPasses: 0
  };
}

function emptyTeamMatchStats() {
  return {
    yellowCards: 0,
    redCards: 0,
    penaltiesFor: 0,
    penaltiesAgainst: 0,
    chancesCreated: 0,
    chancesAgainst: 0
  };
}

function normalizeTeamMatchStats(value) {
  return {
    yellowCards: nonNegativeInteger(value?.yellowCards),
    redCards: nonNegativeInteger(value?.redCards),
    penaltiesFor: nonNegativeInteger(value?.penaltiesFor),
    penaltiesAgainst: nonNegativeInteger(value?.penaltiesAgainst),
    chancesCreated: nonNegativeInteger(value?.chancesCreated ?? value?.foulsCommitted),
    chancesAgainst: nonNegativeInteger(value?.chancesAgainst ?? value?.foulsReceived)
  };
}

function calculateTeamMatchStats() {
  const totals = activeMatches().reduce(
    (totals, item) => {
      const stats = normalizeTeamMatchStats(item.teamStats);
      ["penaltiesFor", "penaltiesAgainst", "chancesCreated", "chancesAgainst"].forEach((key) => {
        totals[key] += stats[key];
      });
      return totals;
    },
    emptyTeamMatchStats()
  );
  activePlayers().forEach((item) => {
    const playerTotals = playerReportTotals(item);
    totals.yellowCards += playerTotals.yellowCards;
    totals.redCards += playerTotals.redCards;
  });
  return totals;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function normalizeCardCount(value, maximum) {
  if (value === true) return 1;
  return clamp(nonNegativeInteger(value), 0, maximum);
}

function playerReport(item, matchId) {
  const value = item.reports?.[matchId];
  if (typeof value === "string") return { ...emptyPlayerReport(), text: value };
  return {
    ...emptyPlayerReport(),
    text: value?.text || "",
    rating: clamp(Number(value?.rating) || 0, 0, 10),
    yellowCards: normalizeCardCount(value?.yellowCards ?? value?.yellowCard, 2),
    redCards: normalizeCardCount(value?.redCards ?? value?.redCard, 1),
    minutes: clamp(Number(value?.minutes) || 0, 0, 130),
    youtube: value?.youtube || "",
    completedPasses: nonNegativeInteger(value?.completedPasses),
    failedPasses: nonNegativeInteger(value?.failedPasses),
    losses: nonNegativeInteger(value?.losses),
    recoveries: nonNegativeInteger(value?.recoveries),
    goals: nonNegativeInteger(value?.goals),
    assists: nonNegativeInteger(value?.assists),
    shotsOnTarget: nonNegativeInteger(value?.shotsOnTarget),
    goalPasses: nonNegativeInteger(value?.goalPasses)
  };
}

function ensurePlayerReport(item, matchId) {
  item.reports = normalizePlayerReports(item.reports);
  item.reports[matchId] ||= emptyPlayerReport();
  return item.reports[matchId];
}

function playerMinutesPlayed(item) {
  return playerReportTotals(item).minutes;
}

function playerReportTotals(item) {
  const keys = ["minutes", "completedPasses", "failedPasses", "losses", "recoveries", "goals", "assists", "shotsOnTarget", "goalPasses", "yellowCards", "redCards"];
  return activeMatches().reduce(
    (totals, matchItem) => {
      const report = playerReport(item, matchItem.id);
      keys.forEach((key) => {
        totals[key] += report[key];
      });
      return totals;
    },
    Object.fromEntries(keys.map((key) => [key, 0]))
  );
}

function playerReportHasData(report) {
  return Boolean(
    report.text.trim() ||
      report.rating ||
      report.yellowCards ||
      report.redCards ||
      report.youtube ||
      report.minutes ||
      report.completedPasses ||
      report.failedPasses ||
      report.losses ||
      report.recoveries ||
      report.goals ||
      report.assists ||
      report.shotsOnTarget ||
      report.goalPasses
  );
}

function youtubeEmbedUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      else videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || "";
    }
    return /^[a-zA-Z0-9_-]{6,}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : "";
  } catch {
    return "";
  }
}

function safeExternalUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

async function downloadPlayerPdf(item) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    alert("El navegador ha bloqueado la ventana del PDF. Permite ventanas emergentes y vuelve a intentarlo.");
    return;
  }
  popup.document.write("<p style=\"font:16px Arial;padding:24px\">Preparando la ficha y cargando la fotografía...</p>");

  const printableTeamName = playerTeamName(item);
  const appearances = activeMatches().filter((matchItem) => playerParticipatedInMatch(item, matchItem));
  const totals = playerReportTotals(item);
  const reports = activeMatches()
    .slice()
    .sort((a, b) => a.round - b.round)
    .map((matchItem) => ({ match: matchItem, report: playerReport(item, matchItem.id) }))
    .filter(({ report }) => playerReportHasData(report));
  const printablePhoto = await imageToDataUrl(item.photo);

  popup.document.open();
  popup.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Ficha de ${escapeHtml(item.name)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #20242a; font: 12px Arial, sans-serif; }
          header { display: grid; grid-template-columns: 120px 1fr; gap: 20px; padding-bottom: 18px; border-bottom: 3px solid #b7192b; }
          .photo { width: 120px; height: 150px; display: grid; place-items: center; overflow: hidden; color: white; background: #b7192b; font-size: 30px; font-weight: bold; }
          .photo img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; }
          h1 { margin: 0 0 5px; font-size: 27px; }
          h2 { margin: 22px 0 10px; color: #861424; font-size: 17px; }
          .meta { color: #6a717c; }
          .info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 14px; }
          .info div, .metric { padding: 9px; background: #f1f3f5; }
          .info span, .metric span { display: block; color: #6a717c; font-size: 9px; text-transform: uppercase; }
          .info strong, .metric strong { display: block; margin-top: 3px; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .report-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 8px; }
          .report-stats div { padding: 6px; background: #f1f3f5; }
          .report-stats span { display: block; color: #6a717c; font-size: 8px; text-transform: uppercase; }
          .report-stats strong { display: block; margin-top: 2px; }
          .ratings { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .rating { padding: 10px; border: 1px solid #dde1e7; }
          .rating span { display: block; color: #6a717c; font-size: 9px; text-transform: uppercase; }
          .rating strong { display: block; margin-top: 4px; font-size: 16px; }
          .rating-bar { height: 5px; margin-top: 7px; background: #e3e6e9; }
          .rating-bar i { display: block; height: 100%; background: #b7192b; }
          .description { white-space: pre-wrap; line-height: 1.5; }
          .report { break-inside: avoid; margin-bottom: 10px; padding: 10px; border: 1px solid #dde1e7; }
          .report h3 { margin: 0 0 5px; }
          .report p { margin: 6px 0 0; white-space: pre-wrap; line-height: 1.45; }
          a { color: #125bd8; overflow-wrap: anywhere; }
        </style>
      </head>
      <body>
        <header>
          <div class="photo">${printablePhoto ? `<img src="${escapeAttr(printablePhoto)}" alt="Foto de ${escapeAttr(item.name)}" />` : initials(item.name)}</div>
          <div>
            <div class="meta">${escapeHtml(printableTeamName.toUpperCase())} · FICHA TÉCNICA</div>
            <h1>${escapeHtml(item.name)}</h1>
            <div class="info">
              ${renderPdfInfo("Fecha de nacimiento", formatDate(item.birthdate))}
              ${renderPdfInfo("Edad", `${calculateAge(item.birthdate)} años`)}
              ${renderPdfInfo("Posición", item.position)}
              ${renderPdfInfo("Lateralidad", item.laterality || "Diestro")}
              ${renderPdfInfo("Dorsal", item.number)}
              ${renderPdfInfo("Temporada", "2026")}
            </div>
          </div>
        </header>
        <h2>Descripción</h2>
        <div class="description">${escapeHtml(item.description || "Sin descripción.")}</div>
        <h2>Valoración</h2>
        <div class="ratings">
          ${Object.entries(playerRatingLabels())
            .map(([key, label]) => renderPdfRating(label, normalizePlayerRatings(item.ratings)[key]))
            .join("")}
        </div>
        <h2>Estadísticas</h2>
        <div class="metrics">
          ${renderPdfMetric("Alineaciones", appearances.length)}
          ${renderPdfMetric("Partidos jugados", appearances.filter((matchItem) => parseScore(matchItem.score)).length)}
          ${renderPdfMetric("Minutos jugados", totals.minutes)}
          ${renderPdfMetric("Goles", totals.goals)}
          ${renderPdfMetric("Asistencias de gol", totals.assists)}
          ${renderPdfMetric("Tiros a puerta", totals.shotsOnTarget)}
          ${renderPdfMetric("Pases de gol", totals.goalPasses)}
          ${renderPdfMetric("Pases correctos", totals.completedPasses)}
          ${renderPdfMetric("Pases fallados", totals.failedPasses)}
          ${renderPdfMetric("Pérdidas", totals.losses)}
          ${renderPdfMetric("Recuperaciones", totals.recoveries)}
          ${renderPdfMetric("Tarjetas amarillas", totals.yellowCards)}
          ${renderPdfMetric("Tarjetas rojas", totals.redCards)}
        </div>
        <h2>Trayectoria</h2>
        <div class="description">${escapeHtml(item.career || `${printableTeamName} · Temporada 2026`)}</div>
        <h2>Informes de partido</h2>
        ${
          reports.length
            ? reports
                .map(
                  ({ match, report }) => `
                    <article class="report">
                      <h3>Jornada ${match.round}: ${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</h3>
                      <div class="meta">${match.date ? formatDate(match.date) : "Fecha pendiente"} · ${report.minutes} minutos · Valoración ${report.rating ? `${report.rating} / 10` : "Sin valorar"}</div>
                      <div class="report-stats">
                        ${renderPdfReportStat("Pases correctos", report.completedPasses)}
                        ${renderPdfReportStat("Pases fallados", report.failedPasses)}
                        ${renderPdfReportStat("Pérdidas", report.losses)}
                        ${renderPdfReportStat("Recuperaciones", report.recoveries)}
                        ${renderPdfReportStat("Goles", report.goals)}
                        ${renderPdfReportStat("Asistencias de gol", report.assists)}
                        ${renderPdfReportStat("Tiros a puerta", report.shotsOnTarget)}
                        ${renderPdfReportStat("Pases de gol", report.goalPasses)}
                        ${renderPdfReportStat("Tarjetas amarillas", report.yellowCards)}
                        ${renderPdfReportStat("Tarjetas rojas", report.redCards)}
                      </div>
                      ${report.text ? `<p>${escapeHtml(report.text)}</p>` : ""}
                      ${report.youtube ? `<p><a href="${escapeAttr(report.youtube)}">${escapeHtml(report.youtube)}</a></p>` : ""}
                    </article>
                  `
                )
                .join("")
            : "<p>Sin informes registrados.</p>"
        }
        <script>
          window.addEventListener("load", async () => {
            const images = Array.from(document.images);
            await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            })));
            setTimeout(() => window.print(), 250);
          });
        <\/script>
      </body>
    </html>
  `);
  popup.document.close();
}

async function imageToDataUrl(value) {
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  try {
    const response = await fetch(value, { cache: "force-cache" });
    if (!response.ok) throw new Error(`No se pudo cargar la foto: ${response.status}`);
    const blob = await response.blob();
    return await readFileAsDataUrl(blob);
  } catch (error) {
    console.error(error);
    return value;
  }
}

function renderPdfInfo(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderPdfMetric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderPdfRating(label, value) {
  return `
    <div class="rating">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatRating(value))}</strong>
      <div class="rating-bar"><i style="width:${value * 10}%"></i></div>
    </div>
  `;
}

function renderPdfReportStat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function parsedMatches() {
  return activeMatches().flatMap((item) => {
    const score = parseScore(item.score);
    return score ? [{ ...item, homeGoals: score.home, awayGoals: score.away }] : [];
  });
}

function parseScore(value) {
  const match = String(value || "").trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function buildStandings() {
  const teams = new Map();
  const getTeam = (name) => {
    if (!teams.has(name)) {
      teams.set(name, {
        name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      });
    }
    return teams.get(name);
  };

  parsedMatches().forEach((item) => {
    const home = getTeam(item.home);
    const away = getTeam(item.away);
    home.played += 1;
    away.played += 1;
    home.goalsFor += item.homeGoals;
    home.goalsAgainst += item.awayGoals;
    away.goalsFor += item.awayGoals;
    away.goalsAgainst += item.homeGoals;

    if (item.homeGoals > item.awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (item.homeGoals < item.awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return [...teams.values()]
    .map((team) => ({ ...team, goalDifference: team.goalsFor - team.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name, "es")
    );
}

function calculateTeamStats(matches) {
  const selectedTeamName = currentTeam().name;
  const stats = {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0
  };

  matches.forEach((item) => {
    const isHome = item.home === selectedTeamName;
    const isAway = item.away === selectedTeamName;
    if (!isHome && !isAway) return;
    const goalsFor = isHome ? item.homeGoals : item.awayGoals;
    const goalsAgainst = isHome ? item.awayGoals : item.homeGoals;
    stats.played += 1;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) {
      stats.won += 1;
      stats.points += 3;
    } else if (goalsFor < goalsAgainst) {
      stats.lost += 1;
    } else {
      stats.drawn += 1;
      stats.points += 1;
    }
  });

  return stats;
}

function buildPlayerStatistics() {
  const matches = activeMatches();
  const matchIds = new Set(matches.map((item) => item.id));
  const totalMatches = matches.length;
  return activePlayers()
    .map((item) => {
      const appearances = matches.filter((matchItem) => playerParticipatedInMatch(item, matchItem));
      const starts = matches.filter((matchItem) => playerStartedMatch(item, matchItem)).length;
      const played = appearances.length;
      const totals = playerReportTotals(item);
      return {
        id: item.id,
        name: item.name,
        number: item.number,
        position: item.position,
        photo: item.photo || "",
        appearances: appearances.length,
        starts,
        played,
        participation: totalMatches ? Math.round((appearances.length / totalMatches) * 100) : 0,
        ...totals,
        reports: Object.keys(item.reports || {}).filter((matchId) => {
          if (!matchIds.has(matchId)) return false;
          const report = playerReport(item, matchId);
          return playerReportHasData(report);
        }).length
      };
    })
    .sort((a, b) => b.starts - a.starts || b.appearances - a.appearances || a.number - b.number);
}

function countPlayersByPosition() {
  const positions = ["Portero", "Defensa", "Centrocampista", "Delantero"];
  return Object.fromEntries(
    positions.map((position) => [
      position,
      activePlayers().filter((playerItem) => playerItem.position === position).length
    ])
  );
}

function renderMetric(label, value) {
  return `
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function formatGoalDifference(value) {
  return value > 0 ? `+${value}` : String(value);
}

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function shortName(name) {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function calculateAge(value) {
  if (!value) return 0;
  const birthdate = new Date(`${value}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const birthdayPending =
    today.getMonth() < birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate());
  if (birthdayPending) age -= 1;
  return age;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
