"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, Link2, LoaderCircle, Plus, Scissors, X } from "lucide-react";
import {
  COLORS,
  extractVideoId,
  formatTime,
  parseTime,
  snippetError,
  SPEEDS,
  type Playlist,
  type Track,
} from "@/lib/library";

export function Dialog({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button
          className="icon-button close-modal"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <h2 id="dialog-title">{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
    </dialog>
  );
}

export function PlaylistDialog({
  playlist,
  onSave,
  onClose,
}: {
  playlist?: Playlist;
  onSave(value: Pick<Playlist, "name" | "description" | "color">): void;
  onClose(): void;
}) {
  const [color, setColor] = useState(playlist?.color ?? "violet");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    onSave({
      name,
      description: String(data.get("description") ?? "").trim(),
      color,
    });
  }
  return (
    <Dialog
      title={playlist ? "Make it yours" : "A new kind of mix"}
      subtitle={
        playlist
          ? "Give your playlist a little personality."
          : "Every great playlist starts with a name."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="dialog-form">
        <label>
          Playlist name
          <input
            name="name"
            placeholder="My next obsession"
            defaultValue={playlist?.name}
            required
            maxLength={80}
            autoFocus
          />
        </label>
        <label>
          Description <span className="muted">(optional)</span>
          <textarea
            name="description"
            placeholder="What's the mood?"
            defaultValue={playlist?.description}
            maxLength={200}
            rows={2}
          />
        </label>
        <fieldset>
          <legend>Pick a color</legend>
          <div className="color-options">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={`color-dot ${item}`}
                onClick={() => setColor(item)}
                aria-label={item}
                aria-pressed={color === item}
              >
                {item === color && <Check size={18} />}
              </button>
            ))}
          </div>
        </fieldset>
        <button className="button primary" type="submit">
          <Plus size={17} />
          {playlist ? "Save playlist" : "Create playlist"}
        </button>
      </form>
    </Dialog>
  );
}

export function AddTrackDialog({
  playlistName,
  onAdd,
  onClose,
}: {
  playlistName: string;
  onAdd(track: Track): void;
  onClose(): void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const url = String(data.get("url") ?? "");
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError("Paste a valid YouTube video URL or video ID.");
      return;
    }
    let title = String(data.get("title") ?? "").trim();
    let artist = String(data.get("artist") ?? "").trim();
    if (!manual) {
      setLoading(true);
      controller.current = new AbortController();
      try {
        const response = await fetch(
          `/api/youtube?url=${encodeURIComponent(url)}`,
          { signal: controller.current.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        title = result.title;
        artist = result.artist;
      } catch (reason) {
        if (controller.current.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load video details.",
        );
        setManual(true);
        setLoading(false);
        return;
      }
    }
    if (!title || !artist) {
      setError("Add a title and artist for this track.");
      setLoading(false);
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      videoId,
      title,
      artist,
      duration: null,
      start: 0,
      end: null,
      speed: 1,
    });
  }
  return (
    <Dialog
      title="Bring your favorite track"
      subtitle={`Add a YouTube video to “${playlistName}”.`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="dialog-form">
        <label>
          <span>
            <Link2 size={14} /> YouTube link
          </span>
          <input
            name="url"
            placeholder="https://www.youtube.com/watch?v=..."
            maxLength={2048}
            required
            autoFocus
            disabled={loading}
          />
        </label>
        <p className="field-hint">
          Video details are filled in automatically. Public videos with
          embedding enabled work best.
        </p>
        <button
          type="button"
          className="text-button manual-toggle"
          onClick={() => setManual(!manual)}
          disabled={loading}
        >
          {manual
            ? "Use automatic video details"
            : "Enter title and artist manually"}
        </button>
        {manual && (
          <>
            <label>
              Track title
              <input
                name="title"
                maxLength={300}
                required
                placeholder="Track name"
              />
            </label>
            <label>
              Artist or channel
              <input
                name="artist"
                maxLength={200}
                required
                placeholder="Artist name"
              />
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Plus size={17} />
          )}
          {loading ? "Finding your track…" : "Add to playlist"}
        </button>
      </form>
    </Dialog>
  );
}

export function SnippetDialog({
  track,
  onSave,
  onClose,
}: {
  track: Track;
  onSave(changes: Pick<Track, "start" | "end" | "speed">): void;
  onClose(): void;
}) {
  const [start, setStart] = useState(formatTime(track.start));
  const [end, setEnd] = useState(
    track.end === null ? "" : formatTime(track.end),
  );
  const [speed, setSpeed] = useState(track.speed);
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const startSeconds = parseTime(start);
    const endSeconds = end.trim() ? parseTime(end) : null;
    if (startSeconds === null || (end.trim() && endSeconds === null)) {
      setError("Use seconds, m:ss, or h:mm:ss for your timestamps.");
      return;
    }
    const message = snippetError(startSeconds, endSeconds, track.duration);
    if (message) {
      setError(message);
      return;
    }
    onSave({ start: startSeconds, end: endSeconds, speed });
  }
  const length =
    parseTime(end) !== null && parseTime(start) !== null
      ? (parseTime(end)! - parseTime(start)!) / speed
      : null;
  return (
    <Dialog
      title="Keep the part you love"
      subtitle={`${track.title} · ${track.artist}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="dialog-form">
        <div className="snippet-illustration" aria-hidden="true">
          {Array.from({ length: 42 }, (_, i) => (
            <i key={i} style={{ height: `${20 + ((i * 17 + 29) % 65)}%` }} />
          ))}
          <span>
            <Scissors size={18} />
          </span>
        </div>
        <div className="two-fields">
          <label>
            Start time
            <input
              aria-label="Start time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              placeholder="0:00"
              required
              autoFocus
            />
          </label>
          <label>
            End time
            <input
              aria-label="End time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              placeholder="End of track"
            />
          </label>
        </div>
        <p className="field-hint">
          Use m:ss or seconds. Leave the end blank for the full remaining track.
          {track.duration !== null
            ? ` Track length: ${formatTime(track.duration)}.`
            : " Play the track once to detect its length."}
        </p>
        <label>
          Playback speed
          <select
            aria-label="Snippet playback speed"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {SPEEDS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
                {rate === 1
                  ? " · Original"
                  : rate < 1
                    ? " · Slower"
                    : " · Faster"}
              </option>
            ))}
          </select>
        </label>
        {length !== null && length > 0 && (
          <p className="field-hint">
            Listening time at {speed}×: {formatTime(length)}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setStart("0:00");
              setEnd("");
              setSpeed(1);
              setError("");
            }}
          >
            Reset to full track
          </button>
          <button type="submit" className="button primary">
            <Check size={17} />
            Save snippet
          </button>
        </div>
      </form>
    </Dialog>
  );
}
