import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useWallet } from '../../context/WalletContext.jsx';
import { formatDateTime } from '../../lib/format.js';
import { AddressChip, HashLine, KeyValue } from '../ui/Identity.jsx';

export function ChainRecord({ order }) {
  const wallet = useWallet();
  const bytes = order.ciphertext
    ? Math.max(0, (order.ciphertext.length - 2) / 2)
    : 0;

  return (
    <details className="chain-record">
      <summary className="chain-record__summary">
        <span className="row" style={{ gap: 8 }}>
          <ShieldCheck size={15} aria-hidden="true" />
          <span>Chain record</span>
          <span className="badge badge--green">Verified</span>
        </span>
        <ChevronDown size={15} className="chain-record__chev" aria-hidden="true" />
      </summary>
      <div className="chain-record__body">
        <KeyValue label="Contract">
          <AddressChip address={wallet.deployment.contractAddress} />
        </KeyValue>
        <KeyValue label="Tracking ID">
          <span className="mono">{order.id}</span>
        </KeyValue>
        <KeyValue label="Created">
          <span>{formatDateTime(order.createdAt)}</span>
        </KeyValue>
        <KeyValue label="Updated">
          <span>{formatDateTime(order.updatedAt)}</span>
        </KeyValue>
        <KeyValue label="Ciphertext size">
          <span className="tabular">{bytes} bytes</span>
        </KeyValue>
        <KeyValue label="Key holders">
          <span className="tabular">{order.keyHolders?.length ?? 0}</span>
        </KeyValue>
        {order.createdTxHash ? (
          <HashLine label="Created in tx" value={order.createdTxHash} />
        ) : null}
        <div className="callout" style={{ marginTop: 12 }}>
          <ShieldCheck size={15} aria-hidden="true" />
          <div>
            <div className="callout__title">Public ciphertext, private plaintext</div>
            <div className="callout__body">
              Anyone can read the bytes above. Only wallets with a wrapped key
              can turn them back into names, addresses, and notes.
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
