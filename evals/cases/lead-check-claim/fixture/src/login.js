const users = new Map([['ada', 'correct horse']]);

export function login(req) {
  const { user, password } = req.body;
  if (users.get(user) === password) return { status: 200, body: 'ok' };
  return { status: 401, body: 'bad credentials' };
}
