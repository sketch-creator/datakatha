// Colour themes for articles and carousels. House = palette.json from the skills pack.
export interface Theme {
  id: string
  name: string
  bg: string
  surface: string
  ink: string
  muted: string
  grid: string
  accent: string
  accent2: string
  context: string
  onAccent: string
  dark: boolean
}

export const THEMES: Theme[] = [
  { id: 'house', name: 'House', bg: '#f9f9f7', surface: '#fcfcfb', ink: '#0b0b0b', muted: '#52514e', grid: '#e1e0d9', accent: '#2a78d6', accent2: '#eb6834', context: '#c3c2b7', onAccent: '#ffffff', dark: false },
  { id: 'ink', name: 'Ink', bg: '#0f1013', surface: '#17181c', ink: '#f2f1ec', muted: '#a3a29b', grid: '#2a2b30', accent: '#f5c542', accent2: '#7aa7ff', context: '#4a4b52', onAccent: '#121212', dark: true },
  { id: 'monsoon', name: 'Monsoon', bg: '#0d2629', surface: '#12323a', ink: '#e8f4f2', muted: '#9fc3bf', grid: '#1f454b', accent: '#3fd0bd', accent2: '#f2c14e', context: '#3b6168', onAccent: '#06201d', dark: true },
  { id: 'kerala', name: 'Kerala', bg: '#f2f5ec', surface: '#fafcf6', ink: '#122619', muted: '#4c5f50', grid: '#d9e2cf', accent: '#1d7a3e', accent2: '#c9971c', context: '#b5c4ad', onAccent: '#ffffff', dark: false },
  { id: 'sunset', name: 'Sunset', bg: '#fff4ec', surface: '#fffaf6', ink: '#2a1208', muted: '#7a5040', grid: '#f1dccd', accent: '#e4572e', accent2: '#7b2cbf', context: '#e6c3ae', onAccent: '#ffffff', dark: false },
]

export function getTheme(id: string, accent?: string): Theme {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0]
  if (!accent) return t
  // Pick readable text on the custom accent.
  const hex = accent.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return { ...t, accent, onAccent: lum > 0.55 ? '#111111' : '#ffffff' }
}
