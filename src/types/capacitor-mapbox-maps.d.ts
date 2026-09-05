/**
 * Ambient module declaration for the local Capacitor Mapbox Maps plugin
 * (`@fresh2go/capacitor-mapbox-maps`), a `file:` dependency that is not
 * always present in root `node_modules` during `tsc`. Re-export the plugin's
 * own published types so they cannot drift from the real implementation.
 */
declare module '@fresh2go/capacitor-mapbox-maps' {
  export * from '../../plugins/capacitor-mapbox-maps/dist/esm';
  import { MapboxMaps } from '../../plugins/capacitor-mapbox-maps/dist/esm';
  export { MapboxMaps };
}