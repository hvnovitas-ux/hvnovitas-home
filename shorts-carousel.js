/* HV Novitas Shorts – vult horizontale kaarten uit een openbare YouTube-playlist */
(() => {
  "use strict";

  const PLAYLIST_ID = "PLnMKEW1hQu3_0Y74VgCDIzbJ5H93vaB0h";
  const PLAYLIST_URL = "https://www.youtube.com/playlist?list=" + PLAYLIST_ID;
  const FEED_URL = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + PLAYLIST_ID;
  const CACHE_KEY = "hvnovitas-shorts-playlist-v11";
  const CACHE_TTL = 30 * 1000;
  const YT_NAMESPACE = "http://www.youtube.com/xml/schemas/2015";
  const MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/";

  const track = document.getElementById("novitasShortsTrack");
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
        thumbnail: "https://i.ytimg.com/vi/" + videoId + "/maxresdefault.jpg"
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
      const fallbackThumbnails = [
        "https://i.ytimg.com/vi/" + video.id + "/sddefault.jpg",
        "https://i.ytimg.com/vi/" + video.id + "/hqdefault.jpg"
      ];
      let fallbackIndex = 0;
      image.onerror = () => {
        if (fallbackIndex >= fallbackThumbnails.length) {
          image.onerror = null;
          return;
        }
        image.src = fallbackThumbnails[fallbackIndex++];
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
    const errors = [];

    // Officially listed public Invidious instances. The playlist endpoint
    // returns a JSON object containing a "videos" array and each item's videoId.
    const parseInvidious = (data) => (data.videos || []).map((item) => {
      const id = item.videoId || item.video_id;
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id || "")) return null;
      const thumbnails = Array.isArray(item.videoThumbnails) ? item.videoThumbnails : [];
      const thumb = thumbnails.find((image) => image.quality === "medium") || thumbnails[0];
      return {
        id,
        title: item.title || "Bekijk deze Novitas Short",
        thumbnail: "https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg"
      };
    }).filter(Boolean);

    const instances = [
      "https://invidious.nerdvpn.de",
      "https://yt.chocolatemoo53.com",
      "https://invidious.tiekoetter.com",
      "https://inv.nadeko.net"
    ];

    const apiSources = instances.map((instance) => ({
      name: new URL(instance).hostname,
      url: instance + "/api/v1/playlists/" + encodeURIComponent(PLAYLIST_ID) + "?page=1&_=" + Date.now(),
      parse: parseInvidious
    }));

    const apiRequests = apiSources.map(async (source) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(source.url, {
          method: "GET",
          cache: "no-store",
          credentials: "omit",
          headers: { "Accept": "application/json" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const videos = source.parse(data);
        if (!videos.length) throw new Error("playlist leverde geen video's op");
        return { name: source.name, videos };
      } catch (error) {
        errors.push(source.name + ": " + (error.message || "ophalen mislukt"));
        throw error;
      } finally {
        window.clearTimeout(timeout);
      }
    });

    // Vergelijk de volledige video-volgorde van alle bereikbare bronnen.
    // Zo wint niet automatisch een snelle, maar mogelijk verouderde server.
    const results = await Promise.allSettled(apiRequests);
    const successful = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    if (successful.length) {
      const groups = new Map();
      successful.forEach((result) => {
        const signature = result.videos.map((video) => video.id).join(",");
        if (!groups.has(signature)) groups.set(signature, []);
        groups.get(signature).push(result);
      });

      const bestGroup = Array.from(groups.values()).sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return instances.findIndex((url) => new URL(url).hostname === a[0].name) -
          instances.findIndex((url) => new URL(url).hostname === b[0].name);
      })[0];

      return bestGroup[0].videos;
    }

    const feedRoutes = [
      {
        name: "YouTube Atom via cors.dev",
        url: "https://proxy.cors.dev/" + FEED_URL
      },
      {
        name: "YouTube Atom via AllOrigins",
        url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(FEED_URL)
      }
    ];

    for (const route of feedRoutes) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(route.url, {
          method: "GET",
          cache: "no-store",
          credentials: "omit",
          headers: { "Accept": "application/atom+xml, application/xml, text/xml" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const videos = parseFeed(await response.text());
        if (videos.length) return videos;
        throw new Error("feed bevat geen video-items");
      } catch (error) {
        errors.push(route.name + ": " + (error.message || "ophalen mislukt"));
      } finally {
        window.clearTimeout(timeout);
      }
    }

    throw new Error("De Novitas-playlist kan momenteel niet worden uitgelezen. " + errors.join(" | "));
  };

  const load = async () => {
    setStatus("Novitas Shorts worden geladen…");
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.videos) && cached.videos.length) {
        renderCards(cached.videos);
        return;
      }
    } catch (_) {
      // Ignore browser cache failures and continue with the live playlist feed.
    }

    try {
      const videos = await fetchVideos();
      renderCards(videos);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), videos }));
      } catch (_) {
        // The carousel remains usable if browser storage is disabled.
      }
    } catch (error) {
      console.warn("HV Novitas Shorts:", error);
      setStatus(error.message || "De Shorts konden nu niet worden geladen.", true);
      updateArrows();
    }
  };

  load();
})();
