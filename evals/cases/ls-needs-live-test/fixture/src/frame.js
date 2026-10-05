// Frames arrive as text lines: "<type>:<payload>", for example "pose:1.0,2.0,0.5".
export function parseFrame(line) {
  const [type, payload] = line.trim().split(':');
  if (!type || payload === undefined) throw new Error(`bad frame: ${line}`);
  return { type, payload };
}
