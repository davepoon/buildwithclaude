# Channel Formats: Adaptation Rules

How to move one core message across channels without repeating yourself, plus the per-channel discipline that keeps each asset native to its platform. The per-channel specs in `channels/<id>.md` are authoritative for length and structure; this file covers the cross-channel craft.

## Don't repeat — re-shape

The strategist assigns each asset its own angle. Two derivatives of the same source should not read as the same paragraph re-typed. Keep the **core message** constant; change the entry point, the depth, and the container.

- Same message, different **hook**: a stat on LinkedIn, a bold claim on X, a question on Instagram.
- Same message, different **depth**: the blog explains the audit; the short-video names only the punchline.
- Same message, different **ask**: comment on LinkedIn, reply on X, save on Instagram, click on newsletter.

If two assets end up nearly identical, one of them has the wrong angle — revisit the plan.

## Hook patterns by channel

The first line decides whether the rest is read. Match the hook to how the channel is consumed.

| Channel | Hook lives in | Strong patterns |
| --- | --- | --- |
| linkedin | First ~140 chars, before "see more" | Contrarian take, surprising stat, sharp question |
| x-thread | Tweet 1, must stand alone | Bold promise, "here's how," a number |
| newsletter | Subject + first line | Subject that names the payoff; first line pays it off |
| instagram | First visible line before "more" | Curiosity or a vivid result, one emoji max here |
| youtube | First 1–2 lines above the fold | The video's payoff in plain words + a keyword |
| short-video | First 3 seconds, spoken + on-screen | The result or the twist, immediately |
| blog | Title + intro sentence | Descriptive title with the keyword; intro states the payoff |

A hook that doesn't pay off is worse than a plain one. Never promise something the body doesn't deliver.

## One CTA per asset — pick the right one

Competing CTAs split attention and lower response. Choose a single ask that fits the channel:

- **linkedin** — a question to drive comments, or "link in comments."
- **x-thread** — follow / bookmark, or a reply prompt, in the final tweet only.
- **newsletter** — one button/line. Deliver value before the ask.
- **instagram** — save / share / comment, or "link in bio."
- **youtube** — subscribe + the relevant link in the links section.
- **short-video** — follow / comment, or "link in bio." One, at the end.
- **blog** — one conclusion CTA (read more, try it, subscribe).

## Length and structure discipline

- **Enforce the count.** Every spec has a range. Under-length reads thin; over-length gets truncated ("see more," "…", cut tweets). Count characters for social, words for long-form.
- **Front-load.** Social platforms truncate. Put the point before the fold in LinkedIn, in tweet 1 for threads, in the subject for email, in the first 3 seconds for short-video.
- **Respect the platform's rendering.** LinkedIn doesn't render Markdown — use line breaks and the occasional Unicode bullet, not `#` headers or `**bold**`. Blogs *do* use Markdown subheads.
- **Chapters and timestamps.** YouTube's first chapter must be `0:00`; timestamps must be real, not invented.

## Hashtags

- **linkedin** — 0–3, at the end, relevant only.
- **instagram** — 5–15, mix of broad and niche, in a block after the caption. Never banned or irrelevant tags.
- **x-thread** — avoid mid-thread hashtags; they fragment the read.
- **newsletter, youtube, short-video, blog** — hashtags are not the mechanic; skip them (YouTube keywords go in the description prose, not as hashtag spam).

## Localized copy: re-fit, don't just translate

When an asset is transcreated, the text length changes — German and Finnish expand, CJK contracts. After the `transcreation` skill adapts the message, **re-check the character/word count** against the channel spec and re-fit. A LinkedIn hook that fit in English may blow past the fold in German; trim to keep the payoff above it.

## Common mistakes to avoid

- Pasting the same paragraph into every channel — kills reach and reads lazy.
- Multiple CTAs in one asset — pick one.
- Markdown syntax in LinkedIn/Instagram/X where it renders as literal `#` and `*`.
- Engagement bait ("comment YES to get the link") — off-brand and down-ranked.
- Cliffhangers a thread never resolves; "part 2 coming" with no payoff.
- Keyword stuffing in blog subheads or YouTube descriptions.
- Fake timestamps or a missing `0:00` YouTube chapter.
- Ignoring the fold — burying the hook below "see more" / "more."
