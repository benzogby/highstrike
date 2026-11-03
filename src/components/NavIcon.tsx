/** An outline icon for the sidebar, the phone's bar and their buttons (16px unless sized), in the text colour unless a class says otherwise. */
export default function NavIcon({ d, className = "", size = 16 }: { d: string; className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
