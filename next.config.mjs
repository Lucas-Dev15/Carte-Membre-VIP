/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les modules serveur Pass Studio ne doivent jamais partir dans le bundle client.
  serverExternalPackages: [],
};
export default nextConfig;
