import { db } from "https://hvnovitas-ux.github.io/hvnovitas-beheer/firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const announcementImage = document.getElementById("aankondigingsfoto");
const announcementPlaceholder = document.querySelector(".announcement-placeholder");

function loadAnnouncementPhoto() {
    if (!announcementImage) {
        console.error("❌ Aankondigingsfoto-element niet gevonden.");
        return;
    }

    onValue(
        ref(db, "aankondigingsfoto"),
        (snapshot) => {
            const data = snapshot.val() || {};
            const basePhotos = data.basePhotos || {};
            const selectedBase = data.selectedBase || "foto1";
            const special = data.special || {};

            const now = Date.now();
            const start = toTimestamp(special.start);
            const end = toTimestamp(special.end);

            const specialActive =
                Boolean(special.imageUrl) &&
                Boolean(start) &&
                Boolean(end) &&
                now >= start &&
                now <= end;

            let imageUrl = "";

            if (specialActive) {
                imageUrl = special.imageUrl;
            } else {
                imageUrl =
                    basePhotos[selectedBase]?.imageUrl ||
                    findFirstBase(basePhotos);
            }

            if (imageUrl) {
                announcementImage.src = imageUrl;
                announcementImage.hidden = false;

                if (announcementPlaceholder) {
                    announcementPlaceholder.hidden = true;
                }
            } else {
                announcementImage.removeAttribute("src");
                announcementImage.hidden = true;

                if (announcementPlaceholder) {
                    announcementPlaceholder.hidden = false;
                }
            }
        },
        (error) => {
            console.error("❌ Aankondigingsfoto Firebase-fout:", error);
            announcementImage.hidden = true;

            if (announcementPlaceholder) {
                announcementPlaceholder.hidden = false;
            }
        }
    );
}

function findFirstBase(basePhotos) {
    for (const slot of ["foto1", "foto2", "foto3"]) {
        if (basePhotos[slot]?.imageUrl) {
            return basePhotos[slot].imageUrl;
        }
    }

    return "";
}

function toTimestamp(value) {
    if (!value) return 0;

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("🧡 HV Novitas nieuwe homepage geladen");

    loadAnnouncementPhoto();

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));

            if (target) {
                event.preventDefault();
                target.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });
});
