import 'dotenv/config';
import 'reflect-metadata';
import { createPulseFlowApp } from './app.factory';

async function bootstrap(): Promise<void> {
  const app = await createPulseFlowApp();
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  console.log(`PulseFlow API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger available on http://localhost:${port}/docs`);
}

bootstrap().catch((error: unknown) => {
  console.error('PulseFlow API failed to start.', error);
  process.exit(1);
});
