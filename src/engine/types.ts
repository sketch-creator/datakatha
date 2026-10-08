// Shared types for the analysis engine. The engine is deterministic: every number
// a story can use is a Fact computed here; the model only chooses and writes.

export type Cell = string | number | null
export type Row = Record<string, Cell>

export interface Dataset {
  name: string
  columns: string[]
  rows: Row[]
  numeric: Set<string>
  sizeKB: number
}

export interface Codebook {
  [column: string]: { title?: string; unit?: string; description?: string; source?: string }
}

export interface Roles {
  entity: string
  time: string
  value: string
  rate: string | null
  size: string | null
  /** Columns used by the hidden checks when present. */
  consumption: string | null
  output: string | null
  unit: string // unit of `value`, e.g. "million tonnes"
  rateUnit: string // e.g. "tonnes per person"
  valueLabel: string // e.g. "CO2 emissions"
  rateLabel: string // e.g. "CO2 emissions per person"
  outputLabel: string
  exclude: string[]
  /** Unit and label for every column (from the codebook when given). */
  units: Record<string, string>
  labels: Record<string, string>
  minSize: number
  minValue: number
  base: number
  latest: number
  source: string
}

export type FactKind = 'value' | 'pct' | 'ratio' | 'pp' | 'rank' | 'count' | 'year'

export interface Fact {
  id: string
  kind: FactKind
  /** What the number is, in words: "China, CO2 emissions per person, 2024". */
  label: string
  /** Full precision, in the data's own unit (percent for pct). */
  value: number
  unit: string
  /** Multiply `value` by this to get absolute base units (million tonnes -> 1e6). */
  scale: number
  /** House-style display strings the writers must copy. */
  en: string
  ml: string
  entity?: string
  period?: number
}

export interface Assertion {
  id: string
  text: string
  holds: boolean
  detail: string
}

export interface ChartSeries {
  name: string
  highlight: boolean
  points: { x: number; y: number }[]
}

export interface ChartBar {
  label: string
  value: number
  highlight?: boolean
  group?: string
}

export interface ChartSpec {
  type: 'line' | 'bar' | 'slope' | 'dot' | 'grouped'
  title: string
  subtitle: string
  yLabel: string
  unit: string
  source: string
  series?: ChartSeries[]
  bars?: ChartBar[]
  /** For slope charts of ranks: smaller is better, draw inverted. */
  invertY?: boolean
  annotations?: { x: number; y: number; text: string }[]
}

export type StoryKind =
  | 'crossover'
  | 'leaders'
  | 'rise'
  | 'fall'
  | 'absolute'
  | 'outliers'
  | 'per-person-gap'
  | 'peaked'
  | 'turns'
  | 'imports'
  | 'decoupling'
  | 'climbers'
  | 'records-vs-peaks'
  | 'total-vs-per-person'
  | 'quiet-risers'
  | 'own-angle'

export interface Story {
  id: string
  kind: StoryKind
  hidden: boolean
  /** Engine draft headline (EN). The writer may improve it but must keep its numbers. */
  title: string
  finding: string
  whyMissed?: string
  method: string
  checkBeforeUse: string
  entities: string[]
  facts: Fact[]
  assertions: Assertion[]
  chart: ChartSpec
  score: number
  /** Comparisons in this story default to the per-person measure. */
  perPerson?: boolean
}

export interface DataCard {
  file: string
  rows: number
  columnCount: number
  entities: number
  periods: { first: number; last: number; count: number }
  uniqueKeys: boolean
  duplicateKeyRows: number
  exactDuplicates: number
  completeEntities: number
  gappedEntities: number
  columns: { name: string; kind: string; filled: number; distinct: number; min?: number; max?: number; unit: string }[]
  flags: string[]
  spikes: { column: string; entity: string; period: number; value: number; ratio: number }[]
  definitions: { column: string; text: string }[]
}

export interface Analysis {
  card: DataCard
  roles: Roles
  stories: Story[]
  /** Facts every output may use (years covered, counts of entities). */
  context: Fact[]
  checksRun: { name: string; result: string }[]
}
