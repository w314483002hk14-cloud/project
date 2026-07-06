export function isServerlessDeploy() {
  return process.env.VERCEL === '1';
}
