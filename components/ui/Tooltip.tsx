import type { ReactNode } from 'react';

interface TooltipProps {
  /** Main explanation text */
  content: ReactNode;
  /** Optional formula line shown in a monospace block */
  formula?: string;
  /** Where the popover appears relative to the trigger. Default: 'top' */
  side?: 'top' | 'bottom';
  /** Max width class. Default: w-60 */
  width?: string;
  children?: ReactNode;
}

/**
 * Lightweight CSS-only tooltip. Wrap a label (or leave children empty to show
 * just the ⓘ info icon) and hover to reveal the explanation.
 *
 * Usage:
 *   <Tooltip content="Explanation" formula="metric = a / b">
 *     <span>Label</span>
 *   </Tooltip>
 *
 *   <span>Margin <Tooltip content="(Price − Cost) ÷ Price"/></span>
 */
export default function Tooltip({ content, formula, side = 'top', width = 'w-60', children }: TooltipProps) {
  const above = side === 'top';
  return (
    <span className="relative group/tt inline-flex items-center gap-1">
      {children}

      {/* Info icon (always rendered; only visible when no children, or as suffix) */}
      <span className="inline-flex items-center cursor-help text-slate-600 hover:text-slate-400 transition-colors shrink-0">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-3 h-3">
          <circle cx="7" cy="7" r="5.5"/>
          <path d="M7 6.5v3" strokeLinecap="round"/>
          <circle cx="7" cy="4.5" r="0.5" fill="currentColor" stroke="none"/>
        </svg>
      </span>

      {/* Popover */}
      <span
        className={[
          'pointer-events-none absolute left-1/2 -translate-x-1/2 z-[200]',
          above ? 'bottom-full mb-2' : 'top-full mt-2',
          width,
          'opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150',
          'rounded-lg border border-slate-700/80 bg-slate-950/95 backdrop-blur-sm shadow-xl px-3 py-2.5 text-left',
        ].join(' ')}
      >
        {/* Arrow */}
        <span
          className={[
            'absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border bg-slate-950',
            above
              ? 'top-full -mt-1 border-l-0 border-t-0 border-slate-700/80'
              : 'bottom-full -mb-1 border-r-0 border-b-0 border-slate-700/80',
          ].join(' ')}
        />

        <p className="text-[11px] leading-relaxed text-slate-300">{content}</p>

        {formula && (
          <div className="mt-1.5 rounded bg-slate-900 border border-slate-800 px-2 py-1">
            <code className="text-[10px] font-mono text-cyan-400 whitespace-pre-wrap">{formula}</code>
          </div>
        )}
      </span>
    </span>
  );
}
