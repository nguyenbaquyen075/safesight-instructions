---
name: evidence
description: Use when choosing the observation kinds to pass to record_verdict, or when unsure whether what you saw is enough to call a violation or a false positive.
---
# Evidence

## Overview
You do not output a confidence number. `observations` is a list of **kinds from the table below** —
nothing else is accepted; the ledger scores them. A verdict is only as strong as its strongest *primary* observation.

## Quick reference

| Kind | Use when | Primary |
|---|---|---|
| `snapshot.no-person` | Nobody inside the red box (shadow, post, vehicle, mannequin, poster). Decisive. | ✓ |
| `snapshot.ppe-visible` | The item reported missing is clearly visible on the SAME person inside the box. | ✓ |
| `snapshot.ppe-clearly-missing` | The person is clear and the item is clearly absent (bare head, bare hands…). | ✓ |
| `track.confirmed-repeat` | `occurrenceCount ≥ 2`: the tracker saw the same person missing it continuously. | ✓ |
| `history.camera-false-positive-prone` | `read_camera_history` shows a false-positive rate above 0.5 over 7 days. | |
| `snapshot.occluded-or-backlit` | Occluded, backlit, blurred, hand or foot outside the frame — cannot conclude. | |
| `snapshot.person-outside-work-zone` | Passer-by or person outside the work area in the background. | |
| `contradiction` | Two things you saw disagree (e.g. helmet visible but the box says no helmet and the image is blurred). | |

## How the ledger reads them
- Only a primary kind can lift the band to VERIFIED.
- VERIFIED false positive → the system marks the violation `false_positive` itself.
- VERIFIED violation → stays open; escalation becomes possible.
- PROBABLE / POSSIBLE → write the note; a person decides.
- The same kind listed twice counts once.

## Common mistakes
- Inventing a kind that is not in the table — the ledger rejects it and the session wastes budget.
- Listing `snapshot.ppe-clearly-missing` when the limb is out of frame — that is `snapshot.occluded-or-backlit`.
- Using `history.camera-false-positive-prone` as if it were primary — it only lowers confidence, it never decides.
- Omitting `track.confirmed-repeat` when `occurrenceCount ≥ 2` — it is the strongest evidence for a real violation.
