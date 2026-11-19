import { liveFeeds } from "./mode";

// Weather for the saved zip (handoff §2 top bar, §7.3). Free source, no paid key (spec §2).
// Ordinary code, no AI. The stub is used in CI, build sessions and local dev; the Mac mini uses
// the live path when CC_LIVE_FEEDS=1.

export type Weather = {
  zip: string;
  tempF: number;
  conditions: string;
  rainPct: number;
  hiF: number;
  loF: number;
  requestUrl: string;
  fetchedAt: string;
};

export const DEFAULT_ZIP = "33472";

// The request built for a zip. Open-Meteo is free and needs no key; a US zip is resolved to a
// forecast point before the forecast call. The zip is kept in the request so a zip change is
// visible in the request the feed makes (spec check 3). Exported for the unit test.
export function weatherRequestUrl(zip: string): string {
  const z = encodeURIComponent(zip.trim());
  return (
    "https://api.open-meteo.com/v1/forecast" +
    `?zip=${z}&current=temperature_2m,precipitation_probability,weather_code` +
    "&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit"
  );
}

// A deterministic stubbed reading, derived from the zip so that changing the zip changes the
// reading (spec check 3). Not a real forecast — it stands in until the Mac mini runs live.
function stubWeather(zip: string, at: string): Weather {
  const n = [...zip.trim()].reduce((s, c) => s + (Number(c) || 0), 0);
  const tempF = 60 + (n % 30);
  const conditions = ["Sunny", "Partly cloudy", "Cloudy", "Light rain"][n % 4];
  return {
    zip: zip.trim(),
    tempF,
    conditions,
    rainPct: (n * 7) % 100,
    hiF: tempF + 6,
    loF: tempF - 9,
    requestUrl: weatherRequestUrl(zip),
    fetchedAt: at,
  };
}

// Live reading from free, keyless sources. Only reachable on the Mac mini (CC_LIVE_FEEDS=1); never
// in CI. Defensive: any failure throws so the caller records the feed error and keeps the cache.
async function liveWeather(zip: string, at: string): Promise<Weather> {
  const z = zip.trim();
  // api.zippopotam.us resolves a US zip to a point, free and keyless.
  const geo = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(z)}`);
  if (!geo.ok) throw new Error(`zip lookup failed (${geo.status})`);
  const place = (await geo.json()) as { places?: { latitude: string; longitude: string }[] };
  const p = place.places?.[0];
  if (!p) throw new Error("zip not found");
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${p.latitude}&longitude=${p.longitude}` +
    "&current=temperature_2m,precipitation_probability,weather_code" +
    "&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast failed (${res.status})`);
  const d = (await res.json()) as {
    current?: { temperature_2m: number; precipitation_probability: number; weather_code: number };
    daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  const cur = d.current;
  if (!cur) throw new Error("no current weather");
  return {
    zip: z,
    tempF: Math.round(cur.temperature_2m),
    conditions: weatherCodeText(cur.weather_code),
    rainPct: Math.round(cur.precipitation_probability ?? 0),
    hiF: Math.round(d.daily?.temperature_2m_max?.[0] ?? cur.temperature_2m),
    loF: Math.round(d.daily?.temperature_2m_min?.[0] ?? cur.temperature_2m),
    requestUrl: url,
    fetchedAt: at,
  };
}

// WMO weather codes to short text (Open-Meteo documents these).
function weatherCodeText(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

export async function fetchWeather(zip: string, at: string): Promise<Weather> {
  return liveFeeds() ? liveWeather(zip, at) : stubWeather(zip, at);
}
