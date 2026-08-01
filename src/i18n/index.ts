import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ru from "./ru.json";
import be from "./be.json";
import type { LanguageId } from "../lib/types";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  be: { translation: be },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: "ru",
  fallbackLng: { be: ["ru", "en"], default: ["en"] },
  interpolation: { escapeValue: false },
  defaultNS: "translation",
});

export async function setAppLanguage(lang: LanguageId): Promise<void> {
  await i18n.changeLanguage(lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export default i18n;
