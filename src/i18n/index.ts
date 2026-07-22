import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ru from "./ru.json";
import type { LanguageId } from "../lib/types";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: "ru",
  fallbackLng: "en",
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
