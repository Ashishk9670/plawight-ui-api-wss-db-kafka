import { Kafka, type Consumer } from 'kafkajs';
import { env } from '@config/env';
import { logger } from '@utils/logger';

export interface KafkaEvent<T = any> {
  key: string | null;
  value: T;
  topic: string;
}

/**
 * Starts a consumer (unique group) BEFORE the action under test, collects everything published from that
 * moment on, and lets the test wait for a specific event by predicate.
 *
 * "Start from latest" alone is resolved by the broker after the group join, so an event produced right after
 * start() returns could be skipped on a cold broker. Instead the end offsets are read first and the consumer
 * seeks to them; messages fetched twice around the seek are dropped by offset.
 */
export class KafkaListener {
  readonly events: KafkaEvent[] = [];
  private seen = new Set<string>();
  private consumer?: Consumer;

  constructor(
    private kafka: Kafka,
    private topic: string,
  ) {}

  async start() {
    const endOffsets = await this.endOffsets();
    this.consumer = this.kafka.consumer({ groupId: `pw-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
    // Resolve only once partitions are assigned, so events produced right after start() are not missed.
    const joined = new Promise<void>((resolve) => this.consumer!.on(this.consumer!.events.GROUP_JOIN, () => resolve()));
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const id = `${partition}:${message.offset}`;
        if (this.seen.has(id)) return;
        this.seen.add(id);
        const value = JSON.parse(message.value?.toString() ?? 'null');
        logger.debug(`Kafka <- ${topic} ${message.key?.toString()}`);
        this.events.push({ key: message.key?.toString() ?? null, value, topic });
      },
    });
    await joined;
    for (const { partition, high } of endOffsets) {
      this.consumer.seek({ topic: this.topic, partition, offset: high });
    }
  }

  /** Current end offset of every partition; empty if the topic does not exist yet. */
  private async endOffsets(): Promise<{ partition: number; high: string }[]> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      return await admin.fetchTopicOffsets(this.topic);
    } catch {
      return [];
    } finally {
      await admin.disconnect();
    }
  }

  async waitForEvent<T = any>(predicate: (e: KafkaEvent) => boolean, timeout = 15_000): Promise<KafkaEvent<T>> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.events.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`No matching Kafka event on "${this.topic}" within ${timeout}ms (${this.events.length} received)`);
  }

  async stop() {
    await this.consumer?.disconnect();
  }
}

export class KafkaClient {
  private kafka = new Kafka({
    clientId: 'pw-framework',
    brokers: env.KAFKA_BROKERS.split(','),
    retry: { retries: 5 },
    logLevel: 1, // ERROR only
  });

  async listen(topic = env.KAFKA_TOPIC_ORDERS): Promise<KafkaListener> {
    const listener = new KafkaListener(this.kafka, topic);
    await listener.start();
    return listener;
  }
}
