// Type, wait a beat, ask Jev once, draw the answer. One band per palette colour, always in the
// DOM: widths animate, flex order follows rank.

const input = document.querySelector('#phrase')
const bar = document.querySelector('#bar')
const note = document.querySelector('#note')
const DEBOUNCE_MS = 260

const bands = new Map()
let colours = []
let decider = 'jev'
let pending = null
let lastAsked = null

init()

async function init() {
  try {
    const meta = await (await fetch('/api/palette')).json()
    colours = meta.colours
    decider = meta.decider
  } catch {
    say('the palette did not load; reload the page')
    return
  }

  for (const colour of colours) {
    const band = document.createElement('div')
    band.className = 'band'
    band.style.background = colour.srgb
    band.style.background = colour.p3  // Display P3 where the browser has it, as Bitframes renders
    const label = document.createElement('span')
    label.className = 'label'
    label.style.color = readableOn(colour.srgb)
    band.append(label)
    bar.append(band)
    bands.set(colour.name, { band, label })
  }

  if (decider === 'mock') say('no model key configured: these weights are a hash, not a judgement')

  const asked = new URLSearchParams(location.search).get('q')
  if (asked) input.value = asked.replace(/\s+/g, ' ').trim().slice(0, 80)

  input.addEventListener('input', () => schedule(DEBOUNCE_MS))
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); schedule(0) } })
  about()

  ask(input.value)
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}

let timer = null
function schedule(delay) {
  clearTimeout(timer)
  timer = setTimeout(() => ask(input.value), delay)
}

async function ask(raw) {
  const phrase = raw.replace(/\s+/g, ' ').trim()
  if (!phrase || phrase.toLowerCase() === lastAsked) return
  lastAsked = phrase.toLowerCase()

  pending?.abort()
  const controller = new AbortController()
  pending = controller

  try {
    const res = await fetch('/api/colour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase }),
      signal: controller.signal,
    })
    const body = await res.json()
    if (!res.ok) { say(body.error ?? 'that did not work'); return }
    draw(body.weights)
    say(summarise(body))
    remember(phrase)
  } catch (err) {
    if (err.name !== 'AbortError') say('the model did not answer; keep typing')
  } finally {
    if (pending === controller) pending = null
  }
}

/** Widest first, left to right, every colour Jev gave weight to. */
function draw(weights) {
  const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1])
  const rank = new Map(ranked.map(([name], i) => [name, i]))
  for (const [name, { band, label }] of bands) {
    const p = weights[name] ?? 0
    band.style.order = String(rank.get(name) ?? 99)
    band.style.width = `${(p * 100).toFixed(3)}%`
    label.textContent = p ? `${name} ${(p * 100).toFixed(p >= 0.01 ? 0 : 1)}%` : ''
  }
}

function summarise(body) {
  if (body.decider === 'mock') return 'mock weights: no model key configured'
  if (body.cached) return 'from cache'
  return `${body.ms} ms · $${body.usd.toFixed(5)}`
}

function say(text) { note.textContent = text }

/** The address bar carries the phrase, so an answer can be linked to. */
function remember(phrase) {
  const url = new URL(location.href)
  url.searchParams.set('q', phrase)
  history.replaceState(null, '', url)
}

/** Black text on a light band, white on a dark one; sRGB is good enough for the decision. */
function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.35 ? '#000' : '#fff'
}

function about() {
  const panel = document.querySelector('#about')
  const open = document.querySelector('#about-open')
  const close = document.querySelector('#about-close')
  const show = on => {
    panel.hidden = !on
    open.setAttribute('aria-expanded', String(on))
    if (on) close.focus(); else input.focus()
  }
  open.addEventListener('click', () => show(true))
  close.addEventListener('click', () => show(false))
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) show(false) })
}
