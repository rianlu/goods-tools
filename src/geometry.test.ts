import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BADGE_PRESETS,
  BADGE_SHAPES,
  DEFAULT_BADGE_PRESET,
  constrainTransform,
  coverGeometry,
  mmToPixels,
  previewDiameterRatio,
} from './geometry.ts'

test('converts the default 58mm artwork range to 827 pixels', () => {
  assert.equal(mmToPixels(DEFAULT_BADGE_PRESET.printDiameterMm, 300), 827)
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
    BADGE_SHAPES.map((shape) => shape.id),
    ['round', 'square'],
  )
})

test('scales the badge preview with the selected finished size', () => {
  assert.ok(previewDiameterRatio(25) < previewDiameterRatio(58))
  assert.ok(previewDiameterRatio(58) < previewDiameterRatio(75))
})

test('keeps the complete print circle covered', () => {
  const landscape = coverGeometry({ width: 2000, height: 1000 }, 1)
  assert.deepEqual(landscape, {
    width: 2,
    height: 1,
    maxOffsetX: 0.5,
    maxOffsetY: 0,
  })

  assert.deepEqual(
    constrainTransform(
      { offsetX: 8, offsetY: -8, zoom: 1 },
      { width: 2000, height: 1000 },
    ),
    { offsetX: 0.5, offsetY: 0, zoom: 1 },
  )
})
