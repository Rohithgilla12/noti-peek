interface Props {
  size?: number;
  className?: string;
}

/** The noti-peek mark: a ring in ambient ink, with a warm amber dot
 *  "peeking" in at roughly the 2-o'clock position — the glyph the
 *  app icon is built from, stripped of the filled rounded square so
 *  it sits flat against the surface it's on. */
export function BrandMark({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="6.6" stroke="currentColor" strokeWidth="1.4" opacity="0.92" />
      <circle cx="14.1" cy="7.9" r="1.9" fill="#d9a24b" />
    </svg>
  );
}
