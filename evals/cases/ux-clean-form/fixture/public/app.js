const form = document.querySelector('#contact');
const send = document.querySelector('#send');
const status = document.querySelector('#status');

function check(input) {
  const error = document.querySelector(`#${input.id}-error`);
  let text = '';
  if (!input.value.trim()) text = input.id === 'email' ? 'Enter your email address so we can reply.' : 'Write a message so we know how to help.';
  else if (input.id === 'email' && !/^\S+@\S+\.\S+$/.test(input.value)) text = 'That email address looks incomplete. Check for a missing @ or domain, for example name@example.com.';
  error.textContent = text;
  error.hidden = !text;
  input.setAttribute('aria-invalid', String(Boolean(text)));
  return !text;
}

form.querySelectorAll('input, textarea').forEach(input => input.addEventListener('blur', () => check(input)));

form.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = [...form.querySelectorAll('input, textarea')];
  const valid = fields.map(check).every(Boolean);
  if (!valid) return fields.find(f => f.getAttribute('aria-invalid') === 'true').focus();
  send.disabled = true;
  send.textContent = 'Sending…';
  try {
    const res = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    if (!res.ok) throw new Error(String(res.status));
    form.reset();
    status.textContent = 'Thanks, your message is on its way. We reply within two working days.';
  } catch {
    status.textContent = 'We could not send your message. Your text is still here; check your connection and press Send message again.';
  } finally {
    send.disabled = false;
    send.textContent = 'Send message';
  }
});
