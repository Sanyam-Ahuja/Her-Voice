export function getTimeContext() {
  const hr = new Date().getHours();
  // day between 6am and 6pm (18:00)
  if (hr >= 6 && hr < 18) {
    return 'day';
  }
  return 'night';
}
