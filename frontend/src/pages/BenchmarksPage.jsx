import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FlaskConical,
  Gauge,
  Server,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { CALIPER_RUN } from '../shared/benchmarks.js';
import { Badge } from '../components/ui/Badges.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { CopyButton } from '../components/ui/CopyButton.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';

const REPRO_COMMAND = [
  '# install the Caliper harness once',
  'npm run bench:install',
  '',
  '# in one terminal: Anvil + the app',
  'npm run dev',
  '',
  '# in another: deploy a scratch contract and run the rounds',
  'npm run bench',
].join('\n');

const MEASURED = [
  'ABI encoding and calldata',
  'Transaction signing and relay',
  'EVM execution and gas',
  'Receipt confirmation (one block)',
  'Public status view calls',
];

const NOT_MEASURED = [
  'Browser AES-256-GCM / ECIES',
  'Wallet signatures and vault unlock',
  'React rendering and event indexing',
  'Multi-worker or production networks',
];

function PercentBar({ value, max, tone = 'write' }) {
  const width = max ? Math.max(3, (value / max) * 100) : 0;
  return (
    <span className="bench-bar-track" aria-hidden="true">
      <span
        className={`bench-bar-fill bench-bar-fill--${tone}`}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

export function BenchmarksPage() {
  usePageTitle('Benchmarks');

  const maxThroughput = Math.max(...CALIPER_RUN.rounds.map((round) => round.throughput));
  const write = CALIPER_RUN.rounds.find((round) => round.kind === 'write');
  const read = CALIPER_RUN.rounds.find((round) => round.kind === 'read');

  return (
    <main className="public-main benchmark-page">
      <div className="privacy-hero benchmark-hero">
        <span className="eyebrow">
          Hyperledger Caliper · local Anvil
        </span>
        <h1>Measured on-chain.</h1>
        <p>
          A two-round Caliper microbenchmark of the BlockTrack contract: encrypted
          order creation on the write path, and the status-only public read path.
          Reproducible, committed, and deliberately separate from the browser&apos;s
          encryption work.
        </p>
        <div className="row row--wrap" style={{ marginTop: 18 }}>
          <Badge tone="green" icon={Check}>
            {CALIPER_RUN.roundsSuccessful}/{CALIPER_RUN.roundsTotal} rounds passed
          </Badge>
          <Badge tone="blue" icon={Gauge}>
            {write.throughput.toFixed(1)} TPS write
          </Badge>
          <Badge tone="violet" icon={Activity}>
            {read.throughput.toFixed(1)} TPS read
          </Badge>
          <Badge tone="neutral" icon={FlaskConical}>
            Caliper {CALIPER_RUN.toolVersion}
          </Badge>
        </div>

        <div className="bench-run-meta">
          <span>
            <Calendar size={13} aria-hidden="true" />
            {CALIPER_RUN.dateLabel}
          </span>
          <span>
            <Clock size={13} aria-hidden="true" />
            {CALIPER_RUN.durationSeconds.toFixed(1)} s
          </span>
          <span>
            <Server size={13} aria-hidden="true" />
            {CALIPER_RUN.chain} · chain {CALIPER_RUN.chainId}
          </span>
          <span>
            <ShieldCheck size={13} aria-hidden="true" />
            {CALIPER_RUN.workers} worker · scratch contract
          </span>
        </div>
      </div>

      <section className="privacy-section" aria-labelledby="bench-summary">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="bench-summary">
              The run
            </h2>
            <p className="section__sub">
              Local single-worker Caliper run. Two fixed-rate rounds, no failures.
            </p>
          </div>
          <Badge tone="neutral" icon={ShieldCheck}>
            Committed snapshot
          </Badge>
        </div>

        <div className="stat-grid">
          <StatCard
            label="Write throughput"
            value={`${write.throughput.toFixed(1)} TPS`}
            meta={`${write.transactions} create-order transactions`}
            icon={ArrowUpRight}
            tone="accent"
          />
          <StatCard
            label="Read throughput"
            value={`${read.throughput.toFixed(1)} TPS`}
            meta={`${read.transactions} public status reads`}
            icon={Activity}
            tone="success"
          />
          <StatCard
            label="Write latency"
            value={`${Math.round(write.latency.avg * 1000)} ms`}
            meta={`avg · ${Math.round(write.latency.max * 1000)} ms max`}
            icon={Clock}
            tone="warn"
          />
          <StatCard
            label="Failures"
            value="0"
            meta="2/2 rounds completed"
            icon={Check}
            tone="success"
          />
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="bench-rounds">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="bench-rounds">
              Round results
            </h2>
            <p className="section__sub">
              Throughput and latency as reported by Caliper.
            </p>
          </div>
          <span className="field__hint">
            {CALIPER_RUN.tool} {CALIPER_RUN.toolVersion}
          </span>
        </div>

        <div className="bench-results-grid">
          <section className="card bench-chart" aria-labelledby="bench-chart-title">
            <div className="row row--between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 className="card__title" id="bench-chart-title">
                  Throughput
                </h3>
                <p className="card__subtitle">Measured transactions per second.</p>
              </div>
              <Badge tone="blue" icon={Gauge}>
                TPS
              </Badge>
            </div>
            <div className="bench-bars" role="img" aria-label="Throughput: create order 5.1 TPS and public status read 20.2 TPS">
              {CALIPER_RUN.rounds.map((round) => (
                <div className="bench-bar-row" key={round.key}>
                  <span className="bench-bar-label">{round.kind === 'write' ? 'Create order' : 'Public read'}</span>
                  <PercentBar
                    value={round.throughput}
                    max={maxThroughput}
                    tone={round.kind}
                  />
                  <span className="bench-bar-value">{round.throughput.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="bench-chart__legend">
              <span>
                <span className="chart__swatch" aria-hidden="true" />
                Configured {write.configuredTps} / {read.configuredTps} TPS
              </span>
              <span>Peak {maxThroughput.toFixed(1)} TPS</span>
            </div>
          </section>

          <section className="card card--pad bench-setup" aria-labelledby="bench-setup-title">
            <div className="row row--between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 className="card__title" id="bench-setup-title">
                  Test setup
                </h3>
                <p className="card__subtitle">What produced these numbers.</p>
              </div>
              <Terminal size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            </div>
            <dl className="bench-kv">
              <div>
                <dt>Chain</dt>
                <dd>{CALIPER_RUN.chain} · {CALIPER_RUN.chainId}</dd>
              </div>
              <div>
                <dt>Tool</dt>
                <dd>Caliper {CALIPER_RUN.toolVersion}</dd>
              </div>
              <div>
                <dt>Adapter</dt>
                <dd>{CALIPER_RUN.adapter} {CALIPER_RUN.adapterVersion}</dd>
              </div>
              <div>
                <dt>Workload</dt>
                <dd>Fixed rate · 1 worker</dd>
              </div>
              <div>
                <dt>Contract</dt>
                <dd>{CALIPER_RUN.contractLabel}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{CALIPER_RUN.durationSeconds.toFixed(1)} s</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="card desktop-only" style={{ marginTop: 12 }}>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                Caliper benchmark round results
              </caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Type</th>
                  <th scope="col">Transactions</th>
                  <th scope="col">Success</th>
                  <th scope="col">Send rate</th>
                  <th scope="col">Throughput</th>
                  <th scope="col">Avg latency</th>
                  <th scope="col">Max latency</th>
                </tr>
              </thead>
              <tbody>
                {CALIPER_RUN.rounds.map((round) => (
                  <tr key={round.key}>
                    <td>
                      <span className="table__id">{round.label}</span>
                      <span className="table__muted" style={{ display: 'block', marginTop: 2 }}>{round.description}</span>
                    </td>
                    <td>
                      <Badge tone={round.kind === 'write' ? 'blue' : 'green'}>
                        {round.typeLabel}
                      </Badge>
                    </td>
                    <td className="tabular">{round.transactions}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="tabular" style={{ color: 'var(--green)' }}>
                        {round.success}
                      </span>
                      <span className="table__muted"> / {round.failed} failed</span>
                    </td>
                    <td className="tabular">{round.sendRate.toFixed(1)} TPS</td>
                    <td className="tabular">{round.throughput.toFixed(1)} TPS</td>
                    <td className="tabular">{round.latency.avg.toFixed(2)} s</td>
                    <td className="tabular">{round.latency.max.toFixed(2)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mobile-only bench-round-cards">
          {CALIPER_RUN.rounds.map((round) => (
            <article className="bench-round-card" key={round.key}>
              <div className="bench-round-card__head">
                <div>
                  <h3 className="bench-round-card__title">{round.label}</h3>
                  <p className="bench-round-card__desc">{round.description}</p>
                </div>
                <Badge tone={round.kind === 'write' ? 'blue' : 'green'}>
                  {round.typeLabel}
                </Badge>
              </div>
              <div className="bench-round-card__grid">
                <div className="bench-round-card__stat">
                  <span>Transactions</span>
                  <strong>{round.transactions}</strong>
                </div>
                <div className="bench-round-card__stat">
                  <span>Success</span>
                  <strong>{round.success} / {round.failed}</strong>
                </div>
                <div className="bench-round-card__stat">
                  <span>Send rate</span>
                  <strong>{round.sendRate.toFixed(1)} TPS</strong>
                </div>
                <div className="bench-round-card__stat">
                  <span>Throughput</span>
                  <strong>{round.throughput.toFixed(1)} TPS</strong>
                </div>
                <div className="bench-round-card__stat">
                  <span>Avg latency</span>
                  <strong>{round.latency.avg.toFixed(2)} s</strong>
                </div>
                <div className="bench-round-card__stat">
                  <span>Max latency</span>
                  <strong>{round.latency.max.toFixed(2)} s</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="bench-method">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="bench-method">
              What this measures
            </h2>
            <p className="section__sub">
              Caliper is a chain-level tool. It is honest about the boundary.
            </p>
          </div>
        </div>

        <div className="privacy-split bench-method">
          <div className="card card--pad">
            <div className="row" style={{ marginBottom: 6 }}>
              <Gauge size={15} aria-hidden="true" style={{ color: 'var(--green)' }} />
              <h3 className="card__title">In the benchmark</h3>
            </div>
            <ul className="privacy-list privacy-list--check">
              {MEASURED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="card card--pad">
            <div className="row" style={{ marginBottom: 6 }}>
              <X size={15} aria-hidden="true" style={{ color: 'var(--red)' }} />
              <h3 className="card__title">Measured elsewhere</h3>
            </div>
            <ul className="privacy-list bench-list--no">
              {NOT_MEASURED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="field__hint" style={{ marginTop: 10 }}>
              The crypto tests and browser E2E cover those paths.
            </p>
          </div>
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="bench-repro">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="bench-repro">
              Reproduce it
            </h2>
            <p className="section__sub">
              The harness is optional. The app runtime does not depend on Caliper.
            </p>
          </div>
        </div>

        <div className="bench-repro">
          <div className="bench-code">
            <div className="bench-code__head">
              <span className="row" style={{ gap: 6 }}>
                <Terminal size={13} aria-hidden="true" />
                terminal
              </span>
              <CopyButton value={REPRO_COMMAND} label="Copy benchmark commands" showLabel />
            </div>
            <pre>
              <code>{REPRO_COMMAND}</code>
            </pre>
          </div>

          <div className="card card--pad bench-report">
            <span className="bench-report__icon">
              <FlaskConical size={18} aria-hidden="true" />
            </span>
            <h3 className="card__title">The full report</h3>
            <p>
              Caliper&apos;s native HTML report includes the round metrics, the
              benchmark config and the run metadata.
            </p>
            <a
              className="btn btn--primary"
              href={CALIPER_RUN.reportPath}
              target="_blank"
              rel="noreferrer"
            >
              Open Caliper report
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <p className="field__hint" style={{ marginTop: 10 }}>
              Committed output from the {CALIPER_RUN.dateLabel} run.
            </p>
          </div>
        </div>
      </section>

      <div className="bench-notes">
        <Callout tone="warning" title="Local microbenchmark, not production throughput">
          These numbers come from a single-worker Anvil node with a fixed-rate
          workload. They show the Caliper integration and the relative cost of the
          write and read paths — not a claim about a production network.
        </Callout>
        <Callout tone="info" title="An old adapter, deliberately isolated">
          The Caliper Ethereum adapter is deprecated and uses web3.js 1.2. The
          repository uses a small CaliperEngine runner to work around the CLI on
          Node 26. None of this ships in the app bundle as runtime code.
        </Callout>
      </div>

      <div className="privacy-cta bench-footer-cta">
        <div>
          <h2>See how the data stays private.</h2>
          <p>The benchmark measures the chain. The privacy model explains the rest.</p>
        </div>
        <div className="row row--wrap">
          <Link to="/privacy" className="btn btn--secondary">
            <ShieldCheck size={15} aria-hidden="true" />
            Privacy model
          </Link>
          <Link to="/track" className="btn btn--ghost">
            Track a shipment
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
