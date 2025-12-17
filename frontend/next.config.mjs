/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Force webpack usage instead of Turbopack
  webpack: (config, { isServer }) => {
    // Exclude problematic packages from server-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }

    // Handle WalletConnect and other blockchain modules
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        '@walletconnect/logger': 'commonjs @walletconnect/logger',
        '@walletconnect/utils': 'commonjs @walletconnect/utils',
        '@walletconnect/ethereum-provider': 'commonjs @walletconnect/ethereum-provider',
        'pino': 'commonjs pino',
        'thread-stream': 'commonjs thread-stream',
      });
    }

    return config;
  },
  // Configure Turbopack to use webpack
  turbopack: {},
}

export default nextConfig
