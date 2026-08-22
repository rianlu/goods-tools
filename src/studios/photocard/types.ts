import type { Artwork, BaseCraft, FilmCraft, Transform } from '../../core/types.ts'
import type { FrameType, PhotocardPreset } from './presets.ts'

export type CardSide = 'front' | 'back'

export type SignatureConfig = {
  text: string
  color: string
  font: string
  showDate: boolean
  dateText?: string
}

export type PhotocardState = {
  preset: PhotocardPreset
  frameType: FrameType
  cornerRadiusMm: number
  activeSide: CardSide
  frontArtwork: Artwork | null
  frontTransform: Transform
  backArtwork: Artwork | null
  backTransform: Transform
  baseCraft: BaseCraft
  filmCraft: FilmCraft
  signature: SignatureConfig
}

