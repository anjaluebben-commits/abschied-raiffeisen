const SUPABASE_URL = 'https://rrimkgippmpuiosojlnv.supabase.co';

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/abschied_guestbook?select=message,created_at&order=created_at.desc&limit=200`,
        { headers: supabaseHeaders() }
      );
      if (!response.ok) throw new Error(await response.text());
      const entries = await response.json();
      return res.status(200).json({ entries });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Laden fehlgeschlagen' });
    }
  }

  if (req.method === 'POST') {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim() || message.length > 280) {
      return res.status(400).json({ error: 'Invalid message' });
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/abschied_guestbook`, {
        method: 'POST',
        headers: supabaseHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }),
        body: JSON.stringify({ message: message.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
