export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── IP rate limit: 10 requests per day ──────────────────────────────────
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const key = `rl:${ip}:${day}`;
    const headers = { Authorization: `Bearer ${redisToken}` };

    const incrRes = await fetch(`${redisUrl}/incr/${key}`, { headers });
    const { result: count } = await incrRes.json();
    if (count === 1) {
      await fetch(`${redisUrl}/expire/${key}/86400`, { headers });
    }
    if (count > 10) {
      return res.status(429).json({ error: 'Daily limit reached. Try again tomorrow.' });
    }
  }

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
      max_tokens: 450,
      system: 'You are a literary database. Respond ONLY with valid JSON, no markdown. Format: {"found":true,"title":"...","author":"...","sentence":"..."} or {"found":false,"message":"..."}. The "sentence" field must contain the opening passage of the book: include as many complete sentences as fit within 700 characters (including spaces), ending strictly at the last complete sentence boundary — never mid-sentence. All text fields must be in ' + langName + '.',
      messages: [{
        role: 'user',
        content: 'Return the opening passage of the book: "' + title + '", translated into ' + langName + '. Fill "sentence" with complete sentences up to 700 characters total (including spaces), cutting at the last complete sentence. Provide the canonical title in ' + langName + ' and the author name. If the book is unknown set found:false.'
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
