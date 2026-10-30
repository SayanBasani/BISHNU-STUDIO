let inFlightShopPromise: Promise<any> | null = null;
let cachedShopSettings: any = null;

export async function fetchPublicShopSettings() {
  if (cachedShopSettings) {
    return cachedShopSettings;
  }

  if (!inFlightShopPromise) {
    inFlightShopPromise = fetch("/api/settings/shop", { cache: "default" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data?.settings || data?.shop;
        if (payload) {
          cachedShopSettings = payload;
        }
        return payload;
      })
      .catch(() => null)
      .finally(() => {
        inFlightShopPromise = null;
      });
  }

  return await inFlightShopPromise;
}
