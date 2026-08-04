import { WebPlugin } from '@capacitor/core';
import type { AddMarkersOptions, CreateMapOptions, MapboxMapsPlugin, SetCameraOptions } from './definitions';
/**
 * Web / Capacitor browser: native Mapbox Maps SDK is not available.
 * Callers should keep using DriverMapbox (mapbox-gl) on web.
 */
export declare class MapboxMapsWeb extends WebPlugin implements MapboxMapsPlugin {
    initialize(): Promise<void>;
    createMap(_options: CreateMapOptions): Promise<{
        id: string;
    }>;
    setCamera(_options: SetCameraOptions): Promise<void>;
    addMarkers(_options: AddMarkersOptions): Promise<void>;
    clearMarkers(): Promise<void>;
    removeMap(): Promise<void>;
    isNativeAvailable(): Promise<{
        available: boolean;
    }>;
}
