'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Copy, Check, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function InstallationPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  
  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }
  
  const installCommands = {
    // Quick install everything
    everything: {
      mac: `git clone https://github.com/davepoon/buildwithclaude.git
cd buildwithclaude
find subagents -name "*.md" -exec cp {} ~/.claude/agents/ \\;
find commands -name "*.md" -exec cp {} ~/.claude/commands/ \\;`,
      windows: `git clone https://github.com/davepoon/buildwithclaude.git
cd buildwithclaude
for %f in (subagents\\*.md) do copy "%f" %USERPROFILE%\\.claude\\agents\\
for %f in (commands\\*.md) do copy "%f" %USERPROFILE%\\.claude\\commands\\`
    },
    // Subagents only
    allSubagentsUser: {
      mac: `git clone https://github.com/davepoon/buildwithclaude.git
find buildwithclaude/subagents -name "*.md" -exec cp {} ~/.claude/agents/ \\;`,
      windows: `git clone https://github.com/davepoon/buildwithclaude.git
for %f in (buildwithclaude\\subagents\\*.md) do copy "%f" %USERPROFILE%\\.claude\\agents\\`
    },
    allSubagentsProject: {
      mac: `mkdir -p .claude/agents
find /path/to/buildwithclaude/subagents -name "*.md" -exec cp {} .claude/agents/ \\;`,
      windows: `mkdir .claude\\agents 2>nul
for %f in (\\path\\to\\buildwithclaude\\subagents\\*.md) do copy "%f" .claude\\agents\\`
    },
    singleSubagentUser: {
      mac: `cp subagent-name.md ~/.claude/agents/`,
      windows: `copy subagent-name.md %USERPROFILE%\\.claude\\agents\\`
    },
    singleSubagentProject: {
      mac: `mkdir -p .claude/agents && cp subagent-name.md .claude/agents/`,
      windows: `mkdir .claude\\agents 2>nul && copy subagent-name.md .claude\\agents\\`
    },
    // Commands only
    allCommandsUser: {
      mac: `git clone https://github.com/davepoon/buildwithclaude.git
find buildwithclaude/commands -name "*.md" -exec cp {} ~/.claude/commands/ \\;`,
      windows: `git clone https://github.com/davepoon/buildwithclaude.git
for %f in (buildwithclaude\\commands\\*.md) do copy "%f" %USERPROFILE%\\.claude\\commands\\`
    },
    allCommandsProject: {
      mac: `mkdir -p .claude/commands
find /path/to/buildwithclaude/commands -name "*.md" -exec cp {} .claude/commands/ \\;`,
      windows: `mkdir .claude\\commands 2>nul
for %f in (\\path\\to\\buildwithclaude\\commands\\*.md) do copy "%f" .claude\\commands\\`
    },
    singleCommandUser: {
      mac: `cp command-name.md ~/.claude/commands/`,
      windows: `copy command-name.md %USERPROFILE%\\.claude\\commands\\`
    },
    singleCommandProject: {
      mac: `mkdir -p .claude/commands && cp command-name.md .claude/commands/`,
      windows: `mkdir .claude\\commands 2>nul && copy command-name.md .claude\\commands\\`
    }
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold wrap-break-word">Installation Guide</h1>
              <p className="text-muted-foreground mt-1">
                Learn how to install Claude Code Subagents and Commands
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Plugin Marketplace - Recommended */}
        <div className="mb-8 p-6 bg-green-500/10 rounded-xl border border-green-500/20">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-green-500 mb-1">Recommended: Plugin Marketplace</p>
              <p className="text-sm mb-3">
                The easiest way to install is via Claude Code&apos;s built-in plugin system:
              </p>
              <pre className="bg-background/50 border border-border/50 p-3 rounded-lg overflow-x-auto mb-3">
                <code className="text-sm font-mono">/plugin marketplace add davepoon/buildwithclaude</code>
              </pre>
              <p className="text-sm text-muted-foreground">
                Then install plugins: <code className="bg-background px-1 rounded max-lg:block max-lg:w-fit max-lg:max-w-full max-lg:overflow-x-auto max-lg:whitespace-nowrap">/plugin install all-agents@buildwithclaude</code>
              </p>
            </div>
          </div>
        </div>

        {/* Manual Installation Tip */}
        <div className="mb-8 p-6 bg-primary/10 rounded-xl border border-primary/20">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-primary mb-1">Alternative: Manual Installation</p>
              <p className="text-sm">
                If you prefer manual installation, browse individual items and copy the markdown files directly.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/browse">
                  <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/10">
                    Browse Subagents <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Button>
                </Link>
                <Link href="/commands">
                  <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/10">
                    Browse Commands <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Installation Content */}
        <Tabs defaultValue="everything" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl max-sm:h-auto">
            <TabsTrigger value="everything" className="max-sm:h-full max-sm:whitespace-normal">Install Everything</TabsTrigger>
            <TabsTrigger value="subagents" className="max-sm:h-full max-sm:whitespace-normal">Subagents Only</TabsTrigger>
            <TabsTrigger value="commands" className="max-sm:h-full max-sm:whitespace-normal">Commands Only</TabsTrigger>
          </TabsList>
          
          {/* Install Everything Tab */}
          <TabsContent value="everything" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-3">Install Everything (Recommended)</h2>
              <p className="text-muted-foreground">
                Get the complete collection of 43+ specialized subagents and 39+ commands for comprehensive AI assistance and automation.
              </p>
            </div>
            
            <div className="bg-card/50 rounded-lg p-4 border border-border/50">
              <p className="text-sm font-medium mb-1">What&apos;s Included</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>✓ 43+ AI Subagents for specialized tasks</p>
                <p>✓ 39+ Slash Commands for automation</p>
                <p>✓ Automatic invocation based on context</p>
                <p>✓ Works across all your projects</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">macOS/Linux</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 hover:bg-primary/10"
                    onClick={() => copyToClipboard(installCommands.everything.mac, 0)}
                  >
                    {copiedIndex === 0 ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">{installCommands.everything.mac}</code>
                </pre>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Windows</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 hover:bg-primary/10"
                    onClick={() => copyToClipboard(installCommands.everything.windows, 1)}
                  >
                    {copiedIndex === 1 ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">{installCommands.everything.windows}</code>
                </pre>
              </div>
            </div>
          </TabsContent>
          
          {/* Subagents Only Tab */}
          <TabsContent value="subagents" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-3">Install Subagents Only</h2>
              <p className="text-muted-foreground">
                Install the complete collection of 43+ specialized AI subagents for comprehensive assistance across all domains.
              </p>
            </div>
            
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-sm">
                <TabsTrigger value="all">All Subagents</TabsTrigger>
                <TabsTrigger value="single">Single Subagent</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-6 mt-6">
                <Tabs defaultValue="user" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 max-w-xs">
                    <TabsTrigger value="user">User Level</TabsTrigger>
                    <TabsTrigger value="project">Project Level</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="user" className="space-y-6 mt-6">
                    <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                      <p className="text-sm font-medium mb-1">User Installation</p>
                      <p className="text-sm text-muted-foreground">
                        Installs subagents globally, making them available in all your projects
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">macOS/Linux</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allSubagentsUser.mac, 2)}
                          >
                            {copiedIndex === 2 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allSubagentsUser.mac}</code>
                        </pre>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Windows</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allSubagentsUser.windows, 3)}
                          >
                            {copiedIndex === 3 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allSubagentsUser.windows}</code>
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="project" className="space-y-6 mt-6">
                    <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                      <p className="text-sm font-medium mb-1">Project Installation</p>
                      <p className="text-sm text-muted-foreground">
                        Installs subagents only for the current project
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">macOS/Linux</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allSubagentsProject.mac, 4)}
                          >
                            {copiedIndex === 4 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allSubagentsProject.mac}</code>
                        </pre>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Windows</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allSubagentsProject.windows, 5)}
                          >
                            {copiedIndex === 5 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allSubagentsProject.windows}</code>
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
              
              <TabsContent value="single" className="space-y-6 mt-6">
                <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                  <p className="text-sm font-medium mb-1">Manual Installation</p>
                  <p className="text-sm text-muted-foreground">
                    Replace <code className="bg-background px-1 rounded">subagent-name.md</code> with the actual filename
                  </p>
                  <p className="text-sm text-primary mt-2">
                    💡 Pro tip: Visit any subagent page for specific installation commands with the actual filename!
                  </p>
                </div>
                
                <Tabs defaultValue="user" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 max-w-xs">
                    <TabsTrigger value="user">User Level</TabsTrigger>
                    <TabsTrigger value="project">Project Level</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="user" className="space-y-4 mt-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">macOS/Linux</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleSubagentUser.mac, 6)}
                        >
                          {copiedIndex === 6 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleSubagentUser.mac}</code>
                      </pre>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Windows</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleSubagentUser.windows, 7)}
                        >
                          {copiedIndex === 7 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleSubagentUser.windows}</code>
                      </pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="project" className="space-y-4 mt-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">macOS/Linux</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleSubagentProject.mac, 8)}
                        >
                          {copiedIndex === 8 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleSubagentProject.mac}</code>
                      </pre>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Windows</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleSubagentProject.windows, 9)}
                        >
                          {copiedIndex === 9 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleSubagentProject.windows}</code>
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          {/* Commands Only Tab */}
          <TabsContent value="commands" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-3">Install Commands Only</h2>
              <p className="text-muted-foreground">
                Install the collection of 39+ slash commands for automation and productivity.
              </p>
            </div>
            
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-sm">
                <TabsTrigger value="all">All Commands</TabsTrigger>
                <TabsTrigger value="single">Single Command</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-6 mt-6">
                <Tabs defaultValue="user" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 max-w-xs">
                    <TabsTrigger value="user">User Level</TabsTrigger>
                    <TabsTrigger value="project">Project Level</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="user" className="space-y-6 mt-6">
                    <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                      <p className="text-sm font-medium mb-1">User Installation</p>
                      <p className="text-sm text-muted-foreground">
                        Installs commands globally, making them available in all your projects
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">macOS/Linux</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allCommandsUser.mac, 10)}
                          >
                            {copiedIndex === 10 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allCommandsUser.mac}</code>
                        </pre>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Windows</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allCommandsUser.windows, 11)}
                          >
                            {copiedIndex === 11 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allCommandsUser.windows}</code>
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="project" className="space-y-6 mt-6">
                    <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                      <p className="text-sm font-medium mb-1">Project Installation</p>
                      <p className="text-sm text-muted-foreground">
                        Installs commands only for the current project
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">macOS/Linux</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allCommandsProject.mac, 12)}
                          >
                            {copiedIndex === 12 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allCommandsProject.mac}</code>
                        </pre>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Windows</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 hover:bg-primary/10"
                            onClick={() => copyToClipboard(installCommands.allCommandsProject.windows, 13)}
                          >
                            {copiedIndex === 13 ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm font-mono">{installCommands.allCommandsProject.windows}</code>
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
              
              <TabsContent value="single" className="space-y-6 mt-6">
                <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                  <p className="text-sm font-medium mb-1">Manual Installation</p>
                  <p className="text-sm text-muted-foreground">
                    Replace <code className="bg-background px-1 rounded">command-name.md</code> with the actual filename
                  </p>
                  <p className="text-sm text-primary mt-2">
                    💡 Pro tip: Visit any command page for specific installation commands with the actual filename!
                  </p>
                </div>
                
                <Tabs defaultValue="user" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 max-w-xs">
                    <TabsTrigger value="user">User Level</TabsTrigger>
                    <TabsTrigger value="project">Project Level</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="user" className="space-y-4 mt-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">macOS/Linux</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleCommandUser.mac, 14)}
                        >
                          {copiedIndex === 14 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleCommandUser.mac}</code>
                      </pre>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Windows</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleCommandUser.windows, 15)}
                        >
                          {copiedIndex === 15 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleCommandUser.windows}</code>
                      </pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="project" className="space-y-4 mt-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">macOS/Linux</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleCommandProject.mac, 16)}
                        >
                          {copiedIndex === 16 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleCommandProject.mac}</code>
                      </pre>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Windows</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 hover:bg-primary/10"
                          onClick={() => copyToClipboard(installCommands.singleCommandProject.windows, 17)}
                        >
                          {copiedIndex === 17 ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="bg-background/50 border border-border/50 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono">{installCommands.singleCommandProject.windows}</code>
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
        
        {/* After Installation Section */}
        <div className="mt-12 p-6 bg-card/50 rounded-xl border border-border/50">
          <h3 className="text-lg font-semibold mb-4">After Installation</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <p className="font-medium mb-1">Restart Claude Code</p>
                <p className="text-sm text-muted-foreground">
                  Restart Claude Code to load the newly installed subagents and commands
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <p className="font-medium mb-1">Using Subagents</p>
                <p className="text-sm text-muted-foreground">
                  Subagents will be automatically invoked based on context, or you can call them explicitly using @ mentions
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <p className="font-medium mb-1">Using Commands</p>
                <p className="text-sm text-muted-foreground">
                  Invoke commands using the / prefix, e.g., <code className="bg-background px-1 rounded">/commit</code> or <code className="bg-background px-1 rounded">/todo add &quot;task&quot;</code>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                4
              </div>
              <div>
                <p className="font-medium mb-1">Verify Installation</p>
                <p className="text-sm text-muted-foreground">
                  Check installed files: <code className="bg-background px-1 rounded">ls ~/.claude/agents/</code> and <code className="bg-background px-1 rounded">ls ~/.claude/commands/</code>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Additional Resources */}
        <div className="mt-8 flex gap-4 flex-wrap">
          <Link href="/browse">
            <Button variant="outline" className="gap-2">
              Browse Subagents
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Button>
          </Link>
          <Link href="/commands">
            <Button variant="outline" className="gap-2">
              Browse Commands
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Button>
          </Link>
          <a 
            href="https://github.com/davepoon/buildwithclaude" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="gap-2">
              View on GitHub
              <ArrowLeft className="h-4 w-4 rotate-45" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}