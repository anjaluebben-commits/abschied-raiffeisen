const SUPABASE_URL = 'https://rrimkgippmpuiosojlnv.supabase.co';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function checkAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}

async function fetchTable(table, order = 'created_at.desc') {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) throw new Error(`Fetch ${table} failed: ${await response.text()}`);
  return response.json();
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const QUIZ_QUESTIONS = [
  'Was war eines der ersten Projekte von Anja bei der Raiffeisenbank Rigi?',
  'In welchem Jahr hat Anja ihre eigene Agentur at creation GmbH gegründet?',
  'Welche Position spielt Anja im Volleyball?',
  'Was hat Raphi mit «Ja, ich will» eigentlich noch mitgeheiratet?'
];

function renderPage({ rsvps, chatLogs, guestbook, quizResults }) {
  const angemeldet = rsvps.filter((r) => r.status === 'angemeldet');
  const abgemeldet = rsvps.filter((r) => r.status === 'abgemeldet');

  const quizTotal = quizResults.length;
  const quizBars = QUIZ_QUESTIONS.map((question, i) => {
    const correct = quizResults.filter((r) => r.answers && r.answers[i] === true).length;
    const wrong = quizTotal - correct;
    const correctPct = quizTotal ? (correct / quizTotal) * 100 : 0;
    const wrongPct = quizTotal ? 100 - correctPct : 0;
    return `
    <div class="quiz-row">
      <div class="quiz-q">${escapeHtml(question)}</div>
      <div class="quiz-bar">
        ${correct ? `<div class="quiz-seg quiz-correct" style="width:${correctPct}%">${correct}</div>` : ''}
        ${wrong ? `<div class="quiz-seg quiz-wrong" style="width:${wrongPct}%">${wrong}</div>` : ''}
        ${quizTotal === 0 ? `<div class="quiz-seg quiz-empty">–</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const rsvpRows = (list) => list.map((r) => `
    <tr>
      <td data-label="Name">${escapeHtml(r.name)}</td>
      <td data-label="E-Mail">${escapeHtml(r.email)}</td>
      <td data-label="Nachricht">${escapeHtml(r.note) || '<span class="dim">–</span>'}</td>
      <td data-label="Zeitpunkt" class="mono dim">${fmtDate(r.created_at)}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="dim">Noch keine Einträge.</td></tr>`;

  const CHAT_PAGE_SIZE = 4;
  const chatRows = chatLogs.map((c, i) => `
    <div class="chat-entry${i >= CHAT_PAGE_SIZE ? ' hidden' : ''}">
      <div class="chat-meta mono dim">${fmtDate(c.created_at)}</div>
      <div class="chat-msg"><span class="tag">Frage</span>${escapeHtml(c.message)}</div>
      <div class="chat-reply"><span class="tag tag-yellow">Antwort</span>${escapeHtml(c.reply)}</div>
    </div>`).join('') || `<p class="dim">Noch keine Chatverläufe.</p>`;
  const chatMoreBtn = chatLogs.length > CHAT_PAGE_SIZE
    ? `<button id="chat-more-btn" class="load-more">Mehr laden</button>`
    : '';

  const gbRows = guestbook.map((g) => `
    <tr><td data-label="Nachricht">${escapeHtml(g.message)}</td><td data-label="Zeitpunkt" class="mono dim">${fmtDate(g.created_at)}</td></tr>
  `).join('') || `<tr><td colspan="2" class="dim">Noch keine Einträge.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin – Abschied Anja</title>
<style>
  :root{ --bg:#08080a; --panel:#131316; --line:#2a2a30; --yellow:#FFD400; --text:#f2f2f0; --text-dim:#8b8b93; --red:#e82025; --green:#22c55e; }
  *{box-sizing:border-box;}
  body{background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; margin:0; padding:2rem 1.5rem 4rem;}
  h1{font-size:1.6rem; margin-bottom:0.25rem;}
  h2{font-size:1.15rem; margin:2.5rem 0 1rem;}
  .dim{color:var(--text-dim);}
  .mono{font-family:'IBM Plex Mono',monospace; font-size:0.8rem;}
  .sub{color:var(--text-dim); margin-bottom:2rem;}
  .card{background:var(--panel); border:1px solid var(--line); border-radius:4px; padding:1.25rem; max-width:1000px;}
  table{width:100%; border-collapse:collapse; font-size:0.9rem;}
  th,td{text-align:left; padding:0.6rem 0.7rem; border-bottom:1px solid var(--line);}
  th{color:var(--text-dim); font-family:'IBM Plex Mono',monospace; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em;}
  .count{color:var(--yellow); font-family:'IBM Plex Mono',monospace;}
  .chat-entry{border-bottom:1px solid var(--line); padding:0.9rem 0;}
  .chat-entry:last-child{border-bottom:none;}
  .chat-meta{margin-bottom:0.4rem;}
  .chat-msg, .chat-reply{margin-bottom:0.3rem; font-size:0.92rem;}
  .tag{display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); border:1px solid var(--line); border-radius:3px; padding:0.1rem 0.4rem; margin-right:0.5rem;}
  .tag-yellow{color:var(--yellow); border-color:var(--yellow);}
  a.reload{color:var(--yellow); font-family:'IBM Plex Mono',monospace; font-size:0.8rem; text-decoration:none;}
  .chat-entry.hidden{display:none;}
  button.load-more{margin-top:0.75rem; background:transparent; border:1px solid var(--yellow); color:var(--yellow); padding:0.55rem 1.2rem; font-family:'IBM Plex Mono',monospace; font-size:0.78rem; cursor:pointer; border-radius:3px;}
  button.load-more:hover{background:rgba(255,212,0,0.08);}
  .quiz-row{margin-bottom:1.1rem;}
  .quiz-row:last-child{margin-bottom:0;}
  .quiz-q{font-size:0.88rem; margin-bottom:0.4rem;}
  .quiz-bar{display:flex; width:100%; height:28px; border-radius:4px; overflow:hidden; background:var(--line);}
  .quiz-seg{display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Mono',monospace; font-size:0.78rem; font-weight:600; color:#0a0a0a; min-width:1.8em;}
  .quiz-correct{background:var(--green);}
  .quiz-wrong{background:var(--red); color:#fff;}
  .quiz-empty{width:100%; background:var(--line); color:var(--text-dim); font-family:'IBM Plex Mono',monospace; font-size:0.78rem;}
  @media (max-width: 640px){
    body{padding:1.25rem 1rem 3rem;}
    .card{padding:0.9rem;}
    table, thead, tbody, th, td, tr{display:block;}
    thead{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap;}
    table tr{border:1px solid var(--line); border-radius:4px; margin-bottom:0.75rem; padding:0.3rem 0.7rem;}
    table tr:last-child{margin-bottom:0;}
    table td{border-bottom:1px solid var(--line); padding:0.55rem 0; padding-left:42%; position:relative; min-height:1.4rem;}
    table td:last-child{border-bottom:none;}
    table td::before{content:attr(data-label); position:absolute; left:0; top:0.55rem; width:38%; font-family:'IBM Plex Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim);}
    table td[colspan]{padding-left:0;}
    table td[colspan]::before{content:none;}
  }
</style>
</head>
<body>
  <h1>Admin – Abschied Anja</h1>
  <p class="sub">Anmeldungen, Abmeldungen und Chatverläufe der Abschieds-Website. <a class="reload" href="/admin">↻ Aktualisieren</a></p>

  <h2>Angemeldet <span class="count">(${angemeldet.length})</span></h2>
  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>E-Mail</th><th>Nachricht</th><th>Zeitpunkt</th></tr></thead>
      <tbody>${rsvpRows(angemeldet)}</tbody>
    </table>
  </div>

  <h2>Abgemeldet <span class="count">(${abgemeldet.length})</span></h2>
  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>E-Mail</th><th>Nachricht</th><th>Zeitpunkt</th></tr></thead>
      <tbody>${rsvpRows(abgemeldet)}</tbody>
    </table>
  </div>

  <h2>Quiz <span class="count">(${quizTotal} Durchläufe)</span></h2>
  <div class="card">${quizBars}</div>

  <h2>Chatverläufe <span class="count">(${chatLogs.length})</span></h2>
  <div class="card" id="chat-log-list">${chatRows}${chatMoreBtn}</div>

  <h2>Gästebuch <span class="count">(${guestbook.length})</span></h2>
  <div class="card">
    <table>
      <thead><tr><th>Nachricht</th><th>Zeitpunkt</th></tr></thead>
      <tbody>${gbRows}</tbody>
    </table>
  </div>

  <script>
    var moreBtn = document.getElementById('chat-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        var hidden = document.querySelectorAll('#chat-log-list .chat-entry.hidden');
        for (var i = 0; i < Math.min(${CHAT_PAGE_SIZE}, hidden.length); i++) {
          hidden[i].classList.remove('hidden');
        }
        if (document.querySelectorAll('#chat-log-list .chat-entry.hidden').length === 0) {
          moreBtn.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }

  try {
    const [rsvps, chatLogs, guestbook, quizResults] = await Promise.all([
      fetchTable('abschied_rsvps'),
      fetchTable('abschied_chat_logs'),
      fetchTable('abschied_guestbook'),
      fetchTable('abschied_quiz_results')
    ]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderPage({ rsvps, chatLogs, guestbook, quizResults }));
  } catch (err) {
    console.error(err);
    return res.status(500).send('Fehler beim Laden der Daten.');
  }
}
