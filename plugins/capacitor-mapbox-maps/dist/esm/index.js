import { registerPlugin } from '@capacitor/core';
import { MapboxMapsWeb } from './web';
const MapboxMaps = registerPlugin('MapboxMaps', {
    web: () => new MapboxMapsWeb(),
});
export * from './definitions';
export { MapboxMaps };
//# sourceMappingURL=index.js.map