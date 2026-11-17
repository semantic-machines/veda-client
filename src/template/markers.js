/**
 * DOM markers shared by the template compiler and the renderer.
 *
 * The compiler inserts these markers into the static template; the renderer
 * resolves them back to Parts without relying on DOM paths. They live in one
 * module so Template.js and TemplateInstance.js cannot drift apart.
 *
 * Markers are randomized once per page load, like lit-html's `lit$<random>$`
 * marker: a value can never guess or forge one, and the element marker cannot
 * collide with an attribute authored by an application. Values are no longer
 * spliced into template markup at all (see Template.js), so this is defence in
 * depth on top of that rule.
 */

const TOKEN = Math.random().toString(36).slice(2, 10);

/** Attribute that groups every Part belonging to one element of a template. */
export const ELEMENT_MARKER = `data-veda-el-${TOKEN}`;

/** Attribute name prefix for a `${attrs}` element slot (a spread Part). */
export const SPREAD_MARKER_PREFIX = `data-veda-spread-${TOKEN}-`;

// The marker suffix is the interpolation index, not the ordinal spread slot:
// a spread Part must read the value that was authored at its position even
// when other `${}` values precede it in the same template.

/** Text marker that anchors a ChildPart. */
export const TEXT_MARKER_PREFIX = `\uE000veda$${TOKEN}$`;
export const TEXT_MARKER_SUFFIX = '\uE001';
export const TEXT_MARKER_RE = new RegExp(
  `^\\uE000veda\\$${TOKEN}\\$(\\d+)\\uE001$`,
);

/** True when the attribute name is one the compiler generated for a spread. */
export function isSpreadMarker (name) {
  return name.startsWith(SPREAD_MARKER_PREFIX);
}

/** Interpolation index encoded in a spread marker attribute name. */
export function spreadValueIndexOf (name) {
  return Number(name.slice(SPREAD_MARKER_PREFIX.length));
}
