# CompoundPulse Proof — MCP server

**A second opinion on any ticker, before you act.** The case for it, the case
against it, and the price that proves it wrong.

**Free. No API key. No account.**

```bash
npx @compoundpulse/proof-mcp
```

## Claude Desktop / Cursor / Cline

```json
{
  "mcpServers": {
    "proof": {
      "command": "npx",
      "args": ["-y", "@compoundpulse/proof-mcp"]
    }
  }
}
```

## The tool

`get_proof(ticker)` returns, for a US stock, major ETF or major crypto pair:

| | |
|---|---|
| **Verdict** | `NO TRADE` · `WAIT` · `EDGE PRESENT` |
| **Proves it wrong** | the exact price that ends the argument |
| **Turns constructive** | the level on the other side |
| **What has to happen first** | the trigger, stated as a condition |
| **Factors** | every scored input behind the call, with its contribution |
| **As of** | the session date — so you can see how stale it is |

```
NVDA — NO TRADE   (as of the 2026-08-14 session)
Price at that session: $225.01 (-0.07%)

Nothing to do yet. This only becomes a trade on a full daily close
above 227.49 or below 190.01 — until then it is stuck in the middle
of its own range.

PROVES IT WRONG:      $190.01
TURNS CONSTRUCTIVE:   $227.49
```

## What it is not

It does **not** predict prices and returns **no price target**. It makes the
assumptions behind a decision explicit before capital is committed.

`NO TRADE` and `WAIT` are returned unmodified — the tool will not launder a
non-signal into a buy. If a symbol isn't covered you get a clear "not covered,
and here's why", never a bearish read by accident.

## Why you can check it

- **We publish how often we're wrong** — calibration, including the failures:
  <https://www.compoundpulse.io/research>
- **Full trade record, losers included** — <https://www.compoundpulse.io/track>
- **Levels are fixed for the session** and are not rewritten after the move, so
  any past call can be checked against what actually happened.

Most tools in this category publish neither. A score you can't audit is an
opinion with a decimal point.

## Privacy

Zero state, zero telemetry. This server is a thin proxy to a public endpoint —
`src/index.js` is ~150 lines and there is no phone-home in it. Read it.

The underlying REST endpoint is public too, if you'd rather skip MCP:

```bash
curl https://www.compoundpulse.io/api/proof/NVDA
```

## Coverage

167 symbols: US mega/large caps, major sector and index ETFs, and major crypto
pairs (`-USD` suffix). A verdict is only published with at least 25 completed
daily sessions of real data behind it.

MIT licensed. Data free to use and quote; attribution requested, not required.
