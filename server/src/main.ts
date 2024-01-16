import dotenv from 'dotenv';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyIO from 'fastify-socket.io';
import Redis from 'ioredis'
import closeWithGrace from 'close-with-grace';


dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;

const CONNECTION_COUNT = 'chat:connection-count';
const CONNECTION_COUNT_UPDATED_CHANNEL = 'chat:connection-count-updated';

let connectedClients = 0;

if (!UPSTASH_REDIS_REST_URL) {
  console.error('no UPSTASH_REDIS_REST_URL provided');
  throw new Error('UPSTASH_REDIS_REST_URL is required');
  process.exit(1);
}
const publisher = new Redis(UPSTASH_REDIS_REST_URL);
const subscriber = new Redis(UPSTASH_REDIS_REST_URL);

async function buildServer() {
  const app = Fastify();

  await app.register(fastifyCors, {
    origin: CORS_ORIGIN,
  });
  const socket: any = await app.register(fastifyIO);

  socket.io.on('connection', async (io: any) => {
    const incrResualt = await publisher.incr(CONNECTION_COUNT);
    connectedClients++;
    await publisher.publish(CONNECTION_COUNT_UPDATED_CHANNEL, String(incrResualt));


    io.on('disconnect', async () => {
      const decrResult = await publisher.decr(CONNECTION_COUNT);
      connectedClients--;
      await publisher.publish(CONNECTION_COUNT_UPDATED_CHANNEL, String(decrResult));

    })
  });

  if (!await publisher.get(CONNECTION_COUNT)) await publisher.set(CONNECTION_COUNT, 0);

  subscriber.subscribe(CONNECTION_COUNT_UPDATED_CHANNEL, (err, count) => {
    if (err) {
      console.error(err);
      return;
    }

  });

  subscriber.on('message', (channel, text) => {
    if (channel === CONNECTION_COUNT_UPDATED_CHANNEL) {
      socket.io.emit(CONNECTION_COUNT_UPDATED_CHANNEL, { count: text });
      return;
    }
  });

  app.get('/helthcheck', () => {
    return { port: PORT, status: 'ok' };
  })
  return app;
}


async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
    closeWithGrace({ delay: 2000 }, async () => {

      if (connectedClients > 0) {

        const currentCount = parseInt(await publisher.get(CONNECTION_COUNT) || '0', 10);
        const newCount = Math.max(currentCount - connectedClients, 0);

        await publisher.set(CONNECTION_COUNT, newCount);
      }
      await app.close();
    })
  } catch (err) {
  }
}

main();