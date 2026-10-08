import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import LanguageSelector from "../components/LanguageSelector";

describe("language selector", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("switches between Hungarian and English labels", () => {
    function Harness() {
      const { language, t } = useLanguage();
      return (
        <>
          <LanguageSelector />
          <div data-testid="current-lang">{language}</div>
          <div data-testid="nav-label">{t("dashboard")}</div>
          <div data-testid="page-labels">
            {[t("login"), t("bets"), t("analytics"), t("settings"), t("newBet"), t("saveReport"), t("setCapital"), t("startNow")].join("|")}
          </div>
        </>
      );
    }

    act(() => {
      root.render(
        <LanguageProvider>
          <Harness />
        </LanguageProvider>
      );
    });

    const select = container.querySelector('[data-testid="language-selector"]');
    expect(select).not.toBeNull();
    expect(select.value).toBe("en");
    expect(container.querySelector('[data-testid="nav-label"]').textContent).toBe("Dashboard");
    expect(container.querySelector('[data-testid="page-labels"]').textContent).toBe(
      "Log in|Bets|Analysis|Settings|New bet|Save new report|Set up your bankroll|Let's start!"
    );

    act(() => {
      select.value = "hu";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="current-lang"]').textContent).toBe("hu");
    expect(container.querySelector('[data-testid="nav-label"]').textContent).toBe("Vezérlőpult");
    expect(container.querySelector('[data-testid="page-labels"]').textContent).toBe(
      "Belépés|Fogadások|Elemzés|Beállítások|Új fogadás|Új jelentés mentése|Állítsuk be a bankrollod|Kezdjük!"
    );
  });
});
