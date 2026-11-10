import * as React from 'react';

export type LogoMarkProps = {
  readonly size?: number;
  readonly title?: string;
};

/** Cross-platform product mark. The application tile uses the same house motif. */
export function LogoMark({ size = 24, title }: LogoMarkProps) {
  const labelled = Boolean(title);
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" role={labelled ? 'img' : undefined} aria-label={title} aria-hidden={labelled ? undefined : true} focusable={false}>
      <path d="M32 112 128 40l96 72v112H32z" fill="none" stroke="#2F62AD" strokeWidth="18" strokeLinejoin="round" />
      <path d="M58 224V126h140v98M102 224v-56h52v56M78 112h100" fill="none" stroke="#2F62AD" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M128 48v-16" fill="none" stroke="#DAB45C" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
