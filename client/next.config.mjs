/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'hmdqtnywfebxjugxzlvc.supabase.co',
            port: '',
            pathname: '/storage/v1/object/public/lectures/**',
          },
          {
            protocol: 'https',
            hostname: 'hmdqtnywfebxjugxzlvc.supabase.co',
            port: '',
            pathname: '/storage/v1/object/public/textbooks/**',
          },
          {
            protocol: 'https',
            hostname: 'hmdqtnywfebxjugxzlvc.supabase.co',
            port: '',
            pathname: '/storage/v1/object/public/profiles/**',
          },
          {
            protocol: 'https',
            hostname: 'hmdqtnywfebxjugxzlvc.supabase.co',
            port: '',
            pathname: '/storage/v1/object/public/classes/**',
          },
          {
            protocol: 'https',
            hostname: 'hmdqtnywfebxjugxzlvc.supabase.co',
            port: '',
            pathname: '/storage/v1/object/public/figures/**',
          },
          {
            protocol: 'https',
            hostname: 'api.ashoksaravanan.com',
            port: '',
            pathname: '/storage/files/scribe/**',
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
