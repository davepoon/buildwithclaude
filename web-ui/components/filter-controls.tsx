'use client'

import { useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, Check, ChevronDown, ChevronsUpDown, X, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
  count?: number
}

// Site header height, and the dock zone under it where the page h1 settles
const HEADER = 56
const DOCK = 44
// Scroll distance before the band pins over which the title docks (matches globals.css)
const DOCK_RANGE = 100

// One shared formatter for all counts
const NUMBER = new Intl.NumberFormat('en-US')
const formatCount = (n: number) => NUMBER.format(n)

// Full-bleed fill (box-shadow spread clipped to the row) that does not widen the page
const bandFill = (color: string) => ({
  background: color,
  boxShadow: `0 0 0 100vmax ${color}`,
  clipPath: 'inset(0 -100vmax)',
})
// Static page-colored background: invisible until content scrolls under it, correct from first paint
const BAND_BG = bandFill('hsl(var(--background))')

/**
 * Page h1 that docks into the sticky filter area: it sticks under the header and its content
 * scales and moves into the dock zone as the page scrolls (driven by FilterBar).
 */
export function FilterHeading({ children }: { children: ReactNode }) {
  return (
    <h1 data-dock-heading className="text-display-2 mb-2 sticky top-14 z-10 pointer-events-none">
      {/* Opaque area around the title (title plus 12px); moves up with it so its edge ends at the dock zone */}
      <span
        aria-hidden
        data-dock-bg
        className="absolute inset-x-0 top-0 -z-10 will-change-transform"
        style={{ ...BAND_BG, height: 'calc(1.2em + 12px)' }}
      />
      <span data-dock-inner className="flex items-center gap-3 origin-top-left will-change-transform">
        {children}
      </span>
    </h1>
  )
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Shared filter bar, sticky under the header (and under the docked h1 when the page has one).
 *  Scroll effects write only transform and opacity, so the layout never changes. */
export function FilterBar({ children, className, dock = true }: { children: ReactNode; className?: string; dock?: boolean }) {
  const markRef = useRef<HTMLSpanElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  // Docking runs in CSS on a view timeline (globals.css), computed by the browser from the first paint.
  // This fallback only runs where scroll-driven animations are not supported.
  useLayoutEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()')) return
    const mark = markRef.current
    const border = layerRef.current
    if (!mark || !border) return
    const offset = dock ? HEADER + DOCK : HEADER
    const heading = dock ? document.querySelector<HTMLElement>('[data-dock-heading]') : null
    const inner = heading?.querySelector<HTMLElement>('[data-dock-inner]') ?? null
    const area = heading?.querySelector<HTMLElement>('[data-dock-bg]') ?? null
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let pinY = 1
    let fs = 0
    let scale = 1
    let titleShift = 0
    let titleLift = 0
    let areaShift = 0
    let areaLift = 0

    const apply = () => {
      const y = window.scrollY
      const step = (v: number) => (reduce ? (v >= 1 ? 1 : 0) : v)
      border.style.opacity = String(step(clamp01((y - pinY + 8) / 8)))
      if (!inner || !area) return
      const p = step(clamp01((y - pinY + DOCK_RANGE) / DOCK_RANGE))
      inner.style.transform = `translateY(${p * (titleShift - titleLift * scale * fs)}px) scale(${1 + p * (scale - 1)})`
      area.style.transform = `translateY(${p * (areaShift - areaLift * fs)}px)`
    }
    const measure = () => {
      pinY = Math.max(1, mark.getBoundingClientRect().top + window.scrollY - offset)
      if (heading && inner) {
        // Keyframe values come from the custom properties in globals.css
        const css = getComputedStyle(heading)
        const read = (name: string) => parseFloat(css.getPropertyValue(name))
        fs = parseFloat(getComputedStyle(inner).fontSize)
        scale = read('--dock-scale')
        titleShift = read('--dock-title-shift')
        titleLift = read('--dock-title-lift')
        areaShift = read('--dock-area-shift')
        areaLift = read('--dock-area-lift')
      }
      apply()
    }

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; apply() })
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(document.body)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [dock])

  return (
    <>
      {/* Zero-height marker at the band's flow position; it drives the CSS view timeline */}
      <span ref={markRef} aria-hidden data-dock-band-mark className="block h-0" />
      <div
        className={cn('sticky z-20 pb-3 mb-3', dock ? 'top-[100px] [--dock-offset:100px]' : 'top-14 pt-3 [--dock-offset:56px]', className)}
      >
        {/* Static band background */}
        <div aria-hidden className="absolute inset-0 -z-10" style={BAND_BG} />
        {/* Bottom border, faded in by scroll position as the band pins */}
        <div
          ref={layerRef}
          aria-hidden
          data-dock-band-bg
          className="absolute inset-x-0 -bottom-px h-px opacity-0"
          style={bandFill('hsl(0 0% 12%)')}
        />
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </>
  )
}

/** Search slot: full first row below lg, fills the remaining row space from lg. */
export function FilterSearch({ children }: { children: ReactNode }) {
  return <div className="relative w-full lg:w-auto lg:flex-1 lg:min-w-60">{children}</div>
}

// Panel opens from the trigger's left edge, or from its right edge when there is no room on the right
function usePanelAlign() {
  const ref = useRef<HTMLButtonElement>(null)
  const [align, setAlign] = useState<'start' | 'end'>('start')
  const update = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setAlign(r.left + Math.max(r.width, 300) > window.innerWidth - 8 ? 'end' : 'start')
  }
  return { ref, align, update }
}

// Trigger: content width, 12px side padding, 8px gaps, 36px tall, label wraps only if wider than the row
const TRIGGER = 'w-auto max-w-full h-auto min-h-9 py-1.5 px-3 gap-2 justify-start bg-card border-border group'
// Panel: aligned to the trigger, at least its width, as wide as the longest row, inside the viewport
const PANEL = 'w-auto min-w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-16px)] p-0'
// Option count: right-aligned, 12px after the name with the row's 8px gap
const COUNT = 'ml-1 text-xs tabular-nums text-muted-foreground group-data-[selected=true]:text-accent-foreground transition-colors'

function optionText(option: FilterOption) {
  return option.count === undefined ? option.label : `${option.label} (${formatCount(option.count)})`
}

interface SingleSelectFilterProps {
  icon: ComponentType<{ className?: string }>
  /** 'all' selects the all option */
  value: string
  options: FilterOption[]
  /** Name of the all option, e.g. "All Sources" */
  allLabel: string
  allCount: number
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  onChange: (value: string) => void
}

/** Single-select combobox, as used for sources on /plugins. */
export function SingleSelectFilter({
  icon: Icon,
  value,
  options,
  allLabel,
  allCount,
  placeholder,
  searchPlaceholder,
  emptyText,
  onChange,
}: SingleSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const { ref: triggerRef, align: panelAlign, update: updateAlign } = usePanelAlign()
  const selected = options.find(o => o.value === value)
  const display = value === 'all' ? `${allLabel} (${formatCount(allCount)})` : selected ? optionText(selected) : placeholder

  const select = (next: string) => {
    setOpen(false)
    onChange(next)
  }

  return (
    <Popover open={open} onOpenChange={(next) => { if (next) updateAlign(); setOpen(next) }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          ref={triggerRef}
          role="combobox"
          aria-expanded={open}
          aria-label={display}
          className={TRIGGER}
        >
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          <span className="whitespace-normal text-left">{display}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={panelAlign}
        collisionPadding={8}
        className={PANEL}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all" className="group" onSelect={() => select('all')}>
                <Check className={cn("h-4 w-4", value === 'all' ? "opacity-100" : "opacity-0")} />
                <span className="flex-1">{allLabel}</span>
                <span className={COUNT}>({formatCount(allCount)})</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  className="group"
                  onSelect={() => select(option.value)}
                >
                  <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined && <span className={COUNT}>({formatCount(option.count)})</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface CategoryOption {
  value: string
  /** Shown name; falls back to formatLabel(value) */
  label?: string
  count: number
}

interface CategoryFilterProps {
  selected: string[]
  options: CategoryOption[]
  formatLabel?: (value: string) => string
  onChange: (next: string[]) => void
  /** Single-select: a pick replaces the current pill */
  single?: boolean
}

/** Category filter, multi-select or single with `single`, with removable pills. */
export function CategoryFilter({ selected, options, formatLabel, onChange, single = false }: CategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const { ref: triggerRef, align: panelAlign, update: updateAlign } = usePanelAlign()
  const optionByValue = useMemo(() => new Map(options.map(o => [o.value, o])), [options])
  const labelFor = (option: Pick<CategoryOption, 'value' | 'label'>) => option.label ?? formatLabel?.(option.value) ?? option.value
  const labelOf = (value: string) => labelFor(optionByValue.get(value) ?? { value })

  return (
    // Fragment: the button joins the filter bar's controls, pills take the next line
    <>
      {/* Category combobox */}
      <Popover open={open} onOpenChange={(next) => { if (next) updateAlign(); setOpen(next) }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            ref={triggerRef}
            role="combobox"
            aria-expanded={open}
            aria-label={selected.length === 0 ? 'Filter by categories' : 'Add category'}
            className={cn(TRIGGER, 'border-dashed')}
          >
            <Tags className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {selected.length === 0 ? 'Filter by categories' : 'Add category'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={panelAlign}
          collisionPadding={8}
          className={PANEL}
        >
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                {selected.length > 0 && (
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                    Clear all filters
                  </CommandItem>
                )}
                {options.map((option) => {
                  const isSelected = selected.includes(option.value)
                  const label = labelFor(option)
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${label} ${option.value}`}
                      className="group"
                      onSelect={() => {
                        if (single) {
                          onChange(isSelected ? [] : [option.value])
                          setOpen(false)
                          return
                        }
                        onChange(isSelected
                          ? selected.filter(c => c !== option.value)
                          : [...selected, option.value])
                      }}
                    >
                      {/* Check slot only once something is selected */}
                      {selected.length > 0 && (
                        <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      )}
                      <span className="flex-1">{label}</span>
                      <span className={COUNT}>({formatCount(option.count)})</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected category pills on their own line, after the button in tab order */}
      {selected.length > 0 && (
        <div className="w-full flex flex-wrap items-center gap-2">
          {selected.map((value) => {
            const option = optionByValue.get(value)
            const label = labelOf(value)
            return (
              <Badge
                key={value}
                variant="secondary"
                className="pl-2 pr-1 py-1 gap-1 text-sm bg-primary/10 text-primary border-primary/20"
              >
                {label}
                {option && <span className="text-xs opacity-70">({formatCount(option.count)})</span>}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => {
                    onChange(selected.filter(c => c !== value))
                    // Keep keyboard focus in the filter instead of losing it with the removed pill
                    triggerRef.current?.focus()
                  }}
                  className="ml-1 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </>
  )
}

interface SortSelectProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

/** Sort dropdown: non-modal popover list, so the page keeps scrolling while it is open. */
export function SortSelect({ value, options, onChange }: SortSelectProps) {
  const [open, setOpen] = useState(false)
  const { ref: triggerRef, align: panelAlign, update: updateAlign } = usePanelAlign()
  const listRef = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  return (
    <Popover open={open} onOpenChange={(next) => { if (next) updateAlign(); setOpen(next) }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          ref={triggerRef}
          role="combobox"
          aria-expanded={open}
          aria-label={current ? `Sort by ${current.label}` : 'Sort by'}
          className={cn(TRIGGER, 'font-normal')}
        >
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="whitespace-normal text-left">{current?.label ?? 'Sort by'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={panelAlign}
        collisionPadding={8}
        className={PANEL}
        // Focus the list so arrow keys and Enter work without a search box
        onOpenAutoFocus={(e) => { e.preventDefault(); listRef.current?.focus() }}
      >
        <Command ref={listRef} tabIndex={-1} defaultValue={current?.label} loop className="outline-none">
          <CommandList>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  className="group"
                  onSelect={() => {
                    setOpen(false)
                    onChange(option.value)
                  }}
                >
                  <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
