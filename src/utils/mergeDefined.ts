// Merge only the defined fields of a partial update into an existing object.
// Used for the song save/update merge strategy: callers may pass partial
// SongData objects where undefined means "leave the existing value untouched".

/** Return a copy of `base` with all defined (non-undefined) fields of
 *  `update` applied. */
export function mergeDefined<T extends object>(base: T, update: T): T {
  const defined = Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  );
  return { ...base, ...defined };
}
