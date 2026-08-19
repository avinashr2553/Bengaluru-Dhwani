"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const PLAYLIST_ID = "PLLRsOv47WAIE";

function formatTime(value) {
  if (!Number.isFinite(value)) return "0:00";

  const total = Math.floor(value);

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function loadYouTubeAPI() {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const finish = () => {
      const started = Date.now();

      const wait = () => {
        if (window.YT?.Player) {
          resolve(window.YT);
        } else if (Date.now() - started > 10000) {
          reject(new Error("YouTube IFrame API timed out."));
        } else {
          setTimeout(wait, 50);
        }
      };

      wait();
    };

    if (existing) {
      finish();
      return;
    }

    window.onYouTubeIframeAPIReady = finish;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;

    script.onerror = () =>
      reject(new Error("Could not load YouTube IFrame API."));

    document.head.appendChild(script);
  });
}

export default function RadioPlayer() {
  const hostRef = useRef(null);
  const playerRef = useRef(null);

  // Prevent multiple attempts to restart the playlist.
  const restartingPlaylistRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [title, setTitle] = useState("Bengaluru Dhwani");
  const [artist, setArtist] = useState("Bengaluru Dhwani");
  const [artwork, setArtwork] = useState("");

  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const [items, setItems] = useState([]);
  const [trackInfo, setTrackInfo] = useState({});
  const [index, setIndex] = useState(0);

  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState("Loading radio…");

  // VOLUME
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  // ONLINE COUNT
  const [onlineCount, setOnlineCount] = useState(0);

  // THEME
  const [isMonsoon, setIsMonsoon] = useState(false);

  /* =========================
     LOAD SAVED THEME
  ========================= */

  useEffect(() => {
    const savedTheme = localStorage.getItem(
      "bengaluru-dhwani-theme"
    );

    if (savedTheme === "monsoon") {
      setIsMonsoon(true);
    }
  }, []);

  /* =========================
     SUPABASE PRESENCE
  ========================= */

  useEffect(() => {
    const presenceKey = crypto.randomUUID();

    const channel = supabase.channel(
      "bengaluru-dhwani-listeners",
      {
        config: {
          presence: {
            key: presenceKey,
          },
        },
      }
    );

    const updateOnlineCount = () => {
      const state = channel.presenceState();

      setOnlineCount(Object.keys(state).length);
    };

    channel
      .on(
        "presence",
        { event: "sync" },
        updateOnlineCount
      )
      .on(
        "presence",
        { event: "join" },
        updateOnlineCount
      )
      .on(
        "presence",
        { event: "leave" },
        updateOnlineCount
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            online_at: new Date().toISOString(),
          });

          updateOnlineCount();
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, []);

  /* =========================
     LOAD YOUTUBE TRACK INFO
  ========================= */

  const loadTrackInfo = useCallback(async (ids) => {
    if (!ids?.length) return;

    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) return;

      const data = await response.json();

      const mapped = {};

      data.forEach((track) => {
        mapped[track.id] = {
          title: track.title,
          author: track.author,
        };
      });

      setTrackInfo(mapped);
    } catch (error) {
      console.error(
        "Failed to load YouTube titles:",
        error
      );
    }
  }, []);

  /* =========================
     SYNC CURRENT TRACK
  ========================= */

  const syncTrack = useCallback(() => {
    const player = playerRef.current;

    if (!player) return;

    const data = player.getVideoData?.() || {};
    const videoId = data.video_id;

    setTitle(
      data.title || "Bengaluru Dhwani"
    );

    setArtist("Bengaluru Dhwani");

    if (videoId) {
      setArtwork(
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      );
    }

    const currentIndex =
      player.getPlaylistIndex?.();

    if (
      Number.isInteger(currentIndex) &&
      currentIndex >= 0
    ) {
      setIndex(currentIndex);
    }

    const playlist =
      player.getPlaylist?.() || [];

    if (playlist.length) {
      setItems(playlist);
      loadTrackInfo(playlist);
    }
  }, [loadTrackInfo]);

  /* =========================
     INITIALIZE YOUTUBE
  ========================= */

  useEffect(() => {
    let disposed = false;

    async function init() {
      try {
        const YT = await loadYouTubeAPI();

        if (
          disposed ||
          !hostRef.current
        ) {
          return;
        }

        const player = new YT.Player(
          hostRef.current,
          {
            width: "1",
            height: "1",

            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              listType: "playlist",
              list: PLAYLIST_ID,
              origin: window.location.origin,
            },

            events: {
              onReady: (event) => {
                playerRef.current =
                  event.target;

                setReady(true);

                setStatus(
                  "Ready — press play."
                );

                event.target.setVolume(
                  volume
                );

                /*
                 * Enable YouTube's playlist looping.
                 * This is the primary loop mechanism.
                 */
                event.target.setLoop(true);

                setTimeout(
                  syncTrack,
                  700
                );
              },

              onStateChange: (event) => {
                const player =
                  playerRef.current;

                if (
                  event.data ===
                  YT.PlayerState.PLAYING
                ) {
                  setPlaying(true);
                  setStatus("Playing");

                  syncTrack();

                } else if (
                  event.data ===
                  YT.PlayerState.PAUSED
                ) {
                  setPlaying(false);
                  setStatus("Paused");

                } else if (
                  event.data ===
                  YT.PlayerState.ENDED
                ) {
                  if (!player) return;

                  const playlist =
                    player.getPlaylist?.() || [];

                  const currentIndex =
                    player.getPlaylistIndex?.();

                  /*
                   * If this is the final item,
                   * explicitly jump to item 0.
                   *
                   * This is a fallback in case
                   * YouTube does not honor setLoop()
                   * for the embedded playlist.
                   */
                  if (
                    playlist.length > 0 &&
                    currentIndex ===
                      playlist.length - 1 &&
                    !restartingPlaylistRef.current
                  ) {
                    restartingPlaylistRef.current =
                      true;

                    player.playVideoAt(0);

                    setTimeout(() => {
                      restartingPlaylistRef.current =
                        false;

                      syncTrack();
                      setPlaying(true);
                      setStatus("Playing");
                    }, 300);

                  } else {
                    /*
                     * For normal playlist transitions,
                     * let YouTube continue naturally.
                     */
                    setTimeout(
                      syncTrack,
                      100
                    );
                  }

                } else if (
                  event.data ===
                  YT.PlayerState.CUED
                ) {
                  syncTrack();
                }
              },

              onError: (event) => {
                console.error(
                  "YouTube player error:",
                  event.data
                );

                setStatus(
                  `YouTube error ${event.data}`
                );
              },
            },
          }
        );

        playerRef.current = player;

      } catch (error) {
        console.error(error);

        setStatus(
          "Could not load YouTube."
        );
      }
    }

    init();

    return () => {
      disposed = true;

      if (
        playerRef.current?.destroy
      ) {
        playerRef.current.destroy();
      }

      playerRef.current = null;
    };
  }, [syncTrack]);

  /* =========================
     PROGRESS UPDATE
  ========================= */

  useEffect(() => {
    const timer = setInterval(() => {
      const player =
        playerRef.current;

      if (!player || !playing) return;

      const now =
        player.getCurrentTime?.() || 0;

      const total =
        player.getDuration?.() || 0;

      setCurrent(now);
      setDuration(total);

      /*
       * Extra fallback:
       *
       * If the final song reaches its end but
       * YouTube does not fire ENDED correctly,
       * jump to the first song ourselves.
       */
      const playlist =
        player.getPlaylist?.() || [];

      const currentIndex =
        player.getPlaylistIndex?.();

      if (
        playlist.length > 0 &&
        currentIndex ===
          playlist.length - 1 &&
        total > 0 &&
        now >= total - 0.5 &&
        !restartingPlaylistRef.current
      ) {
        restartingPlaylistRef.current =
          true;

        player.playVideoAt(0);

        setTimeout(() => {
          restartingPlaylistRef.current =
            false;

          syncTrack();
          setPlaying(true);
          setStatus("Playing");
        }, 300);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [playing, syncTrack]);

  /* =========================
     PLAY / PAUSE
  ========================= */

  const play = () => {
    const player =
      playerRef.current;

    if (!player || !ready) return;

    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  /* =========================
     PREVIOUS
  ========================= */

  const previous = () => {
    const player =
      playerRef.current;

    if (!player) return;

    const playlist =
      player.getPlaylist?.() || [];

    const currentIndex =
      player.getPlaylistIndex?.();

    /*
     * If already on first song,
     * previous goes to the last song.
     */
    if (
      playlist.length > 0 &&
      currentIndex === 0
    ) {
      player.playVideoAt(
        playlist.length - 1
      );
    } else {
      player.previousVideo?.();
    }

    setTimeout(
      syncTrack,
      250
    );
  };

  /* =========================
     NEXT
  ========================= */

  const next = () => {
    const player =
      playerRef.current;

    if (!player) return;

    const playlist =
      player.getPlaylist?.() || [];

    const currentIndex =
      player.getPlaylistIndex?.();

    /*
     * If already on the last song,
     * next goes back to the first song.
     */
    if (
      playlist.length > 0 &&
      currentIndex ===
        playlist.length - 1
    ) {
      player.playVideoAt(0);
    } else {
      player.nextVideo?.();
    }

    setTimeout(
      syncTrack,
      250
    );
  };

  /* =========================
     VOLUME
  ========================= */

  const changeVolume = (event) => {
    const value = Number(
      event.target.value
    );

    setVolume(value);

    const player =
      playerRef.current;

    if (!player) return;

    player.setVolume(value);

    if (value === 0) {
      player.mute();
      setMuted(true);
      return;
    }

    if (player.isMuted?.()) {
      player.unMute();
    }

    setMuted(false);
  };

  const toggleMute = () => {
    const player =
      playerRef.current;

    if (!player) return;

    if (player.isMuted?.()) {
      player.unMute();

      player.setVolume(
        volume || 100
      );

      setMuted(false);
    } else {
      player.mute();

      setMuted(true);
    }
  };

  /* =========================
     SEEK
  ========================= */

  const seek = (event) => {
    const value = Number(
      event.target.value
    );

    setCurrent(value);

    playerRef.current?.seekTo?.(
      value,
      true
    );
  };

  /* =========================
     PLAYLIST SELECT
  ========================= */

  const choose = (itemIndex) => {
    const player =
      playerRef.current;

    if (!player) return;

    player.playVideoAt(
      itemIndex
    );

    setIndex(itemIndex);

    setTimeout(
      syncTrack,
      300
    );
  };

  /* =========================
     THEME
  ========================= */

  const toggleTheme = () => {
    setIsMonsoon((value) => {
      const nextValue = !value;

      localStorage.setItem(
        "bengaluru-dhwani-theme",
        nextValue
          ? "monsoon"
          : "summer"
      );

      return nextValue;
    });
  };

  return (
    <main className="radio">

      {/* BACKGROUND */}

      <div
        className={`background background-main ${
          isMonsoon
            ? "fade-out"
            : "fade-in"
        }`}
        style={{
          backgroundImage:
            'url("/background.png")',
        }}
      />

      <div
        className={`background background-theme ${
          isMonsoon
            ? "fade-in"
            : "fade-out"
        }`}
        style={{
          backgroundImage:
            'url("/themes/monsoon.png")',
        }}
      />

      <div className="shade" />
      <div className="grain" />

      {/* TOP BAR */}

      <header className="topbar">

        <div className="time">
          {new Date().toLocaleTimeString(
            [],
            {
              hour: "numeric",
              minute: "2-digit",
            }
          ).toLowerCase()}
        </div>

        <div className="online">
          <span />
          {onlineCount} online
        </div>

        <div className="links">

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Change wallpaper theme"
          >
            {isMonsoon
              ? "SUMMER"
              : "MONSOON"}
          </button>

          <a
            href="https://open.spotify.com/"
            target="_blank"
            rel="noreferrer"
          >
            ◉ Spotify
          </a>

          <a
            href="https://buymeacoffee.com/avixrmusico"
            target="_blank"
            rel="noreferrer"
          >
          Buy Me Coffee
          </a>

        </div>

      </header>

      {/* HERO */}

      <section className="hero">

        <div className="brand">

          <div className="brand-main">
            ಬೆಂಗಳೂರು ಧ್ವನಿ
          </div>

        </div>

        <div className="live-pill">
          <span />
          LIVE FROM BENGALURU
        </div>

      </section>

      {/* PLAYER */}

      <section className="player">

        {/* ARTWORK */}

        <div
          className={`art ${
            playing
              ? "spinning"
              : ""
          }`}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
            />
          ) : (
            <span>♪</span>
          )}
        </div>

        {/* TRACK */}

        <div className="track">

          <div className="title">
            {title}
          </div>

          <div className="artist">
            {artist}
          </div>

          {/* PROGRESS */}

          <div className="progress">

            <span>
              {formatTime(current)}
            </span>

            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={Math.min(
                current,
                duration || 1
              )}
              style={{
                "--progress": `${
                  duration > 0
                    ? (current /
                        duration) *
                      100
                    : 0
                }%`,
              }}
              onChange={seek}
            />

            <span>
              {formatTime(duration)}
            </span>

          </div>

        </div>

        {/* CONTROLS */}

        <div className="controls">

          <button
            className="skip-button previous-button"
            onClick={previous}
            aria-label="Previous"
          >
            <span className="skip-arrow" />
            <span className="skip-line" />
          </button>

          <button
            className="play"
            onClick={play}
            aria-label={
              playing
                ? "Pause"
                : "Play"
            }
          >
            {playing ? (
              <span className="pause-icon">
                <span />
                <span />
              </span>
            ) : (
              <span className="play-icon" />
            )}
          </button>

          <button
            className="skip-button next-button"
            onClick={next}
            aria-label="Next"
          >
            <span className="skip-arrow" />
            <span className="skip-line" />
          </button>

          {/* VOLUME */}

          <div className="volume-control">

            <button
              className="volume-button"
              onClick={toggleMute}
              aria-label={
                muted
                  ? "Unmute"
                  : "Mute"
              }
            >
              {muted ||
              volume === 0 ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M4 9v6h4l5 4V5L8 9H4z" />
                  <path d="M18 9l-4 6M14 9l4 6" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M4 9v6h4l5 4V5L8 9H4z" />
                  <path d="M16 9.5a4 4 0 0 1 0 5" />
                  <path d="M18.5 7a7.5 7.5 0 0 1 0 10" />
                </svg>
              )}
            </button>

            <input
              className="volume-slider"
              type="range"
              min="0"
              max="100"
              value={
                muted
                  ? 0
                  : volume
              }
              style={{
                "--volume": `${
                  muted
                    ? 0
                    : volume
                }%`,
              }}
              onChange={
                changeVolume
              }
              aria-label="Volume"
            />

          </div>

        </div>

      </section>

      {/* PLAYLIST BUTTON */}

      <button
        className="playlist-toggle"
        onClick={() =>
          setPanelOpen(
            (open) => !open
          )
        }
      >
        ☷ PLAYLIST
      </button>

      {/* PLAYLIST PANEL */}

      <aside
        className={`playlist ${
          panelOpen
            ? "open"
            : ""
        }`}
      >

        <div className="playlist-head">

          <div>

            <small>
              NOW PLAYING
            </small>

            <strong>
              {title}
            </strong>

          </div>

          <button
            onClick={() =>
              setPanelOpen(false)
            }
          >
            ×
          </button>

        </div>

        <div className="items">

          {items.length ? (
            items.map(
              (videoId, i) => (

                <button
                  key={`${videoId}-${i}`}
                  className={`item ${
                    i === index
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    choose(i)
                  }
                >

                  <img
                    src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                    alt=""
                  />

                  <span>
                    {i + 1}.{" "}
                    {trackInfo[
                      videoId
                    ]?.title ||
                      "Loading…"}
                  </span>

                </button>

              )
            )
          ) : (
            <div className="empty">
              Playlist tracks will
              appear here once
              YouTube loads them.
            </div>
          )}

        </div>

      </aside>

      {/* HIDDEN YOUTUBE PLAYER */}

      <div
        className="youtube-host"
        ref={hostRef}
      />

      {/* STATUS */}

      <div className="status">
        {status}
      </div>

    </main>
  );
}