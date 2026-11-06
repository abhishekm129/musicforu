import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLibrary,
  extractVideoId,
  formatTime,
  parseTime,
  readLibrary,
  snippetError,
} from "../src/lib/library";

test("accepts YouTube URL formats and rejects lookalike hosts", () => {
  const id = "5NV6Rdv1a3I";
  for (const url of [
    id,
    `https://youtu.be/${id}?t=30`,
    `https://www.youtube.com/watch?v=${id}&list=abc`,
    `https://m.youtube.com/shorts/${id}`,
    `https://youtube-nocookie.com/embed/${id}`,
    `https://youtube.com/live/${id}`,
  ])
    assert.equal(extractVideoId(url), id);
  for (const url of [
    `https://youtube.com.evil.com/watch?v=${id}`,
    `https://evil.com/${id}`,
    `https://youtube.com@evil.com/watch?v=${id}`,
    `ftp://youtube.com/watch?v=${id}`,
    "javascript:alert(1)",
    "abc",
    `https://youtu.be/${id}extra`,
  ])
    assert.equal(extractVideoId(url), null);
});

test("parses and formats segment timestamps without accepting malformed times", () => {
  assert.equal(parseTime("1:30"), 90);
  assert.equal(parseTime("1:02:03"), 3723);
  assert.equal(parseTime("90"), 90);
  for (const value of ["", "-1", "1:99", "1:2", "Infinity", "86401", "1.5"])
    assert.equal(parseTime(value), null);
  assert.equal(formatTime(3723), "1:02:03");
  assert.equal(formatTime(null), "—");
  assert.equal(snippetError(30, 60, 100), null);
  assert.equal(snippetError(0, null, null), null);
  for (const [start, end, duration] of [
    [60, 30, 100],
    [20, 20, 100],
    [-1, 30, 100],
    [100, null, 100],
    [30, 110, 100],
    [NaN, null, 100],
  ] as [number, number | null, number | null][])
    assert.ok(snippetError(start, end, duration));
});

test("playlist backups preserve per-track snippets and playback speeds", () => {
  const library = createLibrary();
  library.playlists[0].tracks[0] = {
    ...library.playlists[0].tracks[0],
    start: 30,
    end: 90,
    speed: 0.75,
  };
  assert.deepEqual(readLibrary(JSON.parse(JSON.stringify(library))), library);
  library.activePlaylistId = "missing";
  assert.equal(readLibrary(library).activePlaylistId, library.playlists[0].id);
});

test("rejects corrupt, oversized, or ambiguous backups", () => {
  const corruptions: ((library: ReturnType<typeof createLibrary>) => void)[] = [
    (lib) => {
      lib.playlists[0].tracks[0].speed = 99;
    },
    (lib) => {
      lib.playlists[0].tracks[0].start = -1;
    },
    (lib) => {
      lib.playlists[0].tracks[0].duration = Infinity;
    },
    (lib) => {
      lib.playlists[0].tracks[0].end = 0;
    },
    (lib) => {
      lib.playlists[0].tracks[0].videoId = "<script>";
    },
    (lib) => {
      lib.playlists[0].tracks.push(lib.playlists[0].tracks[0]);
    },
    (lib) => {
      lib.playlists.push(lib.playlists[0]);
    },
    (lib) => {
      lib.playlists[0].name = "x".repeat(81);
    },
    (lib) => {
      lib.playlists[0].tracks = Array(501).fill(lib.playlists[0].tracks[0]);
    },
  ];
  for (const corrupt of corruptions) {
    const lib = createLibrary();
    corrupt(lib);
    assert.throws(() => readLibrary(lib), /valid MusicForU/);
  }
  for (const value of [
    null,
    [],
    {},
    { version: 2 },
    { version: 1, playlists: [] },
  ])
    assert.throws(() => readLibrary(value));
});
