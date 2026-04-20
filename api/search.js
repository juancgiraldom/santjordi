export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { title, language } = req.body;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  const langName = language === 'CAT' ? 'Catalan' : language === 'ESP' ? 'Spanish' : 'English';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You are a literary database. Respond ONLY with valid JSON, no markdown. Format: {"found":true,"title":"...","author":"...","sentence":"..."} or {"found":false,"message":"..."}. All text fields must be in ' + langName + '.',
      messages: [{
        role: 'user',
        content: 'Return the first sentence of the book: "' + title + '", translated into ' + langName + '. Provide the canonical title in ' + langName + ' and the author name. If the book is unknown set found:false.'
      }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(response.status).json({ error: text });
  }

  const data = await response.json();
  res.json(data);
}
