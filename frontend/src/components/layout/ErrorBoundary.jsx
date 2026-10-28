import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the console useful in development without showing a stack to users.
    console.error('BlockTrack UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="setup-page">
        <div className="setup-card">
          <span className="eyebrow">Interface error</span>
          <h1 style={{ marginTop: 8 }}>Something broke in the interface.</h1>
          <p>
            The encrypted data is safe on-chain. Reload the page to rebuild the
            local view. If it keeps happening, open the browser console for the
            exact component.
          </p>
          <div className="callout callout--danger" style={{ marginTop: 18 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <div className="callout__title">Error</div>
              <div className="callout__body mono" style={{ fontSize: 11.5 }}>
                {this.state.error?.message || String(this.state.error)}
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>Reload</span>
            </button>
            <a className="btn btn--secondary" href="/login">
              Go to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }
}
