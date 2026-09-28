import { corsHeaders } from '../_shared/cors.ts';

const serviceKey = Deno.env.get('AIR_SERVICE_KEY');
const airApiUrl = 'https://apis.data.go.kr/5590000/AirQualityService/getAirQualityList';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!serviceKey) return json({ error: 'AIR_SERVICE_KEY is not configured' }, 500);

  try {
    const now = new Date();
    const searchDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const params = new URLSearchParams({ serviceKey, pageNo: '1', numOfRows: '1', searchDate, dataType: 'JSON' });
    const response = await fetch(`${airApiUrl}?${params}`);
    if (!response.ok) return json({ error: `Air API failed: ${response.status}` }, response.status);
    const item = (await response.json())?.response?.body?.items?.[0];
    return json(item || { error: 'Air data is empty' }, item ? 200 : 404);
  } catch (error) {
    console.error(error);
    return json({ error: 'Air Function failed' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
