import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { MESSAGING_OPTIONS } from './messaging.config';
import type { MessagingOptions } from './messaging.config';

interface BufferedMessage {
  topic: string;
  key: string | null;
  value: any;
  enqueuedAt: number;
}

/**
 * Producteur Kafka résilient.
 *
 * Invariants :
 *  - Le démarrage du service ne dépend JAMAIS de la disponibilité de Kafka.
 *  - emit() ne lève jamais d'exception (fire-and-forget).
 *  - Les événements émis hors-ligne sont mis en buffer borné puis rejoués
 *    automatiquement dès reconnexion.
 *  - Reconnexion en arrière-plan, illimitée, avec backoff exponentiel plafonné.
 */
@Injectable()
export class ResilientKafkaProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResilientKafkaProducer.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  private connected = false;
  private connecting = false;
  private flushing = false;
  private shuttingDown = false;

  private buffer: BufferedMessage[] = [];
  private droppedCount = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private backoff: number;

  constructor(
    @Inject(MESSAGING_OPTIONS) private readonly opts: MessagingOptions,
  ) {
    this.backoff = opts.initialBackoffMs ?? 1000;
    this.kafka = new Kafka({
      clientId: opts.clientId ?? `${opts.serviceName}-producer`,
      brokers: opts.brokers,
      logLevel: logLevel.ERROR,
      // On désactive la boucle interne de kafkajs : c'est NOTRE boucle qui gère
      // les tentatives, afin de ne jamais bloquer ni se limiter en nombre.
      retry: { retries: 0 },
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connected = false;
      this.scheduleReconnect();
    });
  }

  /** Tentative de connexion NON bloquante : le bootstrap n'attend pas Kafka. */
  onModuleInit() {
    void this.ensureConnected();
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.flush();
      if (this.connected) await this.producer.disconnect();
    } catch {
      /* arrêt silencieux */
    }
  }

  /** Point d'entrée public. Ne lève jamais. */
  emit(topic: string, key: string | null, value: any): void {
    this.enqueue({ topic, key, value, enqueuedAt: Date.now() });
    void this.flush();
  }

  private enqueue(msg: BufferedMessage) {
    const max = this.opts.bufferMaxSize ?? 10000;
    if (this.buffer.length >= max) {
      this.buffer.shift(); // drop-oldest
      this.droppedCount++;
      if (this.droppedCount % 1000 === 1) {
        this.logger.warn(
          `Buffer plein (${max}). ${this.droppedCount} événement(s) abandonné(s) depuis le début.`,
        );
      }
    }
    this.buffer.push(msg);
  }

  /** Single-flight : une seule tentative de connexion à la fois. */
  private async ensureConnected(): Promise<boolean> {
    if (this.connected) return true;
    if (this.connecting || this.shuttingDown) return false;
    this.connecting = true;
    try {
      await this.producer.connect();
      this.connected = true;
      this.backoff = this.opts.initialBackoffMs ?? 1000; // reset backoff
      this.logger.log('✅ Connexion Kafka établie. Rejeu du buffer.');
      void this.flush();
      return true;
    } catch (err: any) {
      this.logger.debug(
        `Kafka indisponible (${err.message}). Nouvelle tentative planifiée.`,
      );
      this.scheduleReconnect();
      return false;
    } finally {
      this.connecting = false;
    }
  }

  /** Reconnexion illimitée, backoff exponentiel plafonné. */
  private scheduleReconnect() {
    if (this.shuttingDown || this.reconnectTimer) return;
    const delay = this.backoff;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.ensureConnected();
    }, delay);
    this.backoff = Math.min(this.backoff * 2, this.opts.maxBackoffMs ?? 30000);
  }

  /** Draine le buffer tant que la connexion tient. */
  private async flush(): Promise<void> {
    if (this.flushing || this.shuttingDown) return;
    if (!this.connected) {
      void this.ensureConnected();
      return;
    }
    this.flushing = true;
    const batchSize = this.opts.flushBatchSize ?? 500;
    try {
      while (this.buffer.length && this.connected) {
        const batch = this.buffer.slice(0, batchSize);
        await this.producer.sendBatch({
          topicMessages: this.groupByTopic(batch),
        });
        this.buffer.splice(0, batch.length);
      }
    } catch (err: any) {
      // Échec d'envoi : on garde le buffer intact et on relance la reconnexion.
      this.connected = false;
      this.logger.warn(
        `Échec d'envoi Kafka (${err.message}). Buffer conservé.`,
      );
      this.scheduleReconnect();
    } finally {
      this.flushing = false;
    }
  }

  private groupByTopic(batch: BufferedMessage[]) {
    const byTopic = new Map<string, { key?: string; value: string }[]>();
    for (const m of batch) {
      const arr = byTopic.get(m.topic) ?? [];
      arr.push({ key: m.key ?? undefined, value: JSON.stringify(m.value) });
      byTopic.set(m.topic, arr);
    }
    return [...byTopic.entries()].map(([topic, messages]) => ({
      topic,
      messages,
    }));
  }

  /** Observabilité : état courant du producteur. */
  health() {
    return {
      connected: this.connected,
      buffered: this.buffer.length,
      dropped: this.droppedCount,
    };
  }
}
