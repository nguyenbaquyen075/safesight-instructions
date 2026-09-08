---
name: ppe-review
description: Use when reading a PPE violation snapshot (helmet, hi-vis vest, gloves, boots) to decide whether the report is a real violation or a false positive.
---
# PPE review

## Overview
The detector draws a red box around a person it believes lacks PPE. Your job is to say what the
image actually shows, item by item, and to know which items the detector gets wrong most often.

## Quick reference

| Item | Counts as present only when | Frequent false positives |
|---|---|---|
| Helmet | It is ON THE HEAD. Held, hung, on the ground = missing (real, not false). | Bending down, hood over helmet |
| Hi-vis vest | The torso is clearly visible with the vest on it. The model has no "no vest" class — missing is inferred from not seeing one. | Backpack, person facing away, backlight |
| Gloves | Bare hands clearly visible. Weakest class (6–9 % measured false positives). | Hand out of frame, hand in pocket, holding an object |
| Boots | Bare feet clearly visible. Weakest class with gloves. | Feet occluded, low resolution |

## Decision rules
- Passer-by in the background or outside the fence → `snapshot.person-outside-work-zone`.
- Red box around a post, shadow, vehicle, mannequin, poster → `snapshot.no-person`.
- `occurrenceCount ≥ 2` means the tracker saw this person missing the item for at least 60 s → strong evidence, add `track.confirmed-repeat`.
- The snapshot is a downscaled 640 px frame: do not guess details you cannot see; say `snapshot.occluded-or-backlit` instead.
- Check the item that was REPORTED missing first; note other items only if clearly relevant.

## When you cannot conclude
`record_verdict` with the non-primary kinds you did observe (e.g. `snapshot.occluded-or-backlit`,
`history.camera-false-positive-prone`) plus a short note, then `schedule_followup` with
`kind: followup` (the only kinds are `followup` and `camera.digest`). Inconclusive is a valid outcome.

## Common mistakes
- Calling a helmet "present" because it is in the picture — it must be on the head.
- Concluding "no gloves" from a hand that is holding something or is outside the frame.
- Treating a high camera false-positive rate as proof this report is false — it is context, not observation.
