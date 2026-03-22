const MAX_RESPONSE_LENGTH = 50_000;

export function truncateResponse(data: any): string {
  const full = JSON.stringify(data, null, 2);
  if (full.length <= MAX_RESPONSE_LENGTH) return full;

  if (Array.isArray(data)) {
    let truncated = data;
    let omitted = 0;
    while (
      JSON.stringify(truncated, null, 2).length > MAX_RESPONSE_LENGTH &&
      truncated.length > 1
    ) {
      omitted += Math.ceil(truncated.length / 2);
      truncated = truncated.slice(0, Math.ceil(truncated.length / 2));
    }
    const result = JSON.stringify(truncated, null, 2);
    return `${result}\n\n[Truncated: ${omitted} more items omitted. Use pagination or filters to see more.]`;
  }

  return (
    full.slice(0, MAX_RESPONSE_LENGTH) +
    "\n\n[Response truncated. Use filters or pagination to reduce output size.]"
  );
}
