import data from './themes.json'

export type ThemeKind = 'desktop' | 'terminal'

export interface Theme {
  slug: string
  name: string
  author: string
  /** GitHub "owner/repo" */
  repo: string
  /** Folder inside the repo, when the theme is not at its root */
  path?: string
  /** desktop: a mod for the desktop app. terminal: a /theme color theme or CLI mod */
  kind: ThemeKind
  appearance?: 'dark' | 'light' | 'both'
  description: string
  /** Image or GIF URL, linked from the author's repo (not copied here) */
  preview?: string
  /** Commands to run, in order. Omit when the repo has its own install steps */
  install?: string[]
  official?: boolean
}

export const themes = data as Theme[]

export const themeRepoUrl = (t: Theme) =>
  `https://github.com/${t.repo}${t.path ? `/tree/main/${t.path}` : ''}`
