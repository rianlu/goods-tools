import type { Artwork, BaseCraft, FilmCraft, Transform } from '../../core/types.ts'
import type { BadgeShape } from './presets.ts'

export type BadgeState = {
  artwork: Artwork
  transform: Transform
  baseCraft: BaseCraft
  filmCraft: FilmCraft
  shape: BadgeShape
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
}

