import { registerPlugin } from '@capacitor/core';
import type { MapboxMapsPlugin } from './definitions';
import { MapboxMapsWeb } from './web';

const MapboxMaps = registerPlugin<MapboxMapsPlugin>('MapboxMaps', {
  web: () => new MapboxMapsWeb(),
});

export * from './definitions';
export { MapboxMaps };
