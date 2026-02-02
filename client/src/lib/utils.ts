export function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
