# Nocturne — Version 3

A compact, AMOLED study tracker for JEE aspirants.

[Open Nocturne](https://aeris722.github.io/Nocturne/)

## Study scoring

Each focus session is worth up to 200 XP. Study for **more than 50%** of its planned duration to earn XP:

`XP = 200 × min(study time / planned time, 1) × focus / 100`

Exactly half or less earns zero. Paused time is excluded. Use the timer or enter `hh:mm:ss` manually. Older check-ins without duration retain focus-only scoring until edited. Other ritual rewards, hydration, and missed-task penalties remain separate.

## Schedule

Every day: 15:30–17:30 Major, 17:30–18:15 Minor, 18:30–21:30 Advanced, and 22:00–23:00 Minor. Weekends add 08:00–11:00 and 11:30–14:00 sessions. Wake-up remains 06:20; journaling is in the evening.

## Data and backups

Data stays in browser local storage. Export and import JSON using the header controls. Backups include goals, timers, study duration, and scoring data. Removed Daily Check In and Class Focus entries are ignored during restore. Past dates can be edited from History; future dates cannot.

## Checks and publishing

Run `node --test tests/refinements.test.cjs`, `node --check dist/app.js`, `node --check dist/backup.js`, and `git diff --check`.

Source is in `dist/`. Publish with `git subtree push --prefix dist origin gh-pages`; verify the live version after the Pages build finishes.
