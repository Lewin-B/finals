const globalForBackgroundWorkers = globalThis as typeof globalThis & {
  backgroundWorkersStarted?: boolean;
};

export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.ENABLE_BACKGROUND_WORKERS !== "true" ||
    globalForBackgroundWorkers.backgroundWorkersStarted
  ) {
    return;
  }

  globalForBackgroundWorkers.backgroundWorkersStarted = true;

  const { startTwitterProducerWorker } = await import(
    "./lib/background-workers/twitter-producer.ts"
  );

  void startTwitterProducerWorker();
}
