// La Quiniela del Ferre. Página aparte de la app: usa la misma base de datos (Supabase) y la misma
// sesión que la app, así que el administrador o el coordinador que haya entrado en la app la gestiona aquí.
// Todo pasa por las funciones de supabase-quiniela.sql: el público nunca ve los emails.
(() => {
  const SUPABASE_URL = "https://vhmnyjmhnobqmxgulsag.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobW55am1obm9icW14Z3Vsc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzEyNTMsImV4cCI6MjA5NjI0NzI1M30.Li4R65j3sGHSrIdt7tiubHNDgKrzjXDqcT92BCqZfDA";
  const AUTH_SESSION_KEY = "ce-ferreries-auth-session";
  const LOCS_KEY = "quiniela-ferre-localizadores";
  const SIGNS = ["1", "X", "2"];
  const TEAM_RELEVANCE = ["regional", "juvenil-nacional", "juvenil-b", "cadete", "infantil", "alevin-a", "alevin-b", "benjamin-a", "benjamin-b", "prebenjamin"];

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- Sesión (la misma que la app) ----------
  let session = null;
  try { session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)); } catch { session = null; }
  if (!session?.access_token) session = null;
  let refreshing = null;

  async function refreshSession() {
    if (!session?.refresh_token) return;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const stored = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
        if (stored?.access_token && Number(stored.expires_at || 0) > Number(session.expires_at || 0)) {
          session = stored;
          if (Number(stored.expires_at) * 1000 - Date.now() > 60_000) return;
        }
      } catch { /* sigue */ }
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) { session = null; localStorage.removeItem(AUTH_SESSION_KEY); }
          return;
        }
        const data = await res.json();
        if (data.access_token) { session = data; localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data)); }
      } catch { /* sin conexión */ }
    })();
    try { await refreshing; } finally { refreshing = null; }
  }

  async function accessToken() {
    if (!session?.access_token) return SUPABASE_ANON_KEY;
    const exp = session.expires_at ? Number(session.expires_at) * 1000 : Infinity;
    if (exp - Date.now() < 60_000) await refreshSession();
    return session?.access_token || SUPABASE_ANON_KEY;
  }

  async function rpc(name, args = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
    const text = await res.text();
    if (!res.ok) {
      let message = "No se ha podido conectar. Prueba otra vez en un momento.";
      try { const e = JSON.parse(text); if (e.message && !/^(permission denied|function|Could not find)/i.test(e.message)) message = e.message; } catch { /* genérico */ }
      throw new Error(message);
    }
    return text ? JSON.parse(text) : null;
  }

  // ---------- Utilidades ----------
  const fmtDateTime = (iso) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const fmtDay = (iso) => new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`)).replace(/\./g, "");
  const pad = (n) => String(n).padStart(2, "0");
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDay(d); };
  const toLocalInput = (iso) => { const d = new Date(iso); return `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const norm = (v) => String(v || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const titleCase = (name) => String(name || "").toLocaleLowerCase("es").replace(/(^|[\s(.-])(\S)/g, (m, s, c) => s + c.toLocaleUpperCase("es"))
    .replace(/\b(Cd|Ce|Cf|Ud|Sd|Fc|Rcd)\b/g, (w) => w.toUpperCase());
  const prettyName = (name) => titleCase(String(name || "").replace(/"/g, " ").replace(/\s+/g, " ").trim())
    .replace(/(?<=\s)(De|Del)(?=\s)/g, (w) => w.toLocaleLowerCase("es")).replace(/\s([a-z])$/, (m, l) => ` ${l.toUpperCase()}`);
  const shortTeam = (name) => String(name || "").replace(/^C\.?\s?E\.?\s+Ferreries\s+/i, "").trim() || String(name || "");
  function teamRelevance(team) {
    const v = norm(`${team.id} ${team.name}`);
    const cat = v.includes("regional") ? "regional"
      : v.includes("juvenil") && v.includes("nacional") ? "juvenil-nacional"
      : v.includes("juvenil") && /\bb\b/.test(v) ? "juvenil-b"
      : v.includes("cadete") ? "cadete"
      : v.includes("infantil") ? "infantil"
      : v.includes("alevin") && /\ba\b/.test(v) ? "alevin-a"
      : v.includes("alevin") && /\bb\b/.test(v) ? "alevin-b"
      : v.includes("prebenjamin") ? "prebenjamin"
      : v.includes("benjamin") && /\ba\b/.test(v) ? "benjamin-a"
      : v.includes("benjamin") && /\bb\b/.test(v) ? "benjamin-b" : "";
    const i = TEAM_RELEVANCE.indexOf(cat);
    return i === -1 ? TEAM_RELEVANCE.length : i;
  }
  const signOf = (h, a) => (h > a ? "1" : h < a ? "2" : "X");
  const msg = (el, text, ok = false) => { $(el).innerHTML = text ? `<div class="q-msg${ok ? " ok" : ""}">${text}</div>` : ""; };
  const loadLocs = () => { try { return JSON.parse(localStorage.getItem(LOCS_KEY)) || {}; } catch { return {}; } };
  const saveLoc = (jid, loc) => { try { const l = loadLocs(); l[jid] = loc; localStorage.setItem(LOCS_KEY, JSON.stringify(l)); } catch { /* opcional */ } };
  // Doble pulsación para lo que no se puede deshacer (sin ventanas emergentes)
  function armed(button, label, action) {
    if (button.dataset.armed === "1") { button.dataset.armed = ""; button.textContent = button.dataset.label; action(); return; }
    button.dataset.label = button.textContent; button.dataset.armed = "1"; button.textContent = label;
    setTimeout(() => { if (button.dataset.armed === "1") { button.dataset.armed = ""; button.textContent = button.dataset.label; } }, 4000);
  }

  // ---------- Estado ----------
  let pub = null;          // respuesta de quiniela_publica
  let picks = {};          // pronóstico que se está rellenando
  let editingLoc = null;   // localizador si se está cambiando una quiniela
  let viewing = null;      // quiniela abierta con el localizador (para ver aciertos)
  const J = () => pub?.jornada || null;

  async function loadPublic(jornadaId = null) {
    try {
      pub = await rpc("quiniela_publica", { p_jornada: jornadaId });
      $("q-error").hidden = true;
    } catch (error) {
      $("q-error").textContent = error.message;
      $("q-error").hidden = false;
      $("q-jornada-info").textContent = "No se ha podido cargar la quiniela.";
    }
    renderAll();
  }

  // ---------- Cabecera ----------
  function renderHero() {
    const j = J();
    $("q-tab-club").hidden = !pub?.gestor;
    if (!j) {
      $("q-jornada-info").textContent = pub ? "Todavía no hay ninguna jornada abierta." : $("q-jornada-info").textContent;
      $("q-sponsor").hidden = true;
      return;
    }
    $("q-jornada-info").textContent = j.cerrada
      ? `${j.nombre} · cerrada`
      : `${j.nombre} · se puede rellenar hasta el ${fmtDateTime(j.cierre)}`;
    const sp = j.patrocinador || {};
    $("q-sponsor").hidden = !sp.nombre && !sp.premio;
    $("q-sponsor-name").textContent = sp.nombre ? `Patrocinada por ${sp.nombre}` : "Patrocinador por confirmar";
    $("q-sponsor-prize").textContent = sp.premio ? `Premio: ${sp.premio}` : "";
    const logo = $("q-sponsor-logo");
    logo.textContent = "";
    if (/^data:image\//.test(sp.logo || "")) { const img = new Image(); img.src = sp.logo; img.alt = `Logo de ${sp.nombre || "el patrocinador"}`; logo.appendChild(img); }
    else logo.textContent = "🏆";
    const link = $("q-sponsor-link");
    link.textContent = "";
    if (/^https:\/\//i.test(sp.enlace || "")) {
      const a = document.createElement("a");
      a.href = sp.enlace; a.target = "_blank"; a.rel = "noopener";
      a.textContent = `Ver ${sp.nombre || "patrocinador"} →`;
      link.appendChild(a);
    }
  }

  // ---------- Jugar ----------
  function matchLabel(p) {
    const when = p.fecha ? `${fmtDay(p.fecha)}${p.hora ? ` · ${p.hora}` : ""}` : "";
    return `<strong>${esc(p.local)} – ${esc(p.visitante)}</strong><small>${esc([p.equipo, when].filter(Boolean).join(" · "))}</small>`;
  }

  function slipRows(j, sel, attr, opts = {}) {
    return j.partidos.map((p, i) => {
      const r = j.resultados?.[p.id];
      const choices = opts.withSusp ? [...SIGNS, "S"] : SIGNS;
      return `<div class="q-row"><span class="q-n">${i + 1}</span><div class="q-m">${matchLabel(p)}${opts.showResult && r ? `<small>Resultado: ${r === "S" ? "suspendido" : esc(r)}</small>` : ""}</div>
        <div class="q-p" role="group" aria-label="Partido ${i + 1}">${choices.map((s) => {
          const on = sel[p.id] === s;
          const cls = [on ? "on" : "", s === "S" ? "wide susp" : "", opts.showResult && on && r && r !== "S" ? (r === s ? "hit" : "miss") : ""].join(" ").trim();
          return `<button type="button" data-${attr}="${esc(p.id)}" data-s="${s}" class="${cls}" aria-pressed="${on}" ${opts.disabled ? "disabled" : ""}>${s === "S" ? "Susp." : s}</button>`;
        }).join("")}</div></div>`;
    }).join("");
  }

  function renderPlay() {
    const j = J();
    $("q-empty").hidden = Boolean(j);
    const open = j && !j.cerrada;
    $("q-closed").hidden = !j || open || Boolean(viewing);
    $("q-form").hidden = !j || (!open && !viewing);
    if (!j) return;
    const readOnly = !open;
    const sel = readOnly && viewing ? viewing.picks : picks;
    $("q-slip-title").textContent = readOnly ? `Quiniela de ${viewing?.alias || ""}` : `Marca 1, X o 2 en los ${j.partidos.length} partidos`;
    $("q-rows").innerHTML = slipRows(j, sel, "pk", { disabled: readOnly, showResult: readOnly });
    const first = j.partidos[0];
    $("q-first").textContent = first ? `${first.local} – ${first.visitante}` : "";
    ["q-alias", "q-email", "q-ok", "q-ex1", "q-ex2"].forEach((id) => { $(id).disabled = readOnly; });
    $("q-send").hidden = readOnly;
    $("q-send").textContent = editingLoc ? "Guardar cambios" : "Enviar quiniela";
    $("q-cancel-edit").hidden = !editingLoc;
    const n = j.partidos.filter((p) => picks[p.id]).length;
    $("q-count").textContent = readOnly ? "" : `${n} de ${j.partidos.length} partidos marcados`;
    $("q-email").placeholder = editingLoc && viewing ? `Déjalo vacío para mantener ${viewing.email}` : "";
    const saved = loadLocs()[j.id];
    if (saved && !$("q-loc").value) $("q-loc").value = saved;
  }

  $("q-rows").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-pk]");
    if (!b || J()?.cerrada) return;
    picks[b.dataset.pk] = picks[b.dataset.pk] === b.dataset.s ? undefined : b.dataset.s;
    renderPlay();
  });

  function resetForm() {
    picks = {}; editingLoc = null; viewing = null;
    $("q-form").reset();
    msg("q-form-msg", "");
    renderPlay();
  }
  $("q-cancel-edit").addEventListener("click", () => { resetForm(); msg("q-loc-msg", ""); });

  $("q-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const j = J();
    if (!j || j.cerrada) return;
    const alias = $("q-alias").value.trim();
    const email = $("q-email").value.trim();
    const x1 = $("q-ex1").value, x2 = $("q-ex2").value;
    if (j.partidos.some((p) => !picks[p.id])) return msg("q-form-msg", "Faltan partidos por marcar.");
    if (x1 === "" || x2 === "") return msg("q-form-msg", "Pon el resultado exacto del primer partido: sirve para desempatar.");
    if (alias.length < 2) return msg("q-form-msg", "Escribe un alias de al menos 2 letras.");
    if (!editingLoc && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("q-form-msg", "Escribe un email válido: es para avisarte si ganas.");
    if (!$("q-ok").checked) return msg("q-form-msg", "Tienes que aceptar las bases.");
    $("q-send").disabled = true;
    try {
      const res = await rpc("quiniela_enviar", {
        p_jornada: j.id, p_alias: alias, p_email: email, p_picks: picks,
        p_exacto: { local: Number(x1), visitante: Number(x2) }, p_localizador: editingLoc
      });
      saveLoc(j.id, res.localizador);
      $("q-done").hidden = false;
      $("q-done").innerHTML = `<p style="margin:0">${res.nueva ? "¡Quiniela enviada!" : "Cambios guardados."} Tu localizador es</p>
        <div class="q-loc">${esc(res.localizador)}</div>
        <p class="q-note" style="margin:6px 0 10px">Guárdalo (una captura de pantalla vale). Con él puedes cambiar tu quiniela hasta el cierre y, si ganas, recoger el premio.</p>
        <button class="q-btn ghost" type="button" id="q-copy">Copiar localizador</button>`;
      $("q-copy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(res.localizador); $("q-copy").textContent = "Copiado"; } catch { $("q-copy").textContent = "No se ha podido copiar"; }
      });
      $("q-loc").value = res.localizador;
      resetForm();
      $("q-done").scrollIntoView({ behavior: "smooth", block: "center" });
      loadPublic(j.id);
    } catch (error) {
      msg("q-form-msg", esc(error.message));
    } finally {
      $("q-send").disabled = false;
    }
  });

  async function openLocator() {
    const loc = $("q-loc").value.trim().toUpperCase();
    if (!/^FER-[A-Z0-9]{4,6}$/.test(loc)) return msg("q-loc-msg", "El localizador es como FER-7K3QX.");
    try {
      const b = await rpc("quiniela_ver", { p_localizador: loc });
      if (!b) return msg("q-loc-msg", "No hay ninguna quiniela con ese localizador.");
      if (J()?.id !== b.jornada) await loadPublic(b.jornada);
      const j = J();
      viewing = b;
      picks = { ...b.picks };
      editingLoc = j.cerrada ? null : b.localizador;
      $("q-alias").value = b.alias;
      $("q-email").value = "";
      $("q-ex1").value = b.exacto?.local ?? "";
      $("q-ex2").value = b.exacto?.visitante ?? "";
      $("q-ok").checked = true;
      const hits = b.validos ? ` Lleva <b>${b.aciertos} aciertos de ${b.validos}</b> partidos con resultado.` : "";
      msg("q-loc-msg", `Quiniela de <b>${esc(b.alias)}</b> (${esc(j.nombre)}).${j.cerrada ? " La jornada está cerrada, así que solo se puede consultar." : " Puedes cambiarla y guardar."}${hits}`, true);
      $("q-done").hidden = true;
      renderPlay();
    } catch (error) {
      msg("q-loc-msg", esc(error.message));
    }
  }
  $("q-loc-go").addEventListener("click", openLocator);
  $("q-loc").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); openLocator(); } });

  // ---------- Clasificación ----------
  function verdictText(v, j) {
    const list = (arr) => arr.map(esc).join(", ");
    const first = j.partidos[0] ? `${esc(j.partidos[0].local)} – ${esc(j.partidos[0].visitante)}` : "el primer partido";
    switch (v?.estado) {
      case "abierta": return `La jornada está abierta. Llevamos <b>${j.participantes}</b> ${j.participantes === 1 ? "quiniela" : "quinielas"}. Se cierra el ${esc(fmtDateTime(j.cierre))}.`;
      case "pendiente": return "La jornada está cerrada. Faltan resultados por meter: cuando estén todos se sabrá si hay ganador.";
      case "desierta": return "Nadie ha acertado todos los partidos. La jornada queda desierta.";
      case "sorteo_pendiente": return `Hay ${v.plenos} plenos y siguen empatados también en el resultado exacto: ${list(v.empatados)}. El club hará el sorteo y el ganador saldrá aquí.`;
      case "ganador":
        if (v.motivo === "pleno") return `¡Pleno! Gana <b>${esc(v.ganador)}</b>, que ha acertado todos los partidos.`;
        if (v.motivo === "exacto") return `Hay ${v.plenos} plenos. Gana <b>${esc(v.ganador)}</b> por acertar también el resultado exacto de ${first}.`;
        return `Hay ${v.plenos} plenos y empataban también en el resultado exacto: ${list(v.empatados)}. Sorteo hecho el ${esc(fmtDateTime(v.fecha_sorteo))}: gana <b>${esc(v.ganador)}</b>.`;
      default: return "";
    }
  }

  function renderStandings() {
    const sel = $("q-jsel");
    sel.innerHTML = (pub?.jornadas || []).map((x) => `<option value="${esc(x.id)}" ${x.id === J()?.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("");
    const j = J();
    if (!j) {
      $("q-verdict").innerHTML = `<p class="q-note" style="margin:0">Todavía no hay jornadas.</p>`;
      $("q-table").innerHTML = ""; $("q-acc").innerHTML = "";
      return;
    }
    const v = pub.veredicto;
    const sp = j.patrocinador || {};
    $("q-verdict").innerHTML = `<div class="q-big">${v.estado === "ganador" ? "🏆 Ganador" : "Estado de la jornada"}</div>
      <p style="margin:6px 0 0">${verdictText(v, j)}</p>
      ${v.estado === "ganador" && sp.nombre ? `<p class="q-note" style="margin:6px 0 0">${sp.premio ? `${esc(sp.premio)} · ` : ""}Premio cortesía de ${esc(sp.nombre)}</p>` : ""}`;
    const rows = pub.clasificacion || [];
    if (!j.cerrada) {
      $("q-table").innerHTML = rows.length
        ? `<p class="q-note">Los pronósticos se verán cuando se cierre la jornada. Ya han jugado:</p><p>${rows.map((r) => esc(r.alias)).join(" · ")}</p>`
        : `<p class="q-note">Todavía no ha jugado nadie. ¡Sé el primero!</p>`;
    } else if (!rows.length) {
      $("q-table").innerHTML = `<p class="q-note">Nadie jugó esta jornada.</p>`;
    } else {
      const winner = v.estado === "ganador" ? v.ganador : null;
      $("q-table").innerHTML = `<div class="q-scroll"><table><thead><tr><th>#</th><th>Alias</th><th class="r">Aciertos</th><th class="r">Exacto</th></tr></thead><tbody>${rows.map((r, i) => `
        <tr class="${r.alias === winner ? "win" : ""}"><td>${i + 1}</td>
        <td>${esc(r.alias)}${r.alias === winner ? " 🏆" : ""}${r.pleno && r.alias !== winner ? " · pleno" : ""}<div class="q-bar"><i style="width:${r.validos ? (r.aciertos / r.validos) * 100 : 0}%"></i></div></td>
        <td class="r">${r.aciertos} / ${r.validos}</td>
        <td class="r">${esc(r.exacto?.local)}–${esc(r.exacto?.visitante)}${r.exacto_ok ? " ✓" : ""}</td></tr>`).join("")}</tbody></table></div>`;
    }
    const acc = pub.acumulada || [];
    $("q-acc").innerHTML = acc.length
      ? `<div class="q-scroll"><table><thead><tr><th>#</th><th>Alias</th><th class="r">Jornadas</th><th class="r">Plenos</th><th class="r">Aciertos</th></tr></thead><tbody>${acc.map((r, i) => `
        <tr><td>${i + 1}</td><td>${esc(r.alias)}</td><td class="r">${r.jornadas}</td><td class="r">${r.plenos}</td><td class="r">${r.aciertos}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="q-note">Aparecerá cuando se cierre la primera jornada.</p>`;
  }
  $("q-jsel").addEventListener("change", (e) => { viewing = null; editingLoc = null; picks = {}; loadPublic(e.target.value); });

  // ---------- Club (administrador y coordinador) ----------
  let adm = null;        // jornada que se gestiona (completa)
  let draft = null;      // {id, nombre, cierre, partidos:[{..., on}], patrocinador, nueva}
  let resDraft = {};
  let portada = null;
  let pendingLogo;
  let autoOpened = false;

  async function loadPortada() {
    if (!portada) portada = await rpc("ferreries_portada");
    return portada || {};
  }

  // Partidos de los equipos del club de hoy al domingo (los del calendario de la FFIB que ya usa la portada)
  function weekendCandidates(fixtures, teams) {
    const today = isoDay(new Date());
    const end = addDays(today, (7 - new Date(`${today}T12:00:00`).getDay()) % 7);
    const own = (n) => norm(n).includes("ferreries");
    const list = [];
    teams.forEach((team) => {
      (fixtures?.[team.id]?.competitions || []).forEach((comp) => {
        (comp.jornadas || []).forEach((jr) => {
          const when = jr.exact?.date || jr.date;
          const ownSide = own(jr.home) && !own(jr.away) ? "home" : own(jr.away) && !own(jr.home) ? "away" : "home";
          const rival = ownSide === "home" ? jr.away : jr.home;
          if (!when || when < today || when > end || /descansa/i.test(rival)) return;
          list.push({
            id: `${team.id}|${comp.kind || "league"}|${jr.round}`, teamId: team.id, kind: comp.kind || "league", round: jr.round,
            equipo: shortTeam(team.name) + (comp.kind === "cup" ? " · Copa" : ""),
            local: prettyName(jr.home), visitante: prettyName(jr.away), fecha: when, hora: jr.exact?.time || "",
            rel: teamRelevance(team), on: true
          });
        });
      });
    });
    return list.sort((a, b) => a.rel - b.rel || a.fecha.localeCompare(b.fecha));
  }

  function draftFrom(j) {
    return { id: j.id, nombre: j.nombre, cierre: j.cierre, partidos: j.partidos.map((p) => ({ ...p, on: true })), patrocinador: { ...(j.patrocinador || {}) }, nueva: false };
  }

  async function newJornada() {
    msg("a-edit-msg", "Buscando los partidos de esta semana…", true);
    try {
      const p = await loadPortada();
      const cands = weekendCandidates(p.fixtures || {}, p.teams || []);
      const dates = cands.map((c) => c.fecha).sort();
      const timed = cands.filter((c) => c.hora).map((c) => new Date(`${c.fecha}T${c.hora.padStart(5, "0")}:00`)).sort((a, b) => a - b);
      const sunday = (() => { const t = isoDay(new Date()); return addDays(t, (7 - new Date(`${t}T12:00:00`).getDay()) % 7); })();
      let id = dates.length ? dates[dates.length - 1] : sunday;
      const used = new Set((pub?.jornadas || []).map((x) => x.id));
      for (let k = 2; used.has(id); k++) id = `${dates.length ? dates[dates.length - 1] : sunday}-${k}`;
      const dm = (iso) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));
      const nombre = dates.length > 1 && dates[0] !== dates[dates.length - 1]
        ? `Jornada del ${dm(dates[0]).split(" ")[0]} al ${dm(dates[dates.length - 1])}`
        : `Jornada del ${dm(dates[0] || sunday)}`;
      const cierre = timed[0] || new Date(`${addDays(sunday, -1)}T09:00:00`);
      draft = { id, nombre, cierre: cierre.toISOString(), partidos: cands, patrocinador: { ...(adm?.patrocinador || {}) }, nueva: true };
      adm = null; resDraft = {}; pendingLogo = undefined;
      renderClub();
      msg("a-edit-msg", cands.length
        ? `He cargado ${cands.length} partidos del calendario de esta semana. Quita los que no quieras, ordénalos (el primero es el del desempate) y guarda.`
        : "No hay partidos en el calendario de esta semana. Añádelos a mano.", true);
    } catch (error) {
      msg("a-edit-msg", esc(error.message));
    }
  }

  async function loadAdmin(id) {
    if (!id) { adm = null; draft = null; renderClub(); return; }
    try {
      adm = await rpc("quiniela_admin_jornada", { p_jornada: id });
      draft = draftFrom(adm);
      resDraft = { ...(adm.resultados || {}) };
      pendingLogo = undefined;
      const people = await rpc("quiniela_admin_boletos", { p_jornada: id });
      adm.boletos = people || [];
      renderClub();
    } catch (error) {
      msg("a-edit-msg", esc(error.message));
    }
  }

  function renderClub() {
    const gestor = Boolean(pub?.gestor);
    $("q-club-login").hidden = gestor;
    $("q-club").hidden = !gestor;
    if (!gestor) return;
    // Al entrar, se abre directamente la jornada actual
    if (!adm && !draft && J() && !autoOpened) { autoOpened = true; loadAdmin(J().id); }
    const sel = $("q-admin-jsel");
    sel.innerHTML = `<option value="">— Elige una jornada —</option>` + (pub.jornadas || []).map((x) => `<option value="${esc(x.id)}" ${adm?.id === x.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("");
    const has = Boolean(draft);
    $("q-edit").hidden = !has;
    $("q-results").hidden = !adm;
    $("q-admin-people").hidden = !adm;
    $("a-del").closest(".q-card").hidden = !adm;
    if (!has) return;

    $("q-edit-title").textContent = draft.nueva ? "Nueva jornada" : "Jornada";
    $("a-nombre").value = draft.nombre || "";
    $("a-cierre").value = draft.cierre ? toLocalInput(draft.cierre) : "";
    const locked = Boolean(adm && adm.participantes > 0);
    $("a-partidos-note").textContent = locked
      ? "Ya hay quinielas enviadas: los partidos ya no se pueden cambiar. El primero es el del desempate."
      : "Marca los partidos que entran. El primero de la lista es el del desempate por resultado exacto.";
    $("a-partidos").innerHTML = draft.partidos.length ? draft.partidos.map((p, i) => `
      <div class="q-pick">
        <input type="checkbox" data-on="${i}" ${p.on ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Incluir ${esc(p.local)} – ${esc(p.visitante)}" />
        <div class="q-m">${matchLabel(p)}</div>
        <div class="q-pick-move">${locked ? "" : `<button type="button" data-up="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" data-down="${i}" aria-label="Bajar" ${i === draft.partidos.length - 1 ? "disabled" : ""}>↓</button>`}</div>
      </div>`).join("") : `<p class="q-note">Sin partidos.</p>`;
    $("a-m-add").disabled = locked;
    const sp = draft.patrocinador || {};
    $("a-sp-n").value = sp.nombre || ""; $("a-sp-p").value = sp.premio || ""; $("a-sp-l").value = sp.enlace || "";
    const logo = pendingLogo !== undefined ? pendingLogo : sp.logo;
    const prev = $("a-sp-prev"); prev.textContent = "";
    if (logo) { const img = new Image(); img.src = logo; img.alt = ""; prev.appendChild(img); } else prev.textContent = "Sin logo";

    if (!adm) return;
    $("a-res").innerHTML = slipRows(adm, resDraft, "rs", { withSusp: true });
    const first = adm.partidos[0];
    $("a-first").textContent = first ? `${first.local} – ${first.visitante}` : "";
    $("a-rx1").value = adm.exacto?.local ?? ""; $("a-rx2").value = adm.exacto?.visitante ?? "";

    const v = adm.veredicto || {};
    const aliasOf = new Map(adm.boletos.map((b) => [b.localizador, b.alias]));
    const text = {
      abierta: `Abierta. ${adm.participantes} ${adm.participantes === 1 ? "quiniela" : "quinielas"} hasta ahora.`,
      pendiente: "Cerrada. Faltan resultados por guardar.",
      desierta: "Nadie ha acertado todos los partidos: jornada desierta.",
      sorteo_pendiente: `Hay ${(v.plenos || []).length} plenos y empatan también en el resultado exacto: ${(v.pool || []).map((l) => esc(aliasOf.get(l))).join(", ")}. Haz el sorteo.`,
      ganador: `Gana <b>${esc(aliasOf.get(v.ganador))}</b>${v.motivo === "exacto" ? " (desempate por resultado exacto)" : v.motivo === "sorteo" ? " (por sorteo)" : ""}. Su email está en la tabla de abajo para avisarle.`
    }[v.estado] || "";
    $("a-verdict").innerHTML = `<div class="q-msg ${v.estado === "ganador" ? "ok" : ""}">${text}</div>${v.estado === "sorteo_pendiente" ? `<button class="q-btn red" type="button" id="a-draw">Hacer el sorteo</button>` : ""}`;
    $("a-draw")?.addEventListener("click", (e) => armed(e.currentTarget, "Pulsa otra vez: el sorteo no se puede repetir", async () => {
      try { await rpc("quiniela_admin_sorteo", { p_jornada: adm.id }); await loadAdmin(adm.id); loadPublic(adm.id); }
      catch (error) { msg("a-res-msg", esc(error.message)); }
    }));
    $("a-people").innerHTML = adm.boletos.length ? `<div class="q-scroll"><table><thead><tr><th>Alias</th><th>Email</th><th class="r">Aciertos</th><th class="q-hide-sm">Localizador</th><th></th></tr></thead><tbody>${adm.boletos.map((b) => `
      <tr class="${v.ganador === b.localizador ? "win" : ""}"><td>${esc(b.alias)}${b.pleno ? " · pleno" : ""}${b.exacto_ok ? " · exacto" : ""}</td><td>${esc(b.email)}</td>
      <td class="r">${b.aciertos} / ${b.validos}</td><td class="q-hide-sm">${esc(b.localizador)}</td>
      <td><button class="q-link" type="button" data-del="${esc(b.localizador)}">Borrar</button></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="q-note">Todavía no hay quinielas.</p>`;
  }

  $("q-admin-jsel").addEventListener("change", (e) => { msg("a-edit-msg", ""); msg("a-res-msg", ""); loadAdmin(e.target.value); });
  $("q-new").addEventListener("click", newJornada);
  $("a-partidos").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.on !== undefined) { draft.partidos[+t.dataset.on].on = t.checked; return; }
    const i = t.dataset.up !== undefined ? +t.dataset.up : t.dataset.down !== undefined ? +t.dataset.down : null;
    if (i === null) return;
    const k = t.dataset.up !== undefined ? i - 1 : i + 1;
    [draft.partidos[i], draft.partidos[k]] = [draft.partidos[k], draft.partidos[i]];
    keepDraftFields(); renderClub();
  });
  function keepDraftFields() {
    if (!draft) return;
    draft.nombre = $("a-nombre").value;
    if ($("a-cierre").value) draft.cierre = new Date($("a-cierre").value).toISOString();
    draft.patrocinador = { ...draft.patrocinador, nombre: $("a-sp-n").value.trim(), premio: $("a-sp-p").value.trim(), enlace: $("a-sp-l").value.trim() };
  }
  $("a-m-add").addEventListener("click", () => {
    const l = $("a-m-l").value.trim(), v = $("a-m-v").value.trim();
    if (!l || !v) return msg("a-edit-msg", "Pon el equipo local y el visitante.");
    keepDraftFields();
    draft.partidos.push({ id: `manual-${Date.now().toString(36)}`, equipo: $("a-m-eq").value.trim(), local: l, visitante: v, fecha: "", hora: "", on: true });
    ["a-m-eq", "a-m-l", "a-m-v"].forEach((id) => { $(id).value = ""; });
    msg("a-edit-msg", ""); renderClub();
  });
  $("a-sp-f").addEventListener("change", () => {
    const f = $("a-sp-f").files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 240 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        pendingLogo = c.toDataURL("image/png");
        keepDraftFields(); renderClub();
      };
      img.onerror = () => msg("a-edit-msg", "Esa imagen no se puede leer. Prueba con un PNG o JPG.");
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  });
  $("a-sp-del").addEventListener("click", () => { pendingLogo = ""; $("a-sp-f").value = ""; keepDraftFields(); renderClub(); });

  $("a-save").addEventListener("click", async () => {
    keepDraftFields();
    const partidos = draft.partidos.filter((p) => p.on).map(({ on, rel, ...p }) => p);
    if (!partidos.length) return msg("a-edit-msg", "Marca al menos un partido.");
    if (!$("a-cierre").value) return msg("a-edit-msg", "Pon la fecha y hora de cierre.");
    const enlace = draft.patrocinador.enlace || "";
    if (enlace && !/^https:\/\//i.test(enlace)) return msg("a-edit-msg", "El enlace del patrocinador tiene que empezar por https://");
    const patrocinador = { ...draft.patrocinador, logo: pendingLogo !== undefined ? pendingLogo : (draft.patrocinador.logo || "") };
    $("a-save").disabled = true;
    try {
      await rpc("quiniela_admin_guardar", { p: { id: draft.id, nombre: draft.nombre.trim(), cierre: draft.cierre, partidos, patrocinador } });
      const id = draft.id;
      await loadPublic(id);
      await loadAdmin(id);
      msg("a-edit-msg", "Jornada guardada. Ya se puede jugar desde la pestaña Jugar.", true);
    } catch (error) {
      msg("a-edit-msg", esc(error.message));
    } finally {
      $("a-save").disabled = false;
    }
  });

  $("a-res").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rs]");
    if (!b) return;
    resDraft[b.dataset.rs] = resDraft[b.dataset.rs] === b.dataset.s ? undefined : b.dataset.s;
    $("a-res").innerHTML = slipRows(adm, resDraft, "rs", { withSusp: true });
  });
  const syncFirst = () => {
    const a = $("a-rx1").value, b = $("a-rx2").value, first = adm?.partidos[0];
    if (first && a !== "" && b !== "") { resDraft[first.id] = signOf(+a, +b); $("a-res").innerHTML = slipRows(adm, resDraft, "rs", { withSusp: true }); }
  };
  $("a-rx1").addEventListener("change", syncFirst);
  $("a-rx2").addEventListener("change", syncFirst);

  $("a-fill").addEventListener("click", async () => {
    try {
      portada = null;
      const p = await loadPortada();
      const results = p.results || [];
      let n = 0;
      adm.partidos.forEach((m, i) => {
        if (!m.teamId) return;
        const r = results.find((x) => x.teamId === m.teamId && (x.competition || "league") === m.kind && Number(x.round) === Number(m.round));
        const s = String(r?.score || "").match(/^(\d+)\s*[-:]\s*(\d+)$/);
        if (!s) return;
        resDraft[m.id] = signOf(+s[1], +s[2]);
        if (i === 0) { $("a-rx1").value = s[1]; $("a-rx2").value = s[2]; }
        n++;
      });
      $("a-res").innerHTML = slipRows(adm, resDraft, "rs", { withSusp: true });
      msg("a-res-msg", n ? `He rellenado ${n} de ${adm.partidos.length} partidos con los resultados de la app. Revísalos y guarda.` : "La app todavía no tiene resultados de estos partidos.", n > 0);
    } catch (error) {
      msg("a-res-msg", esc(error.message));
    }
  });

  $("a-res-save").addEventListener("click", async () => {
    const clean = Object.fromEntries(Object.entries(resDraft).filter(([, v]) => v));
    const a = $("a-rx1").value, b = $("a-rx2").value;
    const first = adm.partidos[0];
    if (first && clean[first.id] && clean[first.id] !== "S" && a !== "" && b !== "" && clean[first.id] !== signOf(+a, +b)) {
      return msg("a-res-msg", "El resultado exacto del primer partido no coincide con el 1, X o 2 marcado.");
    }
    try {
      await rpc("quiniela_admin_resultados", { p_jornada: adm.id, p_resultados: clean, p_exacto: a !== "" && b !== "" ? { local: +a, visitante: +b } : null });
      await loadAdmin(adm.id);
      loadPublic(adm.id);
      msg("a-res-msg", "Resultados guardados. La clasificación ya está actualizada.", true);
    } catch (error) {
      msg("a-res-msg", esc(error.message));
    }
  });

  $("a-people").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-del]");
    if (!b) return;
    armed(b, "¿Seguro? Pulsa otra vez", async () => {
      try { await rpc("quiniela_admin_borrar_boleto", { p_localizador: b.dataset.del }); await loadAdmin(adm.id); loadPublic(adm.id); }
      catch (error) { msg("a-res-msg", esc(error.message)); }
    });
  });

  $("a-del").addEventListener("click", (e) => armed(e.currentTarget, "Pulsa otra vez para borrarla con todas sus quinielas", async () => {
    try { await rpc("quiniela_admin_borrar_jornada", { p_jornada: adm.id }); adm = null; draft = null; await loadPublic(); renderClub(); }
    catch (error) { msg("a-res-msg", esc(error.message)); }
  }));

  // ---------- Pestañas ----------
  function route() {
    const h = (location.hash || "#jugar").slice(1);
    const tab = ["jugar", "clasificacion", "club"].includes(h) ? h : "jugar";
    ["jugar", "clasificacion", "club"].forEach((k) => { $(`v-${k}`).hidden = k !== tab; });
    document.querySelectorAll(".q-tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  }

  function renderAll() {
    renderHero();
    renderPlay();
    renderStandings();
    renderClub();
  }

  addEventListener("hashchange", route);
  route();
  loadPublic();
})();
