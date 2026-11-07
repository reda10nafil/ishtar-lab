/** Controllo prima di qualunque modifica dei dati dimostrativi. */
export function passwordSeedDemo(env: NodeJS.ProcessEnv = process.env): string {
  if (!['development','test'].includes(env.NODE_ENV ?? '') || env.DEMO_SEED_ENABLED !== 'true') throw new Error('Demo seed disabled: use only an explicit development/test demo environment.');
  const password = env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 16) throw new Error('Set an individual DEMO_SEED_PASSWORD of at least 16 characters.');
  return password;
}
