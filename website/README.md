# beide — website

Многостраничный маркетинговый сайт для IDE beide. Отдельное Vite-приложение,
никак не связанное со сборкой Electron: корневой `tsconfig.web.json` включает
только `src/**/*`, поэтому `npm run typecheck` в корне репозитория этот каталог
не видит.

## Стек

* Vite 7 + React 19 + TypeScript (strict)
* Tailwind CSS v4 через `@tailwindcss/vite` (конфиг в `src/index.css`, `@theme`)
* shadcn/ui поверх Radix — `src/components/ui`
* react-router-dom v7 — обычный `BrowserRouter`
* Origin Kit — вендоренные компоненты в `src/components/originkit`

## Команды

```bash
cd website
npm install
npm run dev        # http://localhost:5273
npm run typecheck
npm run build      # tsc --noEmit && vite build → dist/
npm run preview
```

## Страницы

| Путь | Что там |
| --- | --- |
| `/` | Герой, метрики, ключевые возможности, режимы, лента панелей, цикл работы, CTA |
| `/features` | Все возможности с фильтром по группам |
| `/agent` | Режимы Plan/Agent, предохранители, контекст, каталог моделей |
| `/showcase` | Визуальная витрина: тоннель галереи, темы, интерфейс |
| `/docs` | Установка, подключение моделей, правила проекта, безопасность, FAQ |
| `/download` | Требования, шаги установки, предупреждение про ключи |
| `/changelog` | История релизов |
| `*` | 404 |

## Компоненты Origin Kit

Вендорены как исходники (не npm-зависимость), с одной правкой на каждый:
изображения с CDN Origin Kit вырезаны, вместо них локальная генерация SVG в
`src/data/shots.ts`.

| Файл | Экспорт | Где используется |
| --- | --- | --- |
| `ascii-flame.tsx` | `AsciiFire` | CTA на главной, шапка `/agent`, витрина, 404 |
| `cosmic-orb.tsx` | `Orb` | Герой главной, блок контекста на `/agent`, витрина |
| `eye-gallery.tsx` | `EyeTicker` | Лента панелей на главной и в витрине |
| `gallery-tunnel.tsx` | `ImageBox` | Полноэкранный тоннель на `/showcase` (нужен `three`) |
| `pulse-lines.tsx` | `WaveBg` | Подвал, шапка `/features`, `/download`, витрина |
| `scramble-text.tsx` | `GlitchCharReveal` | Заголовки страниц через `ScrambleHeadline` |
| `electric-border.tsx` | `ElectricBorder` | Рамка CTA-блоков |
| `ascii-rain.tsx` | `DigitalRain` | Фон шапок `/agent`, `/download`, `/docs`, `/changelog`, герой главной, витрина |
| `pixel-card.tsx` | `PixelCard` | Карточки возможностей, предохранители, требования, витрина |
| `magnetic-button.tsx` | `MagneticButton` | Главные CTA на всех страницах (нужен `framer-motion`) |
| `shiny-pill.tsx` | `ShinyPill` | Бейджи-эйрбоу в шапках разделов |

`scramble-text` заполняет родителя целиком, поэтому используется только через
обёртку `src/components/site/scramble-headline.tsx` с явной высотой.

Четыре компонента вендорены с дополнительными правками поверх исходника:

* `ascii-rain.tsx` — добавлена проверка `prefers-reduced-motion`: поле
  отрисовывается один раз и не анимируется.
* `pixel-card.tsx` — добавлены пропсы `children` и `contentStyle`, чтобы
  положить содержимое поверх пиксельного слоя.
* `magnetic-button.tsx` — добавлены `onClick` (нужен роутеру для внутренней
  навигации) и `icon`.
* `shiny-pill.tsx` — добавлен `leading`, база и блик обёрнуты в собственный
  `position: relative`, плюс блок `prefers-reduced-motion`.

Обёртки над ними лежат в `src/components/site`: `rain-backdrop.tsx`,
`pixel-feature-card.tsx`, `magnetic-cta.tsx`, `shiny-badge.tsx`.

## Деплой

`npm run build` кладёт статику в `dist/`. Роутинг клиентский — на хостинге нужен
fallback всех путей на `index.html` (Netlify: `/* /index.html 200`, Vercel:
rewrite на `/`, nginx: `try_files $uri /index.html`).
