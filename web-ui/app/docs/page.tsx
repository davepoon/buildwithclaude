import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  Book, 
  Download, 
  GitBranch, 
  Terminal, 
  FileText, 
  Users,
  ArrowRight,
  Shield,
  Zap
} from 'lucide-react'

export default function DocsPage() {
  const docsSections = [
    {
      icon: Download,
      title: 'Installation Guide',
      description: 'Learn how to install subagents in your projects',
      href: '/docs/installation',
      color: 'text-green-400'
    },
    {
      icon: Terminal,
      title: 'Getting Started',
      description: 'Quick start guide for using Claude Code Subagents',
      href: 'https://github.com/davepoon/buildwithclaude#quick-start',
      color: 'text-blue-400',
      external: true
    },
    {
      icon: FileText,
      title: 'Creating Subagents',
      description: 'How to create your own custom subagents',
      href: 'https://github.com/davepoon/buildwithclaude/blob/main/CONTRIBUTING.md#creating-a-new-subagent',
      color: 'text-purple-400',
      external: true
    },
    {
      icon: GitBranch,
      title: 'Contributing',
      description: 'Guidelines for contributing to the collection',
      href: '/contribute',
      color: 'text-orange-400',
      external: false
    },
    {
      icon: Shield,
      title: 'Best Practices',
      description: 'Security and performance best practices',
      href: 'https://github.com/davepoon/buildwithclaude/blob/main/CONTRIBUTING.md#writing-guidelines',
      color: 'text-red-400',
      external: true
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Join the Claude Code community',
      href: 'https://github.com/davepoon/buildwithclaude/discussions',
      color: 'text-indigo-400',
      external: true
    }
  ]
  
  const quickLinks = [
    { title: 'View all subagents', href: '/browse' },
    { title: 'GitHub repository', href: 'https://github.com/davepoon/buildwithclaude' },
    { title: 'Report an issue', href: 'https://github.com/davepoon/buildwithclaude/issues' },
    { title: 'Request a feature', href: 'https://github.com/davepoon/buildwithclaude/issues/new' }
  ]
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <h1 className="text-display-3 font-bold mb-4">Documentation</h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to know about Claude Code Subagents
            </p>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 min-w-0">
            <h2 className="text-2xl font-bold mb-6">Browse Documentation</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-12">
              {docsSections.map((section) => {
                const isExternal = section.external || false
                return (
                  <Link 
                    key={section.href} 
                    href={section.href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                  >
                    <Card className="h-full p-6 border-border/50 hover:border-primary/20 transition-all cursor-pointer group">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg bg-background ${section.color}`}>
                          <section.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                            {section.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {section.description}
                          </p>
                        </div>
                        <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-all ${isExternal ? 'rotate-45' : 'group-hover:translate-x-1'}`} />
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
            
            {/* Getting Started Section */}
            <div className="bg-primary/10 rounded-xl p-8 border border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold">Quick Start</h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Get up and running with Claude Code Subagents in under 5 minutes
              </p>
              <ol className="space-y-4 mb-6">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">Clone the repository</p>
                    <code className="text-sm text-muted-foreground bg-background/50 px-2 py-0.5 rounded max-lg:block max-lg:w-fit max-lg:max-w-full max-lg:overflow-x-auto max-lg:whitespace-nowrap">
                      git clone https://github.com/davepoon/buildwithclaude.git
                    </code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">Copy subagents to your Claude directory</p>
                    <code className="text-sm text-muted-foreground bg-background/50 px-2 py-0.5 rounded max-lg:block max-lg:w-fit max-lg:max-w-full max-lg:overflow-x-auto max-lg:whitespace-nowrap">
                      cp *.md ~/.claude/agents/
                    </code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <div>
                    <p className="font-medium">Restart Claude Code and start using subagents!</p>
                  </div>
                </li>
              </ol>
              <Link href="/docs/installation">
                <Button className="btn-gradient gap-2 max-sm:h-auto max-sm:whitespace-normal">
                  View Full Installation Guide
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Quick Links */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                <div className="space-y-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block p-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors"
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {link.title} →
                    </Link>
                  ))}
                </div>
              </div>
              
              {/* Help Section */}
              <Card className="p-6 border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Book className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Need Help?</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Can&apos;t find what you&apos;re looking for? We&apos;re here to help!
                </p>
                <div className="space-y-2">
                  <a
                    href="https://github.com/davepoon/buildwithclaude/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      Ask a Question
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}