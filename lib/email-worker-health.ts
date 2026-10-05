export const EMAIL_WORKER_STALE_MS = 10 * 60 * 1000;
export type WorkerHealth = { healthy: boolean; lastSuccess: string | null; reason: "stale" | "unavailable" | null };

export function emailWorkerHealth(lastSuccess: Date | string | null, now = Date.now()): WorkerHealth {
  const timestamp = lastSuccess ? new Date(lastSuccess).getTime() : NaN;
  const valid = Number.isFinite(timestamp);
  const healthy = valid && timestamp <= now + 60000 && now - timestamp <= EMAIL_WORKER_STALE_MS;
  return { healthy, lastSuccess: valid ? new Date(timestamp).toISOString() : null, reason: healthy ? null : "stale" };
}

export async function checkEmailWorkerHealth(
  readLastSuccess: () => Promise<Date | string | null>,
  alert: (health: WorkerHealth) => Promise<number>,
  now = Date.now()
) {
  let health: WorkerHealth;
  try { health = emailWorkerHealth(await readLastSuccess(), now); }
  catch { health = { healthy: false, lastSuccess: null, reason: "unavailable" }; }
  const alerted = health.healthy ? 0 : await alert(health);
  return { ...health, alerted };
}

