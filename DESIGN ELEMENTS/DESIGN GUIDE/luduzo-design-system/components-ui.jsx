/* =========================================================
   LUDUZO — UI component library (canonical implementations)
   Drop into components/ui/. Requires the Tailwind config in
   design-system/tailwind.config.js and Montserrat + JetBrains Mono
   loaded (see README). Tailwind-only; no external UI deps.
   ========================================================= */

import React from 'react';

/* ---------- Button ---------- */
export function Button({ variant = 'secondary', children, className = '', ...props }) {
  const base =
    'inline-flex items-center gap-2 font-display font-semibold text-sm rounded-md ' +
    'px-4 py-2.5 transition-colors duration-base cursor-pointer disabled:opacity-50 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';
  const variants = {
    gold: 'bg-gold text-black border border-gold hover:bg-gold-hover',
    secondary: 'bg-onyx text-bone border border-iron hover:bg-onyx-2 hover:border-iron-2',
    ghost: 'bg-transparent text-ash hover:text-bone hover:bg-onyx border border-transparent',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ hero = false, children, className = '' }) {
  const surface = hero
    ? 'bg-gold-gradient border-gold-line'
    : 'bg-onyx border-iron';
  return (
    <div className={`border rounded-lg p-6 ${surface} ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, action, href = '#' }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[15px] font-bold text-bone">{title}</h2>
      {action && (
        <a href={href} className="text-sm font-semibold text-gold hover:underline">
          {action}
        </a>
      )}
    </div>
  );
}

/* ---------- StatBlock ----------
   Big metric with eyebrow label + optional delta.
   hero=true applies the gold-gradient occupancy treatment.       */
export function StatBlock({ label, value, unit, delta, deltaDir, hero = false, children }) {
  const deltaColor = deltaDir === 'up' ? 'text-win' : deltaDir === 'down' ? 'text-loss' : 'text-ash';
  const arrow = deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '';
  return (
    <div className={`rounded-md p-5 border ${hero ? 'bg-gold-gradient border-gold-line' : 'bg-onyx border-iron'}`}>
      <div className="text-xs font-semibold text-ash uppercase tracking-label">{label}</div>
      <div className="mt-2 text-stat font-mono text-bone">
        {value}
        {unit && <span className="text-base text-ash font-semibold ml-1">{unit}</span>}
      </div>
      {delta && (
        <div className={`mt-2 text-xs font-mono font-semibold ${deltaColor}`}>
          {arrow} {delta}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- Progress bar (e.g. occupancy) ---------- */
export function ProgressBar({ pct, className = '' }) {
  return (
    <div className={`h-1.5 rounded-pill bg-iron overflow-hidden ${className}`}>
      <div className="h-full rounded-pill bg-gold-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- StatusPill ----------
   Colored dot + label. Never color alone.                        */
const STATUS = {
  active:  { color: 'bg-win',  text: 'text-win',  label: 'Active' },
  risk:    { color: 'bg-warn', text: 'text-warn', label: 'At risk' },
  overdue: { color: 'bg-loss', text: 'text-loss', label: 'Overdue' },
  frozen:  { color: 'bg-ash',  text: 'text-ash',  label: 'Frozen' },
};
export function StatusPill({ status, live = false, label }) {
  const s = STATUS[status] ?? STATUS.frozen;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`w-[7px] h-[7px] rounded-full ${s.color} ${live ? 'animate-pulse' : ''}`} />
      {label ?? s.label}
    </span>
  );
}

/* ---------- PlanBadge ---------- */
const PLAN = {
  warrior:   'bg-gold-dim text-plan-warrior',
  gladiator: 'bg-[rgba(159,122,234,0.15)] text-plan-gladiator',
  rookie:    'bg-iron text-plan-rookie',
};
export function PlanBadge({ plan = 'rookie', children }) {
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-md ${PLAN[plan]}`}>
      {children ?? plan[0].toUpperCase() + plan.slice(1)}
    </span>
  );
}

/* ---------- AlertItem (needs-attention) ---------- */
export function AlertItem({ icon, title, subtext, href = '#' }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-3.5 rounded-md bg-gold-dim border border-gold-line mb-2.5 last:mb-0 transition-colors hover:bg-[rgba(245,197,24,0.2)]"
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-sm font-semibold text-bone">
        {title}
        {subtext && <span className="block font-medium text-ash text-xs mt-0.5">{subtext}</span>}
      </span>
      <span className="text-gold text-lg">→</span>
    </a>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ initials, color = '#F5C518', size = 38 }) {
  return (
    <span
      className="rounded-full grid place-items-center font-bold text-black shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

/* ---------- DataTable ----------
   Rows are clickable (drill to detail); gold arrow reveals on hover. */
export function DataTable({ columns, children }) {
  return (
    <div className="bg-onyx border border-iron rounded-lg overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className="text-left text-[11px] font-bold uppercase tracking-label text-ash px-4.5 py-3.5 border-b border-iron bg-onyx-2"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({ children, onClick }) {
  return (
    <tr
      onClick={onClick}
      className="group border-b border-iron last:border-0 transition-colors hover:bg-onyx-2 cursor-pointer"
    >
      {children}
    </tr>
  );
}

export function Cell({ children, className = '' }) {
  return <td className={`px-4.5 py-3.5 text-sm align-middle ${className}`}>{children}</td>;
}

/* Reveal-on-hover drill arrow, place in the last cell */
export function RowArrow() {
  return <td className="px-4.5 py-3.5 text-right text-ash-dim group-hover:text-gold">→</td>;
}
