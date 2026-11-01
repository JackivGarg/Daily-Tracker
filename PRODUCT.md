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
