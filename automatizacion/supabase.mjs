// Lectura y guardado del estado de la temporada en Supabase (el mismo bloque que usa la app).
export const SUPABASE_URL = "https://vhmnyjmhnobqmxgulsag.supabase.co";
// Clave pública (anon): es la misma que va dentro de app.js y solo permite leer.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobW55am1obm9icW14Z3Vsc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzEyNTMsImV4cCI6MjA5NjI0NzI1M30.Li4R65j3sGHSrIdt7tiubHNDgKrzjXDqcT92BCqZfDA";
export const STATE_ID = "__app_state_2026_2027__";
const BUCKET = "player-photos";

// Con token (cuenta del club) se recibe la temporada completa; sin token, solo la versión pública.
// Los permisos los aplica la base de datos (ver supabase-permisos.sql).
export async function leerEstado(token = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ferreries_estado`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: "{}"
  });
  if (!res.ok) throw new Error(`Supabase (lectura) respondió ${res.status}`);
  const state = (await res.json())?.__seasonState;
  if (!state) throw new Error("No se encontró el estado de la temporada 2026-2027");
  // «updatedAt» es la marca de versión que se usa al guardar para no pisar cambios de otro
  return { state, updatedAt: Number(state.lastModifiedAt) || 0, completo: Boolean(token) };
}

export async function iniciarSesion(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error("No se pudo iniciar sesión en Supabase (revisa FERRERIES_EMAIL y FERRERIES_PASSWORD)");
  return json.access_token;
}

export async function descargarArchivo(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el acta guardada (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function subirActa(token, ruta, bytes) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true"
    },
    body: bytes
  });
  if (!res.ok) throw new Error(`No se pudo subir el acta (${res.status})`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${ruta.split("/").map(encodeURIComponent).join("/")}`;
}

// Guarda solo si nadie ha cambiado el estado desde que lo leímos (si no, devuelve false).
// La base de datos comprueba además que la cuenta tenga permiso.
export async function guardarEstado(token, state, versionLeida) {
  if (!token) throw new Error("Para guardar hace falta iniciar sesión con una cuenta del club");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ferreries_guardar`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_lineup: { __seasonState: state }, p_esperado: versionLeida })
  });
  if (!res.ok) throw new Error(`Supabase (guardado) respondió ${res.status}: ${await res.text()}`);
  const resultado = await res.json();
  return Boolean(resultado?.ok);
}
