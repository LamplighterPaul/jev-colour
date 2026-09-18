// A small Hono server: it serves the page, answers one question, and keeps the bill small.
//
//   GET  /up            healthcheck
//   GET  /api/palette   the 16 colours and who is answering
//   POST /api/colour    { phrase } -> the distribution over those colours
//
// Everything that costs money is guarded here: identical phrases are answered from memory,
// each visitor gets a bucket of requests, and the day stops when DAILY_USD_CAP is spent.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { COLOURS } from './palette.js'
import { colourOf, deciderName } from './jev.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8080)
const DAILY_USD_CAP = Number(process.env.DAILY_USD_CAP ?? 2)
const USAGE_FILE = process.env.USAGE_FILE ?? join(HERE, 'data', 'usage.json')
const MAX_PHRASE = 80
const CACHE_MAX = 2000
const RATE = { perMinute: 40, windowMs: 60_000 }

const today = () => new Date().toISOString().slice(0, 10)

/** Phrases are cheap to remember and expensive to ask twice. */
const cache = new Map()
const buckets = new Map()
const usage = load()

const app = new Hono()

app.get('/up', c => c.text('ok'))

app.get('/api/palette', c => c.json({
  colours: COLOURS,
  decider: deciderName(),
  spentToday: round(usage.usd, 4),
  capped: usage.usd >= DAILY_USD_CAP,
}))

app.post('/api/colour', async c => {
  const body = await c.req.json().catch(() => ({}))
  const phrase = normalise(String(body?.phrase ?? ''))
  if (!phrase) return c.json({ error: 'empty phrase' }, 400)

  const hit = cache.get(phrase)
  if (hit) { cache.delete(phrase); cache.set(phrase, hit); return c.json({ ...hit, cached: true }) }

  if (!allow(c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local')) {
    return c.json({ error: 'too many requests, give it a second' }, 429)
  }
  if (deciderName() === 'jev' && spentToday() >= DAILY_USD_CAP) {
    return c.json({ error: 'the day’s budget for this experiment is spent; it resets at midnight UTC' }, 429)
  }

  try {
    const run = await colourOf(phrase)
    spend(run.usd)
    const answer = {
      phrase,
      weights: run.weights,
      decider: run.decider,
      model: run.model,
      ms: run.ms,
      usd: round(run.usd, 6),
      cached: false,
    }
    cache.set(phrase, answer)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    return c.json(answer)
  } catch (err) {
    console.error('colour failed:', err instanceof Error ? err.message : err)
    return c.json({ error: 'the model did not answer; try again' }, 502)
  }
})

app.use('/*', serveStatic({ root: relative(join(HERE, 'public')) }))

serve({ fetch: app.fetch, port: PORT }, info => {
  console.log(`jev-colour on http://localhost:${info.port} (decider: ${deciderName()})`)
})

/** Spaces collapsed, case folded: "London  Bus" and "london bus" are one question. */
function normalise(raw) {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_PHRASE).toLowerCase()
}

function allow(ip) {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now - b.start > RATE.windowMs) { buckets.set(ip, { start: now, n: 1 }); prune(now); return true }
  b.n += 1
  return b.n <= RATE.perMinute
}

function prune(now) {
  if (buckets.size < 5000) return
  for (const [ip, b] of buckets) if (now - b.start > RATE.windowMs) buckets.delete(ip)
}

function load() {
  try {
    const saved = JSON.parse(readFileSync(USAGE_FILE, 'utf8'))
    if (saved?.day === today()) return saved
  } catch { /* first run, or a new day */ }
  return { day: today(), usd: 0, calls: 0 }
}

function spentToday() {
  if (usage.day !== today()) { usage.day = today(); usage.usd = 0; usage.calls = 0 }
  return usage.usd
}

function spend(usd) {
  spentToday()
  usage.usd += usd
  usage.calls += 1
  try {
    mkdirSync(dirname(USAGE_FILE), { recursive: true })
    writeFileSync(USAGE_FILE, JSON.stringify(usage))
  } catch (err) {
    console.error('could not write usage:', err instanceof Error ? err.message : err)
  }
}

const round = (n, places) => Number(n.toFixed(places))

/** serveStatic wants a path relative to the working directory, whatever that happens to be. */
function relative(target) {
  const from = process.cwd()
  return target.startsWith(from) ? (target.slice(from.length + 1) || '.') : target
}
