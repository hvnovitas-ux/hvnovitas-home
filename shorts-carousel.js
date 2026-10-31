/* HV Novitas Shorts – vult horizontale kaarten uit een openbare YouTube-playlist */
(() => {
  "use strict";

  const PLAYLIST_ID = "PLnMKEW1hQu3_0Y74VgCDIzbJ5H93vaB0h";
  const PLAYLIST_URL = "https://www.youtube.com/playlist?list=" + PLAYLIST_ID;
  const FEED_URL = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + PLAYLIST_ID;
  const CACHE_KEY = "hvnovitas-shorts-playlist-v1";
  const CACHE_TTL = 30 * 60 * 1000;
  const YT_NAMESPACE = "http://www.youtube.com/xml/schemas/2015";
  const MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/";

  const track = document.getElementById("novitasShortsTrack");
  const status = document.getElementById("novitasShortsStatus");
  const previous = document.getElementById("novitasShortsPrev");
  const next = document.getElementById("novitasShortsNext");
  if (!track || !status) return;

  const setStatus = (message, withLink = false) => {
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
      const videoIdNode = entry.getElementsByTagNameNS(YT_NAMESPACE, "videoId")[0];
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

  const renderCards = (videos) => {
    track.replaceChildren();
    videos.forEach((video) => {
      const card = document.createElement("a");
      card.className = "novitas-short-card";
      card.href = "https://www.youtube.com/shorts/" + encodeURIComponent(video.id);
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.setAttribute("aria-label", video.title + " – bekijk op YouTube");

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

    setStatus(videos.length
      ? videos.length + " Shorts uit de Novitas-playlist."
      : "Er staan nog geen Shorts in deze playlist.", !videos.length);
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

  const load = async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.videos)) {
        renderCards(cached.videos);
        return;
      }
    } catch (_) {
      // Ignore an unavailable or malformed local cache and fetch a fresh feed.
    }

    setStatus("Novitas Shorts worden geladen…");
    try {
      // YouTube's playlist Atom-feed is read via a simple CORS proxy for this static site.
      const response = await fetch("https://proxy.cors.dev/" + FEED_URL, {
        method: "GET",
        headers: { "Accept": "application/atom+xml, application/xml, text/xml" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("De Shorts-feed is tijdelijk niet bereikbaar.");
      const videos = parseFeed(await response.text());
      if (!videos.length) throw new Error("De playlist bevat momenteel geen uitleesbare video's.");

      renderCards(videos);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), videos }));
      } catch (_) {
        // The carousel remains usable if browser storage is disabled.
      }
    } catch (error) {
      setStatus("De Shorts konden nu niet automatisch worden geladen.", true);
      console.warn("HV Novitas Shorts:", error);
    }
  };

  load();
})();
