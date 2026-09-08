---
name: escalation
description: Use when deciding whether a violation deserves a reminder or an escalation, or when writing a Telegram caption for escalate.
---
# Escalation

## Overview
The system already sends an automatic reminder when a violation is written. Escalation is the
second, deliberate step and it costs the site manager's attention — spend it only on verified repeats.

## Rules
- `occurrenceCount = 1` → a REMINDER was already sent. Do not escalate.
- Escalate only when the ledger says VERIFIED violation AND (`occurrenceCount ≥ 2` OR severity `critical`, i.e. missing helmet).
- AlertRule threshold and cooldown apply. A blocked call is normal — do not retry it.
- At most 2 escalations per session (`LIMITS.escalatePerSession`).

## Caption recipe
```
🚨 [Camera name] — [missing item], occurrence [n]. [One sentence: what to do now.]
```
No personal traits, no names, no punishment suggestions.

Operational escalation (no `violationId`): the incident, how many times it repeated, what the agent
already tried, what a person must do.

## Common mistakes
- Escalating on the first occurrence "to be safe".
- Escalating a PROBABLE verdict because the picture "looks bad".
- Retrying `escalate` after a cooldown block.
