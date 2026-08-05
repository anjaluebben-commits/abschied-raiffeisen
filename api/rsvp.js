const SUPABASE_URL = 'https://rrimkgippmpuiosojlnv.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, note, status } = req.body || {};
  if (!name || typeof name !== 'string' || name.length > 200) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  if (!email || typeof email !== 'string' || email.length > 200) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (status !== 'angemeldet' && status !== 'abgemeldet') {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (note && (typeof note !== 'string' || note.length > 1000)) {
    return res.status(400).json({ error: 'Invalid note' });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/abschied_rsvps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ name, email, note: note || null, status })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Supabase insert failed:', errText);
      return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
  }
}
