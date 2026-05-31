export function getTimeContext() {
  const hr = new Date().getHours();
  if (hr >= 6 && hr < 18) {
    return 'day';
  }
  return 'night';
}
