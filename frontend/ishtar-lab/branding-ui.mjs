function attachCredit() {
  const footer = document.querySelector(".side__foot");
  if (!footer || footer.querySelector(".ishtar-license-link")) return;
  const link = document.createElement("a");
  link.className = "ishtar-license-link";
  link.href = "/legal/LICENSE-Ishtar.txt";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Reda Zahloul · Licenza";
  link.title = "Ishtar Lab — contributi di Reda Zahloul, licenza d'uso";
  link.setAttribute("aria-label", "Licenza Ishtar Lab e titolare Reda Zahloul");
  link.addEventListener("click", event => {
    if (!event.ctrlKey && !event.metaKey && window.IshtarCatalog?.license) {
      event.preventDefault();
      window.IshtarCatalog.license();
    }
  });
  footer.append(link);
}
new MutationObserver(attachCredit).observe(document.documentElement, { childList: true, subtree: true });
attachCredit();
