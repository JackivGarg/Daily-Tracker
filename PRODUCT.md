# Daily Tracker

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, Node 24, Express, and SQLite. Selected under the user's instruction to proceed with a local database; framework recommendation was offered as an optional preference. No hosted database is required.

## Users

Jackiv, tracking personal routines daily from 1 November 2026 in Asia/Kolkata.

## Product Purpose

Make a quick, honest daily record of nutrition, training, weight, study, guitar, and personal red/green reflection. Turn that history into useful patterns and motivation.

## Operating Context

One personal Windows desktop application called Momentum, launched from an icon on the user's Desktop and Start menu. Electron hosts the React interface; no external browser or manual server commands are needed. SQLite and private configuration live in the Windows application-data folder. The dashboard is the daily working surface. A separate scrollable real-time 3D journey visualizes growth without delaying logging.

## Capabilities and Constraints

- Calorie intake through individual meal logs with optional protein grams.
- Personal red/green status, with editable definitions; never inferred from calories or activity.
- Workout yes/no, overall rating, and separate ratings for legs, chest, back, biceps, triceps, shoulders, core, and forearms.
- Daily weight, study time and notes, guitar completion and practice time.
- Separate protein and creatine yes/no checks.
- Optional sports and travel checks live alongside guitar; any of those activities replenishes Growth World foliage.
- GitHub-style interactive calendar, charts, history, goals, and data-driven insights.
- Server-side Groq motivation; key lives only in git-ignored .env.
- Persistent local SQLite storage, export/import, no fabricated history.
- Separate routed pages for Dashboard, Insights, History, Growth World and Settings. Daily entry has distinct Day, Nutrition, Training, Weight, Study, and Guitar subpages; never one long scrolling check-in form. Page navigation preserves the unsaved daily draft; leaving the check-in warns before discarding it.

## Brand Commitments

Great dashboards and scrollable 3D UI; use Impeccable, Three.js scroll worlds, and GSAP ScrollTrigger.

## Evidence on Hand

The provided GitHub repository was empty when cloned. There is no existing branding or tracking history.

## Product Principles

- Make daily entry easy to resume and edit.
- Missing data stays missing, never zero or failure.
- Red and green belong to the user's own meaning.
- Keep motivation supportive and tied to actual data.
- Keep essential tasks available without WebGL or motion.

## Open Decisions and Assumptions

User explicitly rejected a light theme and delegated the visual direction: dark, high-tech, visually appealing. Default goals are editable starting values, not personalized nutritional advice.

## Check-in-driven Growth World

The user explicitly requested that the illustrative garden become a persistent visual record: green streaks grow its size, red resets the growth streak and pauses size until a minimum streak returns, gym sessions grow branches, and guitar/sports/travel keep leaves lush. Preserve the existing rest of the app.

Implementation rules: three consecutive calendar green days unlock growth; the third and subsequent green days earn one cumulative growth point each. A red or a calendar gap resets the consecutive streak but never removes earned size or branches. Three workout check-ins earn a permanent branch. Any guitar/sports/travel yes restores 28 vitality points up to 100. Three explicitly logged days with all three activities no are a grace period; further such days reduce vitality by 12 to a floor of 15. Unknown answers and missing dates never count as no. Vitality begins at 55. These are motivational game rules, not health judgments.

Stages progress Seed → Sprout (1 point) → Sapling (6) → Young tree (20) → Full-grown tree (45). Scroll changes the camera only. A history control can inspect saved snapshots; any future-tree preview is clearly marked as illustrative, with no database writes. Display the rules, current points, streak/lock, branches, vitality, and actionable next steps. Support pause, reduced motion, static fallback, and render only when needed.
