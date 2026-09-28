import { corsHeaders } from '../_shared/cors.ts';

const authKey = Deno.env.get('KMA_AUTH_KEY');
const kmaApiUrl = 'https://apihub.kma.go.kr/api/typ01/url/fct_afs_dl.php';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!authKey) return json({ error: 'KMA_AUTH_KEY is not configured' }, 500);

  try {
    const date = getForecastDate();
    const params = new URLSearchParams({ reg: '11B20304', tmfc1: `${date}0000`, tmfc2: `${date}2359`, disp: '0', help: '1', authKey });
    const response = await fetch(`${kmaApiUrl}?${params}`);
    if (!response.ok) return json({ error: `KMA API failed: ${response.status}` }, response.status);
    const parsed = parseWeatherText(await response.text());
    if (!parsed) return json({ error: 'Weather data is empty' }, 404);
    return json(parsed);
  } catch (error) {
    console.error(error);
    return json({ error: 'Weather Function failed' }, 500);
  }
});

function getForecastDate() {
  const date = new Date();
  if (date.getHours() < 6) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function parseWeatherText(text: string) {
  const row = text.split(/\r?\n/).find((line) => line.trim().startsWith('11B20304'));
  if (!row) return null;
  const values = row.trim().split(/\s+/);
  return {
    temperature: values.find((value) => /^-?\d+(\.\d+)?$/.test(value)),
    sky: values.find((value) => /^DB0\d$/.test(value)),
    rain: values.find((value) => /^[0-4]$/.test(value)),
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
