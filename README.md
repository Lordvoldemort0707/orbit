# Orbit

Your day in one place: tasks, habits, a focus timer, a day planner, notes and a journal, with stats across all of them.
Orbit runs in the browser, installs like an app, works offline, and keeps every byte on your device.

## Run it

You need [Node.js](https://nodejs.org) (any recent version). Nothing to install, no build step.

```bash
npm start
```

Then open http://localhost:5173. Add `?demo` to the address on a fresh browser to open it filled with sample data.

## Install it

- **On this computer:** open Orbit in Chrome or Edge, then use the install icon in the address bar (or Settings → Install Orbit).
- **On your phone:** a phone can only install Orbit from an `https://` address. Put this folder on any static host
  (GitHub Pages, Netlify, Cloudflare Pages, Vercel), open that address on the phone, then choose
  *Install app* (Android) or *Share → Add to Home Screen* (iPhone).
  Data does not sync between devices; use Settings → Backup to move it.

## What's in it

| Screen | What it does |
| --- | --- |
| Today | Greeting with the one thing that needs you, weather, your next countdown and longest streak; a daily XP ring and your level; counts; a strip of your whole day; tasks, habits, goals, money, mood and notes |
| Tasks | Today, Upcoming, Anytime and Done, or a **Board** you drag cards across (To do, Doing, Done); lists, search, steps, repeats, priorities, goals; type `Call Mom tomorrow 6pm #family !high` and the fields fill in |
| Calendar | The month with tasks, plans, habits, spending, moods and countdowns on each day; a day panel; countdowns to exams, trips and deadlines |
| Planner | Drag on the day to block out time, drag to move, drag the foot to resize; focus sessions and timed tasks shown against the plan |
| Habits | Tick the last seven days in place, count habits (8 glasses), streaks, best run, a history heatmap you can click to fix; link a habit to a goal |
| Goals | Long-term goals with milestones, a target date and a reason; progress fills in from milestones and linked tasks; confetti when you achieve one |
| Focus | Pomodoro timer with breaks, linked to a task, logs every session; **focus sounds** (rain, brown noise, waves, café hum, white noise) that can follow the timer |
| Money | Type `250 lunch` or `+5000 stipend`; monthly budgets per category, spending per day against a daily budget, subscriptions that log themselves on renewal |
| Notes | Markdown-lite notes with checklists, links and `#tags`, pinning, search, autosave |
| Journal | A mood and a line a day, a 7-day mood line, which weekdays feel best |
| Stats | 7, 30 or 90 days of tasks, focus, habit days kept and mood, each against the period before |
| Progress | Your level and XP, XP per day against your daily goal, where XP comes from, and 22 achievements to unlock |

**Make it yours (Settings):** light, dark or system; six accent colours; editorial or modern headings; full or reduced motion; celebrations on or off; a daily XP goal; weather for your city; your currency.

**XP:** a task is 10 (+5 if high priority), a habit check-in 5 (+25 at a 7-day streak, +100 at 30), focus 1 a minute, a journal entry 5, a milestone 20, a goal 100, a money entry 2. It is worked out from what you did, so undoing something takes its XP back.

**Shortcuts:** `Ctrl K` search and commands (type `250 coffee` there to log spending) · `N` new task · `G` then `T/K/C/P/H/G/F/M/N/J/S/L` to jump · `Space` start or pause on Focus · `?` the full list.

## Your data

Everything is saved in this browser's local storage under `orbit.v1`. Clearing site data deletes it, so export a
backup from Settings now and then. Backups are plain JSON.

## Files

```
index.html            the shell
css/app.css           all styles, light and dark
js/core.js            utilities, the store, domain logic (dates, streaks, quick-add parser), icons
js/ui.js              toasts, dialogs, command palette, shortcuts
js/timer.js           the focus timer
js/life.js            goals, money, countdowns, XP, achievements and celebrations
js/fx.js              confetti, count-ups, rings and bars that grow in
js/ambient.js         focus sounds, generated live from noise
js/weather.js         weather from Open-Meteo (only once you pick a city)
js/sample.js          sample data (marked so it can be removed alone)
js/charts.js          small SVG charts
js/views/*.js         one file per screen
js/app.js             router, navigation, reminders, install and offline
sw.js                 service worker (offline cache)
server.js             a tiny local server for npm start
```
