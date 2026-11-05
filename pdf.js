/*
=========================================================
HV NOVITAS
Module : PDF
Bestand: pdf.js
Versie : 1.0
=========================================================
*/

import {
    PDFDocument,
    StandardFonts,
    rgb
} from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";

// ======================================================
// PDF MAKEN
// ======================================================

export async function maakPDF(data) {

    const pdf =
        await PDFDocument.create();

    const pagina =
        pdf.addPage([595, 842]);

    const font =
        await pdf.embedFont(
            StandardFonts.Helvetica
        );

    const bold =
        await pdf.embedFont(
            StandardFonts.HelveticaBold
        );

    let y = 810;

    function titel(text) {

        pagina.drawText(text, {

            x: 40,
            y,

            size: 18,

            font: bold,

            color: rgb(1, 0.45, 0)

        });

        y -= 30;

    }

    function kop(text) {

        pagina.drawText(text, {

            x: 40,
            y,

            size: 13,

            font: bold

        });

        y -= 20;

    }

    function regel(label, waarde = "") {

        pagina.drawText(

            `${label} ${waarde}`,

            {

                x: 50,
                y,

                size: 11,

                font

            }

        );

        y -= 16;

    }

    titel("HV NOVITAS");

    pagina.drawText(

        "Inschrijfformulier",

        {

            x: 40,

            y,

            size: 12,

            font

        }

    );

    y -= 35;
   // ======================================================
    // PERSOONSGEGEVENS
    // ======================================================

    kop("Persoonsgegevens");

    regel("Voornaam:", data.voornaam);
    regel("Achternaam:", data.achternaam);
    regel("Geslacht:", data.geslacht);
    regel("Geboortedatum:", data.geboortedatum);
    regel("Geboorteplaats:", data.geboorteplaats);
    regel("Nationaliteit:", data.nationaliteit);

    y -= 10;

    // ======================================================
    // ADRES
    // ======================================================

    kop("Adresgegevens");

    regel("Straat:", data.straat);
    regel("Huisnummer:", data.huisnummer);
    regel("Postcode:", data.postcode);
    regel("Woonplaats:", data.woonplaats);

    y -= 10;

    // ======================================================
    // CONTACT
    // ======================================================

    kop("Contactgegevens");

    regel("E-mail:", data.email);
    regel("Telefoon:", data.telefoon);

    y -= 10;

    // ======================================================
    // HANDBAL
    // ======================================================

    kop("Handbal");

    regel("Eerder lid:", data.eerderLid);

    if (data.vereniging) {

        regel("Vereniging:", data.vereniging);

    }

    y -= 10;

    // ======================================================
    // OUDER / VERZORGER
    // ======================================================

    if (data.ouderNaam) {

        kop("Ouder / Verzorger");

        regel("Naam:", data.ouderNaam);

        regel(
            "Telefoon:",
            data.ouderTelefoon
        );

        regel(
            "E-mail:",
            data.ouderEmail
        );

        y -= 10;

    }

    // ======================================================
    // VOORWAARDEN
    // ======================================================

    kop("Voorwaarden");

    regel(

        "Akkoord:",

        data.voorwaarden
            ? "Ja"
            : "Nee"

    );

    y -= 20;
    // ======================================================
    // HANDTEKENING
    // ======================================================

    if (data.handtekening) {

        try {

            const afbeelding =
                await pdf.embedPng(data.handtekening);

            pagina.drawImage(

                afbeelding,

                {

                    x: 50,

                    y: y - 80,

                    width: 180,

                    height: 70

                }

            );

            pagina.drawText(

                "Digitale handtekening",

                {

                    x: 50,

                    y: y - 95,

                    size: 10,

                    font

                }

            );

            y -= 120;

        } catch (e) {

            console.error(
                "Handtekening kon niet worden toegevoegd.",
                e
            );

        }

    }

    // ======================================================
    // DATUM INSCHRIJVING
    // ======================================================

    kop("Registratie");

    const datum =
        new Date().toLocaleString("nl-NL");

    regel(
        "Datum inschrijving:",
        datum
    );

    y -= 20;

    // ======================================================
    // VOETTEKST
    // ======================================================

    pagina.drawText(

        "HV Novitas - Automatisch gegenereerd inschrijfformulier",

        {

            x: 40,

            y: 25,

            size: 9,

            font,

            color: rgb(0.4, 0.4, 0.4)

        }

    );

    // ======================================================
    // PDF OPSLAAN
    // ======================================================

    const bytes =
        await pdf.save();

    return bytes;

}
