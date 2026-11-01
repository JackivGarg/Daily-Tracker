# Momentum — Daily Tracker

A personal Windows app for the habits that matter: nutrition, training, learning, guitar, and an honest reflection on each day. Dark interface, separate pages, interactive calendar, and a real scroll-controlled Three.js growth garden.

## Open the app

Install `Momentum-Setup-1.0.0.exe`, then open **Momentum** from the Desktop shortcut or Start menu. The installed app includes its own runtime; you do not need Node, a browser, or terminal commands. Installation is per-user and does not require an administrator account.

The daily check-in is split across Your Day, Nutrition, Training, Body & Weight, Study & Focus, and Guitar pages. Move between them freely, then select **Save check-in**. You can save a partial day and edit it later. Changing pages inside the check-in keeps your draft; leaving without saving asks first.

## Features

- Individual meal entries with calories and optional protein grams.
- Independent protein and creatine completion checks.
- Workout or rest-day entry, overall rating, and separate ratings for legs, chest, back, biceps, triceps, shoulders, core, and forearms.
- Weight, study minutes and notes, guitar completion and practice minutes.
- Personal red/green labels and meanings, selected manually rather than calculated from health metrics.
- Interactive year calendar, green-day streak, nutrition and focus charts, weight history, and muscle-group balance.
- Groq-powered reflections on request, with a local fallback when offline.
- JSON backup export/import. Import validates all records before any changes and merges by date.
- Separate 3D growth page with reversible native scroll, four camera chapters, reduced-motion support, and WebGL fallback.
- Growth World now uses your actual check-ins for size, branches, and foliage. Scroll explores the plant; it does not earn progress.

### How Growth World changes

Three consecutive green days unlock growth. The third green day and each subsequent consecutive green day earn one retained growth point. Red resets the streak and pauses growth until another three-day green streak; earned size stays. Stages unlock at 1, 6, 20, and 45 points, from sprout to a full-grown tree.

Every three logged workouts add a permanent branch. A guitar, sports, or travel yes adds 28 foliage vitality (maximum 100). After three explicitly logged days with all three marked no, further such days reduce vitality by 12 (minimum 15), producing dry, drooping leaves. Any of those activities can restore them. Missing records and unanswered fields are unknown, never automatic no. Starting vitality is 55.

Sports and travel checks are on the existing Guitar check-in page. Garden history and previews are read-only; changing a real entry recalculates the garden without double-counting.

Tracking begins **1 November 2026** in **Asia/Kolkata**. There are no sample entries in your database. Starting goals are editable suggestions to replace with your own targets.

## Local data and private configuration

Installed app data is stored at `%APPDATA%\Momentum\`:

- `tracker.sqlite` — your history and settings (also SQLite WAL/SHM files while open).
- `.env` — your private Groq configuration.

Use **Goals & settings → Export JSON backup** regularly. Uninstalling keeps your app data; reinstalling the app resumes the same history. Do not delete the app-data folder if you want to keep your records.

The installer and Git repository never contain your `.env`, API key, or tracking database. This computer's supplied key is provisioned separately into the local app-data folder. A fresh installation on another computer works offline and needs its own configuration for AI reflections:

```dotenv
GROQ_API_KEY=your_private_key
GROQ_MODEL=openai/gpt-oss-120b
```

Only structured recent activity is sent to Groq when you click the reflection button; personal notes and meal names remain local. The app never makes automatic AI requests.

## Development

Requires Node 24.13+ and npm. Clone this repository, install dependencies, and configure the ignored root `.env` from `.env.example`.

```powershell
npm install
npm run build
npm run desktop
```

`npm run dev` is an optional browser development workflow. The installed app is the intended end-user experience.

```powershell
npm test
npm run test:ui
npm run package:desktop
```

Packaging produces a per-user Windows x64 installer in `release/`. Development UI smoke tests use an isolated temporary database and the system Chrome executable. No tests write sample data into the installed app's profile.

The Electron renderer is sandboxed, has no Node integration, rejects external navigation/new windows and browser permissions, and uses a content security policy. Its internal API binds only to a random loopback port while the app is open. Nothing is exposed on your network, and closing the application stops that service.

## Design and world

`PRODUCT.md` records product decisions, `DESIGN.md` records the interface system, and `WORLD.md` contains scene, camera, materials, assets, performance budgets, and verification details.
