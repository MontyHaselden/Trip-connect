/**
 * Parse large JSON off the main thread so the tab stays responsive.
 */
export function parseJsonOffThread<T>(raw: string): Promise<T> {
  if (typeof Worker === "undefined" || raw.length < 400_000) {
    return Promise.resolve(JSON.parse(raw) as T);
  }

  return new Promise((resolve, reject) => {
    const source = `
      self.onmessage = (event) => {
        try {
          self.postMessage({ ok: true, value: JSON.parse(event.data) });
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
    worker.postMessage(raw);
  });
}
