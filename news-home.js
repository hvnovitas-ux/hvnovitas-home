import { db } from "./firebase.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const container = document.getElementById("newsHome");

console.log("📰 HV Novitas laatste nieuws geladen");

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
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

if (!container) {
    console.error("❌ newsHome niet gevonden");
} else {

    onValue(
        ref(db, "news"),
        (snapshot) => {

            const data = snapshot.val() || {};

            const items = Object.entries(data)
                .map(([id, news]) => ({
                    id,
                    ...news
                }))
                .filter(news => news && news.created)
                .sort(
                    (a, b) =>
                        (b.created || 0) -
                        (a.created || 0)
                );

            if (!items.length) {
                container.innerHTML = `
                    <div class="empty">
                        Er is momenteel geen nieuwsbericht.
                    </div>
                `;
                return;
            }

            const latest = items[0];

            container.innerHTML = `
                <article class="latest-news">

                    <div class="latest-label">
                        LAATSTE NIEUWS
                    </div>

                    <h2>
                        ${escapeHTML(latest.title || "")}
                    </h2>

                    ${
                        latest.imageUrl
                            ? `
                                <img
                                    class="latest-image"
                                    src="${escapeHTML(latest.imageUrl)}"
                                    alt="${escapeHTML(latest.title || "Nieuws")}"
                                >
                              `
                            : ""
                    }

                    <p class="latest-text">
                        ${escapeHTML(latest.text || "")}
                    </p>

                    <div class="latest-date">
                        ${formatDate(latest.created)}
                    </div>

                </article>

                <div class="more-news">
                    <a
                        href="/news.html"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        → Voor meer nieuws, klik hier
                    </a>
                </div>
            `;
        },
        (error) => {

            console.error(
                "❌ Laatste nieuws laden mislukt:",
                error
            );

            container.innerHTML = `
                <div class="empty">
                    Het nieuws kon momenteel niet worden geladen.
                </div>
            `;
        }
    );
}
