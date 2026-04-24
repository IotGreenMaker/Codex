"use client";

import { useState, useEffect } from "react";
import { WEATHER_REFRESH_INTERVAL } from "@/lib/config";

export type WeatherData = {
  temperatureC: number | null;
  humidity: number | null;
  location: string;
};

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadWeather = async () => {
      try {
        const response = await fetch("/api/weather", { cache: "no-store" });
        const data = (await response.json()) as {
          ok: boolean;
          location?: string;
          temperatureC?: number | null;
          humidity?: number | null;
        };
        if (!ignore && data.ok) {
          setWeather({
            location: data.location ?? "Barreiro, Setubal, Portugal",
            temperatureC: data.temperatureC ?? null,
            humidity: data.humidity ?? null
          });
        }
      } catch {
        if (!ignore) {
          setWeather((current) => current ?? { location: "Barreiro, Setubal, Portugal", temperatureC: null, humidity: null });
        }
      }
    };

    void loadWeather();
    const weatherTimer = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_INTERVAL);
    return () => {
      ignore = true;
      window.clearInterval(weatherTimer);
    };
  }, []);

  return weather;
}
