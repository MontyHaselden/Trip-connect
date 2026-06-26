/**
 * Parse large JSON off the main thread so the tab stays responsive.
 */
export function parseJsonOffThread<T>(raw: string | ArrayBuffer): Promise<T> {
  const useWorker = typeof Worker !== "undefined";
  const byteLength =
    typeof raw === "string" ? raw.length : raw.byteLength;
  // Always parse off-thread when large enough to risk tab freeze (includes postMessage clone).
  if (!useWorker || byteLength < 64_000) {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (byteLength < 64_000) {
      return Promise.resolve(JSON.parse(text) as T);
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(JSON.parse(text) as T);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  }

  return new Promise((resolve, reject) => {
    const source = `
      self.onmessage = (event) => {
        try {
          const input = event.data;
          const text =
            typeof input === "string"
              ? input
              : new TextDecoder().decode(input);
          self.postMessage({ ok: true, value: JSON.parse(text) });
        } catch (error) {
          self.postMessage({ ok: false, error: String(error) });
        }
      };
    `;
    const url = URL.createObjectURL(
      new Blob([source], { type: "application/javascript" }),
    );
    const worker = new Worker(url);
    worker.onmessage = (event: MessageEvent<{ ok: boolean; value?: T; error?: string }>) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      if (event.data.ok) resolve(event.data.value as T);
      else reject(new Error(event.data.error ?? "JSON parse failed"));
    };
    worker.onerror = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error("JSON worker failed"));
    };
    if (raw instanceof ArrayBuffer) {
      worker.postMessage(raw, [raw]);
    } else {
      worker.postMessage(raw);
    }
  });
}
