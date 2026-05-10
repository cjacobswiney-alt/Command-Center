export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getGreeting(): { greeting: string; hint: string | null } {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { greeting: "Good morning, Jacob", hint: null };
  } else if (hour < 17) {
    return { greeting: "Good afternoon, Jacob", hint: null };
  } else {
    return { greeting: "Good evening, Jacob", hint: "Time to brain dump?" };
  }
}
