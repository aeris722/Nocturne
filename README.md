# Nocturne — Version 3

A compact, AMOLED study tracker for JEE aspirants.

[Open Nocturne](https://aeris722.github.io/Nocturne/)

## Study scoring

Major + Minor and Advanced are worth up to 300 XP each; Night and the extra weekend sessions are worth up to 200 XP. Study for **more than 50%** of its planned duration to earn XP:

`XP = session maximum × min(study time / planned time, 1) × focus / 100`

Exactly half or less earns zero. Paused time is excluded. Use the timer or enter `hh:mm:ss` manually. Older check-ins without duration retain focus-only scoring until edited. Other ritual rewards, hydration, and missed-task penalties remain separate.

## Schedule

From 16 October 2026: 15:30–18:15 Major + Minor (300 XP), 18:30–21:30 Advanced (300 XP), and 22:00–23:00 Night (200 XP). Earlier dates retain their original schedule. Weekends add 08:00–11:00 and 11:30–14:00 sessions. Wake-up remains 06:20; journaling is in the evening.

## Data and backups

Data stays in browser local storage. Export and import JSON using the header controls. Backups include goals, timers, study duration, and scoring data. Removed Daily Check In and Class Focus entries are ignored during restore. Past dates can be edited from History; future dates cannot.

## Checks and publishing

Run `node --test tests/refinements.test.cjs`, `node --check dist/app.js`, `node --check dist/backup.js`, and `git diff --check`.

Source is in `dist/`. Publish with `git subtree push --prefix dist origin gh-pages`; verify the live version after the Pages build finishes.

## Weekly skip and daily summary

Choose up to two individual weekday study sessions per Monday–Sunday week. Calendar weekends and days using the weekend schedule cannot be skipped. Skipped sessions do not count toward XP, maximum XP or penalties.

The Yesterday button opens a visual report of recorded study time, average checked-in focus ratings, session details, completed rituals, XP and hydration. Missing durations remain unknown; old running timers stop counting at midnight IST.
