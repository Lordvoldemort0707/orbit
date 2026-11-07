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
| Today | Greeting with the one thing that needs you, counts, a strip of your whole day (plan, focus, tasks done, now), quick add, habits, mood and notes |
| Tasks | Today, Upcoming, Anytime and Done; lists, search, steps, repeats, priorities; type `Call Mom tomorrow 6pm #family !high` and the fields fill in |
| Habits | Tick the last seven days in place, count habits (8 glasses), streaks, best run, a history heatmap you can click to fix |
| Focus | Pomodoro timer with breaks and long breaks, linked to a task, logs every session, chime and notifications |
| Planner | Drag on the day to block out time, drag to move, drag the foot to resize; focus sessions and timed tasks shown against the plan |
| Notes | Markdown-lite notes with checklists, links and `#tags`, pinning, search, autosave |
| Journal | A mood and a line a day, a 7-day mood line, which weekdays feel best |
| Stats | 7, 30 or 90 days of tasks, focus, habit days kept and mood, each against the period before |

**Shortcuts:** `Ctrl K` search and commands · `N` new task · `G` then `T/K/H/F/P/N/J/S` to jump · `Space` start or pause on Focus · `?` the full list.

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
js/sample.js          sample data (marked so it can be removed alone)
js/charts.js          small SVG charts
js/views/*.js         one file per screen
js/app.js             router, navigation, reminders, install and offline
sw.js                 service worker (offline cache)
server.js             a tiny local server for npm start
```
