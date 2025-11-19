/** Utility helpers around chrome.storage.sync with Promise wrappers. */
export function syncGet<T>(key: string, defaultValue: T): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([key], (result) => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError) {
        reject(runtimeError);
        return;
      }

      if (result && key in result) {
        resolve(result[key] as T);
        return;
      }

      resolve(defaultValue);
    });
  });
}

export function syncSet<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [key]: value }, () => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError) {
        reject(runtimeError);
        return;
      }
      resolve();
    });
  });
}
