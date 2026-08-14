const SUPABASE_URL = 'https://rrimkgippmpuiosojlnv.supabase.co';

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { answers } = req.body || {};
  if (
    !Array.isArray(answers) ||
    answers.length !== 4 ||
    !answers.every((a) => typeof a === 'boolean')
  ) {
    return res.status(400).json({ error: 'Invalid answers' });
  }

  const score = answers.filter(Boolean).length;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/abschied_quiz_results`, {
      method: 'POST',
      headers: supabaseHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      }),
      body: JSON.stringify({ answers, score })
    });
    if (!response.ok) throw new Error(await response.text());
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
  }
}
