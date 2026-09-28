// Shared styles of the songbook editor toolbar, matching the notation panel's controls bar.

/** Bar container around all groups; self-start keeps it content-wide like the notation bar */
export const TOOLBAR_CLASS = 'self-start bg-slate-800 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3';

/** Related controls within the bar */
export const TOOLBAR_GROUP_CLASS = 'flex flex-wrap items-center gap-2';

/** Vertical line between groups */
export const TOOLBAR_DIVIDER_CLASS = 'w-px h-6 bg-slate-600 mx-1';

export const TOOLBAR_BUTTON_CLASS = `px-2 py-1 text-xs font-mono bg-slate-700 hover:bg-slate-600
                                     text-slate-300 rounded transition-colors
                                     disabled:opacity-30 disabled:cursor-not-allowed`;

export const TOOLBAR_SELECT_CLASS = `bg-slate-800 text-slate-200 text-xs font-mono rounded
                                     px-2 py-1 border border-slate-600 focus:border-indigo-500
                                     outline-none cursor-pointer`;