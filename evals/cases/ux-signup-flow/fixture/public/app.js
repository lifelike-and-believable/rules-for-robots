const form = document.querySelector('#signup');
const msg = document.querySelector('#msg');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form));
  const res = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    form.reset();
    msg.textContent = `Error ${res.status}`;
    return;
  }
  msg.textContent = 'Account created.';
});

document.querySelector('#delete-account').addEventListener('click', async () => {
  await fetch('/api/account', { method: 'DELETE' });
  location.href = '/goodbye';
});

export function renderProjects(projects) {
  document.querySelector('#projects').innerHTML = projects.map(p => `<li>${p.name}</li>`).join('');
}

fetch('/api/projects').then(r => r.json()).then(renderProjects);
