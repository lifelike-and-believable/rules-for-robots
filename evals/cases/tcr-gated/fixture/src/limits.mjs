// Upload limits (docs/specs/limits.md).

export function maxUploadMb() {
  return 10;
}

export function validName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 100;
}
