"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { GitHubLogoIcon, HamburgerMenuIcon, Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Bot, Package, Palette, Server, Sparkles, SquareTerminal, Store, Webhook } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/global-search";
import { useGlobalSearchShortcut } from "@/hooks/use-global-search-shortcut";

// The eight content catalogs live under one "Browse" entry point.
const browseLinks = [
  { href: "/plugins", label: "Plugins", description: "Bundled agents, commands, and hooks", icon: Package },
  { href: "/skills", label: "Skills", description: "Reusable Claude Code skills", icon: Sparkles },
  { href: "/subagents", label: "Subagents", description: "Specialized AI agents", icon: Bot },
  { href: "/commands", label: "Commands", description: "Custom slash commands", icon: SquareTerminal },
  { href: "/hooks", label: "Hooks", description: "Event-driven automations", icon: Webhook },
  { href: "/mcp-servers", label: "MCP Servers", description: "Model Context Protocol servers", icon: Server },
  { href: "/themes", label: "Themes", description: "Desktop and terminal themes", icon: Palette },
  { href: "/marketplaces", label: "Marketplaces", description: "Community plugin registries", icon: Store },
];

// Genuinely different sections stay as direct top-level links.
const directLinks = [
  { href: "/stories", label: "Stories" },
  { href: "/contribute", label: "Contribute" },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const pathname = usePathname();

  const openSearch = useCallback(() => setSearchOpen(true), []);
  useGlobalSearchShortcut(openSearch);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  const browseActive = browseLinks.some((link) => pathname === link.href);

  const directLinkClass = (isActive: boolean) =>
    cn(
      "px-3 py-1.5 text-sm transition-colors rounded-md",
      isActive
        ? "text-primary bg-primary/10 font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
    );

  return (
    <>
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-medium text-foreground hover:text-primary transition-colors">
                Build with Claude
              </Link>
              <div className="hidden lg:flex items-center gap-1">
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger
                        className={cn(
                          "h-auto bg-transparent px-3 py-1.5 text-sm font-normal rounded-md",
                          browseActive
                            ? "text-primary bg-primary/10 font-medium hover:bg-primary/10 hover:text-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-muted/50 data-[state=open]:text-foreground",
                        )}
                      >
                        Browse
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[34rem] grid-cols-2 gap-1 p-3">
                          {browseLinks.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                              <li key={item.href}>
                                <NavigationMenuLink asChild>
                                  <Link
                                    href={item.href}
                                    className={cn(
                                      "group flex items-start gap-3 rounded-md p-2.5 transition-colors",
                                      isActive ? "bg-primary/10" : "hover:bg-muted/60",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40",
                                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                                      )}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                      <span
                                        className={cn(
                                          "block text-sm font-medium",
                                          isActive ? "text-primary" : "text-foreground",
                                        )}
                                      >
                                        {item.label}
                                      </span>
                                      <span className="block text-xs leading-snug text-muted-foreground">
                                        {item.description}
                                      </span>
                                    </span>
                                  </Link>
                                </NavigationMenuLink>
                              </li>
                            );
                          })}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>

                {directLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={directLinkClass(pathname === link.href)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Desktop search trigger (faux input) */}
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search"
                className="hidden lg:flex items-center gap-2 h-8 w-56 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Search…</span>
                <kbd className="pointer-events-none hidden xl:inline-flex items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  {isMac ? "⌘" : "Ctrl"} K
                </kbd>
              </button>
              {/* Mobile search icon */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 w-8 p-0"
                onClick={openSearch}
                aria-label="Search"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 w-8 p-0"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <HamburgerMenuIcon className="h-4 w-4" />
              </Button>
              <a
                href="https://github.com/davepoon/buildwithclaude"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
                  <GitHubLogoIcon className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">GitHub</span>
                </Button>
              </a>
              <a
                href="https://github.com/davepoon/buildwithclaude"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://img.shields.io/github/stars/davepoon/buildwithclaude.svg?style=social&label=Star"
                  alt="GitHub stars"
                  className="h-5"
                />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Global search palette (⌘K / Ctrl-K) */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Mobile Menu */}
      <DialogPrimitive.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-y-0 right-0 z-50 h-full w-full max-w-xs bg-background border-l border-border duration-200",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            )}
          >
            <DialogPrimitive.Title className="sr-only">Navigation Menu</DialogPrimitive.Title>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border p-4">
                <Link
                  href="/"
                  className="font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Build with Claude
                </Link>
                <DialogPrimitive.Close className="rounded-sm opacity-70 hover:opacity-100">
                  <Cross2Icon className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>

              <nav className="flex-1 overflow-y-auto p-4">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Browse</p>
                <div className="space-y-1">
                  {browseLinks.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                          isActive
                            ? "text-primary bg-primary/10 font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="my-3 border-t border-border" />

                <div className="space-y-1">
                  {directLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "block px-3 py-2 text-sm rounded-md transition-colors",
                          isActive
                            ? "text-primary bg-primary/10 font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              <div className="border-t border-border p-4 space-y-3">
                <a
                  href="https://github.com/davepoon/buildwithclaude"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full justify-center gap-2">
                    <GitHubLogoIcon className="h-4 w-4" />
                    View on GitHub
                  </Button>
                </a>
                <div className="flex justify-center">
                  <a
                    href="https://github.com/davepoon/buildwithclaude"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://img.shields.io/github/stars/davepoon/buildwithclaude.svg?style=social&label=Star"
                      alt="GitHub stars"
                      className="h-5"
                    />
                  </a>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
