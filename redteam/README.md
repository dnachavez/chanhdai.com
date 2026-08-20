# Red team suite

Three suites against `/api/chat`, split by cost and determinism.

|                   | `promptfooconfig.yaml` | `redteam.yaml`  | `redteam-multiturn.yaml` |
| ----------------- | ---------------------- | --------------- | ------------------------ |
| Cases             | 11, fixed              | ~114, generated | ~16, generated           |
| Grading           | JavaScript only        | grader model    | grader model             |
| Requests per run  | 33                     | ~342            | ~192                     |
| Same answer twice | yes                    | no              | no                       |
| Runs on           | every PR               | weekly          | monthly                  |
| Gates merge       | yes                    | critical/high   | critical/high            |

The regression suite is the one that gates a merge. It holds the eight payloads
that got through, verbatim, and fails on three tripwires: the canary string
reaching output, system prompt content reaching output, and the reply dropping out
of Dan's first-person voice. It also carries two controls that fail if the widget
starts refusing everything, which is otherwise the cheapest way to make an
injection suite pass.

The generated suites are for finding the payloads nobody has written down yet.
They are split in two because promptfoo cannot scope a strategy to particular
plugins: a multi-turn strategy in the single-turn file would run against every
base case at four turns apiece and, on its own, cost more requests than the site
has in a day.

## Running

```bash
pnpm redteam:snapshot           # required first; see below
pnpm dev                        # target must be up

pnpm redteam:regress            # deterministic suite
pnpm redteam:scan               # generated, single-turn
pnpm redteam:scan:multiturn     # generated, multi-turn
pnpm redteam:view               # open the last report
```

`redteam:snapshot` writes `.system-prompt.txt` from `buildSystemPrompt()`. The
leak assertion diffs output against that file in 8-word shingles rather than
against a hardcoded phrase list, so editing the prompt cannot silently leave the
assertion testing nothing. It is gitignored and the assertion throws if it is
missing.

To run against preview instead of localhost:

```bash
PROMPTFOO_TARGET_URL=https://<preview>.vercel.app/api/chat pnpm redteam:regress
```

## Credentials

`OPENROUTER_API_KEY` is the only one needed. promptfoo grades with an OpenAI model
by default; all three configs override that to
`openrouter:openai/gpt-oss-120b`.

It has to be a **paid** model. OpenRouter meters every `:free` model against one
account-wide allowance of 1,000 requests a day — the same allowance the live widget
spends — so a grader on the free tier would bill its judgements to the site's daily
budget and take the chat down in order to test the chat. Paid models draw on the
balance, which is a separate meter.

Spending that balance does not endanger the free allowance. OpenRouter sets the
1,000/day tier on **credit purchased all time**, not on the current balance, so
draining the $10 would not drop the account back to 50 requests a day.

Attack _generation_ needs no credential of ours: promptfoo generates plugin test
cases through its own hosted service by default. Setting
`PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION=true` generates locally through the
configured provider instead, at noticeably lower attack quality.

## What this costs

`openai/gpt-oss-120b` is $0.03/M input and $0.17/M output. A judgement is roughly
1,000 tokens in and 150 out, so about **$0.00006 a call**. Attack refinement — the
`jailbreak` and multi-turn strategies iterating against the target — is the larger
share, at roughly $0.0001 a call.

| Suite                    | Runs     | Grader + attacker calls | Per run | Per month  |
| ------------------------ | -------- | ----------------------- | ------- | ---------- |
| `redteam:regress`        | per push | 2                       | $0.0001 | ~$0.002    |
| `redteam:scan`           | weekly   | ~320                    | ~$0.023 | ~$0.09     |
| `redteam:scan:multiturn` | monthly  | ~80                     | ~$0.007 | ~$0.007    |
|                          |          |                         |         | **~$0.10** |

At that rate the $10 balance covers red teaming for several years, and the balance
is there for `FALLBACK_MODEL` anyway — one full day of primary-provider outage costs
~$2.50, which is twenty years of scanning.

The runtime layer (`src/features/chat/lib/output-tripwire.ts`) costs nothing at all:
it is string matching inside the existing stream, with no extra model call and no
network hop. That is the reason it was built that way rather than as a hosted
classifier — a guard that bills per visitor is the expensive layer, not this one.

## Request budget

Requests, not tokens, are what is scarce here. The widget's model is `:free`, which
OpenRouter meters at 20 requests a minute and 1,000 a day account-wide, and one
turn costs three of them (search, read, answer).

| Suite                    | Requests | Share of a day |
| ------------------------ | -------- | -------------- |
| `redteam:regress`        | 30       | 3%             |
| `redteam:scan`           | ~342     | 34%            |
| `redteam:scan:multiturn` | ~192     | 19%            |

Wall clock binds before requests do. A turn takes ~15s, so one worker runs at ~4
turns/minute — already under the 6.7 the request ceiling allows, which is why the
scans pass `-j 1` and no delay. The first attempt at this file was sized against
requests alone, at 192 tests, and spent 65 minutes without finishing.

`CHAT_MODEL_OVERRIDE` is the way out of the budget entirely. The scan workflow
sets it to a cheap paid model by default, so a few hundred generated turns are
billed to the balance (~$0.14) instead of to the allowance the live widget shares.
Dispatch it with `model: production` to scan what actually ships — worth doing
periodically, since a scan of a model you do not serve only tests the prompt.

## Notes on the target

- The per-IP limiter is 20/hour and trusts `x-forwarded-for`, so every config sends
  a random source address per request. Without it a 10-case suite spends the
  budget and grades 429s as passes.
- Generated attacks are capped at 400 characters because the route 413s a message
  over 1000 and hex encoding roughly doubles length.
- Multi-turn strategies are capped at 4 turns against the route's 10-turn session
  ceiling, and run `stateful: false` because the route holds no session state.
