import { AlertTriangle, RotateCcw, Terminal } from 'lucide-react';
import { LogoMark } from '../ui/Logo.jsx';
import { Spinner } from '../ui/Spinner.jsx';

function Brand() {
  return (
    <span className="row" style={{ gap: 9, justifyContent: 'center' }}>
      <LogoMark size={30} />
      <span className="brand-word" translate="no">
        Block<span>Track</span>
      </span>
    </span>
  );
}

export function BootScreen({ label = 'Connecting to the local chain…' }) {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <Brand />
      <div className="row" style={{ gap: 9 }}>
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function SetupPage({ error }) {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <Brand />
        <div style={{ marginTop: 26 }}>
          <span className="eyebrow">Local setup</span>
          <h1 style={{ marginTop: 8 }}>BlockTrack isn&apos;t deployed here yet.</h1>
          <p>
            The app is a static frontend. It reads a generated
            <span className="mono"> /deployment.json</span> that points at an
            Anvil contract. Start the local stack to deploy, seed the encrypted
            demo data, and launch the app.
          </p>
        </div>

        <div className="code-block">{`# from the project root
npm install
npm run dev

# if you already have a deployment and want a clean reset
npm run dev -- --reset`}</div>

        <div className="callout callout--info" style={{ marginTop: 18 }}>
          <Terminal size={16} aria-hidden="true" />
          <div>
            <div className="callout__title">What `npm run dev` does</div>
            <div className="callout__body">
              Starts Anvil, compiles the contract with Foundry, deploys it,
              derives vault keys for the demo personas, seeds encrypted orders,
              and starts Vite on port 5173. No backend is involved.
            </div>
          </div>
        </div>

        {error ? (
          <div className="callout callout--danger" style={{ marginTop: 14 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <div className="callout__title">Runtime configuration error</div>
              <div className="callout__body">{error}</div>
            </div>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Retry</span>
          </button>
          <a
            className="btn btn--ghost"
            href="https://github.com/truegav/BlockTrack-DApp"
            target="_blank"
            rel="noreferrer"
          >
            Repository
          </a>
        </div>
      </div>
    </div>
  );
}

export function BootError({ error, onRetry }) {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <Brand />
        <div style={{ marginTop: 26 }}>
          <span className="eyebrow">Startup error</span>
          <h1 style={{ marginTop: 8 }}>Could not load BlockTrack.</h1>
          <p>
            The deployment configuration was found but the application could not
            start. Check that the local RPC is available and reload.
          </p>
        </div>
        {error ? (
          <div className="callout callout--danger" style={{ marginTop: 18 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <div className="callout__title">Details</div>
              <div className="callout__body mono" style={{ fontSize: 11.5 }}>
                {error}
              </div>
            </div>
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Reload</span>
          </button>
        </div>
      </div>
    </div>
  );
}
