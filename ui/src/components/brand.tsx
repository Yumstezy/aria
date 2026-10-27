// The placeholder mark (the logo isn't chosen yet, CLAUDE.md).

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} aria-hidden="true">
      <rect width="26" height="26" rx="8" fill="var(--action)" />
      <path d="M8 10v6M11.5 7v12M15 9v8M18.5 11v4" stroke="var(--on-action)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
