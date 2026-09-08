---
name: remembering-camera-context
description: Use when the session belongs to one camera (the preamble has a "Camera memory" section) and you are about to call remember_camera, or when an existing memory note contradicts what you just observed.
---
# Camera memory

## Overview
Camera memory is a short list (max 20) of **durable facts** about one camera that later sessions reuse
without re-reading history. The preamble shows each note as `- #<index> [date] text`; `<index>` is the
`replaceIndex` value when a note must be corrected. The system stores the date and session; you write only the content.

## What a note is
One note = **one** durable fact, in this order, ≤ 300 characters:

```
<condition or area> → <effect on detection> → <how to review>
```

Good:
```
16:00–17:00 afternoon sun hits the lens → gloves are often falsely reported → in that window only call gloves missing when bare hands are clearly visible
```
```
Left edge of the frame is the pavement outside the fence → passers-by get boxed → use snapshot.person-outside-work-zone, do not record a violation
```

Write conditions as rounded hour windows ("16:00–17:00"), not the minutes of one day. A note never contains
dates (stored by the system), one-day counts, narration about editing, violation ids or names.

## Durable or not

| Durable → `remember_camera` | Not durable → `write_note` / `schedule_followup` |
|---|---|
| Camera angle, field of view, fixed occluders | One violation, one person, one shift |
| Backlight windows, flickering lights, seasonal rain on the lens | Today's violation count |
| Areas outside the fence / not a work zone | A single camera stall |
| A false-positive pattern seen across days and its cause | An unverified suspicion |
| Fixed schedules (night shift, delivery hours) | Work to do this shift |

Test: will it still be true **next week**? Yes → memory. No → note or follow-up.

## When an old note is wrong
Call `remember_camera` with that note's `replaceIndex` and a **completely new** note in the recipe above.
Do not add a second note to "correct" the first.

## Before writing
1. A note with the same meaning already exists → do not repeat; edit it only if wrong.
2. The fact comes from several observations or a user confirmation — one occurrence is not enough.
3. At most 3 calls per session; use them when it matters, not to fill the quota.

## When reviewing a violation
Memory tells you **where to look closely**, not what to conclude: "gloves often false 16:00–17:00" still
requires looking at the hands in this image before recording an observation.

## Follow-ups
`schedule_followup` accepts only `kind: followup` (re-check one subject) or `kind: camera.digest`
(camera summary). There is no other kind.
