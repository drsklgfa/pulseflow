import { io, type Socket } from 'socket.io-client';
import {
  demoCreatePayment,
  demoInvalidSignature,
  demoLogin,
  demoPayment,
  demoRetry,
  demoSimulate,
  demoWorkspace,
  resetDemo,
  subscribeDemo,
} from './demo-store';
import type {
  AuthSession,
  FailureMode,
  Payment,
  RealtimeEvent,
  WorkspaceData,
} from './types';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1';
const forceDemo = String(import.meta.env.VITE_DEMO_MODE ?? 'false') === 'true';
const sessionKey = 'pulseflow-session-v1';

export function isDemoBuild(): boolean {
  return forceDemo;
}

export function readSession(): AuthSession | null {
  const value = localStorage.getItem(sessionKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

function storeSession(session: AuthSession): AuthSession {
  localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

export function logout(): void {
  localStorage.removeItem(sessionKey);
}

export async function login(email: string, password: string, useDemo = forceDemo): Promise<AuthSession> {
  if (useDemo) return storeSession(demoLogin(email, password));
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as AuthSession & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Unable to sign in.');
  return storeSession({ ...payload, demo: false });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const session = readSession();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { 'content-type': 'application/json' } : {}),
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...options?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? `Request failed with ${response.status}.`);
  return payload;
}

export async function loadWorkspace(session = readSession()): Promise<WorkspaceData> {
  if (session?.demo || forceDemo) return demoWorkspace();
  const [dashboard, payments, notifications, webhooks, analytics, queues, audit] = await Promise.all([
    request<WorkspaceData['dashboard']>('/dashboard'),
    request<{ items: Payment[] }>('/payments?pageSize=100'),
    request<{ items: WorkspaceData['notifications'] }>('/notifications?pageSize=100'),
    request<{ items: WorkspaceData['webhooks'] }>('/webhooks?limit=100'),
    request<WorkspaceData['analytics']>('/analytics?days=7'),
    request<WorkspaceData['queues']>('/queues'),
    request<WorkspaceData['audit']>('/audit?limit=100'),
  ]);
  return {
    dashboard,
    payments: payments.items,
    notifications: notifications.items,
    webhooks: webhooks.items,
    analytics,
    queues,
    audit,
  };
}

export async function loadPayment(id: string): Promise<Payment | undefined> {
  const session = readSession();
  if (session?.demo || forceDemo) return demoPayment(id);
  return request<Payment>(`/payments/${id}`);
}

export async function createPayment(input: {
  customerName: string;
  customerEmail: string;
  amount: number;
}): Promise<Payment> {
  const session = readSession();
  if (session?.demo || forceDemo) return demoCreatePayment(input);
  return request<Payment>('/payments', {
    method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}

export async function simulatePayment(
  id: string,
  status: 'APPROVED' | 'DECLINED',
  failureMode: FailureMode,
): Promise<void> {
  const session = readSession();
  if (session?.demo || forceDemo) return demoSimulate(id, status, failureMode);
  await request(`/lab/payments/${id}/event`, {
    method: 'POST',
    body: JSON.stringify({ status, failureMode }),
  });
}

export async function simulateInvalidSignature(id: string): Promise<void> {
  const session = readSession();
  if (session?.demo || forceDemo) return demoInvalidSignature(id);
  await request(`/lab/payments/${id}/invalid-signature`, { method: 'POST' });
}

export async function retryNotification(id: string): Promise<void> {
  const session = readSession();
  if (session?.demo || forceDemo) return demoRetry(id);
  await request(`/notifications/${id}/retry`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Manual retry from the operations dashboard.' }),
  });
}

export function resetDemoWorkspace(): void {
  resetDemo();
}

export function subscribeRealtime(listener: (event: RealtimeEvent) => void): () => void {
  const session = readSession();
  if (session?.demo || forceDemo) return subscribeDemo(listener);
  const base = apiUrl.replace(/\/api\/v1\/?$/, '');
  const socket: Socket = io(`${base}/events`, { transports: ['websocket', 'polling'] });
  socket.on('pulseflow:event', listener);
  return () => socket.disconnect();
}
