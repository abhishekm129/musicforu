"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { type Track } from "@/lib/library";

type YouTubePlayer = {
  playVideo(): void; pauseVideo(): void; destroy(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void; setPlaybackRate(rate: number): void;
  getPlaybackRate(): number; getAvailablePlaybackRates(): number[];
  getCurrentTime(): number; getDuration(): number;
  loadVideoById(options: { videoId: string; startSeconds: number; endSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds: number; endSeconds?: number }): void;
};
type YouTubeNamespace = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer };
declare global { interface Window { YT?: YouTubeNamespace; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<YouTubeNamespace> | null = null;
function loadAPI(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 15000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      apiPromise = null;
      reject(new Error("The YouTube player could not connect. Check your connection or content blocker, then retry."));
    }
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT); else fail();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiPromise;
}

export type PlayerHandle = { toggle(): void; seek(seconds: number): void };
type Props = {
  track: Track | null; playSignal: number; loop: boolean; volume: number;
  onPlaying(playing: boolean): void;
  onProgress(time: number, duration: number): void;
  onDuration(duration: number): void;
  onEnded(): void;
};

export const YouTubePlayer = forwardRef<PlayerHandle, Props>(function YouTubePlayer(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const live = useRef(props);
  live.current = props;
  const playing = useRef(false);
  const ended = useRef(false);
  const consumedSignal = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const hasTrack = Boolean(props.track);

  useImperativeHandle(ref, () => ({
    toggle() {
      if (!ready || !player.current) return;
      if (playing.current) player.current.pauseVideo();
      else {
        const track = live.current.track;
        const time = player.current.getCurrentTime();
        if (track && (time < track.start || (track.end !== null && time >= track.end - 0.1) || time >= player.current.getDuration() - 0.1)) player.current.seekTo(track.start, true);
        ended.current = false;
        player.current.playVideo();
      }
    },
    seek(seconds) {
      const track = live.current.track;
      if (ready && player.current && track) {
        const end = track.end ?? player.current.getDuration();
        player.current.seekTo(Math.max(track.start, Math.min(seconds, end > 0 ? end - 0.1 : seconds)), true);
        ended.current = false;
      }
    },
  }), [ready]);

  useEffect(() => {
    if (!hasTrack) return;
    let cancelled = false;
    setError("");
    setReady(false);
    loadAPI().then((YT) => {
      if (cancelled || !host.current) return;
      const element = document.createElement("div");
      host.current.replaceChildren(element);
      player.current = new YT.Player(element, {
        width: "100%", height: "100%",
        playerVars: { playsinline: 1, origin: window.location.origin, controls: 1, rel: 0 },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            playing.current = event.data === 1;
            live.current.onPlaying(playing.current);
            if (event.data === 1) {
              setError("");
              ended.current = false;
              const current = player.current;
              const track = live.current.track;
              if (current && track) {
                const rates = current.getAvailablePlaybackRates();
                if (rates.includes(track.speed)) current.setPlaybackRate(track.speed);
                else if (rates.length) setError(`This video does not support ${track.speed}× speed. Choose another speed.`);
                const duration = current.getDuration();
                if (duration > 0 && duration <= 86400) live.current.onDuration(duration);
              }
            }
            if (event.data === 0) finish();
          },
          onError: (event: { data: number }) => {
            if (cancelled) return;
            playing.current = false;
            live.current.onPlaying(false);
            setError([101, 150].includes(event.data) ? "This creator has disabled embedded playback. Open the video on YouTube or choose another track." : event.data === 100 ? "This video is private or no longer available. Try another track." : "YouTube could not play this video. Retry or open it on YouTube.");
          },
          onAutoplayBlocked: () => { if (!cancelled) setError("Your browser paused automatic playback. Press play in the YouTube player to continue."); },
        },
      });
    }).catch((reason: Error) => { if (!cancelled) setError(reason.message); });

    function finish() {
      const current = player.current;
      const track = live.current.track;
      if (ended.current || !current || !track) return;
      ended.current = true;
      if (live.current.loop) {
        current.pauseVideo();
        current.seekTo(track.start, true);
        current.playVideo();
      } else {
        current.pauseVideo();
        playing.current = false;
        live.current.onPlaying(false);
        live.current.onEnded();
      }
    }

    const timer = window.setInterval(() => {
      const current = player.current;
      const track = live.current.track;
      if (!current || !track || typeof current.getCurrentTime !== "function") return;
      const time = current.getCurrentTime();
      const duration = current.getDuration();
      live.current.onProgress(time, duration);
      if (playing.current && time < track.start - 0.5) current.seekTo(track.start, true);
      if (playing.current && track.end !== null && time >= track.end - 0.1) finish();
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      player.current?.destroy();
      player.current = null;
      playing.current = false;
    };
  }, [hasTrack, retry]);

  useEffect(() => {
    if (!ready || !player.current || !props.track) return;
    const track = props.track;
    setError("");
    ended.current = false;
    const options = { videoId: track.videoId, startSeconds: track.start, ...(track.end !== null ? { endSeconds: track.end } : {}) };
    const autoplay = props.playSignal !== consumedSignal.current || playing.current;
    consumedSignal.current = props.playSignal;
    if (autoplay) player.current.loadVideoById(options); else player.current.cueVideoById(options);
    // YouTube resets playback speed when loading another video.
    player.current.setPlaybackRate(track.speed);
  }, [ready, props.track?.id, props.track?.videoId, props.track?.start, props.track?.end, props.playSignal]);

  useEffect(() => {
    if (!ready || !player.current || !props.track) return;
    const desired = props.track.speed;
    const rates = player.current.getAvailablePlaybackRates();
    if (rates.length && !rates.includes(desired)) {
      setError(`This video does not support ${desired}× speed. Choose another speed or use the YouTube controls.`);
      return;
    }
    player.current.setPlaybackRate(desired);
  }, [ready, props.track?.speed, props.track?.id]);

  useEffect(() => {
    if (ready) player.current?.setVolume(props.volume);
  }, [ready, props.volume]);

  return <div className="youtube-shell">
    {!hasTrack && <div className="player-placeholder"><span className="placeholder-disc" /><p>A moment worth playing.</p><small>Choose a track to start listening.</small></div>}
    <div className={hasTrack ? "youtube-frame" : "youtube-frame empty"} ref={host} />
    {error && <div className="player-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry player</button></div>}
  </div>;
});
