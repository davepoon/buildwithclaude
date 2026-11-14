import { themes } from '@/lib/themes'
import ThemesPageClient from './themes-client'

export const metadata = {
  title: 'Themes | BuildWithClaude',
  description: 'Browse custom themes for Claude Code: animated desktop app themes built as mods, and color themes for the terminal.',
}

export default function ThemesPage() {
  return <ThemesPageClient themes={themes} />
}
