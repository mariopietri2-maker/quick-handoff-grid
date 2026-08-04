import { WebPlugin } from '@capacitor/core';
import type {
  AddMarkersOptions,
  CreateMapOptions,
  MapboxMapsPlugin,
  SetCameraOptions,
} from './definitions';

/**
 * Web / Capacitor browser: native Mapbox Maps SDK is not available.
 * Callers should keep using DriverMapbox (mapbox-gl) on web.
 */
export class MapboxMapsWeb extends WebPlugin implements MapboxMapsPlugin {
  async initialize(): Promise<void> {
    /* no-op on web */
  }

  async createMap(_options: CreateMapOptions): Promise<{ id: string }> {
    throw this.unavailable(
      'Native Mapbox Maps SDK is only available on Android. Use mapbox-gl (DriverMapbox) on web.',
    );
  }

  async setCamera(_options: SetCameraOptions): Promise<void> {
    throw this.unavailable('Native Mapbox not available on web');
  }

  async addMarkers(_options: AddMarkersOptions): Promise<void> {
    throw this.unavailable('Native Mapbox not available on web');
  }

  async clearMarkers(): Promise<void> {
    /* no-op */
  }

  async removeMap(): Promise<void> {
    /* no-op */
  }

  async isNativeAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }
}
