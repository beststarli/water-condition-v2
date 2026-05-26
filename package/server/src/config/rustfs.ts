export const RUSTFS = {
  endpoint: process.env.RUSTFS_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.RUSTFS_ACCESS_KEY || 'rustfsadmin',
  secretKey: process.env.RUSTFS_SECRET_KEY || 'rustfsadmin',
  bucket: process.env.RUSTFS_BUCKET || 'water-condition',
  region: process.env.RUSTFS_REGION || 'us-east-1',
  publicUrlBase:
    process.env.RUSTFS_PUBLIC_URL || 'http://localhost:9000/water-condition',
}
