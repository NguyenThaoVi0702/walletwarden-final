// k6 load test for the AI advisor (T29): 1, 4 and 5 simultaneous users through the tunnel.
//
//   k6 run -e BASE_URL=https://xxxx.trycloudflare.com -e VUS=4 scripts/loadtest/ai_load.js
//
// Needs test accounts loadtest1..5@walletwarden.test / Loadtest123! (create them once via sign-up).
// Endpoint paths follow the frozen contract in INTEGRATION.md.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:8000';
const VUS = Number(__ENV.VUS || 1);
const aiLatency = new Trend('ai_latency_s');

export const options = {
  scenarios: {
    advisor: { executor: 'per-vu-iterations', vus: VUS, iterations: 5, maxDuration: '5m' },
  },
  thresholds: {
    // Plan metric: median above 5 s with 4 users -> smaller model / shorter prompts.
    ai_latency_s: ['med<5'],
    checks: ['rate>0.95'],
  },
};

const QUESTIONS = [
  'Tháng này tiền của mình đi đâu hết vậy?',
  'Mình có đủ tiền mua tai nghe 2 triệu không?',
  'Làm sao để tiết kiệm tiền ăn?',
  'So với tháng trước mình tiêu thế nào?',
  'Tuần này mình nên chi tối đa bao nhiêu?',
];

export function setup() {
  const tokens = [];
  for (let i = 1; i <= Math.max(VUS, 1); i++) {
    const res = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email: `loadtest${i}@walletwarden.test`, password: 'Loadtest123!' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    check(res, { 'login ok': (r) => r.status === 200 });
    tokens.push(res.json('access_token'));
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const res = http.post(
    `${BASE}/api/ai/chat`,
    JSON.stringify({ question: QUESTIONS[__ITER % QUESTIONS.length], history: [] }),
    {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      timeout: '60s',
    },
  );
  check(res, {
    'status 200': (r) => r.status === 200,
    'has text': (r) => r.status === 200 && r.json('text').length > 0,
  });
  aiLatency.add(res.timings.duration / 1000);
  sleep(2);
}
