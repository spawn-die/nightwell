let _id = 1;

export function nextId(prefix = 'e'): string {
  _id += 1;
  return `${prefix}_${_id}`;
}

export function resetIds(n = 1): void {
  _id = n;
}
