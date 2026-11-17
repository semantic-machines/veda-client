/**
 * Late-bound factories for declarative component upgrades.
 *
 * TemplateInstance must create customized built-ins (loop/if/property/relation/
 * inline component) but importing those modules directly would create a cycle
 * (Component -> Template -> TemplateInstance -> Component). Each built-in module
 * registers its factory here; TemplateInstance reads the registry at runtime.
 */
export const factories = {
  Component: null,
  Loop: null,
  If: null,
  Property: null,
  Relation: null,
};
