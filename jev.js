// Jev is TypeSafe AI's "System One" model: it returns typed decisions with probabilities and
// cannot generate text. One `choice` question over the 16 palette colours gives the whole page:
// the answer is the distribution, and the bar is that distribution drawn to scale.
//
// This is the mechanism Matt DesLauriers described for his own demo — sixteen predefined colours,
// "just rendering their weighted probabilities" — written out. He linked no source; this file is not
// his code, and any judgement in the wording of the question below is mine.

import { NAMES } from './palette.js'

const KEY = process.env.TYPESAFE_API_KEY?.trim()
const MODEL = process.env.TYPESAFE_MODEL ?? 'jev-latest'
const ENDPOINT = process.env.TYPESAFE_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone'

/** Price per input token, the same figure the Forma experiment bills against. */
export const USD_PER_TOKEN = 0.042 / 1_000_000

export const deciderName = () => (KEY ? 'jev' : 'mock')

/** One question, sixteen options, no descriptions: the colour names carry their own meaning. */
const QUESTIONS = {
  colour: {
    type: 'choice',
    instructions:
      'A person typed a word or phrase. If they had to paint it using only these sixteen colours, which one would they reach for? Judge the phrase as a whole.',
    criteria: Object.fromEntries(NAMES.map(name => [name, null])),
  },
}

/**
 * @param {string} phrase
 * @returns {Promise<{weights: Record<string, number>, decider: string, model: string, ms: number, inputTokens: number, usd: number}>}
 */
export async function colourOf(phrase) {
  return KEY ? jev(phrase) : mock(phrase)
}

async function jev(phrase) {
  const started = performance.now()
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { phrase }, model: MODEL, questions: QUESTIONS }),
      signal: AbortSignal.timeout(15_000),
    })
    if ((res.status === 429 || res.status === 529) && attempt < 2) {
      await new Promise(r => setTimeout(r, 400 * 2 ** attempt))
      continue
    }
    if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = await res.json()
    const answer = body.answers?.colour
    if (answer?.type !== 'choice') throw new Error('Jev did not answer the colour question')
    const inputTokens = body.usage?.input_tokens ?? 0
    return {
      weights: normalise(answer.probabilities),
      decider: 'jev',
      model: body.model ?? MODEL,
      ms: Math.round(performance.now() - started),
      inputTokens,
      usd: inputTokens * USD_PER_TOKEN,
    }
  }
}

/** Keep only what the palette knows, drop what rounds to nothing, and sum to 1. */
function normalise(probabilities) {
  const out = {}
  let total = 0
  for (const name of NAMES) {
    const p = Number(probabilities?.[name])
    if (Number.isFinite(p) && p > 0.0005) { out[name] = p; total += p }
  }
  if (!total) return { gray: 1 }
  for (const name of Object.keys(out)) out[name] /= total
  return out
}

// Development stand-in when no key is configured. It is a hash, not a judgement: it exists so
// the page runs for anyone who clones this, and the answer is labelled "mock" when it is used.
function mock(phrase) {
  const started = performance.now()
  let h = 2166136261
  for (let i = 0; i < phrase.length; i++) h = Math.imul(h ^ phrase.charCodeAt(i), 16777619) >>> 0
  const raw = NAMES.map((name, i) => {
    const r = ((Math.imul(h ^ (i + 1) * 0x9e3779b9, 0x85ebca6b) >>> 0) / 4294967296)
    return [name, Math.exp(6 * r)]
  })
  const total = raw.reduce((n, [, v]) => n + v, 0)
  return {
    weights: normalise(Object.fromEntries(raw.map(([name, v]) => [name, v / total]))),
    decider: 'mock',
    model: 'hash',
    ms: Math.round(performance.now() - started),
    inputTokens: 0,
    usd: 0,
  }
}
