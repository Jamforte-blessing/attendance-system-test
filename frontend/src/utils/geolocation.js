/**
 * Takes multiple GPS readings and returns the average.
 * Reduces drift caused by the device switching between GPS/WiFi/cell positioning.
 * 
 * @param {number} samples - Number of GPS samples to take (default 5, use 15+ for initial setup)
 * @param {number} delayMs - Delay in ms between samples (default 600ms)
 * @param {boolean} filterByAccuracy - If true, only use readings with accuracy <= 30m (default false)
 */
export function getAveragedPosition(samples = 5, delayMs = 600, filterByAccuracy = false) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation is not supported by this browser.');
      return;
    }

    const readings = [];
    let attempt = 0;
    const maxAttempts = samples * 2; // Allow retries for accuracy filtering

    const take = () => {
      if (attempt >= maxAttempts) {
        if (readings.length === 0) {
          reject('Could not get GPS readings. Please ensure GPS is enabled and try again.');
          return;
        }
        // Use whatever readings we have
        resolve({
          latitude:  readings.reduce((s, r) => s + r.latitude,  0) / readings.length,
          longitude: readings.reduce((s, r) => s + r.longitude, 0) / readings.length,
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          attempt++;
          // Filter by accuracy if requested (accuracy in meters)
          if (!filterByAccuracy || pos.coords.accuracy <= 30) {
            readings.push({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          }
          
          if (readings.length < samples) {
            setTimeout(take, delayMs);
          } else {
            resolve({
              latitude:  readings.reduce((s, r) => s + r.latitude,  0) / readings.length,
              longitude: readings.reduce((s, r) => s + r.longitude, 0) / readings.length,
            });
          }
        },
        () => reject('Location access was denied. Please allow location access and try again.'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

export async function getBestAvailablePosition(samples = 5, delayMs = 600, filterByAccuracy = false) {
  try {
    return await getAveragedPosition(samples, delayMs, filterByAccuracy);
  } catch (err) {
    try {
      return await getFallbackPosition();
    } catch (_) {
      throw err;
    }
  }
}
