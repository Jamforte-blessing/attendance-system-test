const GPS_CACHE_KEY = 'kiosk_gps_cache';
const GPS_CACHE_TTL = 10 * 60 * 1000; // reuse reading for 10 minutes — kiosk doesn't move

/**
 * Takes multiple GPS readings and returns the average.
 * Reduces drift caused by the device switching between GPS/WiFi/cell positioning.
 */
export function getAveragedPosition(samples = 5, delayMs = 600) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation is not supported by this browser.');
      return;
    }

    const readings = [];
    let attempt = 0;
    const maxAttempts = samples * 2;

    const take = () => {
      if (attempt >= maxAttempts) {
        if (readings.length === 0) {
          reject('Could not get GPS readings. Please ensure GPS is enabled and try again.');
          return;
        }
        resolve(average(readings));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          attempt++;
          readings.push({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy,
          });
          if (readings.length < samples) {
            setTimeout(take, delayMs);
          } else {
            resolve(average(readings));
          }
        },
        () => reject('Location access was denied. Please allow location access and try again.'),
        // maximumAge: 30s — allow the browser to reuse a recently cached reading instead of
        // always forcing a cold acquisition (which causes drift between samples)
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    };

    take();
  });
}

function average(readings) {
  return {
    latitude:  readings.reduce((s, r) => s + r.latitude,  0) / readings.length,
    longitude: readings.reduce((s, r) => s + r.longitude, 0) / readings.length,
  };
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
