import { standardChecks } from './checks'
import { Panel } from './data'
import { FactBook } from './facts'
import { hiddenChecks } from './hidden'
import { buildCard, detectRoles } from './profile'
import type { Analysis, Codebook, Dataset, Roles } from './types'

export * from './types'
export { parseCsv, parseCodebook, Panel } from './data'
export { detectRoles, buildCard } from './profile'

export function analyze(ds: Dataset, cb: Codebook = {}, overrides: Partial<Roles> = {}, source = ''): Analysis {
  const detected = detectRoles(ds, cb, source)
  if (!detected) throw new Error('Could not find an entity column and a time column in this file.')
  const roles: Roles = { ...detected, ...overrides }
  const card = buildCard(ds, roles, cb)
  const panel = new Panel(ds, roles.entity, roles.time, roles.exclude)
  const std = standardChecks({ panel, roles })
  const hid = hiddenChecks({ panel, roles })
  const stories = [...std.stories, ...hid.stories]
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, id: `S${i + 1}` }))
  const ctx = new FactBook(roles)
  ctx.year('First year in the file', panel.periods[0])
  ctx.year('Latest year in the file', panel.periods[panel.periods.length - 1])
  ctx.year('Base year used for changes', roles.base)
  ctx.year('Latest year used', roles.latest)
  ctx.count(`Entities (${roles.entity}) in the file`, panel.entities.length)
  return { card, roles, stories, context: ctx.facts, checksRun: [...std.log, ...hid.log] }
}
