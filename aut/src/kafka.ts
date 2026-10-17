import { Kafka, type Producer } from 'kafkajs';

export const ORDERS_TOPIC = process.env.KAFKA_TOPIC_ORDERS ?? 'orders';

const kafka = new Kafka({
  clientId: 'shop-aut',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9094').split(','),
  // Fail fast when the broker is unreachable instead of hanging the HTTP request for minutes.
  connectionTimeout: 3000,
  requestTimeout: 5000,
  retry: { retries: 5, initialRetryTime: 300, maxRetryTime: 3000 },
});

let producer: Producer | undefined;

export async function initKafka(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({ topics: [{ topic: ORDERS_TOPIC, numPartitions: 1 }] });
  await admin.disconnect();
  producer = kafka.producer();
  await producer.connect();
}

export interface OrderEvent {
  eventType: 'order.created' | 'order.updated';
  occurredAt: string;
  order: unknown;
}

export async function publishOrderEvent(eventType: OrderEvent['eventType'], order: { id: number }) {
  if (!producer) throw new Error('Kafka producer not initialised');
  const event: OrderEvent = { eventType, occurredAt: new Date().toISOString(), order };
  await producer.send({
    topic: ORDERS_TOPIC,
    messages: [{ key: String(order.id), value: JSON.stringify(event) }],
  });
}
