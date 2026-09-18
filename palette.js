// The sixteen colours are not ours. The idea is not ours either: both come from Matt DesLauriers
// (@mattdesl on X, mattdesl on GitHub). This is the "Colorful" palette (system 0x00) published as
// docs/palette.md in Matt DesLauriers' Bitframes, a generative-art project of his:
//
//   https://github.com/mattdesl/bitframes/blob/main/docs/palette.md
//
// MIT, Copyright (c) 2024 Matt DesLauriers. The sRGB hex values below are copied from that file.
// The Display P3 values are the same primaries in that colour space, produced once by the palette
// generator in the same repository (src/colors.js, getPalette({ colorSpace: 'display-p3' })) and
// pasted here, so that this page draws what Bitframes draws without carrying any of its code.
//
// The names are the palette's own, in palette order, with one exception: index 0 is called
// "background" in the spec — the beige of the paper — and is offered to Jev as "beige", because
// "background" is not a colour anyone would name.

/** @type {{ name: string, index: number, srgb: string, p3: string }[]} */
export const COLOURS = [
  { name: 'beige', srgb: '#e9e2d4', p3: 'color(display-p3 0.907967 0.886865 0.837095)' },
  { name: 'black', srgb: '#000000', p3: 'color(display-p3 0 0 0)' },
  { name: 'white', srgb: '#ffffff', p3: 'color(display-p3 1 1 1)' },
  { name: 'gray', srgb: '#9e9e9e', p3: 'color(display-p3 0.619081 0.619081 0.619081)' },
  { name: 'red', srgb: '#dd1706', p3: 'color(display-p3 0.793739 0.196675 0.125420)' },
  { name: 'orange', srgb: '#f88100', p3: 'color(display-p3 0.946520 0.505940 0.000407)' },
  { name: 'brown', srgb: '#a25900', p3: 'color(display-p3 0.617486 0.348872 0.000167)' },
  { name: 'yellow', srgb: '#fad200', p3: 'color(display-p3 0.972614 0.823523 0.000223)' },
  { name: 'green', srgb: '#00a02a', p3: 'color(display-p3 0.209263 0.629582 0.166024)' },
  { name: 'teal', srgb: '#00c7a6', p3: 'color(display-p3 0.000257 0.800803 0.652844)' },
  { name: 'dark blue', srgb: '#004e60', p3: 'color(display-p3 0.000107 0.308009 0.400025)' },
  { name: 'light blue', srgb: '#0081f8', p3: 'color(display-p3 0.159883 0.487378 0.990681)' },
  { name: 'indigo', srgb: '#3444da', p3: 'color(display-p3 0.215511 0.265571 0.822053)' },
  { name: 'purple', srgb: '#841bb9', p3: 'color(display-p3 0.475572 0.143593 0.699939)' },
  { name: 'light pink', srgb: '#fcbaff', p3: 'color(display-p3 0.960784 0.728256 0.999999)' },
  { name: 'hot pink', srgb: '#ff8cd0', p3: 'color(display-p3 0.999999 0.509702 0.828540)' },
].map((colour, index) => ({ ...colour, index }))

/** The names, in palette order: the options Jev chooses between. */
export const NAMES = COLOURS.map(c => c.name)
