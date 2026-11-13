// The reading list: books with a title, an author, and the year they were published.
import fs from 'node:fs';

export function loadBooks(file) {
  const books = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(books)) throw new Error(`${file}: expected a list of books`);
  return books;
}

export function listLines(books) {
  return books.map(b => `${b.title}, by ${b.author} (${b.year})`);
}
