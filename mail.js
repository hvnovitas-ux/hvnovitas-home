/*
=========================================================
HV NOVITAS
Module : Mail
Bestand: mail.js
Versie : 1.0
=========================================================
*/

import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

// ======================================================
// INITIALISEREN
// ======================================================

emailjs.init({

    publicKey: "midvAouM3afDkcK9B"

});

// ======================================================
// CONSTANTEN
// ======================================================

const SERVICE_ID = "service_eoomltq";

const TEMPLATE_HV = "template_6nfavzp";

const TEMPLATE_BEVESTIGING = "template_lbh3c67";

// ======================================================
// HULPFUNCTIE
// ======================================================

async function verzend(templateId, gegevens) {

    return await emailjs.send(

        SERVICE_ID,

        templateId,

        gegevens

    );

}
// ======================================================
// MAIL NAAR HV NOVITAS
// ======================================================

export async function mailNaarHV(gegevens) {

    const templateParams = {

        voornaam: gegevens.voornaam,
        achternaam: gegevens.achternaam,

        geslacht: gegevens.geslacht,
        geboortedatum: gegevens.geboortedatum,
        geboorteplaats: gegevens.geboorteplaats,
        nationaliteit: gegevens.nationaliteit,

        straat: gegevens.straat,
        huisnummer: gegevens.huisnummer,
        postcode: gegevens.postcode,
        woonplaats: gegevens.woonplaats,

        email: gegevens.email,
        telefoon: gegevens.telefoon,

        eerderLid: gegevens.eerderLid,
        vereniging: gegevens.vereniging,

        ouderNaam: gegevens.ouderNaam,
        ouderTelefoon: gegevens.ouderTelefoon,
        ouderEmail: gegevens.ouderEmail,

        datum: new Date().toLocaleString("nl-NL")

    };

    try {

        const resultaat = await verzend(

            TEMPLATE_HV,

            templateParams

        );

        console.log(
            "📧 Mail naar HV Novitas verzonden.",
            resultaat.status
        );

        return true;

    }

    catch (error) {

        console.error(
            "❌ Mail naar HV Novitas mislukt.",
            error
        );

        return false;

    }

}
// ======================================================
// BEVESTIGINGSMAIL
// ======================================================

export async function mailBevestiging(gegevens) {

    const ontvanger =
        gegevens.ouderEmail &&
        gegevens.ouderEmail.trim() !== ""
            ? gegevens.ouderEmail
            : gegevens.email;

    const templateParams = {

        ontvanger: ontvanger,

        voornaam: gegevens.voornaam,
        achternaam: gegevens.achternaam,

        email: gegevens.email,

        datum:
            new Date().toLocaleString("nl-NL")

    };

    try {

        const resultaat = await verzend(

            TEMPLATE_BEVESTIGING,

            templateParams

        );

        console.log(

            "📧 Bevestigingsmail verzonden.",

            resultaat.status

        );

        return true;

    }

    catch (error) {

        console.error(

            "❌ Bevestigingsmail mislukt.",

            error

        );

        return false;

    }

}

// ======================================================
// HOOFDFUNCTIE
// ======================================================

export async function verstuurMails(gegevens) {

    const hv =
        await mailNaarHV(gegevens);

    const bevestiging =
        await mailBevestiging(gegevens);

    return {

        hv,
        bevestiging

    };

}
