export type StudioId = 'badge' | 'photocard'

export type ViewMode = 'preview' | 'print'

export type Transform = {
  scale: number
  offsetX: number
  offsetY: number
}

export type Artwork = {
  source: CanvasImageSource
  width: number
  height: number
  name: string
  isDemo?: boolean
}

export type BaseCraft =
  | 'none'
  | 'fine-silver'
  | 'silver-glitter'
  | 'brushed-silver'
  | 'sand-glitter'
  | 'gold-glitter'
  | 'pearl'

export type FilmCraft =
  | 'none'
  | 'glossy'
  | 'matte'
  | 'rainbow'
  | 'cracked-ice'
  | 'cross'



export type ExportSpec = {
  title: string
  description: string
  specRows: Array<{
    name: string
    value: string
    highlight?: boolean
  }>
  exportPixelSize: {
    width: number
    height: number
  }
  confirmButtonText: string
}
