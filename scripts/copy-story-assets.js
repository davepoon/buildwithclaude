#!/usr/bin/env node
/**
 * Copies story image assets from stories/<slug>/*.{png,jpg,webp,svg,gif} into
 * web-ui/public/stories/<slug>/ so Next.js can serve them — both the optional
 * cover (cover.<ext>) and any images referenced in the story body
 * (e.g. ![alt](diagram.png) -> /stories/<slug>/diagram.png).
 *
 * Runs as a prebuild/predev hook in web-ui/package.json.
 */

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')
const STORIES_SRC = path.join(REPO_ROOT, 'stories')
const STORIES_DEST = path.join(REPO_ROOT, 'web-ui', 'public', 'stories')

const IMAGE_RE = /\.(png|jpe?g|webp|svg|gif|avif)$/i

function main() {
  if (!fs.existsSync(STORIES_SRC)) {
    console.log('[copy-story-assets] no stories/ directory, skipping')
    return
  }

  fs.mkdirSync(STORIES_DEST, { recursive: true })

  const slugDirs = fs
    .readdirSync(STORIES_SRC, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  let copied = 0
  for (const slug of slugDirs) {
    const srcDir = path.join(STORIES_SRC, slug)
    const images = fs.readdirSync(srcDir, { withFileTypes: true })
      .filter(e => e.isFile() && IMAGE_RE.test(e.name))
      .map(e => e.name)
    if (images.length === 0) continue

    const destDir = path.join(STORIES_DEST, slug)
    fs.mkdirSync(destDir, { recursive: true })
    for (const img of images) {
      fs.copyFileSync(path.join(srcDir, img), path.join(destDir, img))
      console.log(`[copy-story-assets] ${slug}/${img}`)
      copied++
    }
  }

  console.log(`[copy-story-assets] copied ${copied} image(s)`)
}

main()
