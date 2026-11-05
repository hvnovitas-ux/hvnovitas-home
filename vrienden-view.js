import { db } from "./firebase.js";
import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const container = document.getElementById("vriendenList");
const count = document.getElementById("vriendenCount");

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "VN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function render(snapshot) {
  if (!container) return;

  const data = snapshot.val() || {};

  const friends = Object.values(data)
    .filter(item => item && String(item.name || "").trim())
    .sort((a, b) =>
      String(a.name).localeCompare(
        String(b.name),
        "nl",
        { sensitivity: "base" }
      )
    );

  if (count) {
    count.textContent = friends.length === 1
      ? "1 Vriend"
      : friends.length + " Vrienden";
  }

  if (friends.length === 0) {
    container.innerHTML = `
      <div class="friends-empty">
        <strong>Er zijn momenteel geen Vrienden geregistreerd.</strong>
      </div>
    `;
    return;
  }

  container.innerHTML = friends.map(friend => {
    const name = String(friend.name).trim();

    return `
      <article class="friend">
        <div class="friend-top">
          <div class="friend-icon">${escapeHTML(initials(name))}</div>
          <small>Vriend van Novitas</small>
        </div>
        <strong>${escapeHTML(name)}</strong>
        <p>Bedankt voor de steun aan HV Novitas!</p>
      </article>
    `;
  }).join("");
}

onValue(
  ref(db, "vrienden"),
  render,
  error => {
    console.error("Vrienden laden mislukt:", error);

    if (count) count.textContent = "";

    if (container) {
      container.innerHTML = `
        <div class="friends-empty">
          <strong>De Vrienden konden niet worden geladen.</strong>
        </div>
      `;
    }
  }
);
