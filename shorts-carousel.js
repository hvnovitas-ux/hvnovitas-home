/* HV Novitas Shorts – vult horizontale kaarten uit een openbare YouTube-playlist */
(() => {
  "use strict";

  const PLAYLIST_ID = "PLnMKEW1hQu3_0Y74VgCDIzbJ5H93vaB0h";
  const PLAYLIST_URL = "https://www.youtube.com/playlist?list=" + PLAYLIST_ID;
  const FEED_URL = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + PLAYLIST_ID;
  const CACHE_KEY = "hvnovitas-shorts-playlist-v4";
  const CACHE_TTL = 5 * 60 * 1000;
  const YT_NAMESPACE = "http://www.youtube.com/xml/schemas/2015";
  const MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/";

  const track = document.getElementById("novitasShortsTrack");
  const fallback = document.getElementById("novitasShortsFallback");
  const status = document.getElementById("novitasShortsStatus");
  const previous = document.getElementById("novitasShortsPrev");
  const next = document.getElementById("novitasShortsNext");
  if (!track) return;

  const setStatus = (message, withLink = false) => {
    if (!status) return;
    status.textContent = message;
    if (withLink) {
      const link = document.createElement("a");
      link.href = PLAYLIST_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Bekijk de Shorts op YouTube";
      status.append(" ", link);
    }
  };

  const safeText = (node, selector) => {
    const found = node.querySelector(selector);
    return found ? found.textContent.trim() : "";
  };

  const parseFeed = (xmlText) => {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("De YouTube-feed kon niet worden gelezen.");

    const entries = Array.from(xml.getElementsByTagName("entry"));
    return entries.map((entry) => {
      const videoIdNode =
        entry.getElementsByTagNameNS(YT_NAMESPACE, "videoId")[0] ||
        entry.getElementsByTagName("yt:videoId")[0] ||
        entry.getElementsByTagName("videoId")[0];
      const videoId = videoIdNode ? videoIdNode.textContent.trim() : "";
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

      const title = safeText(entry, "title") || "Bekijk deze Novitas Short";
      const thumbnailNode = entry.getElementsByTagNameNS(MEDIA_NAMESPACE, "thumbnail")[0];
      const thumbnail = thumbnailNode ? thumbnailNode.getAttribute("url") : "";
      return {
        id: videoId,
        title,
        thumbnail: thumbnail || "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg"
      };
    }).filter(Boolean);
  };

  // Open Shorts in an on-page player so visitors stay on hvnovitas.nl.
  const openPlayer = (video) => {
    let modal = document.getElementById("novitasShortsModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "novitasShortsModal";
      modal.className = "novitas-shorts-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Novitas Short bekijken");
      modal.innerHTML = '<div class="novitas-shorts-modal-backdrop" data-close="true"></div><div class="novitas-shorts-modal-panel"><button class="novitas-shorts-modal-close" type="button" aria-label="Sluiten">×</button><div class="novitas-shorts-player"></div></div>';
      document.body.append(modal);
      modal.addEventListener("click", (event) => {
        if (event.target.closest("[data-close]") || event.target.closest(".novitas-shorts-modal-close")) closePlayer();
      });
    }

    const player = modal.querySelector(".novitas-shorts-player");
    player.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.id) + "?autoplay=1&playsinline=1&rel=0";
    iframe.title = video.title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    player.append(iframe);
    modal.classList.add("is-open");
    document.body.classList.add("novitas-shorts-modal-open");
    modal.querySelector(".novitas-shorts-modal-close").focus();
  };

  const closePlayer = () => {
    const modal = document.getElementById("novitasShortsModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.querySelector(".novitas-shorts-player")?.replaceChildren();
    document.body.classList.remove("novitas-shorts-modal-open");
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlayer();
  });

  const renderCards = (videos) => {
    track.replaceChildren();
    videos.forEach((video) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "novitas-short-card";
      card.setAttribute("aria-label", video.title + " – bekijk op deze website");
      card.addEventListener("click", () => openPlayer(video));

      const image = document.createElement("img");
      image.src = video.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "strict-origin-when-cross-origin";
      image.onerror = () => {
        image.onerror = null;
        image.src = "https://i.ytimg.com/vi/" + video.id + "/hqdefault.jpg";
      };

      const tag = document.createElement("span");
      tag.className = "novitas-short-tag";
      tag.textContent = "▶ SHORT";

      const play = document.createElement("span");
      play.className = "novitas-short-play";
      play.setAttribute("aria-hidden", "true");
      play.textContent = "▶";

      const title = document.createElement("span");
      title.className = "novitas-short-title";
      title.textContent = video.title;

      card.append(image, tag, play, title);
      track.append(card);
    });

    // Alleen de carrousel tonen zodra er echt kaarten zijn opgebouwd.
    const section = track.closest(".novitas-shorts-section");
    if (section) section.classList.add("has-short-cards");
    if (fallback) fallback.hidden = true;
    if (previous) previous.style.display = "";
    if (next) next.style.display = "";

    // Geen statusregel onder de carrousel: de tekst voegt niets toe.
    if (status) status.hidden = true;
    updateArrows();
  };

  const updateArrows = () => {
    if (!previous || !next) return;
    previous.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  };

  previous?.addEventListener("click", () => {
    track.scrollBy({ left: -Math.max(260, track.clientWidth * .8), behavior: "smooth" });
  });
  next?.addEventListener("click", () => {
    track.scrollBy({ left: Math.max(260, track.clientWidth * .8), behavior: "smooth" });
  });
  track.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);

  const fetchVideos = async () => {
    // YouTube's playlist Atom feed is fetched through cors.dev first.
    // rss2json currently returns a Cloudflare 403 challenge in browsers.
    const fetchAndParse = (url, label) => async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) {
          const proxyError = response.headers.get("X-Cors-Error");
          throw new Error(label + " antwoordde " + response.status + (proxyError ? " (" + proxyError + ")" : ""));
        }

        const videos = parseFeed(await response.text());
        if (!videos.length) throw new Error(label + " gaf geen video's terug");
        return videos;
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const attempts = [
      fetchAndParse("https://proxy.cors.dev/" + FEED_URL, "YouTube-feed"),
      fetchAndParse("https://api.allorigins.win/raw?url=" + encodeURIComponent(FEED_URL), "Reserve-feed 1"),
      fetchAndParse("https://corsproxy.io/?url=" + encodeURIComponent(FEED_URL), "Reserve-feed 2")
    ];

    let lastError;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
        console.warn("HV Novitas Shorts-feedroute mislukt:", error);
      }
    }
    throw lastError || new Error("Geen Shorts-feed beschikbaar");
  };

  const load = async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.videos) && cached.videos.length) {
        renderCards(cached.videos);
        return;
      }
    } catch (_) {
      // Ignore an unavailable or malformed local cache and fetch a fresh feed.
    }

    setStatus("Novitas Shorts worden geladen…");
    try {
      const videos = await fetchVideos();
      renderCards(videos);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), videos }));
      } catch (_) {
        // The carousel remains usable if browser storage is disabled.
      }
    } catch (error) {
      // The playlist iframe is already present in index.html. Keep it visible
      // when the feed or carousel cannot be loaded.
      console.warn("HV Novitas Shorts-feed niet beschikbaar; vaste YouTube-playlist blijft zichtbaar:", error);
      if (fallback) fallback.hidden = false;
      if (previous) previous.style.display = "none";
      if (next) next.style.display = "none";
      if (status) status.hidden = true;
      const section = track.closest(".novitas-shorts-section");
      if (section) section.classList.remove("has-short-cards");
    }
  };

  load();
})();
