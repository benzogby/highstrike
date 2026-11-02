/** HighStrike's built-in mark, for when no logo has been uploaded. Its own module (not Header's) so the app's frame can
 * draw it without loading the site header's code and the Supabase library that comes with it. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#009f6f" />
      <path
        d="M8 22 L13 15 L17 18 L24 8"
        stroke="#0a0b0d"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M24 8 L24 13 M24 8 L19 8" stroke="#0a0b0d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
