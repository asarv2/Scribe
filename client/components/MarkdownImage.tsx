// components/MarkdownImage.tsx
import Image, { ImageProps } from 'next/image';
import styles from './MarkdownImage.module.css';

/**
 * Replacement for the <img> tag that react-markdown emits.
 * • Accepts ANY src (local /public, remote CDN, Supabase, etc.).
 * • width/height = 0 keeps it fully responsive.
 * • maxHeight = 300px constrains tall graphics so they never dominate the page.
 * • Supports dark mode for SVG images with automatic inversion.
 */
export default function MarkdownImage(
  { src = '', alt = '', ...rest }: { src?: string; alt?: string } & Omit<ImageProps, 'src' | 'alt'>,
) {
  if (!src) return null;  // guard against missing URLs

  // Check if the image is an SVG to apply dark mode styling
  const isSvg = src.toLowerCase().endsWith('.svg');

  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes="100vw"
      // 🔑 stretch to container width, keep aspect ratio, but never exceed 700 px tall
      style={{ width: '70%', height: 'auto', objectFit: 'contain' }}
      className={isSvg ? styles.markdownImage : undefined}
      unoptimized   /* delete once remotePatterns list is complete */
      {...rest}
    />
  );
}
