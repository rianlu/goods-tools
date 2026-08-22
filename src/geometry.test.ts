import assert from 'node:assert/strict'
import test from 'node:test'
import { mmToPixels, pixelsToMm } from './core/geometry/dpi.ts'
import { constrainTransform } from './core/geometry/transform.ts'
import { BADGE_PRESETS, SHAPE_OPTIONS, previewDiameterRatio } from './studios/badge/presets.ts'
import { PHOTOCARD_PRESETS } from './studios/photocard/presets.ts'

test('converts the default 58mm artwork range to 827 pixels at 300 DPI', () => {
  assert.equal(mmToPixels(70, 300), 827)
})

test('converts pixels back to mm accurately', () => {
  assert.equal(pixelsToMm(827, 300), 70.02)
})

test('offers common badge sizes with a visible and wrapped area', () => {
  assert.deepEqual(
    BADGE_PRESETS.map(({ finishedDiameterMm, printDiameterMm }) => [
      finishedDiameterMm,
      printDiameterMm,
    ]),
    [[25, 31], [32, 38], [44, 52], [58, 70], [75, 87]],
  )
})

test('offers circular and square badge shapes', () => {
  assert.deepEqual(
    SHAPE_OPTIONS.map((shape) => shape.id),
    ['round', 'square'],
  )
})

test('scales the badge preview with the selected finished size', () => {
  assert.ok(previewDiameterRatio(25) < previewDiameterRatio(58))
  assert.ok(previewDiameterRatio(58) < previewDiameterRatio(75))
})

test('keeps the complete print circle covered with transform constraints', () => {
  const constrained = constrainTransform(
    { offsetX: 8, offsetY: -8, scale: 1 },
    { source: {} as CanvasImageSource, width: 2000, height: 1000, name: 'test' },
  )
  assert.equal(constrained.scale, 1)
  assert.ok(constrained.offsetX <= 0.5 && constrained.offsetX >= -0.5)
})

test('correctly computes pixel dimensions for all badge presets at 300 DPI', () => {
  const expectedPixels: Record<string, number> = {
    '25mm': 366,
    '32mm': 449,
    '44mm': 614,
    '58mm': 827,
    '75mm': 1028,
  }
  for (const preset of BADGE_PRESETS) {
    const px = mmToPixels(preset.printDiameterMm, 300)
    assert.equal(px, expectedPixels[preset.id])
  }
})

test('correctly computes 300 DPI print pixel dimensions for photocard presets with 1.5mm bleed', () => {
  // Mini: 54x86mm + 1.5mm bleed each side = 57x89mm
  const miniW = mmToPixels(54 + 1.5 * 2, 300)
  const miniH = mmToPixels(86 + 1.5 * 2, 300)
  assert.equal(miniW, 673)
  assert.equal(miniH, 1051)

  // Square: 72x86mm + 1.5mm bleed = 75x89mm
  const squareW = mmToPixels(72 + 1.5 * 2, 300)
  const squareH = mmToPixels(86 + 1.5 * 2, 300)
  assert.equal(squareW, 886)
  assert.equal(squareH, 1051)

  // Standard K-Pop Card: 54x85mm + 1.5mm bleed = 57x88mm
  const kpopW = mmToPixels(54 + 1.5 * 2, 300)
  const kpopH = mmToPixels(85 + 1.5 * 2, 300)
  assert.equal(kpopW, 673)
  assert.equal(kpopH, 1039)
})
