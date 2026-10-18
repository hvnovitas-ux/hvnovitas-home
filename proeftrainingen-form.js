import { db } from "https://hvnovitas-ux.github.io/hvnovitas-beheer/firebase.js";
import { ref, push } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

emailjs.init({ publicKey: "midvAouM3afDkcK9B" });
const EMAIL_SERVICE = "service_eoomltq";
const TEMPLATE_HV = "template_6nfavzp";
const TEMPLATE_CONFIRMATION = "template_lbh3c67";
const form = document.getElementById("trialForm");
const submitButton = document.getElementById("trialSubmit");
const message = document.getElementById("trialMessage");
const birthDateInput = document.getElementById("geboortedatum");

const today = new Date();
birthDateInput.max = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");

function val(id) {
  return document.getElementById(id).value.trim();
}
function showMessage(text, type) {
  message.textContent = text;
  message.className = "trial-message " + type;
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
async function sendNotificationEmails(data) {
  const dateLabel = new Date(data.created).toLocaleString("nl-NL");
  const clubParams = {
    aanvraagtype: "Proeftraining",
    voornaam: data.voornaam,
    achternaam: data.achternaam,
    geslacht: data.geslacht,
    geboortedatum: data.geboortedatum,
    geboorteplaats: "",
    nationaliteit: "",
    straat: "",
    huisnummer: "",
    postcode: "",
    woonplaats: "",
    email: data.email,
    telefoon: data.telefoon,
    eerderLid: "",
    vereniging: "",
    ouderNaam: "",
    ouderTelefoon: "",
    ouderEmail: "",
    opmerkingen: data.opmerkingen || "",
    datum: dateLabel
  };
  const confirmationParams = {
    ontvanger: data.email,
    aanvraagtype: "Proeftraining",
    voornaam: data.voornaam,
    achternaam: data.achternaam,
    email: data.email,
    telefoon: data.telefoon,
    geboortedatum: data.geboortedatum,
    opmerkingen: data.opmerkingen || "",
    datum: dateLabel
  };
  const results = await Promise.allSettled([
    emailjs.send(EMAIL_SERVICE, TEMPLATE_HV, clubParams),
    emailjs.send(EMAIL_SERVICE, TEMPLATE_CONFIRMATION, confirmationParams)
  ]);
  return { club: results[0].status === "fulfilled", applicant: results[1].status === "fulfilled" };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "trial-message";
  message.textContent = "";
  if (!form.reportValidity()) return;
  if (val("website")) {
    form.reset();
    showMessage("Bedankt! Je aanvraag is ontvangen.", "success");
    return;
  }

  const email = val("email").toLowerCase();
  const birthDate = val("geboortedatum");
  if (!validEmail(email)) {
    document.getElementById("email").focus();
    showMessage("Controleer het e-mailadres en probeer het opnieuw.", "error");
    return;
  }
  if (birthDate > birthDateInput.max) {
    birthDateInput.focus();
    showMessage("De geboortedatum kan niet in de toekomst liggen.", "error");
    return;
  }
  if (!document.getElementById("privacyAkkoord").checked) {
    showMessage("Geef toestemming om je gegevens te gebruiken voor contact over de proeftraining.", "error");
    return;
  }

  const data = {
    voornaam: val("voornaam"),
    achternaam: val("achternaam"),
    geboortedatum: birthDate,
    geslacht: val("geslacht"),
    email: email,
    telefoon: val("telefoon"),
    opmerkingen: val("opmerkingen"),
    toestemming: true,
    status: "Nieuw",
    bron: "website",
    created: Date.now()
  };

  submitButton.disabled = true;
  submitButton.textContent = "AANMELDING VERZENDEN...";
  try {
    const savedRef = await push(ref(db, "proeftrainingen"), data);
    const emailStatus = await sendNotificationEmails({ ...data, id: savedRef.key });
    form.reset();
    if (emailStatus.club && emailStatus.applicant) {
      showMessage("Bedankt! Je proeftrainingaanvraag is ontvangen. HV Novitas is geïnformeerd en er is een bevestigingsmail naar het opgegeven e-mailadres gestuurd.", "success");
    } else if (emailStatus.club) {
      showMessage("Je aanvraag is ontvangen en HV Novitas is geïnformeerd. De bevestigingsmail kon niet worden verzonden. De club kan je aanvraag wel opvolgen.", "warning");
    } else if (emailStatus.applicant) {
      showMessage("Je aanvraag is opgeslagen en de bevestigingsmail is verstuurd. De melding aan HV Novitas is niet gelukt; de aanvraag staat wel in het CMS.", "warning");
    } else {
      showMessage("Je aanvraag is opgeslagen, maar de e-mails konden niet worden verzonden. De aanvraag staat wel in het CMS.", "warning");
    }
  } catch (error) {
    console.error("Proeftrainingaanvraag opslaan of verwerken mislukt:", error);
    showMessage("Verzenden is niet gelukt. Controleer je verbinding en probeer het opnieuw. De aanvraag is niet bevestigd.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "VERSTUUR AANMELDING";
  }
});
