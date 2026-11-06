# MusicForU

A music playlist and snippet player built with TypeScript, React, Next.js, Node.js, and Tailwind CSS. Playlists are saved in your browser; no accounts, API keys, or external database are required.

## Development

Requires Node.js 20.9+.

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## What you can do

- Create, rename, recolor, and delete playlists.
- Add a YouTube URL or video ID. A Next.js route fetches the title and channel through YouTube oEmbed; manual entry is available if metadata cannot be fetched.
- Save each track's start time, end time, and playback speed independently, including multiple cuts of the same video.
- Play the saved segments through the visible YouTube IFrame Player API, with pause, seek, volume, previous/next, shuffle, and repeat.
- Reorder or remove tracks, search the selected playlist, and add tracks from a small starter collection in Discover.
- Export your entire library as JSON and restore a validated backup on another browser or device.

Use the scissors button beside a track to customize it. Times accept seconds, `m:ss`, or `h:mm:ss`; a blank end time plays through the end. The track's length is detected when playback starts. Speed and snippet settings persist with that playlist entry.

## Storage and playback

The library is stored under `musicforu.library.v1` in localStorage. Clearing browser data removes it, and it does not sync between devices. Keep an exported backup. When browser storage is blocked or full, the app shows a warning so you can export unsaved changes. A malformed saved library is preserved until you explicitly make a change.

Videos stream directly from YouTube and require internet access. Availability, embedding permissions, regional restrictions, ads, autoplay restrictions, and available playback speeds are controlled by YouTube and your browser. Use the app's speed selector to apply a saved speed. If autoplay is blocked, press play inside the embedded player. The app does not download or extract audio. Discover is a starter collection, not a live YouTube search engine.

## Checks and production

```sh
npm test
npm run typecheck
npm run build
npm start
```

Tests cover video URL validation, timestamp boundaries, backup round trips and corruption, and metadata API success/failure paths. The production app needs a Node.js host that supports Next.js route handlers. There are no environment variables to configure.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/components/music-app.tsx` | Library interface, queue, and playback controls |
| `src/components/youtube-player.tsx` | YouTube API lifecycle and segment playback |
| `src/components/dialogs.tsx` | Playlist, track import, and snippet forms |
| `src/lib/library.ts` | Data model, starter library, validation, and timestamps |
| `src/lib/use-library.ts` | Local persistence and storage error handling |
| `src/app/api/youtube/route.ts` | Validated, cached YouTube metadata lookup |
