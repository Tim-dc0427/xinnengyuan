// Redis not available in dev - provide no-op client
export const redis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
  publish: async () => 0,
} as any
