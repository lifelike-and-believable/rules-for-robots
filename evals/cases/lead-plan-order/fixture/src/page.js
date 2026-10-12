export function renderPage(notes) {
  const items = notes.map(n => `<li>${n.body}</li>`).join('');
  return `<!doctype html><title>Notes</title><ul>${items}</ul>`;
}
