// Load smoke test. Run (k6 must be installed):  k6 run perf/k6-smoke.js
// BASE_URL defaults to the local docker AUT.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 10 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const list = http.get(`${BASE}/api/products`);
  check(list, { 'products 200': (r) => r.status === 200 });

  const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: 'user@shop.test', password: 'Password123!' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(login, { 'login 200': (r) => r.status === 200 });

  const gql = http.post(`${BASE}/graphql`, JSON.stringify({ query: '{ products { id name price } }' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(gql, { 'graphql 200': (r) => r.status === 200 && !r.json('errors') });
  sleep(1);
}
