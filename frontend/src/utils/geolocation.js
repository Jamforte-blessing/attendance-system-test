import KalmanFilter from 'kalmanjs';

const GPS_CACHE_KEY = 'kiosk_gps_cache';
const GPS_CACHE_TTL = 10 * 60 * 1000;

// R = measurement noise (how much we distrust each raw GPS reading).
// Q = process noise (how much the true position is expected to change between samples).
// Low Q + higher R = aggressive smoothing for a stationary device.
const KALMAN_R = 0.01;
const KALMAN_Q = 3;

export function getAveragedPosition(samples = 5, delayMs = 600) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation is not supported by this browser.');
      return;
    }

    const latFilter = new KalmanFilter({ R: KALMAN_R, Q: KALMAN_Q });
    const lngFilter = new KalmanFilter({ R: KALMAN_R, Q: KALMAN_Q });

    let collected = 0;
    let attempt = 0;
    const maxAttempts = samples * 2;
    let lastLat = null;
    let lastLng = null;

    const take = () => {
      if (attempt >= maxAttempts) {
        if (collected === 0) {
          reject('Could not get GPS readings. Please ensure GPS is enabled and try again.');
          return;
        }
        resolve({ latitude: lastLat, longitude: lastLng });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          attempt++;
          collected++;
          // Feed each raw reading into the filter — output converges toward true position.
          lastLat = latFilter.filter(pos.coords.latitude);
          lastLng = lngFilter.filter(pos.coords.longitude);
          if (collected < samples) {
            setTimeout(take, delayMs);
          } else {
            resolve({ latitude: lastLat, longitude: lastLng });
          }
        },
        () => reject('Location access was denied. Please allow location access and try again.'),
        // maximumAge: 0 — force a fresh acquisition for every sample so the filter
        // receives genuinely independent readings, not repeated cached values.
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };

    take();
  });
}

async function getFallbackPosition() {
  const url = import.meta.env.VITE_LOCATION_FALLBACK_URL || 'https://ipapi.co/json/';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Fallback location service is unavailable.');
  }

  const data = await response.json();
  const latitude = data.latitude ?? data.lat;
  const longitude = data.longitude ?? data.lon ?? data.lng;

  if (latitude == null || longitude == null) {
    throw new Error('Fallback location service did not return coordinates.');
  }

  return {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    source: 'fallback',
  };
}

export async function getBestAvailablePosition(samples = 5, delayMs = 600) {
  // Return cached reading if it's less than 10 minutes old.
  // The kiosk is a fixed device — there's no reason to re-acquire GPS on every scan.
  try {
    const cached = sessionStorage.getItem(GPS_CACHE_KEY);
    if (cached) {
      const { position, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < GPS_CACHE_TTL) return position;
    }
  } catch (_) {}

  try {
    const position = await getAveragedPosition(samples, delayMs);
    try {
      sessionStorage.setItem(GPS_CACHE_KEY, JSON.stringify({ position, timestamp: Date.now() }));
    } catch (_) {}
    return position;
  } catch (err) {
    try {
      return await getFallbackPosition();
    } catch (_) {
      throw err;
    }
  }
}
