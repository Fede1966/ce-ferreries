// Lectura y guardado del estado de la temporada en Supabase (el mismo bloque que usa la app).
export const SUPABASE_URL = "https://vhmnyjmhnobqmxgulsag.supabase.co";
// Clave pública (anon): es la misma que va dentro de app.js y solo permite leer.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobW55am1obm9icW14Z3Vsc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzEyNTMsImV4cCI6MjA5NjI0NzI1M30.Li4R65j3sGHSrIdt7tiubHNDgKrzjXDqcT92BCqZfDA";
export const STATE_ID = "__app_state_2026_2027__";
const BUCKET = "player-photos";

export async function leerEstado() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lineups?match_id=eq.${encodeURIComponent(STATE_ID)}&select=lineup,updated_at`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase (lectura) respondió ${res.status}`);
  const filas = await res.json();
  const state = filas?.[0]?.lineup?.__seasonState;
  if (!state) throw new Error("No se encontró el estado de la temporada 2026-2027");
  return { state, updatedAt: filas[0].updated_at };
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

// Guarda solo si nadie ha cambiado el estado desde que lo leímos (si no, devuelve false)
export async function guardarEstado(token, state, updatedAtLeido) {
  const ahora = new Date().toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/lineups?match_id=eq.${encodeURIComponent(STATE_ID)}&updated_at=eq.${encodeURIComponent(updatedAtLeido)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ lineup: { __seasonState: state }, updated_at: ahora })
    }
  );
  if (!res.ok) throw new Error(`Supabase (guardado) respondió ${res.status}: ${await res.text()}`);
  const filas = await res.json();
  return Array.isArray(filas) && filas.length === 1;
}
