import { type ChangeEvent, FormEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  createPayment,
  isDemoBuild,
  loadPayment,
  loadWorkspace,
  login,
  logout,
  readSession,
  resetDemoWorkspace,
  retryNotification,
  simulateInvalidSignature,
  simulatePayment,
  subscribeRealtime,
} from './api';
import { formatDate, formatMoney, formatRelative, titleCase } from './format';
import type {
  AuthSession,
  FailureMode,
  Notification,
  Payment,
  RealtimeEvent,
  View,
  WorkspaceData,
} from './types';

const nav: Array<{ id: View; label: string; icon: string; group?: string }> = [
  { id: 'overview', label: 'Overview', icon: '◫', group: 'OPERATIONS' },
  { id: 'payments', label: 'Payments', icon: '◇' },
  { id: 'webhooks', label: 'Webhooks', icon: '⌁' },
  { id: 'queues', label: 'Queues', icon: '⇄' },
  { id: 'notifications', label: 'Notifications', icon: '✦' },
  { id: 'analytics', label: 'Analytics', icon: '⌇', group: 'INSIGHTS' },
  { id: 'lab', label: 'Failure lab', icon: '⚗' },
  { id: 'audit', label: 'Audit trail', icon: '≡' },
  { id: 'docs', label: 'How it works', icon: '⌘', group: 'LEARN' },
];

const emptyWorkspace: WorkspaceData = {
  dashboard: {
    metrics: { payments: 0, approved: 0, pending: 0, declined: 0, approvalRate: 0, volumeMinorUnits: 0, notificationsSent: 0, notificationsFailed: 0 },
    queues: {},
    recentPayments: [],
    recentEvents: [],
    recentWebhooks: [],
    generatedAt: new Date().toISOString(),
  },
  payments: [],
  notifications: [],
  webhooks: [],
  analytics: { periodDays: 7, series: [], totals: { payments: 0, volumeMinorUnits: 0, approvalRate: 0, deliveryRate: 0, averageAttempts: 0, averageProcessingLatencyMs: 0 }, generatedAt: new Date().toISOString() },
  queues: { notifications: {}, deadLetter: {}, concurrency: 5, retryPolicy: { attempts: 4, strategy: 'exponential', initialDelayMs: 1500 }, generatedAt: new Date().toISOString() },
  audit: [],
};

function statusClass(value: string): string {
  return value.toLowerCase().replaceAll('_', '-');
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [view, setView] = useState<View>('overview');
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [loading, setLoading] = useState(Boolean(session));
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setWorkspace(await loadWorkspace(session));
    } catch (error: unknown) {
      setNotice({ message: error instanceof Error ? error.message : 'Unable to load workspace.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) return undefined;
    return subscribeRealtime((event) => {
      setLiveEvents((current) => [event, ...current].slice(0, 8));
      window.setTimeout(() => void refresh(), 250);
    });
  }, [refresh, session]);

  async function openPayment(id: string): Promise<void> {
    try {
      const payment = await loadPayment(id);
      if (payment) setSelectedPayment(payment);
    } catch (error: unknown) {
      setNotice({ message: error instanceof Error ? error.message : 'Unable to load payment.', tone: 'error' });
    }
  }

  function signOut(): void {
    logout();
    setSession(null);
    setWorkspace(emptyWorkspace);
  }

  if (!session) return <LoginScreen onLogin={setSession} />;

  const title = nav.find((item) => item.id === view)?.label ?? 'Overview';
  return (
    <div className="app-shell">
      <Sidebar
        session={session}
        view={view}
        mobileOpen={mobileMenu}
        onNavigate={(next) => { setView(next); setMobileMenu(false); }}
        onLogout={signOut}
      />
      <main className="main-stage">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileMenu((value) => !value)}>☰</button>
          <div>
            <p className="eyebrow">PAYMENT OPERATIONS</p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <div className={`connection-pill ${session.demo ? 'demo' : 'live'}`}><i />{session.demo ? 'Interactive GitHub demo' : 'Docker stack connected'}</div>
            <button className="icon-button" aria-label="Refresh data" onClick={() => void refresh()}>↻</button>
            <button className="profile-button" title={session.user.email}><span>{session.user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><b>{session.user.name}</b></button>
          </div>
        </header>
        {notice && <div className={`toast ${notice.tone}`} role="status"><span>{notice.message}</span><button aria-label="Close" onClick={() => setNotice(null)}>×</button></div>}
        <section className="page-content">
          {loading ? <Loading /> : <ViewRouter view={view} workspace={workspace} session={session} liveEvents={liveEvents} refresh={refresh} openPayment={openPayment} setNotice={setNotice} />}
        </section>
      </main>
      {selectedPayment && <PaymentDrawer payment={selectedPayment} onClose={() => setSelectedPayment(null)} />}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(isDemoBuild());

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      onLogin(await login(String(form.get('email')), String(form.get('password')), demoMode));
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="visual-grid" />
        <div className="brand large"><span className="brand-mark">P</span><div><strong>PulseFlow</strong><small>Orchestration Lab</small></div></div>
        <div className="login-copy">
          <span className="hero-kicker">PORTFOLIO EDITION · V1.0</span>
          <h1>See every payment event.<br />Control every retry.</h1>
          <p>A complete orchestration workspace for signed webhooks, Redis queues, asynchronous workers and observable notifications.</p>
          <div className="login-flow"><span>API</span><b>→</b><span>Webhook</span><b>→</b><span>Redis</span><b>→</b><span>Worker</span><b>→</b><span>Delivery</span></div>
        </div>
        <div className="floating-card one"><i className="ok-dot" /><div><strong>Webhook verified</strong><small>HMAC · replay protected</small></div></div>
        <div className="floating-card two"><strong>99.7%</strong><small>delivery success</small></div>
      </div>
      <div className="login-panel">
        <form onSubmit={(event: FormEvent<HTMLFormElement>) => void submit(event)}>
          <div className="login-heading"><span>WELCOME BACK</span><h2>Operations console</h2><p>Sign in to explore the full payment lifecycle.</p></div>
          <label>Email address<input name="email" type="email" defaultValue="admin@pulseflow.local" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" defaultValue="PulseFlow123!" autoComplete="current-password" minLength={10} required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Connecting…' : 'Enter workspace'}<span>→</span></button>
          {!isDemoBuild() && <button type="button" className="text-button" onClick={() => setDemoMode((value) => !value)}>{demoMode ? 'Use the local API instead' : 'Explore without Docker'}</button>}
          <div className="demo-credentials"><span>Demo credentials</span><code>admin@pulseflow.local</code><code>PulseFlow123!</code></div>
          <p className="login-note"><i /> No external account, payment card or paid service is required.</p>
        </form>
      </div>
    </div>
  );
}

function Sidebar({ session, view, mobileOpen, onNavigate, onLogout }: { session: AuthSession; view: View; mobileOpen: boolean; onNavigate: (view: View) => void; onLogout: () => void }) {
  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-mark">P</span><div><strong>PulseFlow</strong><small>Orchestration Lab</small></div></div>
      <nav>
        {nav.map((item, index) => <div key={item.id}>{item.group && <p className="nav-group">{item.group}</p>}<button className={view === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><span>{item.icon}</span>{item.label}{item.id === 'notifications' && <i className="nav-count">2</i>}</button>{index === 4 && <div className="nav-divider" />}</div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="environment-card"><span className="pulse-dot" /><div><strong>{session.demo ? 'Demo engine online' : 'Services healthy'}</strong><small>API · Postgres · Redis · Worker</small></div></div>
        <button className="logout-button" onClick={onLogout}><span>↪</span>Sign out</button>
        <p className="version">v1.0.1 · GitHub Pages ready</p>
      </div>
    </aside>
  );
}

function ViewRouter({ view, workspace, session, liveEvents, refresh, openPayment, setNotice }: { view: View; workspace: WorkspaceData; session: AuthSession; liveEvents: RealtimeEvent[]; refresh: () => Promise<void>; openPayment: (id: string) => Promise<void>; setNotice: (notice: { message: string; tone: 'success' | 'error' | 'info' } | null) => void }) {
  const common = { workspace, refresh, setNotice };
  if (view === 'payments') return <PaymentsView {...common} openPayment={openPayment} />;
  if (view === 'webhooks') return <WebhooksView workspace={workspace} />;
  if (view === 'queues') return <QueuesView workspace={workspace} />;
  if (view === 'notifications') return <NotificationsView {...common} />;
  if (view === 'analytics') return <AnalyticsView workspace={workspace} />;
  if (view === 'lab') return <LabView {...common} session={session} />;
  if (view === 'audit') return <AuditView workspace={workspace} />;
  if (view === 'docs') return <DocsView />;
  return <Overview workspace={workspace} liveEvents={liveEvents} openPayment={openPayment} />;
}

function Loading() {
  return <div className="loading"><span /><strong>Synchronizing operations</strong><p>Reading Postgres, Redis and worker telemetry…</p></div>;
}

function Overview({ workspace, liveEvents, openPayment }: { workspace: WorkspaceData; liveEvents: RealtimeEvent[]; openPayment: (id: string) => Promise<void> }) {
  const { dashboard } = workspace;
  const metrics = dashboard.metrics;
  return <>
    <div className="hero-card">
      <div><span className="hero-kicker">RESILIENT BY DESIGN</span><h2>Payments keep moving,<br />even when providers do not.</h2><p>Observe signed events, queue retries and customer notifications from a single operational timeline.</p><div className="hero-tags"><span>Idempotent</span><span>Async</span><span>Observable</span><span>Portable</span></div></div>
      <FlowGraphic />
    </div>
    <div className="metric-grid">
      <Metric title="Processed volume" value={formatMoney(metrics.volumeMinorUnits)} detail={`${metrics.payments} payments`} trend="+12.8%" />
      <Metric title="Approval rate" value={`${metrics.approvalRate}%`} detail={`${metrics.approved} approved`} trend="+2.4%" />
      <Metric title="Notifications sent" value={metrics.notificationsSent.toLocaleString('pt-BR')} detail={`${metrics.notificationsFailed} terminal failures`} trend="99.7%" />
      <Metric title="Jobs waiting" value={String(dashboard.queues.waiting ?? 0)} detail={`${dashboard.queues.active ?? 0} currently active`} trend="healthy" />
    </div>
    <div className="overview-grid">
      <ProcessChart workspace={workspace} />
      <RecentPayments payments={dashboard.recentPayments} openPayment={openPayment} />
      <EventFeed events={liveEvents.length ? liveEvents : dashboard.recentEvents.map((event) => ({ id: event.id, type: event.type.toLowerCase(), occurredAt: event.createdAt, correlationId: event.correlationId, payload: { customerName: event.payment?.customerName ?? '' } }))} />
      <ServiceTopology />
    </div>
  </>;
}

function Metric({ title, value, detail, trend }: { title: string; value: string; detail: string; trend: string }) {
  return <article className="metric-card"><div className="metric-head"><span>{title}</span><i>•••</i></div><strong>{value}</strong><div className="metric-foot"><span>{detail}</span><b>{trend}</b></div></article>;
}

function FlowGraphic() {
  return <div className="flow-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="flow-node api">API<small>validate</small></div><div className="flow-link first"><i /></div><div className="flow-node redis">Redis<small>enqueue</small></div><div className="flow-link second"><i /></div><div className="flow-node worker">Worker<small>deliver</small></div><div className="flow-spark s1" /><div className="flow-spark s2" /></div>;
}

function ProcessChart({ workspace }: { workspace: WorkspaceData }) {
  const points = workspace.analytics.series;
  const max = Math.max(1, ...points.map((point) => point.payments));
  return <article className="panel chart-panel"><PanelTitle title="Processing flow" subtitle="Last seven days" action="7 days" /><div className="chart-summary"><strong>{workspace.analytics.totals.payments}</strong><span>events orchestrated</span></div><div className="bar-chart">{points.map((point) => <div className="bar-column" key={point.date}><div className="bar-stack"><i className="bar-approved" style={{ height: `${Math.max(7, (point.approved / max) * 145)}px` }} /><i className="bar-declined" style={{ height: `${(point.declined / max) * 145}px` }} /></div><span>{new Date(`${point.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' })}</span></div>)}</div><div className="chart-legend"><span><i className="approved-dot" />Approved</span><span><i className="declined-dot" />Declined</span></div></article>;
}

function RecentPayments({ payments, openPayment }: { payments: Payment[]; openPayment: (id: string) => Promise<void> }) {
  return <article className="panel recent-panel"><PanelTitle title="Recent payments" subtitle="Select one to inspect its timeline" /><div className="payment-list">{payments.slice(0, 6).map((payment) => <button className="payment-row" key={payment.id} onClick={() => void openPayment(payment.id)}><div className="person-icon">{payment.customerName.slice(0, 1)}</div><div className="payment-person"><strong>{payment.customerName}</strong><small>{formatRelative(payment.createdAt)}</small></div><div className="payment-amount"><strong>{formatMoney(payment.amount, payment.currency)}</strong><Status value={payment.status} /></div></button>)}</div></article>;
}

function EventFeed({ events }: { events: RealtimeEvent[] }) {
  return <article className="panel event-panel"><PanelTitle title="Live event stream" subtitle="Redis Pub/Sub → WebSocket" action={<span className="live-label"><i />LIVE</span>} /><div className="event-list">{events.slice(0, 6).map((event) => <div className="event-row" key={event.id}><span className={`event-symbol ${event.type.includes('failed') ? 'danger' : ''}`}>{event.type.includes('payment') ? '◇' : event.type.includes('webhook') ? '⌁' : '✦'}</span><div><strong>{titleCase(event.type.replaceAll('.', ' '))}</strong><small>{String(event.payload.customerName ?? event.payload.paymentId ?? 'Orchestration event')}</small></div><time>{formatRelative(event.occurredAt)}</time></div>)}</div></article>;
}

function ServiceTopology() {
  return <article className="panel topology-panel"><PanelTitle title="Service topology" subtitle="One command, six containers" /><div className="topology"><div><span>WEB</span><small>React + Vite</small></div><b>↔</b><div><span>API</span><small>NestJS</small></div><b>↔</b><div><span>DATA</span><small>Postgres + Redis</small></div><b>↔</b><div><span>WORKER</span><small>BullMQ</small></div></div><div className="health-row"><span><i />PostgreSQL healthy</span><span><i />Redis healthy</span><span><i />Worker active</span></div></article>;
}

function PaymentsView({ workspace, refresh, openPayment, setNotice }: { workspace: WorkspaceData; refresh: () => Promise<void>; openPayment: (id: string) => Promise<void>; setNotice: (notice: { message: string; tone: 'success' | 'error' | 'info' } | null) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const filtered = workspace.payments.filter((payment) => (status === 'ALL' || payment.status === status) && `${payment.customerName} ${payment.customerEmail} ${payment.externalId ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createPayment({ customerName: String(form.get('name')), customerEmail: String(form.get('email')), amount: Number(form.get('amount')) });
      event.currentTarget.reset(); setShowForm(false); await refresh();
      setNotice({ message: 'Payment created with a unique idempotency key.', tone: 'success' });
    } catch (error: unknown) { setNotice({ message: error instanceof Error ? error.message : 'Unable to create payment.', tone: 'error' }); }
  }

  return <>
    <SectionHeading eyebrow="TRANSACTION CONTROL" title="Payments" text="Persisted requests with deterministic state transitions and a complete processing timeline." action={<button className="primary" onClick={() => setShowForm((value) => !value)}>+ New payment</button>} />
    {showForm && <form className="create-form" onSubmit={(event: FormEvent<HTMLFormElement>) => void submit(event)}><label>Customer name<input name="name" required minLength={2} placeholder="Full name" /></label><label>Email address<input name="email" type="email" required placeholder="customer@example.com" /></label><label>Amount (R$)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="149.90" /></label><button className="primary">Create payment</button></form>}
    <div className="table-toolbar"><label className="search-box">⌕<input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search customer or provider ID" /></label><div className="filter-tabs">{['ALL', 'PENDING', 'APPROVED', 'DECLINED', 'CANCELLED'].map((item) => <button className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{titleCase(item)}</button>)}</div></div>
    <article className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Customer</th><th>Amount</th><th>Provider</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{filtered.map((payment) => <tr key={payment.id}><td><div className="customer-cell"><span>{payment.customerName[0]}</span><div><strong>{payment.customerName}</strong><small>{payment.customerEmail}</small></div></div></td><td><strong>{formatMoney(payment.amount, payment.currency)}</strong></td><td><span className="provider-badge">{payment.provider}</span></td><td><Status value={payment.status} /></td><td>{formatDate(payment.createdAt)}</td><td><button className="row-action" onClick={() => void openPayment(payment.id)}>Inspect →</button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing {filtered.length} of {workspace.payments.length} payments</span><span>Idempotency protected</span></div></article>
  </>;
}

function WebhooksView({ workspace }: { workspace: WorkspaceData }) {
  const valid = workspace.webhooks.filter((item) => item.signatureValid).length;
  return <><SectionHeading eyebrow="SIGNED EVENTS" title="Webhook inbox" text="Every provider callback is authenticated, deduplicated and retained for inspection." /><div className="mini-metrics"><Metric title="Events received" value={String(workspace.webhooks.length)} detail="retained in PostgreSQL" trend="audited" /><Metric title="Valid signatures" value={String(valid)} detail={`${workspace.webhooks.length - valid} rejected`} trend={`${workspace.webhooks.length ? Math.round(valid / workspace.webhooks.length * 100) : 0}%`} /><Metric title="Providers" value={String(new Set(workspace.webhooks.map((item) => item.provider)).size)} detail="mock and Stripe ready" trend="HMAC" /></div><article className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Event</th><th>Provider</th><th>Signature</th><th>Processing</th><th>Received</th></tr></thead><tbody>{workspace.webhooks.map((webhook) => <tr key={webhook.id}><td><strong>{webhook.eventType}</strong><small className="mono">{webhook.externalEventId}</small></td><td><span className="provider-badge">{webhook.provider}</span></td><td><span className={`signature ${webhook.signatureValid ? 'valid' : 'invalid'}`}>{webhook.signatureValid ? '✓ Verified' : '× Rejected'}</span></td><td>{webhook.processingError ? <span className="error-text">{webhook.processingError}</span> : <span className="success-text">Idempotent processing</span>}</td><td>{formatDate(webhook.receivedAt)}</td></tr>)}</tbody></table></div></article></>;
}

function QueuesView({ workspace }: { workspace: WorkspaceData }) {
  const counts = workspace.queues.notifications;
  const stages = [
    ['waiting', 'Waiting', 'Persisted jobs ready for a worker'],
    ['active', 'Active', 'Currently being processed'],
    ['completed', 'Completed', 'Retained for observability'],
    ['failed', 'Failed', 'Available for manual retry'],
    ['delayed', 'Delayed', 'Backoff before the next attempt'],
    ['deadLetter', 'Dead letter', 'Terminal failures isolated safely'],
  ] as const;
  return <><SectionHeading eyebrow="BULLMQ + REDIS" title="Queue operations" text="Decoupled processing with concurrency, exponential backoff and dead-letter isolation." /><div className="queue-grid">{stages.map(([key, title, text], index) => <article className={`queue-card ${key === 'failed' || key === 'deadLetter' ? 'warning' : ''}`} key={key}><span className="queue-index">0{index + 1}</span><strong>{key === 'deadLetter' ? workspace.dashboard.queues.deadLetter ?? workspace.queues.deadLetter.waiting ?? 0 : counts[key] ?? 0}</strong><h3>{title}</h3><p>{text}</p><div className="queue-bar"><i style={{ width: `${Math.min(100, Number(key === 'deadLetter' ? workspace.queues.deadLetter.waiting ?? 0 : counts[key] ?? 0) / 20 * 100)}%` }} /></div></article>)}</div><div className="two-panel"><article className="panel policy-card"><PanelTitle title="Retry policy" subtitle="Configured once, applied to every notification" /><div className="policy-grid"><div><span>Attempts</span><strong>{workspace.queues.retryPolicy.attempts}</strong></div><div><span>Strategy</span><strong>{titleCase(workspace.queues.retryPolicy.strategy)}</strong></div><div><span>Initial delay</span><strong>{workspace.queues.retryPolicy.initialDelayMs} ms</strong></div><div><span>Concurrency</span><strong>{workspace.queues.concurrency} workers</strong></div></div></article><article className="panel pipeline-card"><PanelTitle title="Job lifecycle" subtitle="From API response to customer delivery" /><div className="pipeline"><span>Event</span><b>→</b><span>Queue</span><b>→</b><span>Worker</span><b>→</b><span>Provider</span><b>→</b><span>Audit</span></div></article></div></>;
}

function NotificationsView({ workspace, refresh, setNotice }: { workspace: WorkspaceData; refresh: () => Promise<void>; setNotice: (notice: { message: string; tone: 'success' | 'error' | 'info' } | null) => void }) {
  async function retry(item: Notification): Promise<void> {
    try { await retryNotification(item.id); await refresh(); setNotice({ message: 'The failed notification returned to the queue and completed.', tone: 'success' }); }
    catch (error: unknown) { setNotice({ message: error instanceof Error ? error.message : 'Unable to retry.', tone: 'error' }); }
  }
  return <><SectionHeading eyebrow="DELIVERY OPERATIONS" title="Notifications" text="Inspect attempts, provider errors and delivery outcomes without blocking the payment API." /><article className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Recipient</th><th>Channel</th><th>Status</th><th>Attempts</th><th>Last result</th><th /></tr></thead><tbody>{workspace.notifications.map((notification) => <tr key={notification.id}><td><strong>{notification.payment?.customerName ?? notification.recipient}</strong><small>{notification.recipient}</small></td><td><span className="provider-badge">{notification.channel}</span></td><td><Status value={notification.status} /></td><td><span className="attempts">{notification.attempts}/{notification.maxAttempts}</span></td><td>{notification.lastError ? <span className="error-text">{notification.lastError}</span> : <span className="success-text">Delivered {notification.sentAt ? formatRelative(notification.sentAt) : ''}</span>}</td><td>{notification.status === 'FAILED' && <button className="row-action danger-action" onClick={() => void retry(notification)}>Retry →</button>}</td></tr>)}</tbody></table></div></article></>;
}

function AnalyticsView({ workspace }: { workspace: WorkspaceData }) {
  const { analytics } = workspace;
  const maxVolume = Math.max(1, ...analytics.series.map((point) => point.volumeMinorUnits));
  return <><SectionHeading eyebrow="OPERATIONAL INTELLIGENCE" title="Analytics" text="Conversion, delivery quality, retry behavior and end-to-end latency in one view." /><div className="metric-grid analytics-metrics"><Metric title="Approval rate" value={`${analytics.totals.approvalRate}%`} detail={`${analytics.totals.payments} analyzed payments`} trend="conversion" /><Metric title="Delivery rate" value={`${analytics.totals.deliveryRate}%`} detail="after all retry attempts" trend="reliability" /><Metric title="Average attempts" value={String(analytics.totals.averageAttempts)} detail="per notification" trend="efficient" /><Metric title="Processing latency" value={`${analytics.totals.averageProcessingLatencyMs} ms`} detail="payment to delivery" trend="end-to-end" /></div><div className="analytics-grid"><article className="panel volume-chart"><PanelTitle title="Processed volume" subtitle="Daily payment value" /><div className="vertical-chart">{analytics.series.map((point) => <div key={point.date}><i style={{ height: `${Math.max(4, point.volumeMinorUnits / maxVolume * 190)}px` }} /><span>{new Date(`${point.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' })}</span><small>{formatMoney(point.volumeMinorUnits)}</small></div>)}</div></article><article className="panel reliability-card"><PanelTitle title="Reliability score" subtitle="Composite portfolio metric" /><div className="score-ring"><div><strong>96</strong><span>/100</span></div></div><ul><li><span>Webhook verification</span><b>100%</b></li><li><span>Queue delivery</span><b>{analytics.totals.deliveryRate}%</b></li><li><span>Replay protection</span><b>100%</b></li><li><span>Worker availability</span><b>99.9%</b></li></ul></article></div></>;
}

function LabView({ workspace, session, refresh, setNotice }: { workspace: WorkspaceData; session: AuthSession; refresh: () => Promise<void>; setNotice: (notice: { message: string; tone: 'success' | 'error' | 'info' } | null) => void }) {
  const pending = workspace.payments.filter((item) => item.status === 'PENDING');
  const [paymentId, setPaymentId] = useState(pending[0]?.id ?? '');
  const [status, setStatus] = useState<'APPROVED' | 'DECLINED'>('APPROVED');
  const [failureMode, setFailureMode] = useState<FailureMode>('NONE');
  const [busy, setBusy] = useState(false);

  async function run(): Promise<void> {
    if (!paymentId) { setNotice({ message: 'Create or select a pending payment first.', tone: 'info' }); return; }
    setBusy(true);
    try { await simulatePayment(paymentId, status, failureMode); await refresh(); setNotice({ message: `Scenario completed: ${status.toLowerCase()} with ${failureMode.toLowerCase().replaceAll('_', ' ')}.`, tone: 'success' }); }
    catch (error: unknown) { setNotice({ message: error instanceof Error ? error.message : 'Scenario failed.', tone: 'error' }); }
    finally { setBusy(false); }
  }

  async function invalid(): Promise<void> {
    if (!paymentId) return;
    try { await simulateInvalidSignature(paymentId); await refresh(); setNotice({ message: 'Invalid webhook rejected and preserved in the audit trail.', tone: 'success' }); }
    catch (error: unknown) { setNotice({ message: error instanceof Error ? error.message : 'Unable to run scenario.', tone: 'error' }); }
  }

  return <><SectionHeading eyebrow="CHAOS & RELIABILITY" title="Failure laboratory" text="Demonstrate retries and security controls safely, without moving real money or calling paid services." /><div className="lab-layout"><article className="panel scenario-builder"><PanelTitle title="Build a scenario" subtitle={`${pending.length} pending payment(s) available`} /><label>Target payment<select value={paymentId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPaymentId(event.target.value)}><option value="">Select a pending payment</option>{pending.map((payment) => <option key={payment.id} value={payment.id}>{payment.customerName} · {formatMoney(payment.amount)}</option>)}</select></label><div className="option-group"><span>Provider outcome</span><div>{(['APPROVED', 'DECLINED'] as const).map((item) => <button className={status === item ? 'selected' : ''} onClick={() => setStatus(item)} key={item}>{item === 'APPROVED' ? '✓ Approve' : '× Decline'}</button>)}</div></div><div className="option-group"><span>Notification behavior</span><div className="four-options">{(['NONE', 'FAIL_ONCE', 'FAIL_ALWAYS', 'TIMEOUT'] as FailureMode[]).map((item) => <button className={failureMode === item ? 'selected' : ''} onClick={() => setFailureMode(item)} key={item}>{titleCase(item)}</button>)}</div></div><button className="primary full" disabled={busy} onClick={() => void run()}>{busy ? 'Running scenario…' : 'Execute full workflow'}<span>→</span></button></article><div className="scenario-cards"><LabCard icon="⌁" title="Reject forged webhook" text="Sends an invalid HMAC signature and confirms that no state transition occurs." action="Run security check" onClick={() => void invalid()} /><LabCard icon="↻" title="Observe exponential retry" text="Choose Fail Once to watch the worker recover on its second attempt." action="Configure above" onClick={() => setFailureMode('FAIL_ONCE')} /><LabCard icon="⊘" title="Populate dead-letter queue" text="Choose Fail Always to exhaust all attempts and isolate the terminal job." action="Configure above" onClick={() => setFailureMode('FAIL_ALWAYS')} /><LabCard icon="⟲" title="Reset portfolio data" text="Restore the curated dataset used by the GitHub Pages demonstration." action="Reset demo" onClick={() => { if (session.demo) { resetDemoWorkspace(); void refresh(); setNotice({ message: 'Demo dataset restored.', tone: 'success' }); } else setNotice({ message: 'Reset is only available in the static demo.', tone: 'info' }); }} /></div></div></>;
}

function LabCard({ icon, title, text, action, onClick }: { icon: string; title: string; text: string; action: string; onClick: () => void }) {
  return <article className="lab-card"><span className="lab-icon">{icon}</span><div><h3>{title}</h3><p>{text}</p></div><button onClick={onClick}>{action}<span>→</span></button></article>;
}

function AuditView({ workspace }: { workspace: WorkspaceData }) {
  return <><SectionHeading eyebrow="ACCOUNTABILITY" title="Audit trail" text="Administrative actions are attributed, timestamped and linked to the affected resource." /><article className="panel audit-list">{workspace.audit.map((entry) => <div className="audit-row" key={entry.id}><span className="audit-icon">{entry.action.includes('retry') ? '↻' : entry.action.includes('reject') ? '×' : '✓'}</span><div><strong>{titleCase(entry.action.replaceAll('.', ' '))}</strong><p>{entry.resource}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 18)}` : ''}</p></div><div className="audit-actor"><span>{entry.actor?.name ?? 'System'}</span><small>{entry.actor?.role ?? 'SERVICE'}</small></div><time>{formatDate(entry.createdAt)}</time></div>)}</article></>;
}

function DocsView() {
  const steps = ['The API authenticates the operator and validates the payment request.', 'The payment provider adapter creates a mock or Stripe payment intent.', 'A signed webhook passes HMAC verification and replay protection.', 'BullMQ persists a notification job in Redis without blocking HTTP.', 'The worker applies retry policy and delivers through Mailpit or Resend.', 'PostgreSQL stores the full timeline while WebSocket updates the dashboard.'];
  return <><SectionHeading eyebrow="ARCHITECTURE YOU CAN STUDY" title="How PulseFlow works" text="A demo-first design that remains deployable without rewriting the core domain." /><div className="docs-grid"><article className="panel docs-main"><PanelTitle title="End-to-end workflow" subtitle="Every layer is independently replaceable" />{steps.map((text, index) => <div className="doc-step" key={text}><span>{String(index + 1).padStart(2, '0')}</span><p>{text}</p></div>)}</article><article className="panel code-card"><div className="code-head"><span>Run the complete stack</span><i>terminal</i></div><pre><code>git clone https://github.com/drsklgfa/pulseflow.git{`\n`}cd pulseflow{`\n`}docker compose up --build</code></pre><div className="endpoints"><p><b>Dashboard</b><span>localhost:3000</span></p><p><b>API</b><span>localhost:3333/api/v1</span></p><p><b>Swagger</b><span>localhost:3333/docs</span></p><p><b>Mailpit</b><span>localhost:8025</span></p></div></article><article className="panel patterns-card"><PanelTitle title="Patterns demonstrated" subtitle="Portfolio signals beyond a CRUD" /><div className="pattern-tags">{['Hexagonal adapters', 'Idempotency', 'HMAC signatures', 'Replay protection', 'Background jobs', 'Dead-letter queue', 'Exponential backoff', 'RBAC', 'Audit logs', 'WebSockets', 'Health checks', 'CI/CD'].map((item) => <span key={item}>{item}</span>)}</div></article><article className="panel deployment-card"><PanelTitle title="Portable by default" subtitle="No hosting platform is mandatory" /><p>The repository is complete on GitHub. Docker runs the full application locally; GitHub Pages publishes the interactive browser demo; environment adapters enable Stripe and Resend later.</p><div><span>GitHub only</span><b>→</b><span>Docker local</span><b>→</b><span>Cloud optional</span></div></article></div></>;
}

function PaymentDrawer({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="payment-drawer" onClick={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}><div className="drawer-head"><div><span>PAYMENT TIMELINE</span><h2>{payment.customerName}</h2><p className="mono">{payment.id}</p></div><button onClick={onClose}>×</button></div><div className="drawer-summary"><div><span>Amount</span><strong>{formatMoney(payment.amount, payment.currency)}</strong></div><div><span>Provider</span><strong>{payment.provider}</strong></div><div><span>Status</span><Status value={payment.status} /></div></div><div className="timeline"><h3>Processing history</h3>{(payment.timeline ?? []).map((event, index) => <div className="timeline-item" key={event.id}><div className="timeline-rail"><i className={event.type.includes('FAILED') || event.type.includes('REJECTED') ? 'danger' : ''}>{index + 1}</i><span /></div><div><time>{formatDate(event.createdAt)}</time><strong>{event.title}</strong><p>{event.description}</p><small className="mono">correlation: {event.correlationId}</small></div></div>)}</div></aside></div>;
}

function Status({ value }: { value: string }) {
  return <span className={`status ${statusClass(value)}`}><i />{titleCase(value)}</span>;
}

function PanelTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="panel-title"><div><span>{title}</span><small>{subtitle}</small></div>{action && <div>{action}</div>}</div>;
}

function SectionHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: ReactNode }) {
  return <div className="section-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{action}</div>;
}
