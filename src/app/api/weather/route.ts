import { NextResponse } from "next/server";

const DEFAULT_LOCATION = {
  name: "Barreiro, Setubal, Portugal",
  latitude: 38.66,
  longitude: -9.07,
  timezone: "Europe/Lisbon"
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Accept ?lat=...&lon=...&tz=...&name=...
    const latitude = searchParams.get("lat") || String(DEFAULT_LOCATION.latitude);
    const longitude = searchParams.get("lon") || String(DEFAULT_LOCATION.longitude);
    const timezone = searchParams.get("tz") || DEFAULT_LOCATION.timezone;
    const name = searchParams.get("name") || DEFAULT_LOCATION.name;

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", latitude);
    url.searchParams.set("longitude", longitude);
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code");
    url.searchParams.set("timezone", timezone);

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Weather API failed with ${response.status}`);
    }

    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
      };
    };

    return NextResponse.json({
      ok: true,
      location: name,
      temperatureC: data.current?.temperature_2m ?? null,
      humidity: data.current?.relative_humidity_2m ?? null,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch weather."
      },
      { status: 500 }
    );
  }
}
