# Requirement Similarity Policy

Loaded by Team Lead Step 5.5 **only when** `Interrupted Run Recovery → Prior Run Detected: Yes` appears in `team-lead-classification.md`. Skip this policy entirely if no interrupted run was detected.

---

## 1. Classification Definitions

| Class | Meaning |
|---|---|
| `same` | New requirement is the same work as the interrupted one — same domain, same goal, same acceptance criteria (possibly rephrased or re-triggered after Ctrl+C). |
| `extension` | New requirement extends or refines the prior one — same area, but adds or tightens scope ("also add X", "restrict it further to Y", "same thing but also handle Z"). |
| `related` | New requirement touches the same domain or layer but is a separate, isolatable concern — would contaminate the prior PR if mixed in. |
| `unrelated` | New requirement has no meaningful overlap in domain, component, or file scope. |
| `unclear` | Signals conflict or insufficient evidence — cannot safely classify. |

---

## 2. Signals

Collect all five signals before classifying. All signal data must be read from disk — never invented.

| Signal | How to collect | Absent / unreadable treatment |
|---|---|---|
| **Branch slug alignment** | Derive new requirement's intended branch slug (3-5 kebab words) and compare to `Prior Branch` from `interrupted-run-detection.md` | Treat as neutral (no contribution to classification) |
| **Requirement area overlap** | Read `reports/runs/<prior-id>/requirements.md` → compare domain/component (e.g. CORS, auth, ship placement, board rendering) and operation (restrict, add, fix, render) to new requirement | If file unreadable → skip signal; if prior run ID is `unknown` → classify as `unclear` immediately |
| **Acceptance criteria inheritance** | Compare prior AC list to new AC list: same / superset / extension / different | If prior requirements.md unreadable → skip signal |
| **Dirty file scope match** | Run `git stash show --name-only <stash-ref>` using ref from detection report; compare file paths to the new requirement's expected scope | If no stash ref → skip signal |
| **Prior PR alignment** | `gh pr list --head <prior-branch> --json number,state,title,body --limit 1` — compare PR title/body to new requirement | If `gh` unavailable or no PR → skip signal; caps confidence at `medium` regardless of other signals |

If `prior-id` is `unknown` or `reports/runs/<prior-id>/requirements.md` cannot be read: **classify immediately as `unclear`**. Do not continue collecting other signals.

---

## 3. Confidence Rules

| Confidence | Condition |
|---|---|
| `high` | 3 or more signals agree on the same classification |
| `medium` | Exactly 2 signals agree, others absent or neutral; OR `gh` unavailable and remaining signals agree |
| `low` | Only 1 signal, or signals conflict |

**If confidence is `low` or signals conflict → reclassify as `unclear` regardless of raw classification.**

---

## 4. Branch Decision Table

Apply **after** the similarity classification is written to `requirement-similarity-detection.md`. The classification drives which Case (A–I) in `git-branch-policy.md` to use, documented in the Branch Decision Log.

| Classification | Confidence | Prior branch state | Branch action | Case |
|---|---|---|---|---|
| `same` | `high` | Exists, not merged | Continue on prior branch after rebase | A or C |
| `same` | `high` | Exists only on remote | `git checkout -b <prior-branch> origin/<prior-branch>`, then rebase | A |
| `same` | `high` | Merged | **Do not continue on merged branch.** Create new branch from main | G |
| `same` | `medium` or `low` | Any | Treat as `unclear`: create new branch from main | D/B |
| `extension` | `high` or `medium` | Exists, not merged | Continue on same branch after rebase | C or I |
| `extension` | Any | Merged | Create new branch from main; note it extends prior work | G |
| `related` | Any | Any | Create new branch from main; document relation to prior run | B or H |
| `unrelated` | Any | Any | Create new branch from main; no reference to prior run in new PR | B or H |
| `unclear` | Any | Any | Create new branch from main (safe isolation default) | D/B |

**Hard overrides — apply before the table above:**
- Rebase-in-progress (`.git/rebase-merge` or `.git/rebase-apply`) → hard blocker. No similarity logic runs. (Already blocked by Requirement Intake Step 0.5A — but Team Lead must not override this.)
- Prior branch merged → never continue on it, regardless of classification or confidence.
- If the New Branch Guard (checking local + remote) fails for the target branch → write `workflow-blocker.md` and stop.

---

## 5. PR Behavior

| Classification | Confidence | Prior PR state | PR action |
|---|---|---|---|
| `same` | `high` | Open | Continue pushing to same branch → existing PR updates automatically. Do not open a duplicate. |
| `same` | `high` | Closed (not merged) | Create new PR at end of run. |
| `same` | `high` | Merged | Create new PR at end of run. |
| `same` | `high` | None | Create PR as normal. |
| `same` | `medium` or `low` | Any | Create new PR (treated as `unclear`). |
| `extension` | `high` or `medium` | Open | Continue on same branch → existing PR updates. Team Lead may update PR body via `gh pr edit` to note scope extension. |
| `extension` | Any | Closed / merged / none | Create new PR. |
| `related` | Any | Any | Always new PR. |
| `unrelated` | Any | Any | Always new PR. |
| `unclear` | Any | Any | Always new PR. |

---

## 6. Stash Safety Rules

**No stash pop or drop is permitted in PR 2.** This applies regardless of classification or confidence.

| Action | Allowed? |
|---|---|
| `git stash show --name-only <stash-ref>` (inspect files) | Yes — required before any assessment |
| Record stash ref and message in report | Yes |
| Document whether stash likely belongs to this requirement | Yes |
| `git stash pop` | **Forbidden in PR 2** |
| `git stash drop` | **Forbidden in all cases, always** |
| `git stash apply` | **Forbidden in PR 2** |
| `git reset --hard` | **Always forbidden** |
| `git clean -fd` | **Always forbidden** |
| `git checkout .` | **Always forbidden** |

Stash contents must be left in place for human or agent inspection. The `Stash Action` field in `requirement-similarity-detection.md` is always `leave — ref recorded` in PR 2.

---

## 7. Unclear Fallback Rules

When classification is `unclear` (or reclassified due to low confidence):

1. Create a new branch from updated main (Case D or B).
2. Leave stash in place. Record ref.
3. Do not reference the prior branch or prior PR in the new run's PR description.
4. Write `Similarity Classification: unclear` in `requirement-similarity-detection.md`.
5. Record all signals collected and why they conflicted or were insufficient.
6. Continue with the standard flow (Product → Architecture → Implementation).

Prefer isolation. No work may be lost.
