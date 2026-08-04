export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Optional emoji / short label shown on the pin */
  title?: string;
  color?: string;
}

export interface CreateMapOptions {
  /** Unique map id (reuse to update the same native view). */
  id?: string;
  /** Public Mapbox access token (pk.*). Falls back to native BuildConfig if omitted. */
  accessToken?: string;
  center?: LatLng;
  zoom?: number;
  /** Mapbox style URI. Default: mapbox://styles/mapbox/streets-v12 */
  styleUri?: string;
  /** When true, open a full-screen native MapActivity (recommended v1). */
  fullScreen?: boolean;
  markers?: MapMarker[];
}

export interface SetCameraOptions {
  id?: string;
  center: LatLng;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  animated?: boolean;
}

export interface AddMarkersOptions {
  id?: string;
  markers: MapMarker[];
}

export interface MapboxMapsPlugin {
  /** Set the public token used by the Maps SDK (call once at app start). */
  initialize(options: { accessToken: string }): Promise<void>;

  /**
   * Create / show a native Mapbox map.
   * Android: fullScreen opens MapActivity; otherwise a native MapView is attached
   * behind the WebView (experimental — prefer fullScreen for v1).
   */
  createMap(options: CreateMapOptions): Promise<{ id: string }>;

  setCamera(options: SetCameraOptions): Promise<void>;

  addMarkers(options: AddMarkersOptions): Promise<void>;

  clearMarkers(options?: { id?: string }): Promise<void>;

  removeMap(options?: { id?: string }): Promise<void>;

  /** True when the native Android/iOS implementation is available. */
  isNativeAvailable(): Promise<{ available: boolean }>;
}
