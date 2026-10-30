/** A chat row's avatar: the name's initials on a colour derived from the name. */
export function initials(name: string): string {
  return name.split(' ').map((s) => s[0] ?? '').slice(0, 2).join('').toUpperCase();
}

const AVATAR_HUES = ['#872e5c', '#e18425', '#4172a8', '#4e8a4a', '#6a6037', '#2f7b8c', '#a34573', '#8a7d4b'];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}
