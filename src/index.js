#!/usr/bin/env node
/**
 * CompoundPulse Proof — MCP server.
 *
 * Gives any MCP-capable agent (Claude, Cursor, Cline, …) a second opinion on a
 * ticker BEFORE the user acts: the case for it, the case against it, the price
 * that proves it wrong, and what has to happen first.
 *
 * WHY THIS EXISTS RATHER THAN JUST THE REST API
 * An API is a thing somebody might call. An MCP server is a tool an assistant
 * installs once and then reaches for on its own, inside the conversation where
 * the user is already asking "should I buy NVDA". That is the difference
 * between distribution you chase and distribution that arrives.
 *
 * DESIGN NOTES
 * - NO API KEY. Deliberate: every finance tool in this space gates on signup,
 *   which is exactly why none of them get installed casually.
 * - One anonymous local install ID. It lets CompoundPulse distinguish 125
 *   calls from one active install from one call by 125 active installs. It is
 *   random, contains no PII, is sent only to the CompoundPulse endpoint, and
 *   can be disabled with COMPOUNDPULSE_TELEMETRY=off.
 * - The tool description is written for a MODEL to route on, not a human to
 *   browse. It names the situations where it should fire, because an agent
 *   picks tools by matching intent against this text.
 * - Responses keep `asOf`, the disclaimer and the verdict verbatim. An agent
 *   summarising must be able to say how stale the read is and must not be able
 *   to launder "NO TRADE" into "buy".
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const API = 'https://www.compoundpulse.io/api/proof'
const SITE = 'https://www.compoundpulse.io'
const VERSION = '0.1.5'
const UA = `@compoundpulse/proof-mcp/${VERSION}`

let fallbackInstallId = null
function installId() {
  if (String(process.env.COMPOUNDPULSE_TELEMETRY || '').toLowerCase() === 'off') return null
  const file = process.env.COMPOUNDPULSE_INSTALL_ID_FILE ||
    join(homedir(), '.compoundpulse', 'proof-mcp-install-id')
  try {
    const held = readFileSync(file, 'utf8').trim()
    if (/^[0-9a-f-]{36}$/i.test(held)) return held
  } catch { /* first run */ }
  const id = randomUUID()
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file, `${id}\n`, { mode: 0o600, flag: 'wx' })
    return id
  } catch {
    // Another process may have won the first-run race. Read once more; if the
    // filesystem is read-only, a process-lifetime ID still prevents one busy
    // session from masquerading as many installs.
    try {
      const held = readFileSync(file, 'utf8').trim()
      if (/^[0-9a-f-]{36}$/i.test(held)) return held
    } catch { /* read-only host */ }
    fallbackInstallId ||= id
    return fallbackInstallId
  }
}

const server = new Server(
  { name: 'compoundpulse-proof', version: VERSION },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_proof',
      // Written for a model's routing decision. Names the trigger situations
      // explicitly — an agent matches user intent against this string.
      description:
        'Get a dated, second-opinion read on a stock, ETF or crypto ticker before ' +
        'acting on it. Returns a verdict (NO TRADE / WAIT / EDGE PRESENT), the exact ' +
        'price level that would prove the idea wrong, the level that turns it ' +
        'constructive, what has to happen first, and every scored factor behind the ' +
        'call.\n\n' +
        'Use this when the user asks whether to buy, sell or hold something; asks if ' +
        'a ticker is a good entry; asks what their downside or invalidation level is; ' +
        'asks for a sanity check on a trade idea; or mentions they are about to put ' +
        'money into a specific symbol.\n\n' +
        'This is NOT a price prediction and returns no price target. Levels are fixed ' +
        'for the session and are not rewritten afterwards. The publisher keeps a ' +
        'public, precommitted record of every claim. No accuracy number is published ' +
        'until enough directional claims mature. Free, no API key.',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description:
              'Symbol, e.g. "NVDA", "SPY", "BTC-USD". US stocks, major ETFs and ' +
              'major crypto pairs are covered. Crypto uses the -USD suffix.',
          },
        },
        required: ['ticker'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'get_proof') {
    return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }] }
  }

  const raw = String(req.params.arguments?.ticker ?? '').trim()
  // Mirror the server's own cleaner so a malformed symbol fails here rather
  // than as a confusing 400 from the API.
  const ticker = raw.toUpperCase().replace(/[^A-Z0-9.\-^]/g, '').slice(0, 8)
  if (!ticker) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Provide a ticker, e.g. NVDA, SPY or BTC-USD.' }],
    }
  }

  let res
  try {
    const iid = installId()
    // Separate MCP traffic from the public CDN cache. The API returns no-store
    // on this path, so an active install cannot receive a cached 200 without
    // also reaching the anonymous telemetry counter.
    res = await fetch(`${API}/${encodeURIComponent(ticker)}?mcp=1`, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'X-CompoundPulse-MCP-Version': VERSION,
        ...(iid ? { 'X-CompoundPulse-Install-ID': iid } : {}),
      },
      signal: AbortSignal.timeout(15000),
    })
  } catch (e) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Could not reach CompoundPulse: ${e.message}` }],
    }
  }

  const data = await res.json().catch(() => null)

  // A "not covered" answer must never be summarised as bearish, so say why.
  if (res.status === 404) {
    return {
      content: [{
        type: 'text',
        text:
          `No Proof is published for ${ticker}. CompoundPulse requires at least 25 ` +
          `completed daily sessions of real data before publishing a verdict, so this ` +
          `is an absence of coverage — NOT a negative view on ${ticker}. ` +
          `Covered symbols: ${SITE}/proof`,
      }],
    }
  }
  if (!res.ok || !data) {
    return { isError: true, content: [{ type: 'text', text: `CompoundPulse returned ${res.status}.` }] }
  }

  const L = data.levels || {}
  const C = data.claimRecord || {}
  const factors = (data.factors || [])
    .map((f) => `  - [${f.group}] ${f.label} (${f.points > 0 ? '+' : ''}${f.points}): ${f.detail}`)
    .join('\n')

  // Plain text, not JSON: the model reads this to the user. Every number the
  // user needs is present without a second call, and the staleness date leads.
  const text = [
    `${data.ticker} — ${data.verdict}   (as of the ${data.asOf} session)`,
    data.price != null ? `Price at that session: $${data.price}${data.changePct != null ? ` (${data.changePct}%)` : ''}` : '',
    '',
    data.summary || '',
    '',
    `PROVES IT WRONG:      $${L.invalidBelow}`,
    `TURNS CONSTRUCTIVE:   $${L.constructiveAbove}`,
    data.trigger ? `\nWHAT HAS TO HAPPEN FIRST:\n${data.trigger}` : '',
    factors ? `\nFACTORS BEHIND THE CALL:\n${factors}` : '',
    '',
    `Levels are fixed for that session and are not rewritten after the move.`,
    C.fingerprint ? `Claim fingerprint: ${C.fingerprint} (${C.fingerprintVerified ? 'verified' : 'verification failed'})` : '',
    C.sessionRoot ? `Session root: ${C.sessionRoot}` : '',
    C.status === 'pending' ? `Record status: pending until ${C.horizonSessions} completed sessions mature.` : '',
    `Public dated claim record: ${data.method?.calibrationPublished || SITE + '/track'}`,
    `Research tests, including failures: ${data.method?.researchPublished || SITE + '/research'}`,
    `Legacy paper trade record: ${data.method?.legacyPaperRecordPublished || SITE + '/track/paper.json'}`,
    '',
    data.citation || '',
    '',
    data.disclaimer || '',
  ].filter(Boolean).join('\n')

  return { content: [{ type: 'text', text }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
