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

    const take = () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          readings.push({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
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
