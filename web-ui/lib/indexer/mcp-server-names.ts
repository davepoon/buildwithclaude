import { createHash } from 'node:crypto'

/**
 * Slug-safe last segment of an official registry name (`com.example/weather` -> `weather`).
 */
export function getShortName(name: string): string {
  if (!name) return 'unknown'
  const baseName = name.includes('/') ? name.split('/').pop() : name
  return (baseName || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

/**
 * Map each official registry name to the name its slug is built from.
 *
 * Registry names are unique, but their last segments are not: many servers are published
 * as `<namespace>/mcp`. Servers that share a short name would share a slug and overwrite
 * each other's row, so a shared short name falls back to the full registry name. A short
 * name that only one server uses is kept, so existing slugs do not change.
 */
export function assignShortNames(names: string[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const name of names) {
    const shortName = getShortName(name)
    counts.set(shortName, (counts.get(shortName) || 0) + 1)
  }

  const shortNames = new Map<string, string>()
  for (const name of names) {
    const shortName = getShortName(name)
    shortNames.set(name, counts.get(shortName) === 1 ? shortName : name.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
  }
  return shortNames
}

/**
 * The form a database slug takes: lowercase, other characters become `-`, runs of `-` collapse.
 */
export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
}

/**
 * Eight hex characters of the registry name's SHA-256, so a name always gets the same suffix.
 */
export function nameSuffix(name: string, length = 8): string {
  return createHash('sha256').update(name).digest('hex').slice(0, length)
}

/**
 * Map each official registry name to a database slug that no other name in the batch shares.
 *
 * The slug is `<sourceRegistry>-<slugified short name>` and the upsert keys on it. Short
 * names are already distinct, but slugifying can still make two of them meet: a fallback
 * (`com.example/mcp` -> `com-example-mcp`) can equal another server's own short name, and
 * collapsing hyphens turns `a-b-mcp` and `a--b-mcp` into one slug. When names meet, one
 * keeps the plain slug: the one whose short name is its own last segment rather than a
 * fallback, then the one whose short name needed no collapsing, then the first in sort
 * order. Every other one gets `-<nameSuffix(registry name)>`, which depends only on its own
 * registry name. A suffixed slug never takes a slug already given out or any server's plain
 * slug: the suffix keeps growing (8, 16, 32, then all 64 hex characters), and if even the full
 * hash is taken a counter is added. Groups are visited in sorted order, so the result does not
 * change with page order.
 */
export function assignSlugs(names: string[], sourceRegistry: string): Map<string, string> {
  const shortNames = assignShortNames(names)
  const groups = new Map<string, string[]>()
  for (const name of new Set(names)) {
    const slug = `${sourceRegistry}-${slugify(shortNames.get(name) || name)}`
    groups.set(slug, [...(groups.get(slug) || []), name])
  }

  const rank = (name: string): [number, number] => {
    const shortName = shortNames.get(name) || name
    return [shortName === getShortName(name) ? 0 : 1, slugify(shortName) === shortName ? 0 : 1]
  }

  const slugs = new Map<string, string>()
  const used = new Set<string>()
  const plain = new Set(groups.keys())
  const taken = (candidate: string) => used.has(candidate) || plain.has(candidate)
  for (const slug of [...groups.keys()].sort()) {
    const ordered = [...(groups.get(slug) || [])].sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)]
      return ra[0] - rb[0] || ra[1] - rb[1] || (a < b ? -1 : a > b ? 1 : 0)
    })
    ordered.forEach((name, index) => {
      let candidate = slug
      if (index > 0) {
        const hash = nameSuffix(name, 64)
        let length = 8
        candidate = `${slug}-${hash.slice(0, length)}`
        while (taken(candidate) && length < hash.length) {
          length = Math.min(length * 2, hash.length)
          candidate = `${slug}-${hash.slice(0, length)}`
        }
        const base = candidate
        for (let counter = 2; taken(candidate); counter++) candidate = `${base}-${counter}`
      }
      used.add(candidate)
      slugs.set(name, candidate)
    })
  }
  return slugs
}
