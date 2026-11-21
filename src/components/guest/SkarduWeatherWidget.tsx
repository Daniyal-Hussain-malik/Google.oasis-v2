import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Droplets,
  Moon,
  RefreshCw,
  Shirt,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { api } from '@/src/lib/api';

type WeatherCategory = 'clear' | 'partly_cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

interface SkarduWeatherData {
  location: string;
  elevationM: number;
  tempC: number;
  feelsLikeC: number;
  highC: number;
  lowC: number;
  windKmh: number;
  humidity: number;
  isDay: boolean;
  weatherCode: number;
  condition: string;
  category: WeatherCategory;
  plannerTip: string;
  clothingTip: string;
  observedAt: string;
  updatedAt: string;
  cached?: boolean;
  stale?: boolean;
}

function WeatherGlyph({ category, isDay, className = 'h-4 w-4' }: { category: WeatherCategory; isDay: boolean; className?: string }) {
  switch (category) {
    case 'clear':
      return isDay ? <Sun className={`${className} text-amber-500`} /> : <Moon className={`${className} text-sky-400`} />;
    case 'partly_cloudy':
      return <CloudSun className={`${className} text-amber-500`} />;
    case 'fog':
      return <CloudFog className={`${className} text-slate-400`} />;
    case 'rain':
      return <CloudRain className={`${className} text-sky-500`} />;
    case 'snow':
      return <CloudSnow className={`${className} text-cyan-400`} />;
    case 'storm':
      return <CloudLightning className={`${className} text-amber-400`} />;
    default:
      return <Cloud className={`${className} text-slate-400`} />;
  }
}

function formatSkarduTime(isoString?: string): string {
  if (!isoString) return 'Live Skardu time';
  try {
    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) return 'Skardu time';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return 'Skardu time';
  }
}

export function SkarduWeatherWidget({ variant = 'topbar' }: { variant?: 'topbar' | 'sheet' }) {
  const [weather, setWeather] = useState<SkarduWeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadWeather = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const data = await api<SkarduWeatherData>(force ? '/public/weather?refresh=1' : '/public/weather');
      setWeather(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<SkarduWeatherData>('/public/weather');
        if (active) setWeather(data);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const interval = setInterval(() => {
      loadWeather(false);
    }, 15 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadWeather]);

  if (variant === 'sheet') {
    if (loading && !weather) {
      return (
        <div className="rounded-xl border border-border bg-secondary/40 p-3.5 animate-pulse">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="mt-2 h-3 w-48 rounded bg-muted" />
        </div>
      );
    }

    if (error && !weather) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          <span>Skardu weather unavailable</span>
          <button
            type="button"
            onClick={() => loadWeather(true)}
            className="font-medium text-foreground underline underline-offset-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!weather) return null;

    return (
      <div className="rounded-xl border border-border bg-secondary/40 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <WeatherGlyph category={weather.category} isDay={weather.isDay} className="h-5 w-5" />
            <div>
              <p className="text-xs font-semibold text-foreground">{weather.location}</p>
              <p className="text-[11px] text-muted-foreground">{weather.condition}</p>
            </div>
          </div>
          <div className="text-right tabular-nums">
            <p className="font-display text-lg font-semibold leading-none text-foreground">{weather.tempC}°C</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">H:{weather.highC}° L:{weather.lowC}°</p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{weather.plannerTip}</p>
      </div>
    );
  }

  if (loading && !weather) {
    return (
      <div
        aria-label="Loading Skardu weather"
        className="inline-flex h-6 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground"
      >
        <span className="h-3 w-3 rounded-full bg-muted animate-pulse" />
        <span className="h-3 w-28 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <button
        type="button"
        onClick={() => loadWeather(true)}
        className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Skardu weather · Retry</span>
      </button>
    );
  }

  if (!weather) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Skardu weather: ${weather.tempC}°C, ${weather.condition}. Open day planner`}
          className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground cursor-pointer"
        >
          <WeatherGlyph category={weather.category} isDay={weather.isDay} className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground tabular-nums">{weather.tempC}°C</span>
          <span className="text-border">·</span>
          <span className="truncate max-w-[110px] sm:max-w-none">{weather.condition}</span>
          <span className="hidden md:inline text-muted-foreground/80 tabular-nums">
            (H:{weather.highC}° L:{weather.lowC}°)
          </span>
          <span className="hidden sm:inline text-accent font-medium ml-0.5">Plan day</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[310px] sm:w-[348px] p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Skardu Forecast · {weather.elevationM.toLocaleString()}m
            </p>
            <h3 className="font-display text-lg font-semibold text-foreground leading-tight mt-0.5">
              {weather.location}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => loadWeather(true)}
            disabled={refreshing}
            aria-label="Refresh Skardu weather"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card border border-border/80 shadow-xs">
              <WeatherGlyph category={weather.category} isDay={weather.isDay} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{weather.condition}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Feels like {weather.feelsLikeC}°C · {formatSkarduTime(weather.updatedAt)} PKT
              </p>
            </div>
          </div>
          <span className="font-display text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {weather.tempC}°
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border/70 bg-card px-2 py-2">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Thermometer className="h-3 w-3" />
              <span>High / Low</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
              {weather.highC}° / {weather.lowC}°C
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card px-2 py-2">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Wind className="h-3 w-3" />
              <span>Wind</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
              {weather.windKmh} km/h
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card px-2 py-2">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Droplets className="h-3 w-3" />
              <span>Humidity</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
              {weather.humidity}%
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-accent/25 bg-accent/8 p-3">
          <div className="flex items-start gap-2">
            <Compass className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-foreground">{weather.plannerTip}</p>
          </div>
          <div className="flex items-start gap-2 pt-1 border-t border-border/60">
            <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] leading-snug text-muted-foreground">{weather.clothingTip}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5 text-xs">
          <Link to="/activities" className="font-medium text-accent hover:underline">
            Explore Activities & Safaris →
          </Link>
          <Link to="/around" className="text-muted-foreground hover:text-foreground hover:underline">
            Around Skardu
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
