/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use standalone output only for self-hosted / Docker deployments; Vercel uses its own serverless output.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
