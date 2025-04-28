// components/MarkdownImage.tsx
import Image, { ImageProps } from 'next/image';

/**
 * Replacement for the <img> tag that react-markdown emits.
 * • Accepts ANY src (local /public, remote CDN, Supabase, etc.).
 * • width/height = 0 keeps it fully responsive.
 * • maxHeight = 300px constrains tall graphics so they never dominate the page.
 */
export default function MarkdownImage(
  { src = '', alt = '', ...rest }: { src?: string; alt?: string } & Omit<ImageProps, 'src' | 'alt'>,
) {
  if (!src) return null;  // guard against missing URLs

  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes="100vw"
      // 🔑 stretch to container width, keep aspect ratio, but never exceed 300 px tall
      style={{ width: '100%', height: 'auto', maxHeight: '700px', objectFit: 'contain' }}
      unoptimized   /* delete once remotePatterns list is complete */
      {...rest}
    />
  );
}
