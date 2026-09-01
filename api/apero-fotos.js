const SUPABASE_URL = 'https://rrimkgippmpuiosojlnv.supabase.co';
const BUCKET = 'apero-fotos';
// Leichter Missbrauchsschutz – steckt ohnehin sichtbar in /fotobox, hält nur Bots ab.
const UPLOAD_TOKEN = process.env.APERO_FOTO_TOKEN || 'apero-goldau-2609';
const MAX_BYTES = 5 * 1024 * 1024;

function sbHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function checkAdmin(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  return decoded.slice(0, i) === process.env.ADMIN_USER && decoded.slice(i + 1) === process.env.ADMIN_PASS;
}

export default async function handler(req, res) {
  // ---- GET: neueste Fotos (öffentlich = nur sichtbare; ?all=1 mit Admin-Auth = alle) ----
  if (req.method === 'GET') {
    const wantAll = req.query.all === '1' && checkAdmin(req);
    const filter = wantAll ? '' : '&sichtbar=eq.true';
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/apero_fotos?select=id,path,created_at,sichtbar&order=created_at.desc&limit=60${filter}`,
        { headers: sbHeaders() }
      );
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        fotos: rows.map((x) => ({
          id: x.id, url: publicUrl(x.path), created_at: x.created_at, sichtbar: x.sichtbar
        }))
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Laden fehlgeschlagen' });
    }
  }

  // ---- POST: neues Foto  { image: "data:image/jpeg;base64,...", token } ----
  if (req.method === 'POST') {
    const { image, token } = req.body || {};
    if (token !== UPLOAD_TOKEN) return res.status(403).json({ error: 'Kein Zugriff' });
    if (typeof image !== 'string') return res.status(400).json({ error: 'Kein Bild' });
    const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ error: 'Ungültiges Bildformat' });

    const mime = m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 100) return res.status(400).json({ error: 'Bild leer' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Bild zu gross' });

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    try {
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' }),
        body: buf
      });
      if (!up.ok) throw new Error('upload: ' + (await up.text()));

      const ins = await fetch(`${SUPABASE_URL}/rest/v1/apero_fotos`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ path })
      });
      if (!ins.ok) throw new Error('insert: ' + (await ins.text()));

      return res.status(200).json({ ok: true, url: publicUrl(path) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }
  }

  // ---- PATCH: Foto aus-/einblenden (nur Admin)  ?id=<uuid>  { sichtbar: boolean } ----
  if (req.method === 'PATCH') {
    if (!checkAdmin(req)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Fotobox Admin"');
      return res.status(401).json({ error: 'Authentifizierung nötig' });
    }
    const id = req.query.id;
    const { sichtbar } = req.body || {};
    if (!id || typeof sichtbar !== 'boolean') {
      return res.status(400).json({ error: 'id und sichtbar nötig' });
    }
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/apero_fotos?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ sichtbar })
        }
      );
      if (!r.ok) throw new Error(await r.text());
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Update fehlgeschlagen' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
