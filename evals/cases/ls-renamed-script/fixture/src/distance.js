const MILES_PER_KM = 0.621371;

export function kmToMiles(km) {
  return km * MILES_PER_KM;
}

export function milesToKm(miles) {
  return miles / MILES_PER_KM;
}
