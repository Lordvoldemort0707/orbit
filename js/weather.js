/* Orbit — weather on Today, from Open-Meteo (free, no key). Only runs once you pick a city in Settings;
   the city's coordinates are the only thing sent. The last reading is kept for 30 minutes and offline. */
(function () {
  'use strict';
  const W = (O.weather = {});
  const KEY = 'orbit.weather';
  const CODES = [
    [[0], 'Clear', 'w_clear'], [[1], 'Mostly clear', 'w_partly'], [[2], 'Partly cloudy', 'w_partly'], [[3], 'Cloudy', 'w_cloud'],
    [[45, 48], 'Fog', 'w_fog'], [[51, 53, 55, 56, 57], 'Drizzle', 'w_rain'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain', 'w_rain'],
    [[71, 73, 75, 77, 85, 86], 'Snow', 'w_snow'], [[95, 96, 99], 'Thunderstorm', 'w_storm'],
  ];
  W.describe = (code) => { const m = CODES.find(([cs]) => cs.includes(code)); return m ? { text: m[1], icon: m[2] } : { text: 'Weather', icon: 'w_cloud' }; };
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  W.cached = () => { const c = read(), loc = O.store.state.settings.location; return c && loc && c.lat === loc.lat && c.lon === loc.lon ? c : null; };
  let inflight = null;
  W.get = async ({ force = false } = {}) => {
    const loc = O.store.state.settings.location;
    if (!loc) return null;
    const c = W.cached();
    if (c && !force && Date.now() - c.at < 30 * 60e3) return c;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunset&timezone=auto&forecast_days=3`;
        const r = await fetch(url);
        if (!r.ok) throw new Error('weather ' + r.status);
        const j = await r.json();
        const out = {
          at: Date.now(), lat: loc.lat, lon: loc.lon,
          temp: Math.round(j.current.temperature_2m), feels: Math.round(j.current.apparent_temperature), code: j.current.weather_code, wind: Math.round(j.current.wind_speed_10m),
          hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]), rain: j.daily.precipitation_probability_max[0],
          sunset: (j.daily.sunset[0] || '').slice(11, 16),
          tomorrow: { hi: Math.round(j.daily.temperature_2m_max[1]), lo: Math.round(j.daily.temperature_2m_min[1]), code: j.daily.weather_code[1] },
        };
        try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (_) {}
        return out;
      } catch (e) { return c || null; } finally { setTimeout(() => { inflight = null; }, 0); }
    })();
    return inflight;
  };
  W.search = async (q) => {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    if (!r.ok) throw new Error('search failed');
    const j = await r.json();
    return (j.results || []).map((x) => ({ name: x.name, region: [x.admin1, x.country].filter(Boolean).join(', '), lat: +x.latitude.toFixed(3), lon: +x.longitude.toFixed(3) }));
  };
  /* the line on Today: "24°, partly cloudy · H 28° L 19° · 20% rain" */
  W.line = (w) => `${w.temp}°, ${W.describe(w.code).text.toLowerCase()} · H ${w.hi}° L ${w.lo}°${w.rain >= 30 ? ` · ${w.rain}% rain` : ''}`;
})();
