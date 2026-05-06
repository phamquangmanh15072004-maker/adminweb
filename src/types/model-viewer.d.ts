import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module '@google/model-viewer';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        ar?: boolean;
        'shadow-intensity'?: string;
        'environment-image'?: string;
        'interaction-prompt'?: string;
        loading?: 'auto' | 'eager' | 'lazy';
        reveal?: 'auto' | 'interaction' | 'manual';
        'touch-action'?: string;
      };
    }
  }
}

export {};
