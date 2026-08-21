package com.freshdelivery.nativedriver.ui.map

import com.mapbox.geojson.Point

/**
 * Optional traffic-signal markers along a route.
 * Stub returns empty list so navigation works without the full next-wave implementation.
 */
suspend fun fetchTrafficSignals(routePoints: List<Point>): List<Point> {
    return emptyList()
}
