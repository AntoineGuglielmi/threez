/**
 * Réglages centralisés des modèles et de l'atelier pixel art.
 * Modifie ces valeurs pour adapter la taille, les couleurs et les outils.
 */
export const CORRIDOR_PIXEL_CONFIG = {
  size: 64,
  background: '#171d20',
  editor: {
    palette: [
      '#171d20', '#30383b', '#354144', '#4b5659',
      '#626b6d', '#707875', '#858b83', '#a4a99e',
      '#c2c2b2', '#d0b18a', '#76513d', '#b47d56',
      '#3f3029', '#c0c7bf', '#783d3b', '#a64c47',
    ],
    brush: { min: 1, max: 9, initial: 1 },
    saveDebounceMs: 500,
  },
} as const
