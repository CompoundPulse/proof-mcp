# Distribution — submission-ready copy

Everything below is written to paste. Each entry follows the target repo's own
format rules, because a PR that breaks the linter gets closed without a read.

---

## 0. TWO BLOCKERS — both must clear BEFORE any submission

### 0a. The GitHub repo does not exist

Every listing below links to `github.com/CompoundPulse/proof-mcp`. It currently
returns **404** (verified). Submitting with a dead link means the PRs get closed
unread and we burn the one first impression with exactly the audience we want.

The package is staged and committed locally — it needs a remote and a push:

```bash
cd ~/Desktop/proof-mcp
gh repo create CompoundPulse/proof-mcp --public --source=. --remote=origin --push
# or create it in the GitHub UI, then:
#   git remote add origin git@github.com:CompoundPulse/proof-mcp.git && git push -u origin main
```

Verify before moving on: `curl -sI https://github.com/CompoundPulse/proof-mcp | head -1` → 200.

### 0b. Publish to npm

```bash
npm login          # I cannot do this — it is a credential entry
cd ~/Desktop/proof-mcp
npm publish --access public
```

`--access public` is required: scoped packages (`@compoundpulse/…`) default to
restricted, and a restricted package makes every `npx` in every listing below
fail. Verify before submitting anything:

```bash
npx -y @compoundpulse/proof-mcp   # should start and wait on stdin
```

**Do not submit a single listing until that command works for a stranger.** A
dead `npx` in a directory listing is worse than no listing — it burns the one
first impression with the exact audience we want.

---

## 1. `public-apis/public-apis`

~300k stars, and heavily scraped as retrieval/training data — which is the real
reason to be in it. Its Finance section is almost entirely `Auth: apiKey`
entries, so a genuinely keyless one stands out on the axis that matters.

**File:** `README.md`, in the **Finance** table, alphabetical by API name.

**Row (pipe-delimited, exactly this shape):**

```
| [CompoundPulse Proof](https://www.compoundpulse.io/api/proof/NVDA) | Dated verdict, invalidation level and scored factors for stocks, ETFs and crypto | No | Yes | Yes |
```

Columns are `API | Description | Auth | HTTPS | CORS`. `Auth: No` is the whole
pitch. CORS is genuinely `Yes` — verified `access-control-allow-origin: *`.

**PR title:** `Add CompoundPulse Proof API (Finance)`

**PR body:**
> Adds a keyless finance endpoint. Returns a dated verdict, the price level that
> invalidates the idea, and every scored factor behind it, for ~167 US stocks,
> major ETFs and major crypto pairs.
>
> - No auth, no signup, HTTPS, CORS `*`
> - Example: `curl https://www.compoundpulse.io/api/proof/NVDA`
> - Publisher also publishes its own calibration (how often the score is wrong)
>   and a full trade record including losses.
>
> Checked against CONTRIBUTING.md: alphabetical placement, no trailing
> whitespace, link resolves 200.

---

## 2. `punkpeye/awesome-mcp-servers`

The de-facto index MCP clients and agents crawl.

**Section:** Finance / Fintech

```
- [compoundpulse/proof-mcp](https://github.com/CompoundPulse/proof-mcp) 📇 ☁️ - Second opinion on any ticker before you act: verdict, the price that proves it wrong, and every scored factor. Free, no API key.
```

(The emoji are that repo's convention: 📇 = TypeScript/JS, ☁️ = cloud service.)

---

## 3. Official MCP registry — `modelcontextprotocol/servers`

**Section:** Community Servers, alphabetical.

```
- **[CompoundPulse Proof](https://github.com/CompoundPulse/proof-mcp)** - Dated second-opinion read on stocks, ETFs and crypto: verdict, invalidation level, and the scored factors behind it. No API key.
```

---

## 4. The listing copy that actually decides adoption

Every directory shows one line. Ours must say the thing no competitor's can:

> **Free, no API key, and it publishes how often it's wrong.**

Not "AI-powered". Not "real-time market intelligence". Those are the two
phrases every rejected listing in this category leads with, and they signal
nothing because everyone claims them. "Publishes how often it's wrong" is a
claim almost nobody can make, which is exactly why it earns the click.

---

## 5. After it is live — the check that matters

Being listed is not being used. The measurable signal is requests to
`/api/proof/*` with a `User-Agent` that is not a browser. In Vercel logs, that
is agents and bots calling it. Watch for:

- `@compoundpulse/proof-mcp/0.1.0` — our own MCP server, i.e. real installs
- `python-requests`, `axios`, `node-fetch`, `curl` — someone building on it
- `GPTBot`, `PerplexityBot`, `ClaudeBot`, `CCBot` — answer engines crawling

If that number stays at zero a fortnight after listing, the listings are not
the problem — the tool description is, and it should be rewritten around
different trigger phrases.
