// The session holds the id of the signed-in user.
export function currentUser(session) {
  return session.userId;
}
