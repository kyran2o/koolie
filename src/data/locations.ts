import { LocationPoint } from '../types/koolie';

export const KERALA_LOCATIONS: LocationPoint[] = [
  { name: 'Vaikom', district: 'Kottayam', lat: 9.7495, lng: 76.3944, isPrimary: true },
  { name: 'Kottayam', district: 'Kottayam', lat: 9.5916, lng: 76.5222, isPrimary: true },
  { name: 'Ernakulam', district: 'Ernakulam', lat: 9.9816, lng: 76.2999, isPrimary: true },
  { name: 'Kochi', district: 'Ernakulam', lat: 9.9312, lng: 76.2673, isPrimary: true },
  { name: 'Alappuzha', district: 'Alappuzha', lat: 9.4981, lng: 76.3388, isPrimary: true },
  { name: 'Thrippunithura', district: 'Ernakulam', lat: 9.9486, lng: 76.3464, isPrimary: true },
  { name: 'Thalayolaparambu', district: 'Kottayam', lat: 9.7917, lng: 76.4533 },
  { name: 'Cherthala', district: 'Alappuzha', lat: 9.6852, lng: 76.3364 },
  { name: 'Kaduthuruthy', district: 'Kottayam', lat: 9.7712, lng: 76.4892 },
  { name: 'Ettumanoor', district: 'Kottayam', lat: 9.67, lng: 76.5611 },
];

export function getLocationByName(name: string): LocationPoint {
  return (
    KERALA_LOCATIONS.find((loc) => loc.name.toLowerCase() === name.toLowerCase()) ||
    KERALA_LOCATIONS[0]
  );
}

/**
 * Computes straight-line distance in kilometers between two coordinates using Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Number(distance.toFixed(1));
}
