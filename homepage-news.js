import { db } from "./firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const container = document.getElementById("newsHome");

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

if (container) {
  onValue(ref(db, "news"), (snapshot) => {
    const data = snapshot.val() || {};
    const items = Object.entries(data)
      .map(([id, news]) => ({ id, ...news }))
      .filter(news => news && news.created)
      .sort((a, b) => (b.created || 0) - (a.created || 0));

    if (!items.length) {
      container.innerHTML = '<div class="homepage-news-empty">Er is momenteel geen nieuwsbericht.</div>';
      return;
    }

    const latest = items[0];
    container.innerHTML = `
      <article class="homepage-latest-news">
        <div class="homepage-latest-label">LAATSTE NIEUWS</div>
        <h2>${escapeHTML(latest.title || "")}</h2>
        <div class="homepage-latest-content">
          <div class="homepage-latest-copy">
            <p class="homepage-latest-text">${escapeHTML(latest.text || "")}</p>
            <div class="homepage-latest-date">${formatDate(latest.created)}</div>
          </div>
          <aside class="homepage-latest-ad" aria-label="Advertentie">
            <ins class="adsbygoogle"
              style="display:block"
              data-ad-client="ca-pub-8196697024976069"
              data-ad-slot="6891092389"
              data-ad-format="auto"
              data-full-width-responsive="true"></ins>
          </aside>
        </div>
        ${latest.imageUrl ? `<img class="homepage-latest-image" src="${escapeHTML(latest.imageUrl)}" alt="${escapeHTML(latest.title || "Nieuws")}" loading="lazy">` : ""}
      </article>
    `;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.warn("AdSense-advertentie kon nog niet worden geladen:", error);
    }
  }, (error) => {
    console.error("Laatste nieuws laden mislukt:", error);
    container.innerHTML = '<div class="homepage-news-empty">Het nieuws kon momenteel niet worden geladen.</div>';
  });
}
