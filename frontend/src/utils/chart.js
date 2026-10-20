/** Round-number y-axis for counts: returns the top value and the tick values (always whole numbers). */
export function niceScale(maxValue, desiredTicks = 4) {
  const max = Math.max(maxValue, 1);
  const rough = max / desiredTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}

/** 1,284 -> "1,284"; 12,900 -> "12.9K" */
export function compactNumber(value) {
  if (value < 1000) return String(value);
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Indexes of the x-axis labels to draw so they never collide (always includes the first and last). */
export function labelIndexes(count, width, minGap = 64) {
  if (count <= 1) return [0];
  const maxLabels = Math.max(2, Math.floor(width / minGap));
  const every = Math.ceil((count - 1) / (maxLabels - 1));
  const indexes = [];
  for (let index = count - 1; index >= 0; index -= every) indexes.unshift(index);
  if (indexes[0] !== 0 && indexes[0] < every * 0.6) indexes.shift(); // avoid crowding the first label
  if (indexes[0] !== 0) indexes.unshift(0);
  return indexes;
}
