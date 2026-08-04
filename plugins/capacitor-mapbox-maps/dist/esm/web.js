import { WebPlugin } from '@capacitor/core';
/**
 * Web / Capacitor browser: native Mapbox Maps SDK is not available.
 * Callers should keep using DriverMapbox (mapbox-gl) on web.
 */
export class MapboxMapsWeb extends WebPlugin {
    async initialize() {
        /* no-op on web */
    }
    async createMap(_options) {
        throw this.unavailable('Native Mapbox Maps SDK is only available on Android. Use mapbox-gl (DriverMapbox) on web.');
    }
    async setCamera(_options) {
        throw this.unavailable('Native Mapbox not available on web');
    }
    async addMarkers(_options) {
        throw this.unavailable('Native Mapbox not available on web');
    }
    async clearMarkers() {
        /* no-op */
    }
    async removeMap() {
        /* no-op */
    }
    async isNativeAvailable() {
        return { available: false };
    }
}
//# sourceMappingURL=web.js.map