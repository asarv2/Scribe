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
    async headers() {
        return [
          {
            source: '/:path*',
            headers: [
              {
                key: 'Cross-Origin-Embedder-Policy',
                value: 'credentialless'
              },
              {
                key: 'Cross-Origin-Opener-Policy',
                value: 'same-origin'
              },
              {
                key: 'Cross-Origin-Resource-Policy',
                value: 'cross-origin'
              }
            ]
          }
        ]
    }
};

export default nextConfig;
