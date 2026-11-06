export const STORAGE_KEY = "musicforu.library.v1";
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type Track = {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number | null;
  start: number;
  end: number | null;
  speed: number;
};
export type Playlist = { id: string; name: string; description: string; color: string; tracks: Track[] };
export type Library = { version: 1; activePlaylistId: string; playlists: Playlist[] };
export const COLORS = ["violet", "peach", "mint", "blue", "rose"] as const;

export const CATALOG: Track[] = [
  { id: "resonance", videoId: "8GW6sLrK40k", title: "Resonance", artist: "HOME", duration: null, start: 0, end: null, speed: 1 },
  { id: "get-lucky", videoId: "5NV6Rdv1a3I", title: "Get Lucky", artist: "Daft Punk · Pharrell Williams", duration: null, start: 0, end: null, speed: 1 },
  { id: "blinding-lights", videoId: "4NRXx6U8ABQ", title: "Blinding Lights", artist: "The Weeknd", duration: null, start: 0, end: null, speed: 1 },
  { id: "less-i-know", videoId: "2SUwOgmvzK4", title: "The Less I Know The Better", artist: "Tame Impala", duration: null, start: 0, end: null, speed: 1 },
  { id: "a-moment-apart", videoId: "xarC5jAiO7w", title: "A Moment Apart", artist: "ODESZA", duration: null, start: 0, end: null, speed: 1 },
  { id: "awake", videoId: "dm4tkSNKfFI", title: "Awake", artist: "Tycho", duration: null, start: 0, end: null, speed: 1 },
];

export function createLibrary(): Library {
  return {
    version: 1,
    activePlaylistId: "late-night",
    playlists: [
      { id: "late-night", name: "Late night, on repeat", description: "For the hours that are just yours.", color: "violet", tracks: CATALOG.slice(0, 5).map((track) => ({ ...track })) },
      { id: "deep-focus", name: "A little more focus", description: "Find your flow. Stay a while.", color: "mint", tracks: [CATALOG[4], CATALOG[0]].map((track) => ({ ...track })) },
      { id: "golden-hour", name: "Golden hour", description: "A soundtrack for the way home.", color: "peach", tracks: [CATALOG[1], CATALOG[2], CATALOG[3]].map((track) => ({ ...track })) },
    ],
  };
}

export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split("/")[2] : null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  return hours ? `${hours}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function parseTime(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(?::[0-5]\d){0,2}$/.test(value)) return null;
  const seconds = value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  return Number.isSafeInteger(seconds) && seconds <= 86400 ? seconds : null;
}

export function snippetError(start: number, end: number | null, duration: number | null): string | null {
  if (!Number.isFinite(start) || start < 0 || start > 86400) return "Choose a start time between 0:00 and 24:00:00.";
  if (end !== null && (!Number.isFinite(end) || end <= start || end > 86400)) return "The end time must be after the start time and within 24 hours.";
  if (duration !== null && (start >= duration || (end !== null && end > duration))) return "Keep your snippet within the length of the track.";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function readLibrary(value: unknown): Library {
  const invalid = () => { throw new Error("This file is not a valid MusicForU playlist backup."); };
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.playlists) || value.playlists.length < 1 || value.playlists.length > 100) return invalid();
  const playlistIds = new Set<string>();
  const playlists = value.playlists.map((playlist): Playlist => {
    if (!isRecord(playlist) || !text(playlist.id, 100) || playlistIds.has(playlist.id) || !text(playlist.name, 80) || typeof playlist.description !== "string" || playlist.description.length > 200 || !COLORS.includes(playlist.color as typeof COLORS[number]) || !Array.isArray(playlist.tracks) || playlist.tracks.length > 500) return invalid();
    playlistIds.add(playlist.id);
    const trackIds = new Set<string>();
    const tracks = playlist.tracks.map((track): Track => {
      if (!isRecord(track) || !text(track.id, 100) || trackIds.has(track.id) || typeof track.videoId !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(track.videoId) || !text(track.title, 300) || !text(track.artist, 200) || !(track.duration === null || (typeof track.duration === "number" && Number.isFinite(track.duration) && track.duration > 0 && track.duration <= 86400)) || typeof track.start !== "number" || !(track.end === null || typeof track.end === "number") || !SPEEDS.includes(track.speed as typeof SPEEDS[number]) || snippetError(track.start, track.end, track.duration)) return invalid();
      trackIds.add(track.id);
      return { id: track.id, videoId: track.videoId, title: track.title, artist: track.artist, duration: track.duration, start: track.start, end: track.end, speed: track.speed as number };
    });
    return { id: playlist.id, name: playlist.name, description: playlist.description, color: playlist.color as string, tracks };
  });
  return { version: 1, activePlaylistId: typeof value.activePlaylistId === "string" && playlistIds.has(value.activePlaylistId) ? value.activePlaylistId : playlists[0].id, playlists };
}
