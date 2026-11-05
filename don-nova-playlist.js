/* Don Nova - horizontale videocarrousel uit een openbare YouTube-playlist */
(() => {
  "use strict";

  const PLAYLIST_ID = "PLAdncNiOeDP0";
  const PLAYLIST_URL = "https://www.youtube.com/playlist?list=" + PLAYLIST_ID;
  const FEED_URL = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + PLAYLIST_ID;
  const CACHE_KEY = "don-nova-playlist-v1";
  const CACHE_TTL = 5 * 60 * 1000;
  const YT_NAMESPACE = "http://www.youtube.com/xml/schemas/2015";
  const MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/";

  const track = document.getElementById("dnPlaylistTrack");
  const status = document.getElementById("dnPlaylistStatus");
  const previous = document.getElementById("dnPlaylistPrev");
  const next = document.getElementById("dnPlaylistNext");
  if (!track) return;

  const setStatus = (message, withLink = false) => {
    if (!status) return;
    status.replaceChildren(document.createTextNode(message));
    if (withLink) {
      const link = document.createElement("a");
      link.href = PLAYLIST_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Bekijk de volledige playlist op YouTube";
      status.append(" ", link);
    }
    status.hidden = false;
  };

  const safeText = (node, selector) => {
    const found = node.querySelector(selector);
    return found ? found.textContent.trim() : "";
  };

  const parseFeed = (xmlText) => {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("De YouTube-feed kon niet worden gelezen.");

    return Array.from(xml.getElementsByTagName("entry")).map((entry) => {
      const idNode = entry.getElementsByTagNameNS(YT_NAMESPACE, "videoId")[0];
      const id = idNode ? idNode.textContent.trim() : "";
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

      const title = safeText(entry, "title") || "Bekijk deze HV Novitas-video";
      const thumbnailNode = entry.getElementsByTagNameNS(MEDIA_NAMESPACE, "thumbnail")[0];
      const thumbnail = thumbnailNode ? thumbnailNode.getAttribute("url") : "";
      return {
        id,
        title,
        thumbnail: thumbnail || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"
      };
    }).filter(Boolean);
  };

  const closePlayer = () => {
    const modal = document.getElementById("dnPlaylistModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.querySelector(".dn-playlist-player")?.replaceChildren();
    document.body.classList.remove("dn-playlist-modal-open");
  };

  const openPlayer = (video) => {
    let modal = document.getElementById("dnPlaylistModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "dnPlaylistModal";
      modal.className = "dn-playlist-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "HV Novitas-video bekijken");
      modal.innerHTML = '<div class="dn-playlist-modal-backdrop" data-close="true"></div><div class="dn-playlist-modal-panel"><button class="dn-playlist-modal-close" type="button" aria-label="Sluiten">×</button><div class="dn-playlist-player"></div></div>';
      document.body.append(modal);
      modal.addEventListener("click", (event) => {
        if (event.target.closest("[data-close]") || event.target.closest(".dn-playlist-modal-close")) closePlayer();
      });
    }

    const player = modal.querySelector(".dn-playlist-player");
    player.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.id) + "?autoplay=1&playsinline=1&rel=0";
    iframe.title = video.title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    player.append(iframe);

    modal.classList.add("is-open");
    document.body.classList.add("dn-playlist-modal-open");
    modal.querySelector(".dn-playlist-modal-close").focus();
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlayer();
  });

  const updateArrows = () => {
    if (!previous || !next) return;
    previous.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  };

  const renderCards = (videos) => {
    track.replaceChildren();

    videos.forEach((video) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "dn-playlist-card";
      card.setAttribute("aria-label", video.title + " – bekijk video");
      card.addEventListener("click", () => openPlayer(video));

      const thumb = document.createElement("span");
      thumb.className = "dn-playlist-thumb";

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
      tag.className = "dn-playlist-tag";
      tag.textContent = "▶ VIDEO";

      const play = document.createElement("span");
      play.className = "dn-playlist-play";
      play.setAttribute("aria-hidden", "true");
      play.textContent = "▶";

      const title = document.createElement("span");
      title.className = "dn-playlist-title";
      title.textContent = video.title;

      thumb.append(image, tag, play);
      card.append(thumb, title);
      track.append(card);
    });

    if (status) status.hidden = true;
    updateArrows();
  };

  previous?.addEventListener("click", () => {
    track.scrollBy({ left: -Math.max(280, track.clientWidth * 0.8), behavior: "smooth" });
  });
  next?.addEventListener("click", () => {
    track.scrollBy({ left: Math.max(280, track.clientWidth * 0.8), behavior: "smooth" });
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
      // Cache is optional; continue with a fresh playlist request.
    }

    setStatus("De video's worden geladen…");
    try {
      const response = await fetch("https://proxy.cors.dev/" + FEED_URL, {
        method: "GET",
        headers: { "Accept": "application/atom+xml, application/xml, text/xml" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("De YouTube-playlist is tijdelijk niet bereikbaar.");

      const videos = parseFeed(await response.text());
      if (!videos.length) throw new Error("Er zijn momenteel geen video's uit de playlist op te halen.");

      renderCards(videos);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), videos }));
      } catch (_) {
        // Carousel remains functional when browser storage is disabled.
      }
    } catch (error) {
      setStatus("De video's konden nu niet automatisch worden geladen.", true);
      console.warn("Don Nova-videoplaylist:", error);
    }
  };

  load();
})();
