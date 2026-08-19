'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Copy, Box, Star, Github } from 'lucide-react'
import {
  MCPServer,
  SOURCE_INDICATORS
} from '@/lib/mcp-types'
import { MCPInstallationModal } from './mcp-installation-modal'

interface MCPCardProps {
  server: MCPServer
}

export function MCPCard({ server }: MCPCardProps) {
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const getLogoUrl = () => {
    if (server.logo_url) return server.logo_url

    if (server.source_registry?.type === 'docker' && server.vendor) {
      return `https://hub.docker.com/public/images/logos/${server.vendor}.png`
    }

    if (server.sources.github) {
      const match = server.sources.github.match(/github\.com\/([^/]+)/)
      if (match) {
        return `https://github.com/${match[1]}.png?size=40`
      }
    }

    return null
  }

  const logoUrl = getLogoUrl()
  const showLogo = logoUrl && !logoError
  const serverSlug = server.path.replace(/\//g, '-')
  const href = `/mcp-server/${serverSlug}`

  const handleInstall = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowInstallModal(true)
  }

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toString()
  }

  return (
    <>
      <Link href={href}>
        <div className="p-5 rounded-lg border border-border hover:border-primary/40 transition-colors h-full flex flex-col bg-card">
          {/* Header: Logo + Title + Stats */}
          <div className="flex items-start justify-between gap-4 mb-2">
            {/* Left side: Logo + Title */}
            <div className="flex items-center gap-2 min-w-0">
              {showLogo && (
                <div className="relative w-6 h-6 flex-shrink-0">
                  <Image
                    src={logoUrl}
                    alt={`${server.vendor || server.display_name} logo`}
                    width={24}
                    height={24}
                    className="object-contain rounded"
                    onError={() => setLogoError(true)}
                  />
                </div>
              )}
              <h3 className="font-medium truncate">{server.display_name}</h3>
            </div>

            {/* Right side: Stats as pills */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {server.stats?.docker_pulls && server.stats.docker_pulls > 0 && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Box className="h-3.5 w-3.5" />
                  {formatNumber(server.stats.docker_pulls)}
                </span>
              )}
              {server.stats?.github_stars && server.stats.github_stars > 0 && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                  <Star className="h-3.5 w-3.5" />
                  {formatNumber(server.stats.github_stars)}
                </span>
              )}
            </div>
          </div>

          {/* Source indicators */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            {server.source_registry?.type === 'official-mcp' && (
              <span>{SOURCE_INDICATORS['official-mcp'].icon} Official</span>
            )}
            {(server.source_registry?.type === 'docker' || server.docker_mcp_available) && (
              <span>{SOURCE_INDICATORS.docker.icon} Docker</span>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 flex-1 mb-3">
            {server.description}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleInstall}
            >
              <Copy className="h-3 w-3 mr-1" />
              Install
            </Button>
            {server.sources.github && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open(server.sources.github, '_blank')
                }}
              >
                <Github className="h-3 w-3 mr-1" />
                GitHub
              </Button>
            )}
          </div>
        </div>
      </Link>

      <MCPInstallationModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        serverName={server.name}
        displayName={server.display_name}
        claudeMcpAddCommand={server.claude_mcp_add_command}
        dockerMcpAvailable={server.docker_mcp_available || server.source_registry?.type === 'docker'}
        dockerMcpCommand={server.docker_mcp_command || `docker mcp server enable mcp/${server.name}`}
        environmentVariables={server.environment_variables}
        packages={server.packages}
        remotes={server.remotes}
      />
    </>
  )
}
