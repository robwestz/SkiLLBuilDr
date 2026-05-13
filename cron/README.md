# Cron Manager (local)

This directory holds OS-level scheduling for the routines in `../routines/`. The
goal is the OPS column from the Agentic OS diagram — turning a routine into a
daily/weekly trigger — without depending on a cloud scheduler.

The runner is always `node routine-run.mjs <routine.json> --execute`. The cron
glue here just wires that command into Windows Task Scheduler or Unix cron.

## Why local first

- Local schedules survive offline operation and need no API keys.
- The routine runner enforces a per-step safety grind (`runtime_authorized`,
  default dry-run) so an automated trigger cannot escalate beyond what the
  routine manifest explicitly allowed.
- Cloud cron / GitHub Actions can be layered on later once the local path is
  proven; the routine contract does not change.

## Windows — Task Scheduler

Run as the user that owns the repo (avoid `SYSTEM` for any routine that touches
files outside the repo). Example: schedule the security-audit routine every
weekday at 07:00.

```powershell
powershell -ExecutionPolicy Bypass -File .\cron\install-example.ps1 `
  -RoutinePath "..\routines\security-audit.routine.json" `
  -TaskName "ecc-browser/security-audit" `
  -DailyAt "07:00"
```

What the installer does:

1. Resolves the absolute path to `routine-run.mjs` and the routine JSON.
2. Registers a scheduled task that runs `node routine-run.mjs <routine> --execute`.
3. Logs to `Event Viewer -> Task Scheduler` plus the JSONL trace under
   `.agents/routine-runs/<ts>/`.

To remove later: `Unregister-ScheduledTask -TaskName "ecc-browser/security-audit"`.

## macOS / Linux — cron

```bash
./cron/install-example.sh \
  ../routines/code-review.routine.json \
  "0 7 * * 1-5"
```

This appends a single line to your user crontab pointing at the routine. The
script prints the line first and asks you to confirm before writing — so you
can copy the line into another scheduler (systemd timers, launchd, etc.) if
preferred.

## What the cron entry should NOT do

- Should NOT push to git.
- Should NOT delete artifacts older than X days — let the operator decide.
- Should NOT run a routine whose steps include `shell` kinds without
  `runtime_authorized: true` set — the runner will block those anyway, but
  scheduling them is a smell.

## Verifying a scheduled run

After the trigger fires, the JSONL log under `.agents/routine-runs/<ts>/` is
the source of truth. Each line is a step decision; the final line is `event=end`
on success or `event=halt` on first failure. Routines that exit non-zero are
visible in Task Scheduler's "Last Run Result" column or in `grep CRON
/var/log/syslog` on Linux.

## Future (FUTURE_WORK.md)

- Trigger types beyond cron (filesystem watch, webhook).
- Lightweight dashboard listing scheduled routines + last-run status (Fas 6).
- One-shot retry on transient failure with backoff.
