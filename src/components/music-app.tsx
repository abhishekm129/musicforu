"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Download,
  Ellipsis,
  Headphones,
  Library,
  ListMusic,
  LoaderCircle,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat1,
  Scissors,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  AddTrackDialog,
  Dialog,
  PlaylistDialog,
  SnippetDialog,
} from "./dialogs";
import { YouTubePlayer, type PlayerHandle } from "./youtube-player";
import {
  CATALOG,
  COLORS,
  formatTime,
  readLibrary,
  SPEEDS,
  type Library as LibraryData,
  type Playlist,
  type Track,
} from "@/lib/library";
import { useLibrary } from "@/lib/use-library";

type Modal =
  | { type: "playlist"; playlist?: Playlist }
  | { type: "add" }
  | { type: "snippet"; playlistId: string; track: Track }
  | { type: "delete"; playlist: Playlist }
  | { type: "import"; library: LibraryData }
  | { type: "help" }
  | null;
type Playing = { playlistId: string; trackId: string } | null;

function Cover({ color, small = false }: { color: string; small?: boolean }) {
  return (
    <div
      className={`cover ${color} ${small ? "small-cover" : ""}`}
      aria-hidden="true"
    >
      <div className="cover-orbit" />
      <div className="cover-disc">
        <span />
      </div>
      <div className="cover-spark">✳</div>
    </div>
  );
}

export function MusicApp() {
  const { library, updateLibrary, ready, storageError } = useLibrary();
  const [view, setView] = useState<"library" | "discover">("library");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [playing, setPlaying] = useState<Playing>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSignal, setPlaySignal] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(65);
  const [lastVolume, setLastVolume] = useState(65);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [toast, setToast] = useState("");
  const player = useRef<PlayerHandle>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const activePlaylist =
    library.playlists.find((item) => item.id === library.activePlaylistId) ??
    library.playlists[0];
  const playingPlaylist = library.playlists.find(
    (item) => item.id === playing?.playlistId,
  );
  const currentTrack =
    playingPlaylist?.tracks.find((item) => item.id === playing?.trackId) ??
    null;
  const currentIndex =
    playingPlaylist?.tracks.findIndex((item) => item.id === playing?.trackId) ??
    -1;
  const search = query.trim().toLowerCase();
  const visibleTracks = activePlaylist.tracks.filter((track) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(search),
  );
  const visiblePlaylists = library.playlists.filter((item) =>
    `${item.name} ${item.description}`.toLowerCase().includes(search),
  );
  const discoveries = CATALOG.filter((track) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(search),
  );
  const snippetCount = activePlaylist.tracks.filter(
    (track) => track.start > 0 || track.end !== null || track.speed !== 1,
  ).length;
  const effectiveEnd =
    currentTrack?.end ??
    (duration > 0 ? duration : (currentTrack?.duration ?? 0));
  const effectiveStart = currentTrack?.start ?? 0;
  const rangeEnd = Math.max(effectiveStart + 1, effectiveEnd);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function selectPlaylist(id: string) {
    updateLibrary((value) => ({ ...value, activePlaylistId: id }));
    setView("library");
    setQuery("");
  }
  function updatePlaylist(
    id: string,
    update: (playlist: Playlist) => Playlist,
  ) {
    updateLibrary((value) => ({
      ...value,
      playlists: value.playlists.map((item) =>
        item.id === id ? update(item) : item,
      ),
    }));
  }
  function patchTrack(
    playlistId: string,
    trackId: string,
    changes: Partial<Track>,
  ) {
    updatePlaylist(playlistId, (playlist) => ({
      ...playlist,
      tracks: playlist.tracks.map((track) =>
        track.id === trackId ? { ...track, ...changes } : track,
      ),
    }));
  }
  function playTrack(playlistId: string, track: Track) {
    setPlaying({ playlistId, trackId: track.id });
    setProgress(track.start);
    setDuration(track.duration ?? 0);
    setPlaySignal((signal) => signal + 1);
  }
  function togglePlayback() {
    if (currentTrack) player.current?.toggle();
    else if (activePlaylist.tracks.length)
      playTrack(activePlaylist.id, activePlaylist.tracks[0]);
    else setModal({ type: "add" });
  }
  function nextTrack(direction: number, automatic = false) {
    if (!playingPlaylist || currentIndex < 0) return;
    if (direction < 0 && progress > effectiveStart + 3) {
      player.current?.seek(effectiveStart);
      return;
    }
    const count = playingPlaylist.tracks.length;
    let index = currentIndex + direction;
    if (shuffle && count > 1 && direction > 0)
      index =
        (currentIndex + 1 + Math.floor(Math.random() * (count - 1))) % count;
    if (automatic && index >= count) {
      setIsPlaying(false);
      return;
    }
    index = (index + count) % count;
    playTrack(playingPlaylist.id, playingPlaylist.tracks[index]);
  }
  function addTrack(track: Track) {
    if (activePlaylist.tracks.length >= 500) {
      setToast(
        "This playlist is full. Create another playlist for more tracks.",
      );
      return;
    }
    updatePlaylist(activePlaylist.id, (playlist) => ({
      ...playlist,
      tracks: [...playlist.tracks, track],
    }));
    setModal(null);
    setToast(`Added “${track.title}” to your playlist.`);
  }
  function moveTrack(trackId: string, direction: number) {
    updatePlaylist(activePlaylist.id, (playlist) => {
      const tracks = [...playlist.tracks];
      const from = tracks.findIndex((track) => track.id === trackId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= tracks.length) return playlist;
      [tracks[from], tracks[to]] = [tracks[to], tracks[from]];
      return { ...playlist, tracks };
    });
  }
  function exportLibrary() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `musicforu-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Your library backup is ready.");
  }
  async function importLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setToast("Choose a MusicForU backup smaller than 2 MB.");
      return;
    }
    try {
      setModal({
        type: "import",
        library: readLibrary(JSON.parse(await file.text())),
      });
    } catch {
      setToast(
        "That file is not a valid MusicForU backup. Your current library is unchanged.",
      );
    }
  }
  function saveDuration(value: number) {
    if (
      !currentTrack ||
      !playing ||
      value <= 0 ||
      value > 86400 ||
      (currentTrack.duration !== null &&
        Math.abs(currentTrack.duration - value) < 1)
    )
      return;
    let start = currentTrack.start;
    let end = currentTrack.end;
    if (start >= value || (end !== null && end > value)) {
      start = start >= value ? 0 : start;
      end = end !== null && end > value ? value : end;
      setToast("Snippet times were adjusted to fit the video’s actual length.");
    }
    patchTrack(playing.playlistId, playing.trackId, {
      duration: value,
      start,
      end,
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="MusicForU home">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          <span>
            musicfor<span className="brand-u">u</span>
            <span className="brand-period">.</span>
          </span>
        </a>
        <p className="nav-label">YOUR SPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={view === "library" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setView("library");
              setQuery("");
            }}
          >
            <Library size={19} />
            Your library
            <span className="nav-active-dot" />
          </button>
          <button
            className={view === "discover" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setView("discover");
              setQuery("");
            }}
          >
            <Compass size={19} />
            Discover
          </button>
        </nav>
        <div className="sidebar-heading">
          <p className="nav-label">
            YOUR PLAYLISTS <span>{library.playlists.length}</span>
          </p>
          <button
            className="icon-button"
            aria-label="Create playlist"
            onClick={() => setModal({ type: "playlist" })}
            disabled={!ready || library.playlists.length >= 100}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="playlist-nav">
          {library.playlists.map((playlist) => (
            <button
              key={playlist.id}
              className={`playlist-nav-item ${view === "library" && playlist.id === activePlaylist.id ? "selected" : ""}`}
              onClick={() => selectPlaylist(playlist.id)}
            >
              <Cover color={playlist.color} small />
              <span>
                {playlist.name}
                <small>
                  {playlist.tracks.length}{" "}
                  {playlist.tracks.length === 1 ? "track" : "tracks"}
                </small>
              </span>
              {playing?.playlistId === playlist.id && isPlaying && (
                <AudioLines size={15} className="accent" />
              )}
            </button>
          ))}
        </div>
        <button
          className="new-playlist"
          onClick={() => setModal({ type: "playlist" })}
          disabled={!ready || library.playlists.length >= 100}
        >
          <Plus size={17} />
          Create a playlist
        </button>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="status-dot" />
            <span>
              A space of your own<small>Saved on this device</small>
            </span>
          </div>
          <div className="backup-actions">
            <button onClick={exportLibrary} disabled={!ready}>
              <Download size={14} />
              Export
            </button>
            <button
              onClick={() => importInput.current?.click()}
              disabled={!ready}
            >
              <Upload size={14} />
              Import
            </button>
            <button
              aria-label="About your library"
              onClick={() => setModal({ type: "help" })}
            >
              <CircleHelp size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Your space</span>
            <ChevronRight size={13} />
            <strong>{view === "library" ? "Your library" : "Discover"}</strong>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Search your library"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                view === "library"
                  ? "Search your library"
                  : "Search starter tracks"
              }
            />
            {query && (
              <button
                className="icon-button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </label>
          <span className="topbar-local">
            <span className="status-dot" />
            Personal library
          </span>
        </header>
        <div className="content-grid">
          <main className="main-content" id="main-content">
            {storageError && (
              <div className="storage-warning" role="alert">
                {storageError}
                <button className="text-button" onClick={exportLibrary}>
                  Export library
                </button>
              </div>
            )}
            <div className="page-intro">
              <div>
                <p className="eyebrow">A LITTLE MORE YOU IN EVERY PLAYLIST</p>
                <h1>
                  {view === "library"
                    ? "Your music. Your way."
                    : "Find your next repeat."}
                  <span className="heading-dot"> ✳</span>
                </h1>
              </div>
              <span className="intro-tag">
                <Headphones size={14} />
                Made for your moments
              </span>
            </div>
            {view === "library" ? (
              <>
                <section
                  aria-label="Your playlists"
                  className="playlists-section"
                >
                  <div className="section-heading">
                    <h2>
                      Made by you <span>{library.playlists.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => setModal({ type: "playlist" })}
                      disabled={library.playlists.length >= 100}
                    >
                      <Plus size={14} />
                      New playlist
                    </button>
                  </div>
                  <div className="playlist-cards">
                    {visiblePlaylists.map((playlist) => (
                      <button
                        className={`playlist-card ${playlist.id === activePlaylist.id ? "current" : ""}`}
                        key={playlist.id}
                        onClick={() => selectPlaylist(playlist.id)}
                      >
                        <Cover color={playlist.color} />
                        <div className="playlist-card-text">
                          <strong>{playlist.name}</strong>
                          <span>
                            {playlist.tracks.length}{" "}
                            {playlist.tracks.length === 1 ? "track" : "tracks"}{" "}
                            <span className="tiny-dot">·</span> Your mix
                          </span>
                        </div>
                        <span className="card-arrow">
                          <ArrowUpRight size={17} />
                        </span>
                      </button>
                    ))}
                    {visiblePlaylists.length === 0 && (
                      <div className="search-empty">
                        No playlists match “{query}”. Tracks in this playlist
                        are shown below.
                      </div>
                    )}
                  </div>
                </section>
                <section
                  className={`playlist-hero ${activePlaylist.color}`}
                  aria-label="Selected playlist"
                >
                  <div className="hero-copy">
                    <p className="eyebrow">
                      <ListMusic size={13} /> YOUR PLAYLIST
                    </p>
                    <h2>{activePlaylist.name}</h2>
                    <p className="hero-description">
                      {activePlaylist.description ||
                        "A collection that sounds like you."}
                    </p>
                    <div className="hero-meta">
                      <span>
                        {activePlaylist.tracks.length}{" "}
                        {activePlaylist.tracks.length === 1
                          ? "track"
                          : "tracks"}
                      </span>
                      <span>·</span>
                      <span>
                        {snippetCount} custom{" "}
                        {snippetCount === 1 ? "snippet" : "snippets"}
                      </span>
                    </div>
                    <div className="hero-actions">
                      <button
                        className="button primary"
                        onClick={() =>
                          activePlaylist.tracks.length
                            ? playTrack(
                                activePlaylist.id,
                                activePlaylist.tracks[0],
                              )
                            : setModal({ type: "add" })
                        }
                      >
                        <Play size={15} fill="currentColor" />
                        {activePlaylist.tracks.length
                          ? "Play playlist"
                          : "Add first track"}
                      </button>
                      <button
                        className="hero-edit"
                        aria-label="Edit playlist"
                        onClick={() =>
                          setModal({
                            type: "playlist",
                            playlist: activePlaylist,
                          })
                        }
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="hero-art">
                    <Cover color={activePlaylist.color} />
                    <span className="hero-art-note">
                      ON YOUR
                      <br />
                      WAVELENGTH.
                    </span>
                  </div>
                  <span className="hero-index">
                    VOL.{" "}
                    {String(
                      library.playlists.indexOf(activePlaylist) + 1,
                    ).padStart(2, "0")}
                  </span>
                </section>
                <section className="track-section" aria-label="Playlist tracks">
                  <div className="section-heading">
                    <h2>
                      The lineup <span>{activePlaylist.tracks.length}</span>
                    </h2>
                    <div className="lineup-actions">
                      <button
                        className="icon-button delete-playlist"
                        aria-label="Delete playlist"
                        title={
                          library.playlists.length === 1
                            ? "Keep at least one playlist"
                            : "Delete playlist"
                        }
                        disabled={library.playlists.length === 1}
                        onClick={() =>
                          setModal({ type: "delete", playlist: activePlaylist })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        className="button secondary compact"
                        onClick={() => setModal({ type: "add" })}
                      >
                        <Plus size={15} />
                        Add track
                      </button>
                    </div>
                  </div>
                  <div className="track-table">
                    <div className="track-table-head">
                      <span>#</span>
                      <span>TRACK</span>
                      <span>YOUR CUT</span>
                      <Clock3 size={14} />
                      <span />
                    </div>
                    {visibleTracks.map((track) => {
                      const index = activePlaylist.tracks.indexOf(track);
                      const isCurrent =
                        playing?.playlistId === activePlaylist.id &&
                        playing.trackId === track.id;
                      const custom = track.start > 0 || track.end !== null;
                      return (
                        <div
                          className={`track-row ${isCurrent ? "now-playing" : ""}`}
                          key={track.id}
                        >
                          <button
                            className="track-play"
                            aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
                            onClick={() =>
                              isCurrent
                                ? player.current?.toggle()
                                : playTrack(activePlaylist.id, track)
                            }
                          >
                            {isCurrent && isPlaying ? (
                              <AudioLines size={16} />
                            ) : (
                              <>
                                <span className="track-number">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <Play
                                  className="track-play-icon"
                                  size={13}
                                  fill="currentColor"
                                />
                              </>
                            )}
                          </button>
                          <div className="track-identity">
                            <img
                              src={`https://i.ytimg.com/vi/${track.videoId}/default.jpg`}
                              alt=""
                              loading="lazy"
                            />
                            <div>
                              <button
                                className="track-title"
                                onClick={() =>
                                  playTrack(activePlaylist.id, track)
                                }
                              >
                                {track.title}
                              </button>
                              <p>{track.artist}</p>
                            </div>
                          </div>
                          <button
                            className={`cut-badge ${custom || track.speed !== 1 ? "custom" : ""}`}
                            onClick={() =>
                              setModal({
                                type: "snippet",
                                playlistId: activePlaylist.id,
                                track,
                              })
                            }
                            aria-label={`Edit snippet for ${track.title}`}
                          >
                            <Scissors size={12} />
                            <span>
                              {custom
                                ? `${formatTime(track.start)} – ${track.end !== null ? formatTime(track.end) : "end"}`
                                : "Full track"}
                            </span>
                            {track.speed !== 1 && <b>{track.speed}×</b>}
                          </button>
                          <span className="track-duration">
                            {formatTime(
                              track.end !== null
                                ? (track.end - track.start) / track.speed
                                : track.duration !== null
                                  ? (track.duration - track.start) / track.speed
                                  : null,
                            )}
                          </span>
                          <details className="track-menu">
                            <summary aria-label={`Actions for ${track.title}`}>
                              <Ellipsis size={19} />
                            </summary>
                            <div className="track-menu-popover">
                              <button
                                onClick={() =>
                                  setModal({
                                    type: "snippet",
                                    playlistId: activePlaylist.id,
                                    track,
                                  })
                                }
                              >
                                <Scissors size={14} />
                                Edit snippet
                              </button>
                              <button
                                disabled={index === 0}
                                onClick={() => moveTrack(track.id, -1)}
                              >
                                <ArrowUp size={14} />
                                Move up
                              </button>
                              <button
                                disabled={
                                  index === activePlaylist.tracks.length - 1
                                }
                                onClick={() => moveTrack(track.id, 1)}
                              >
                                <ArrowDown size={14} />
                                Move down
                              </button>
                              <button
                                className="danger-text"
                                onClick={() => {
                                  updatePlaylist(
                                    activePlaylist.id,
                                    (playlist) => ({
                                      ...playlist,
                                      tracks: playlist.tracks.filter(
                                        (item) => item.id !== track.id,
                                      ),
                                    }),
                                  );
                                  if (isCurrent) {
                                    setPlaying(null);
                                    setIsPlaying(false);
                                  }
                                  setToast(`Removed “${track.title}”.`);
                                }}
                              >
                                <Trash2 size={14} />
                                Remove track
                              </button>
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                  {visibleTracks.length === 0 && (
                    <div className="empty-state">
                      <Music2 size={27} />
                      <h3>
                        {search
                          ? "No tracks found"
                          : "Your next favorite belongs here."}
                      </h3>
                      <p>
                        {search
                          ? "Try another title or artist."
                          : "Add a YouTube link or explore a few starter tracks."}
                      </p>
                      <button
                        className="button secondary"
                        onClick={() =>
                          search ? setQuery("") : setModal({ type: "add" })
                        }
                      >
                        {search ? "Clear search" : "Add your first track"}
                      </button>
                    </div>
                  )}
                  <div className="lineup-footer">
                    <span>
                      <Check size={12} />
                      {storageError
                        ? "Export to back up your changes"
                        : ready
                          ? "Your mix, saved automatically"
                          : "Loading your saved library…"}
                    </span>
                    <span>Make every second yours.</span>
                  </div>
                </section>
              </>
            ) : (
              <section className="discovery-section">
                <div className="discovery-banner">
                  <span className="eyebrow">A PLACE TO START</span>
                  <h2>
                    Something for your
                    <br />
                    next listening session.
                  </h2>
                  <p>
                    A few starter tracks to make your own. Add any YouTube video
                    to keep exploring.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setModal({ type: "add" })}
                  >
                    <Plus size={16} />
                    Add a YouTube link
                  </button>
                  <AudioLines
                    className="discovery-art"
                    size={150}
                    strokeWidth={0.6}
                  />
                </div>
                <div className="section-heading">
                  <h2>Start with a favorite</h2>
                  <span className="muted">Adding to {activePlaylist.name}</span>
                </div>
                <div className="discovery-grid">
                  {discoveries.map((track, index) => (
                    <article className="discovery-card" key={track.id}>
                      <div
                        className={`discovery-image ${COLORS[index % COLORS.length]}`}
                      >
                        <img
                          src={`https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`}
                          alt=""
                          loading="lazy"
                        />
                        <Music2 size={32} />
                      </div>
                      <div className="discovery-card-body">
                        <h3>{track.title}</h3>
                        <p>{track.artist}</p>
                        <button
                          className="button secondary compact"
                          onClick={() =>
                            addTrack({ ...track, id: crypto.randomUUID() })
                          }
                        >
                          <Plus size={14} />
                          Add to playlist
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {discoveries.length === 0 && (
                  <div className="empty-state">
                    <Search size={25} />
                    <h3>No starter tracks found</h3>
                    <p>Add your own YouTube link to find your favorite.</p>
                  </div>
                )}
              </section>
            )}
            <footer className="main-footer">
              <span>BUILT AROUND YOU.</span>
              <span>
                Music powered by YouTube <ArrowUpRight size={11} />
              </span>
            </footer>
          </main>

          <aside className="listening-room" aria-label="Now playing">
            <div className="room-heading">
              <h2>Your listening room</h2>
              <span className="live-pill">
                {isPlaying ? (
                  <>
                    <span className="status-dot" />
                    PLAYING
                  </>
                ) : (
                  "TAKE A MOMENT"
                )}
              </span>
            </div>
            <YouTubePlayer
              ref={player}
              track={currentTrack}
              playSignal={playSignal}
              loop={loop}
              volume={volume}
              onPlaying={setIsPlaying}
              onProgress={(time, length) => {
                setProgress(time);
                if (length > 0) setDuration(length);
              }}
              onDuration={saveDuration}
              onEnded={() => nextTrack(1, true)}
            />
            <div className="room-track">
              <p className="eyebrow">
                {currentTrack ? "NOW IN YOUR ORBIT" : "READY WHEN YOU ARE"}
              </p>
              <h3>{currentTrack?.title ?? "Find your frequency."}</h3>
              <p>
                {currentTrack?.artist ?? "Press play. Settle in. Stay a while."}
              </p>
              {currentTrack && (
                <a
                  className="youtube-link"
                  href={`https://www.youtube.com/watch?v=${currentTrack.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on YouTube
                  <ArrowUpRight size={12} />
                </a>
              )}
            </div>
            <div className="snippet-card">
              <div className="snippet-card-icon">
                <Scissors size={18} />
              </div>
              <p className="eyebrow">THE GOOD PART, ON REPEAT</p>
              <h3>
                {currentTrack &&
                (currentTrack.start > 0 || currentTrack.end !== null)
                  ? "Your favorite seconds."
                  : "Skip to the feeling."}
              </h3>
              <p>
                {currentTrack &&
                (currentTrack.start > 0 || currentTrack.end !== null)
                  ? `${formatTime(currentTrack.start)} → ${currentTrack.end !== null ? formatTime(currentTrack.end) : "end"} · ${currentTrack.speed}× playback`
                  : "That chorus. That drop. That one moment. Save exactly what you want to hear."}
              </p>
              <button
                className="text-button"
                onClick={() => {
                  const track = currentTrack ?? activePlaylist.tracks[0];
                  if (track)
                    setModal({
                      type: "snippet",
                      playlistId: playing?.playlistId ?? activePlaylist.id,
                      track,
                    });
                  else setModal({ type: "add" });
                }}
              >
                Make a snippet <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="queue-heading">
              <h3>Up next</h3>
              <ListMusic size={16} />
            </div>
            {playingPlaylist &&
            currentIndex < playingPlaylist.tracks.length - 1 ? (
              <div className="queue-list">
                {playingPlaylist.tracks
                  .slice(currentIndex + 1, currentIndex + 4)
                  .map((track, index) => (
                    <button
                      key={track.id}
                      onClick={() => playTrack(playingPlaylist.id, track)}
                    >
                      <span className="queue-index">{index + 1}</span>
                      <img
                        src={`https://i.ytimg.com/vi/${track.videoId}/default.jpg`}
                        alt=""
                        loading="lazy"
                      />
                      <span>
                        <strong>{track.title}</strong>
                        <small>{track.artist}</small>
                      </span>
                      <Play size={12} />
                    </button>
                  ))}
              </div>
            ) : (
              <p className="queue-empty">
                {currentTrack
                  ? "You’re at the end of this mix. A good time for one more favorite."
                  : "Your next moment starts with a track."}
              </p>
            )}
            <div className="room-note">
              <Headphones size={16} />
              <span>
                Less noise.
                <br />
                <strong>More of what you love.</strong>
              </span>
            </div>
          </aside>
        </div>
      </div>

      <div className="playback-bar" aria-label="Playback controls">
        <div className="playback-track">
          {currentTrack ? (
            <img
              src={`https://i.ytimg.com/vi/${currentTrack.videoId}/default.jpg`}
              alt=""
            />
          ) : (
            <div className="playback-empty-cover">
              <Music2 size={20} />
            </div>
          )}
          <div>
            <strong>
              {currentTrack?.title ?? "Your soundtrack is waiting"}
            </strong>
            <span>
              {currentTrack?.artist ?? "Pick something that feels like you"}
            </span>
          </div>
          {currentTrack && (
            <button
              className="icon-button bottom-snip"
              aria-label="Edit current snippet"
              onClick={() =>
                playing &&
                setModal({
                  type: "snippet",
                  playlistId: playing.playlistId,
                  track: currentTrack,
                })
              }
            >
              <Scissors size={16} />
            </button>
          )}
        </div>
        <div className="transport">
          <div className="transport-buttons">
            <button
              className={`icon-button ${shuffle ? "enabled" : ""}`}
              aria-label="Shuffle"
              aria-pressed={shuffle}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Previous track"
              disabled={!currentTrack}
              onClick={() => nextTrack(-1)}
            >
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              className="main-play"
              aria-label={isPlaying ? "Pause playback" : "Play playback"}
              onClick={togglePlayback}
              disabled={!ready}
            >
              {!ready ? (
                <LoaderCircle size={19} className="spin" />
              ) : isPlaying ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              className="icon-button"
              aria-label="Next track"
              disabled={!currentTrack}
              onClick={() => nextTrack(1)}
            >
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button
              className={`icon-button ${loop ? "enabled" : ""}`}
              aria-label="Repeat current snippet"
              aria-pressed={loop}
              onClick={() => setLoop(!loop)}
            >
              <Repeat1 size={17} />
            </button>
          </div>
          <div className="progress-control">
            <span>{formatTime(Math.max(0, progress - effectiveStart))}</span>
            <input
              type="range"
              aria-label="Seek within track"
              min={effectiveStart}
              max={rangeEnd}
              step={0.1}
              value={Math.min(rangeEnd, Math.max(effectiveStart, progress))}
              disabled={!currentTrack || effectiveEnd <= effectiveStart}
              onChange={(event) => {
                const value = Number(event.target.value);
                setProgress(value);
                player.current?.seek(value);
              }}
              style={
                {
                  "--progress": `${Math.max(0, Math.min(100, ((progress - effectiveStart) / (rangeEnd - effectiveStart)) * 100))}%`,
                } as CSSProperties
              }
            />
            <span>
              {formatTime(
                effectiveEnd > 0 ? effectiveEnd - effectiveStart : null,
              )}
            </span>
          </div>
        </div>
        <div className="playback-options">
          <select
            aria-label="Playback speed"
            value={currentTrack?.speed ?? 1}
            disabled={!currentTrack}
            onChange={(event) =>
              playing &&
              patchTrack(playing.playlistId, playing.trackId, {
                speed: Number(event.target.value),
              })
            }
          >
            {SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
          <span className="control-separator" />
          <button
            className="icon-button"
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            onClick={() => {
              if (volume) {
                setLastVolume(volume);
                setVolume(0);
              } else setVolume(lastVolume || 65);
            }}
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
          <span className="quality-tag">YOUTUBE</span>
        </div>
      </div>

      <input
        className="sr-only"
        type="file"
        accept="application/json,.json"
        ref={importInput}
        onChange={importLibrary}
        aria-label="Import playlist backup"
        tabIndex={-1}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.type === "playlist" && (
        <PlaylistDialog
          playlist={modal.playlist}
          onClose={() => setModal(null)}
          onSave={(value) => {
            if (modal.playlist) {
              updatePlaylist(modal.playlist.id, (playlist) => ({
                ...playlist,
                ...value,
              }));
            } else {
              if (library.playlists.length >= 100) return;
              const playlist = {
                id: crypto.randomUUID(),
                ...value,
                tracks: [],
              };
              updateLibrary((lib) => ({
                ...lib,
                activePlaylistId: playlist.id,
                playlists: [...lib.playlists, playlist],
              }));
              setView("library");
              setQuery("");
            }
            setModal(null);
            setToast("Playlist saved. Make yourself at home.");
          }}
        />
      )}
      {modal?.type === "add" && (
        <AddTrackDialog
          playlistName={activePlaylist.name}
          onClose={() => setModal(null)}
          onAdd={addTrack}
        />
      )}
      {modal?.type === "snippet" && (
        <SnippetDialog
          track={modal.track}
          onClose={() => setModal(null)}
          onSave={(changes) => {
            patchTrack(modal.playlistId, modal.track.id, changes);
            setModal(null);
            setToast("Your snippet is saved. Play the track to hear your cut.");
          }}
        />
      )}
      {modal?.type === "delete" && (
        <Dialog
          title="Let this mix go?"
          subtitle={`Delete “${modal.playlist.name}” and its saved snippets from this device.`}
          onClose={() => setModal(null)}
        >
          <div className="form-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep playlist
            </button>
            <button
              className="button danger"
              onClick={() => {
                const id = modal.playlist.id;
                updateLibrary((lib) => {
                  const playlists = lib.playlists.filter(
                    (item) => item.id !== id,
                  );
                  return {
                    ...lib,
                    playlists,
                    activePlaylistId:
                      lib.activePlaylistId === id
                        ? playlists[0].id
                        : lib.activePlaylistId,
                  };
                });
                if (playing?.playlistId === id) {
                  setPlaying(null);
                  setIsPlaying(false);
                }
                setModal(null);
                setToast("Playlist deleted.");
              }}
            >
              Delete playlist
            </button>
          </div>
        </Dialog>
      )}
      {modal?.type === "import" && (
        <Dialog
          title="Bring your library back"
          subtitle={`This backup has ${modal.library.playlists.length} playlists. Restoring it replaces the library on this device.`}
          onClose={() => setModal(null)}
        >
          <div className="form-actions">
            <button className="button secondary" onClick={exportLibrary}>
              <Download size={16} />
              Back up current
            </button>
            <button
              className="button primary"
              onClick={() => {
                updateLibrary(modal.library);
                setPlaying(null);
                setIsPlaying(false);
                setQuery("");
                setView("library");
                setModal(null);
                setToast("Your library is restored.");
              }}
            >
              Restore backup
            </button>
          </div>
        </Dialog>
      )}
      {modal?.type === "help" && (
        <Dialog
          title="A space of your own"
          subtitle="Your music, with a little more freedom."
          onClose={() => setModal(null)}
        >
          <div className="help-copy">
            <p>
              Add YouTube videos to playlists, then choose{" "}
              <Scissors size={14} /> to save a start time, end time, and
              playback speed for each track. Repeat loops the current track or
              snippet; shuffle changes what plays next.
            </p>
            <p>
              Your playlists save automatically in this browser. Use Export to
              keep a backup or move them to another device. Clearing browser
              data removes this device’s library.
            </p>
            <p>
              Playback needs an internet connection and a video that allows
              embedding. Some videos limit playback speeds. Track lengths are
              detected when you first play them.
            </p>
            <p>
              Discover contains a small starter collection. To add any other
              song, use its YouTube video link.
            </p>
            <button className="button primary" onClick={() => setModal(null)}>
              Sounds good
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
