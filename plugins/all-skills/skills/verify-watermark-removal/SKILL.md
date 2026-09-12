---
name: verify-watermark-removal
description: Verify that a watermark-removal or "humanizer" step actually removed a statistical text watermark, by measuring a sample whose key the user holds. Use after any tool, script or service claims to have cleaned a text, or when the user asks whether such a tool works, which one to trust, or how to test one. Reports a detector score against fixed thresholds plus what the run cost in meaning, facts, verbatim overlap and length. This skill only measures and never removes a mark.
category: testing-qa
license: MIT
---

# Verify Watermark Removal

A tool says it removed a watermark from a text. This skill checks whether it did,
by measuring rather than by trusting the tool's own report.

The check works because the mark is planted first, with a key the user holds. A
detector that knows the key is the strongest detector that can exist for that
text, so its score is a ceiling rather than a guess. What the key buys is a scale
of the user's own; what keeps a tool from recognising the sample is something
else, namely that a freshly generated private sample is a text nobody has seen
before. The samples shipped with the tool are published together with their key,
so those can be recognised, and the repository says so in `samples/README.md`.
The skill also reports what the rewrite cost the text, because a mark that
disappeared together with half the meaning is not a result anyone wants.

This skill measures. It never removes a mark, and it never claims anything about
a specific vendor's watermark.

## When to Use This Skill

- A "watermark remover", "AI humanizer" or "detector bypass" tool claims it cleaned a text, and the claim needs checking before anyone repeats it.
- Someone is about to pay for such a tool and wants evidence instead of a landing page.
- Several such tools have to be compared on one ruler, with numbers another person can reproduce.
- A rewriting step sits inside a pipeline, and someone needs to know what it costs in meaning, facts and length.
- The user asks how these tools can be tested at all, or why a "99% undetectable" promise cannot be verified from outside.

## What This Skill Does

1. **Plants a known mark**: generates text carrying a statistical watermark of the SynthID-Text class under a key the user chooses, and scores every sample as it writes it, so a text where the mark did not plant is named before anything is handed to a tool.
2. **Scores what came back**: runs the keyed detector on the returned text and places the score against thresholds that were fixed before any run, giving one of four outcomes.
3. **Measures the cost**: meaning similarity, facts kept, longest verbatim run, share of words changed, length ratio.
4. **Builds a comparison table**: turns several recorded runs into one matrix, so tools are ranked on the same measurements instead of on their own claims.
5. **Keeps the answer honest**: reports the grey zone as an outcome of its own and never turns a passing run into "this text is now undetectable".

## How to Use

### Basic Usage

Install once. A CPU is enough, Python 3.10 or newer:

```bash
git clone https://github.com/Yurakonoplya/unmark-checker && cd unmark-checker
git checkout v0.1.5              # the revision this page describes
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install -e .                 # no PyPI package: install from the clone
read -rs UNMARK_CHECKER_KEY && export UNMARK_CHECKER_KEY
```

The checkout pins exactly the revision described here: `main` moves, and a
command that behaves differently from this page is worse than no page.

The key is typed at the `read` prompt, which echoes nothing and writes nothing to
the shell history. Keep it in the environment, never in a file and never in a
command that gets logged. The key is the whole basis of the check.

If the tool under test runs on the same machine, start it with
`env -u UNMARK_CHECKER_KEY <tool> ...`: a process that inherits the key could
score the sample itself and shape its output to it, which is exactly what the
measurement is meant to rule out.

Then four steps.

**1. Get a marked sample.** The repository ships ready samples in `samples/`,
with their key printed in `samples/README.md`. That is the fast path. For a test
no tool can anticipate, generate your own (about two minutes each on a CPU with
the small model):

```bash
unmark-checker generate --num 2 --words 100 --scheme shallow \
    --model sshleifer/tiny-gpt2 --out my-samples
```

Use `--model gpt2` instead when the sample has to read as English, for example
when it is going into a web form that rejects nonsense.

Every sample is scored as it is written, and the manifest next to the texts
records the outcome of that scoring. **Hand a tool only the samples the manifest
records as `mark_present`.** The command does not do this filtering for you: if
the mark planted in none of the samples it says so and exits with code 2, but if
it planted in some of them it warns, lists the ones it did not plant in and exits
with code 0, leaving every file on disk. `check` behaves the same way: given such
a sample it prints a warning and measures it anyway, and that measurement means
nothing, because a mark that was never there cannot be removed.

**2. Run the tool under test** on the sample, and save exactly what came back,
unedited, to a file.

**3. Measure, one command:**

```bash
unmark-checker check --sample my-samples/UM-1A2B3C.txt --returned cleaned.txt
```

**4. Report what the run says, and only that.** The outcome is one of four:

| Outcome | What it means |
|---|---|
| `mark_present` | score at or above 4.0; the tool did not take this mark out |
| `uncertain` | score between 2.0 and 4.0, the grey zone; do not round it to a yes or a no |
| `mark_gone` | score below 2.0; on this sample, on this run, the mark did not survive |
| `not_our_text` | fewer than half the content words of the returned text come from the sample, so it is not recognisably the sample and no score is reported |

Always report the cost numbers next to the outcome: meaning kept, facts kept,
longest verbatim run, share of words changed, length ratio. They exist for the
three scored outcomes only (`mark_present`, `uncertain`, `mark_gone`). A
`not_our_text` run stops before they are computed and reports four things
instead: the outcome, the share of content words that came from the sample, and
the word counts of both texts. Do not ask for a meaning or facts number there,
and do not report one as zero: it was never measured.

### Advanced Usage

Add `--json` when the numbers are going into a table or a report:

```bash
unmark-checker check --sample my-samples/UM-1A2B3C.txt --returned cleaned.txt --json
```

One run on one sample is one measurement, not a verdict on a product. For a claim
worth repeating, run several samples at several lengths and across the three
scheme presets (`shallow`, `default`, `deep`).

Record each run as a service file and build one table out of the folder:

```bash
unmark-checker matrix --dir my-runs --out my-runs/matrix.md
```

The service file format is described in `docs/service-file.md` in the repository.
Runs measured this way and published in the same format are collected at
https://unmarkclaude.io/check/services, so a table built locally can be set
against one built by someone else.

When installing anything is not an option, the same check runs in a browser at
https://unmarkclaude.io/check, on a sample whose key that site holds. Use this
skill instead when the text must not leave the machine, or when the key has to be
the user's own.

## Example

**User**: "I ran this paragraph through a humanizer that promises to strip AI watermarks. Did it work?"

**Output**:

```
The mark is still there. Detector score 6.41, at or above 4.0. Under the null
case a clean text scores that high about three times in a hundred thousand, so
this is not a coin flip: the tool did not take this mark out.
Meaning kept: 0.94 of 1.00. Facts kept: 7 of 7.
Longest verbatim run: 38 words. Words changed: 11%. Length: 0.97x (100 words
in, 97 out).
```

Read back to the user: the mark this tool was asked to remove is still in place,
and the text came back almost unchanged. On this sample, on this run, the tool
did not do what it promised. This says nothing about any vendor's own watermark.

## What the Check Proves, and What It Does Not

- A tool that **leaves this mark in place** is unlikely to remove a vendor's mark either: this is an inference from where both marks live (word choice), not a measurement; the measurement covers one key, one scheme, one model and one sample.
- A tool that **removes this mark** has not been shown to remove anyone else's. Different key, different scheme parameters, different model. Say so, and do not let a passing run turn into "the text is now undetectable".
- `uncertain` is an answer, not a rounding error. Collapsing the grey zone into a yes or a no is a lie in one direction or the other.

## Tips

- Use the user's own key whenever the result has to be strict. The shipped samples are convenient, and their published key is also their one weakness: a tool could recognise those exact texts and treat them specially.
- Save what the tool returned byte for byte. Trimming a heading or a stray line moves the score and the verbatim run, and the numbers stop being comparable.
- Report the cost numbers every time, not only when they look bad. They are what separates "removed the mark" from "rewrote the text into something else".
- Longer samples give a steadier score. Below roughly 80 words the detector has little to work with, and `uncertain` becomes the normal answer.
- Never tune the thresholds to a result. They were fixed before any run, and moving them after seeing one invalidates every number produced with this code.
- Apply this only to text the user owns or is authorised to process.

## Common Use Cases

- Checking a paid "humanizer" before the subscription renews.
- Comparing several removal services on one ruler and publishing the table.
- Testing a rewriting step inside an internal pipeline for what it costs in facts and meaning.
- Answering "is this text still watermarked" with a measurement and a stated limit, instead of a guess.
