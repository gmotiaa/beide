export const SITE = {
  name: "beide",
  tagline: "IDE с AI-агентом внутри",
  claim: "Первая белорусская IDE с полноценным AI-агентом в десктопе",
  description:
    "Десктопная среда разработки для Windows: редактор Monaco, файловый проводник, терминал и агент, который сам читает проект, планирует и правит код — с превью диффов и чекпоинтами.",
  version: "0.1.0",
  license: "MIT",
  repo: "https://github.com/Gmotia/beide",
  releases: "https://github.com/Gmotia/beide/releases",
  issues: "https://github.com/Gmotia/beide/issues",
} as const;

export type NavItem = { label: string; to: string };

export const NAV: NavItem[] = [
  { label: "Возможности", to: "/features" },
  { label: "Агент", to: "/agent" },
  { label: "Витрина", to: "/showcase" },
  { label: "Документация", to: "/docs" },
  { label: "Обновления", to: "/changelog" },
];

export type Feature = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tag?: string;
};

export const FEATURES: Feature[] = [
  {
    id: "agent",
    title: "Агент в процессе, а не во вкладке",
    description:
      "Агент живёт в main-процессе Electron и работает с реальной файловой системой проекта: читает, ищет, правит, запускает команды. Никаких копипастов между браузером и редактором.",
    icon: "Bot",
    tag: "Ядро",
  },
  {
    id: "plan",
    title: "Режимы Plan и Agent",
    description:
      "В Plan агент только исследует и предлагает план — он физически не пишет на диск. В Agent выполняет: правки, команды, установку зависимостей. Переключение — одним кликом в композере.",
    icon: "Compass",
    tag: "Контроль",
  },
  {
    id: "diff",
    title: "Диффы перед записью",
    description:
      "Каждое изменение сначала показывается как дифф: Apply или Reject. Ничего не попадает в файл, пока вы не согласились — это не «доверься модели», а нормальный ревью.",
    icon: "GitCompare",
    tag: "Контроль",
  },
  {
    id: "checkpoints",
    title: "Чекпоинты и откат",
    description:
      "Перед серией правок beide снимает чекпоинт в .beide/checkpoints/. Если агент ушёл не туда — откат в один клик, без возни с git stash.",
    icon: "History",
    tag: "Безопасность",
  },
  {
    id: "permissions",
    title: "Разрешения: ask или auto",
    description:
      "По умолчанию агент спрашивает перед записью файла и запуском команды. Режим auto включается осознанно — и только для проектов, где вы этого хотите.",
    icon: "ShieldCheck",
    tag: "Безопасность",
  },
  {
    id: "editor",
    title: "Monaco и вкладки",
    description:
      "Тот же движок, что в VS Code: подсветка, автодополнение, мультикурсор, поиск по файлу. Вкладки, дерево проекта, быстрый переход по @-упоминаниям.",
    icon: "Code2",
    tag: "Редактор",
  },
  {
    id: "mentions",
    title: "@file и @folder, картинки",
    description:
      "Точечный контекст вместо «прочитай весь репозиторий»: упомяните файл или папку прямо в сообщении. Скриншот макета или ошибки можно приложить вложением.",
    icon: "AtSign",
    tag: "Редактор",
  },
  {
    id: "terminal",
    title: "Встроенный терминал",
    description:
      "Команды запускаются из IDE и их вывод виден агенту. Это пайп поверх shell:run, а не полноценный PTY — интерактивные TUI лучше держать в отдельном окне.",
    icon: "Terminal",
    tag: "Редактор",
  },
  {
    id: "rules",
    title: "Правила проекта",
    description:
      "BEIDE.md в корне или .beide/rules.md задают агенту постоянные инструкции: стек, стиль, запреты. Один раз описали — и они попадают в каждый запрос.",
    icon: "ScrollText",
    tag: "Настройка",
  },
  {
    id: "themes",
    title: "Три темы и русский интерфейс",
    description:
      "Dark, Light и Midnight, i18n на русском и английском. Интерфейс собран на дизайн-токенах, поэтому темы переключаются без «поехавших» цветов.",
    icon: "Palette",
    tag: "Настройка",
  },
  {
    id: "providers",
    title: "Несколько провайдеров моделей",
    description:
      "Anthropic и xAI подключаются через pi auth login, NVIDIA и Google — ключами в .env. Ключи хранятся вне репозитория, в профиле пользователя.",
    icon: "KeyRound",
    tag: "Модели",
  },
  {
    id: "sessions",
    title: "Сессии и история",
    description:
      "Каждый диалог сохраняется: можно вернуться к вчерашней задаче, посмотреть, какие инструменты вызывал агент, и продолжить с того же места.",
    icon: "MessagesSquare",
    tag: "Ядро",
  },
];

export type Mode = {
  name: string;
  badge: string;
  summary: string;
  can: string[];
  cannot: string[];
};

export const MODES: Mode[] = [
  {
    name: "Plan",
    badge: "только чтение",
    summary:
      "Режим разведки. Агент собирает контекст и возвращает план, который вы читаете до того, как что-то изменится.",
    can: [
      "Читать файлы и искать по проекту",
      "Строить карту зависимостей и точек входа",
      "Предлагать пошаговый план правок",
      "Задавать уточняющие вопросы",
    ],
    cannot: [
      "Записывать файлы",
      "Удалять или переименовывать",
      "Запускать команды, меняющие проект",
    ],
  },
  {
    name: "Agent",
    badge: "чтение и запись",
    summary:
      "Рабочий режим. Агент выполняет план: правит файлы, запускает команды, чинит то, что сам сломал — под вашим контролем.",
    can: [
      "Создавать и править файлы",
      "Запускать команды в терминале",
      "Ставить зависимости",
      "Прогонять тесты и чинить падения",
    ],
    cannot: [
      "Обойти запрос разрешения в режиме ask",
      "Записать что-либо без превью диффа",
      "Уйти за пределы открытой папки проекта",
    ],
  },
];

export type ModelRow = {
  name: string;
  version: string;
  provider: string;
  context: string;
  images: boolean;
};

export const MODELS: ModelRow[] = [
  { name: "Claude Opus", version: "5", provider: "Anthropic", context: "1M", images: true },
  { name: "Claude Sonnet", version: "5", provider: "Anthropic", context: "1M", images: true },
  { name: "Claude Haiku", version: "4.5", provider: "Anthropic", context: "200K", images: true },
  { name: "MiniMax", version: "M3", provider: "NVIDIA", context: "128K", images: true },
  { name: "GLM", version: "5.2", provider: "NVIDIA", context: "128K", images: false },
  { name: "Nemotron", version: "3 Ultra", provider: "NVIDIA", context: "128K", images: false },
  { name: "Kimi", version: "K2.6", provider: "NVIDIA", context: "128K", images: true },
  { name: "DeepSeek", version: "V4 Pro", provider: "NVIDIA", context: "128K", images: false },
  { name: "Gemini", version: "3.5 Flash", provider: "Google", context: "1M", images: true },
  { name: "Grok", version: "4.5", provider: "xAI", context: "256K", images: false },
];

export type Step = { n: string; title: string; body: string };

export const WORKFLOW: Step[] = [
  {
    n: "01",
    title: "Открываете папку",
    body: "beide индексирует дерево проекта и подхватывает правила из BEIDE.md, если они есть.",
  },
  {
    n: "02",
    title: "Ставите задачу",
    body: "Обычным текстом, с @-упоминаниями нужных файлов и скриншотами, если так понятнее.",
  },
  {
    n: "03",
    title: "Читаете план",
    body: "В режиме Plan агент возвращает разбор и последовательность шагов — без единой записи на диск.",
  },
  {
    n: "04",
    title: "Смотрите диффы",
    body: "Переключаетесь в Agent. Каждая правка приходит как дифф с кнопками Apply и Reject.",
  },
  {
    n: "05",
    title: "Откатываете при необходимости",
    body: "Чекпоинт снят до начала серии правок — вернуться к исходному состоянию можно в один клик.",
  },
];

export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: "Нужна ли подписка на beide?",
    a: "Нет. beide распространяется под лицензией MIT и ничего не стоит. Платить вы будете только провайдеру моделей — по своим ключам и своему тарифу.",
  },
  {
    q: "Куда уходит мой код?",
    a: "Только в тот провайдер модели, который вы выбрали в пикере. У beide нет своего бэкенда, промежуточного прокси и телеметрии по содержимому файлов.",
  },
  {
    q: "Где хранятся ключи?",
    a: "Anthropic и xAI — в профиле pi (~/.pi/agent), NVIDIA и Google — в .env рядом с проектом. В репозиторий ключи не попадают, IDE их не пересылает никуда, кроме самого провайдера.",
  },
  {
    q: "Может ли агент сломать проект?",
    a: "По умолчанию он спрашивает перед каждой записью и запуском команды, показывает дифф до применения и снимает чекпоинт перед серией правок. Режим auto существует, но включается вами осознанно.",
  },
  {
    q: "Работает ли beide на macOS и Linux?",
    a: "Сейчас поддерживается Windows 10 и 11. Приложение собрано на Electron, так что технических препятствий для других платформ нет — но сборок под них пока нет.",
  },
  {
    q: "Это форк VS Code?",
    a: "Нет. Это отдельное приложение на Electron и React, которое использует Monaco в качестве редактора — тот же движок, что внутри VS Code, но без его экосистемы расширений.",
  },
  {
    q: "Терминал полноценный?",
    a: "Пока нет. Это пайп поверх запуска команд: вывод виден и вам, и агенту, но интерактивные TUI (vim, htop) там работать не будут.",
  },
  {
    q: "Можно ли задать агенту правила проекта?",
    a: "Да. Положите BEIDE.md в корень репозитория или .beide/rules.md рядом с настройками — эти инструкции подмешиваются в каждый запрос.",
  },
];

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  status: "current" | "past";
  items: { kind: "add" | "fix" | "change"; text: string }[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2026",
    title: "Первый публичный срез",
    status: "current",
    items: [
      { kind: "add", text: "Агент в main-процессе с режимами Plan и Agent" },
      { kind: "add", text: "Превью диффов с Apply и Reject перед записью" },
      { kind: "add", text: "Чекпоинты проекта в .beide/checkpoints/" },
      { kind: "add", text: "Разрешения ask и auto для записи и команд" },
      { kind: "add", text: "Редактор Monaco, вкладки и дерево файлов" },
      { kind: "add", text: "Упоминания @file и @folder, вложения-картинки" },
      { kind: "add", text: "Встроенный терминал поверх shell:run" },
      { kind: "add", text: "Каталог моделей: Anthropic, NVIDIA, Google, xAI" },
      { kind: "add", text: "Темы dark, light, midnight и интерфейс на RU и EN" },
      { kind: "add", text: "Правила проекта через BEIDE.md и .beide/rules.md" },
    ],
  },
];

export type DocSection = {
  id: string;
  title: string;
  blurb: string;
  blocks: { heading?: string; text?: string; code?: string; list?: string[] }[];
};

export const DOCS: DocSection[] = [
  {
    id: "install",
    title: "Установка",
    blurb: "Сборка из исходников. Windows 10 или 11, Node.js 22 и выше.",
    blocks: [
      {
        text: "beide собирается локально. Понадобится Node.js 22+ и git — больше ничего.",
      },
      {
        code: "git clone https://github.com/Gmotia/beide\ncd beide\nnpm install\nnpm run dev",
      },
      {
        heading: "Сборка дистрибутива",
        text: "Установщик под Windows собирается одной командой; результат появится в каталоге release.",
      },
      { code: "npm run build\nnpm run dist" },
    ],
  },
  {
    id: "auth",
    title: "Подключение моделей",
    blurb: "Anthropic и xAI — через pi, NVIDIA и Google — через .env.",
    blocks: [
      {
        heading: "Anthropic и xAI",
        text: "Авторизация идёт через профиль pi. Ключи и токены сохраняются в ~/.pi/agent и остаются вне репозитория.",
      },
      { code: "npx pi auth login" },
      {
        heading: "NVIDIA и Google",
        text: "Скопируйте .env.example в .env и заполните нужные ключи. Файл .env уже в .gitignore.",
      },
      { code: "NVIDIA_API_KEY=...\nGOOGLE_API_KEY=..." },
      {
        heading: "Что важно",
        list: [
          "beide не хранит ключи у себя и не проксирует запросы через свой сервер",
          "Достаточно одного провайдера — остальные можно не подключать",
          "Модель переключается в пикере композера в любой момент диалога",
        ],
      },
    ],
  },
  {
    id: "modes",
    title: "Режимы работы",
    blurb: "Plan исследует, Agent исполняет.",
    blocks: [
      {
        text: "Plan — режим только для чтения: агент собирает контекст и возвращает план. Запись на диск в нём невозможна на уровне механики, а не договорённости.",
      },
      {
        text: "Agent — рабочий режим: правки, команды, зависимости, тесты. Каждое действие проходит через разрешения и превью диффа.",
      },
      {
        heading: "Рабочая привычка",
        list: [
          "Незнакомый проект начинайте с Plan",
          "Мелкие точечные правки делайте сразу в Agent",
          "Перед крупной серией правок убедитесь, что чекпоинты включены",
        ],
      },
    ],
  },
  {
    id: "rules",
    title: "Правила проекта",
    blurb: "BEIDE.md и .beide/rules.md — постоянный контекст для агента.",
    blocks: [
      {
        text: "Положите файл BEIDE.md в корень репозитория. Всё, что в нём написано, подмешивается в каждый запрос к модели — стек, соглашения, запреты.",
      },
      {
        code: "# BEIDE.md\n\n- Стек: React 19 + TypeScript strict, Zustand\n- Не добавлять новые зависимости без обсуждения\n- Комментарии и идентификаторы — на английском\n- Перед завершением: npm run typecheck && npm test",
      },
      {
        text: "Альтернатива — .beide/rules.md, если не хочется класть служебный файл в корень.",
      },
    ],
  },
  {
    id: "safety",
    title: "Разрешения и откат",
    blurb: "Три независимых предохранителя.",
    blocks: [
      {
        heading: "Разрешения",
        text: "Режим ask (по умолчанию) спрашивает перед записью файла и запуском команды. Режим auto снимает вопросы — включайте его только там, где вам это действительно нужно.",
      },
      {
        heading: "Диффы",
        text: "Изменение сначала показывается как дифф. Apply записывает, Reject отбрасывает. Никакой записи «вслепую» не происходит.",
      },
      {
        heading: "Чекпоинты",
        text: "Перед серией правок снимается снимок в .beide/checkpoints/. Откат возвращает файлы к состоянию до вмешательства агента.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Если что-то не работает",
    blurb: "Короткий список типовых проблем.",
    blocks: [
      {
        list: [
          "Модель не отвечает — проверьте, что ключ провайдера подключён: npx pi auth login или .env",
          "Агент не видит файл — упомяните его явно через @file, а не описанием «тот файл со стилями»",
          "Команда висит — это не PTY: интерактивные TUI в встроенном терминале не работают",
          "Правки не применяются — посмотрите, не остался ли включённым режим Plan",
          "Сборка падает на Windows — убедитесь, что Node.js 22 или новее: node -v",
        ],
      },
    ],
  },
];

export type Metric = { value: string; label: string };

export const METRICS: Metric[] = [
  { value: "10", label: "моделей в каталоге" },
  { value: "4", label: "провайдера" },
  { value: "2", label: "режима работы агента" },
  { value: "MIT", label: "лицензия" },
];
