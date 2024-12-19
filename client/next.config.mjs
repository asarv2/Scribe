/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'hmdqtnywfebxjugxzlvc.supabase.co',
            port: '',
            pathname: '/storage/v1/object/public/slides/**',
          },
        ],
      },
};

export default nextConfig;
