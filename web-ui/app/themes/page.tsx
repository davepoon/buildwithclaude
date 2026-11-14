import { themes } from '@/lib/themes'
import ThemesPageClient from './themes-client'

export const metadata = {
  title: 'Themes | BuildWithClaude',
  description: 'Browse custom themes for Claude Code: animated desktop app themes built as mods, and color themes for the terminal.',
}

interface ThemesPageProps {
  // A `q` deep-link (from a theme search result) pre-filters the listing.
  searchParams: Promise<{ q?: string }>
}

export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  const { q } = await searchParams
  const initialQuery = q?.trim() || ''
  return <ThemesPageClient key={initialQuery} themes={themes} initialQuery={initialQuery} />
}
