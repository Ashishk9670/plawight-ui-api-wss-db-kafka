import { Kafka, type Consumer } from 'kafkajs';
import { env } from '@config/env';
import { logger } from '@utils/logger';

export interface KafkaEvent<T = any> {
  key: string | null;
  value: T;
  topic: string;
}

/**
 * Starts a consumer (unique group, from latest) BEFORE the action under test, collects
 * everything, and lets the test wait for a specific event by predicate.
 */
export class KafkaListener {
  readonly events: KafkaEvent[] = [];
  private consumer?: Consumer;

  constructor(
    private kafka: Kafka,
    private topic: string,
  ) {}

  async start() {
    this.consumer = this.kafka.consumer({ groupId: `pw-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
    // Resolve only once partitions are assigned, so events produced right after start() are not missed.
    const joined = new Promise<void>((resolve) => this.consumer!.on(this.consumer!.events.GROUP_JOIN, () => resolve()));
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const value = JSON.parse(message.value?.toString() ?? 'null');
        logger.debug(`Kafka <- ${topic} ${message.key?.toString()}`);
        this.events.push({ key: message.key?.toString() ?? null, value, topic });
      },
    });
    await joined;
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
