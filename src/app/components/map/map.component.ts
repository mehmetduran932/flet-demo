import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {
  private map: any;
  private markersData: { [key: string]: any } = {};
  private markers: { [key: string]: L.Marker } = {};
  private polylines: { [key: string]: L.Polyline } = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.initMap();
    this.getApi();
    setInterval(() => this.getApi(), 5000);
  }

  private initMap(): void {
    this.map = L.map('map').setView([39.9334, 32.8597], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
  }

  private customIcon(rotationAngle: number): L.DivIcon {
    return L.divIcon({
      html: `<div style="transform: rotate(${rotationAngle}deg);">
               <img src="assets/images/plane-icon.png" style="width: 20px; height: 20px;">
             </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      className: ''
    });
  }

  private getApi(): void {
    this.http.get('https://api.adsb.lol/v2/ladd').subscribe((res: any) => {
      const planes = res.ac;
      planes.forEach((plane: any) => {
        if (!this.markersData[plane.hex]) {
          this.markersData[plane.hex] = {
            hex: plane.hex,
            flight: plane.flight,
            lat: plane.lat,
            lon: plane.lon,
            previousLat: null,
            previousLng: null,
            rotationAngle: 0
          };
        } else {
          const markerData = this.markersData[plane.hex];
          const previousLat = markerData.lat;
          const previousLng = markerData.lon;

          markerData.lat = plane.lat;
          markerData.lon = plane.lon;
          markerData.previousLat = previousLat;
          markerData.previousLng = previousLng;
          this.updateMarker(markerData);
        }
      });
    });
  }

  private updateMarker(markerData: any): void {
    const newLat = markerData.lat;
    const newLng = markerData.lon;

    if (newLat === undefined || newLng === undefined) {
      console.error(`Invalid coordinates for hex: ${markerData.hex}`);
      return;
    }

    console.log(`Updating marker ${markerData.hex} to new position: ${newLat}, ${newLng}`);

    const marker = this.markers[markerData.hex];
    if (marker) {
      const previousLat = markerData.previousLat;
      const previousLng = markerData.previousLng;

      if (previousLat !== null && previousLng !== null) {
        const rotationAngle = this.calculateBearing(previousLat, previousLng, newLat, newLng);
        markerData.rotationAngle = rotationAngle;
      }

      markerData.previousLat = newLat;
      markerData.previousLng = newLng;

      marker.setLatLng([newLat, newLng]);
      marker.setIcon(this.customIcon(markerData.rotationAngle));

      const polyline = this.polylines[markerData.hex];
      if (polyline) {
        const latlngs = polyline.getLatLngs() as L.LatLng[];
        latlngs.push(new L.LatLng(newLat, newLng));
        polyline.setLatLngs(latlngs);
      } else {
        const newPolyline = L.polyline([new L.LatLng(newLat, newLng)], { color: 'blue' }).addTo(this.map);
        this.polylines[markerData.hex] = newPolyline;
      }
    } else {
      const newMarker = L.marker([newLat, newLng], { icon: this.customIcon(0) });
      newMarker.bindPopup(markerData.flight);
      newMarker.addTo(this.map);
      this.markers[markerData.hex] = newMarker;

      const newPolyline = L.polyline([new L.LatLng(newLat, newLng)], { color: 'blue' }).addTo(this.map);
      this.polylines[markerData.hex] = newPolyline;

      markerData.previousLat = newLat;
      markerData.previousLng = newLng;
    }
  }

  private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRadians = (deg: number) => deg * Math.PI / 180;
    const toDegrees = (rad: number) => rad * 180 / Math.PI;

    const dLng = toRadians(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRadians(lat2));
    const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
      Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLng);
    const bearing = Math.atan2(y, x);
    return (toDegrees(bearing) + 360) % 360;
  }
}
