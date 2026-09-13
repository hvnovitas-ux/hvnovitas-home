document.addEventListener("DOMContentLoaded", () => {
    console.log("🧡 HV Novitas nieuwe homepage geladen");

    /*
     * SMOOTH SCROLL
     */

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(
                link.getAttribute("href")
            );

            if (target) {
                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });
});
