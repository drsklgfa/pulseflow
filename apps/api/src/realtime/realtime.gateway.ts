import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { REALTIME_CHANNEL } from '@pulseflow/contracts';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

@WebSocketGateway({
  namespace: '/events',
  cors: { origin: allowedOrigins, credentials: false },
})
export class RealtimeGateway implements OnModuleInit, OnModuleDestroy, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly infrastructure: InfrastructureService) {}

  async onModuleInit(): Promise<void> {
    await this.infrastructure.subscriber.subscribe(REALTIME_CHANNEL);
    this.infrastructure.subscriber.on('message', (_channel, message) => {
      try {
        this.server.emit('pulseflow:event', JSON.parse(message) as Record<string, unknown>);
      } catch {
        this.logger.warn('Ignored a malformed realtime event.');
      }
    });
  }

  handleConnection(client: Socket): void {
    client.emit('pulseflow:ready', {
      status: 'connected',
      timestamp: new Date().toISOString(),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.infrastructure.subscriber.unsubscribe(REALTIME_CHANNEL);
  }
}
