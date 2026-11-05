/*
=========================================================
HV NOVITAS
Module : Inschrijven
Bestand: inschrijven.js
Versie : 2.0
=========================================================
*/

import { db } from "./firebase.js";
import { maakPDF } from "./pdf.js";
import { verstuurMails } from "./mail.js";

import {
    ref,
    push
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

console.log("📋 Module Inschrijven geladen");

// ======================================================
// ELEMENTEN
// ======================================================

const geboortedatum =
    document.getElementById("geboortedatum");

const ouderCard =
    document.getElementById("ouderCard");

const canvas =
    document.getElementById("signatureCanvas");

const ctx =
    canvas.getContext("2d");

const clearButton =
    document.getElementById("clearSignature");

const sendButton =
    document.getElementById("sendForm");

const message =
    document.getElementById("message");

let tekenen = false;

// ======================================================
// MELDINGEN
// ======================================================

function toonMelding(
    tekst,
    type = "success"
) {

    message.className = "message";
    message.classList.add(type);
    message.textContent = tekst;
    message.style.display = "block";

}

// ======================================================
// LEEFTIJD
// ======================================================

function berekenLeeftijd(datum) {

    if (!datum) return 99;

    const geboorte =
        new Date(datum);

    const vandaag =
        new Date();

    let leeftijd =
        vandaag.getFullYear() -
        geboorte.getFullYear();

    const maand =
        vandaag.getMonth() -
        geboorte.getMonth();

    if (

        maand < 0 ||

        (
            maand === 0 &&
            vandaag.getDate() <
            geboorte.getDate()
        )

    ) {

        leeftijd--;

    }

    return leeftijd;

}

// ======================================================
// OUDERBLOK
// ======================================================

function updateOuderBlok() {

    const leeftijd =
        berekenLeeftijd(
            geboortedatum.value
        );

    ouderCard.style.display =
        leeftijd < 18
            ? "block"
            : "none";

}

geboortedatum.addEventListener(
    "change",
    updateOuderBlok
);

updateOuderBlok();

// ======================================================
// HANDTEKENING
// ======================================================

ctx.lineWidth = 2;
ctx.lineCap = "round";
ctx.strokeStyle = "#000";

function positie(e) {

    const rect =
        canvas.getBoundingClientRect();

    return {

        x: e.clientX - rect.left,

        y: e.clientY - rect.top

    };

}
// ======================================================
// MUIS
// ======================================================

canvas.addEventListener("mousedown", e => {

    tekenen = true;

    const p = positie(e);

    ctx.beginPath();

    ctx.moveTo(p.x, p.y);

});

canvas.addEventListener("mousemove", e => {

    if (!tekenen) return;

    const p = positie(e);

    ctx.lineTo(p.x, p.y);

    ctx.stroke();

});

canvas.addEventListener("mouseup", () => {

    tekenen = false;

});

canvas.addEventListener("mouseleave", () => {

    tekenen = false;

});

// ======================================================
// TOUCH
// ======================================================

canvas.addEventListener("touchstart", e => {

    e.preventDefault();

    tekenen = true;

    const p = positie(e.touches[0]);

    ctx.beginPath();

    ctx.moveTo(p.x, p.y);

}, { passive: false });

canvas.addEventListener("touchmove", e => {

    e.preventDefault();

    if (!tekenen) return;

    const p = positie(e.touches[0]);

    ctx.lineTo(p.x, p.y);

    ctx.stroke();

}, { passive: false });

canvas.addEventListener("touchend", () => {

    tekenen = false;

});

// ======================================================
// HANDTEKENING WISSEN
// ======================================================

clearButton.addEventListener("click", () => {

    ctx.clearRect(

        0,
        0,
        canvas.width,
        canvas.height

    );

});

// ======================================================
// HANDTEKENING CONTROLEREN
// ======================================================

function heeftHandtekening() {

    const pixels =

        ctx.getImageData(

            0,
            0,
            canvas.width,
            canvas.height

        ).data;

    for (

        let i = 3;

        i < pixels.length;

        i += 4

    ) {

        if (pixels[i] !== 0) {

            return true;

        }

    }

    return false;

}

// ======================================================
// FORMULIER CONTROLEREN
// ======================================================

function controleerFormulier() {

    const verplichteVelden = [

        "voornaam",
        "achternaam",
        "geslacht",
        "geboortedatum",
        "geboorteplaats",
        "nationaliteit",
        "straat",
        "huisnummer",
        "postcode",
        "woonplaats",
        "email",
        "telefoon"

    ];

    for (const id of verplichteVelden) {

        const veld = document.getElementById(id);

        if (!veld || !veld.value.trim()) {

            if (veld) {

                veld.focus();

            }

            toonMelding(

                "Vul alle verplichte velden in.",

                "error"

            );

            return false;

        }

    }

    if (

        berekenLeeftijd(

            geboortedatum.value

        ) < 18

    ) {

        if (

            !document.getElementById("ouderNaam").value.trim() ||

            !document.getElementById("ouderEmail").value.trim()

        ) {

            toonMelding(

                "Vul de gegevens van de ouder/verzorger in.",

                "error"

            );

            return false;

        }

    }

    if (

        !document.getElementById("voorwaarden").checked

    ) {

        toonMelding(

            "Ga akkoord met de voorwaarden.",

            "error"

        );

        return false;

    }

    if (!heeftHandtekening()) {

        toonMelding(

            "Plaats eerst een digitale handtekening.",

            "error"

        );

        return false;

    }

    return true;

}
// ======================================================
// GEGEVENS VERZAMELEN
// ======================================================

function verzamelGegevens() {

    return {

        voornaam: document.getElementById("voornaam").value.trim(),
        achternaam: document.getElementById("achternaam").value.trim(),
        geslacht: document.getElementById("geslacht").value,
        geboortedatum: document.getElementById("geboortedatum").value,
        geboorteplaats: document.getElementById("geboorteplaats").value.trim(),
        nationaliteit: document.getElementById("nationaliteit").value.trim(),

        straat: document.getElementById("straat").value.trim(),
        huisnummer: document.getElementById("huisnummer").value.trim(),
        postcode: document.getElementById("postcode").value.trim(),
        woonplaats: document.getElementById("woonplaats").value.trim(),

        email: document.getElementById("email").value.trim(),
        telefoon: document.getElementById("telefoon").value.trim(),

        eerderLid: document.getElementById("eerderLid").value,
        vereniging: document.getElementById("vereniging").value.trim(),

        ouderNaam: document.getElementById("ouderNaam").value.trim(),
        ouderTelefoon: document.getElementById("ouderTelefoon").value.trim(),
        ouderEmail: document.getElementById("ouderEmail").value.trim(),

        voorwaarden: document.getElementById("voorwaarden").checked,

        handtekening: canvas.toDataURL("image/png"),

        status: "Nieuw",

        created: Date.now()

    };

}

// ======================================================
// FIREBASE
// ======================================================

async function opslaanInFirebase(data) {

    const resultaat = await push(

        ref(db, "inschrijvingen"),

        data

    );

    return resultaat.key;

}

// ======================================================
// PDF
// ======================================================

async function downloadPDF(data) {

    try {

        const pdfBytes =
            await maakPDF(data);

        const blob =
            new Blob(

                [pdfBytes],

                {
                    type: "application/pdf"
                }

            );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            `HV-Novitas-Inschrijving-${data.achternaam}.pdf`;

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        console.log("📄 PDF opgeslagen");

    }

    catch (error) {

        console.error(

            "⚠ PDF kon niet worden gemaakt:",

            error

        );

    }

}

// ======================================================
// VERZENDEN
// ======================================================

sendButton.addEventListener("click", async () => {

    message.style.display = "none";

    if (!controleerFormulier()) {

        return;

    }

    sendButton.disabled = true;

    sendButton.textContent =
        "⏳ Inschrijving verwerken...";

    try {

        const gegevens =
            verzamelGegevens();

        // ======================================
        // FIREBASE
        // ======================================

        const id =
            await opslaanInFirebase(
                gegevens
            );

        gegevens.id = id;

        console.log("✅ Firebase opgeslagen");

        // ======================================
        // EMAIL
        // ======================================

        await verstuurMails(
            gegevens
        );

        console.log("📧 Email verzonden");

        // ======================================
        // PDF
        // ======================================

        await downloadPDF(
            gegevens
        );

        toonMelding(

            "✅ Bedankt! Uw inschrijving is succesvol ontvangen. Er is een bevestigingsmail verzonden.",

            "success"

        );

        resetFormulier();

    }

    catch (error) {

        console.error(error);

        toonMelding(

            "❌ " + error.message,

            "error"

        );

    }

    finally {

        sendButton.disabled = false;

        sendButton.textContent =
            "📨 Inschrijving verzenden";

    }

});
// ======================================================
// FORMULIER LEEGMAKEN
// ======================================================

function resetFormulier() {

    document.querySelectorAll("input").forEach(input => {

        if (input.type === "checkbox") {

            input.checked = false;

        }

        else {

            input.value = "";

        }

    });

    document.querySelectorAll("select").forEach(select => {

        select.selectedIndex = 0;

    });

    ctx.clearRect(

        0,
        0,
        canvas.width,
        canvas.height

    );

    updateOuderBlok();

}

// ======================================================
// E-MAIL CONTROLEREN
// ======================================================

const email =
    document.getElementById("email");

email.addEventListener("blur", () => {

    const regex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (

        email.value &&
        !regex.test(email.value)

    ) {

        toonMelding(

            "Voer een geldig e-mailadres in.",

            "error"

        );

    }

});

// ======================================================
// POSTCODE
// ======================================================

const postcode =
    document.getElementById("postcode");

postcode.addEventListener("input", () => {

    postcode.value =
        postcode.value.toUpperCase();

});

// ======================================================
// TELEFOON
// ======================================================

const telefoon =
    document.getElementById("telefoon");

telefoon.addEventListener("input", () => {

    telefoon.value =
        telefoon.value.replace(

            /[^0-9+\-\s]/g,

            ""

        );

});

// ======================================================
// ENTER BLOKKEREN
// ======================================================

document.addEventListener("keydown", e => {

    if (

        e.key === "Enter" &&

        e.target.tagName !== "TEXTAREA"

    ) {

        e.preventDefault();

    }

});

// ======================================================
// START
// ======================================================

updateOuderBlok();

console.log(

    "✅ Inschrijfformulier versie 2.0 gereed."

);
