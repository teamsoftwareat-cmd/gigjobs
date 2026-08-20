import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Modal } from './index'

const createPinIcon = (color) => L.divIcon({
  className: 'custom-pin-icon',
  html: `
    <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C7.372 0 2 5.372 2 12c0 9.389 12 26 12 26s12-16.611 12-26C26 5.372 20.628 0 14 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="12" r="5" fill="#ffffff"/>
    </svg>
  `,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
})

export function MapModal({ isOpen, onClose, markers = [], title }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    if (!containerRef.current) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    mapRef.current = L.map(containerRef.current, {
      center: [0, 0],
      zoom: 2,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current)

    const layerGroup = L.layerGroup().addTo(mapRef.current)
    const bounds = []

    const markerIcons = {
      project: createPinIcon('#DC3545'),
      checkin: createPinIcon('#0E7C86'),
      checkout: createPinIcon('#28A745'),
    }

    const addMarker = (marker) => {
      if (!Number.isFinite(marker.latitude) || !Number.isFinite(marker.longitude)) return
      const icon = markerIcons[marker.type] || createPinIcon('#0A74DA')
      const leafletMarker = L.marker([marker.latitude, marker.longitude], { icon }).addTo(layerGroup)
      if (marker.label) {
        let popupText = marker.label
        if (Number.isFinite(marker.distance_km)) {
          popupText += ` (${marker.distance_km.toFixed(1)} km)`
        }
        leafletMarker.bindPopup(popupText)
      }
      bounds.push([marker.latitude, marker.longitude])
    }

    const projectMarker = markers.find((marker) => marker.type === 'project')
    const checkInMarker = markers.find((marker) => marker.type === 'checkin')
    const checkOutMarker = markers.find((marker) => marker.type === 'checkout')

    markers.forEach(addMarker)

    const addConnection = (from, to, color) => {
      if (!from || !to) return
      L.polyline(
        [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ],
        { color, dashArray: '10,10', weight: 3 }
      ).addTo(layerGroup)
      bounds.push([from.latitude, from.longitude], [to.latitude, to.longitude])
    }

    addConnection(projectMarker, checkInMarker, '#0E7C86')
    addConnection(projectMarker, checkOutMarker, '#28A745')

    if (bounds.length) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
      setTimeout(() => mapRef.current.invalidateSize(), 100)
    }

    return () => {
      layerGroup.clearLayers()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [isOpen, markers])

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Location map'}>
      <div style={{ minWidth: 320, minHeight: 420 }}>
        <div ref={containerRef} className="map-modal-frame" />
      </div>
    </Modal>
  )
}
