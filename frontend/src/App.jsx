import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, STATUSES, RPC_URL, CHAIN_ID } from './config.js';

const ADDRESS_OK = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
const ANVIL_CHAIN_HEX = '0x' + CHAIN_ID.toString(16); // 0x7a69

// When several wallet extensions inject providers, window.ethereum may be a
// proxy (e.g. evmAsk) that breaks requests. Prefer the real MetaMask object.
function getInjectedProvider() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers.find((p) => p && p.isMetaMask) || null;
  }
  return eth.isMetaMask === false ? null : eth;
}

// Translate cryptic wallet/RPC errors into actionable messages.
function friendlyError(e) {
  const m = e?.info?.error?.message || e?.reason || e?.message || String(e);
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED' || /user rejected/i.test(m)) {
    return { rejected: true, text: m };
  }
  if (
    e?.code === -32002 ||
    /too many errors|coalesce|fetch failed|ECONNREFUSED|could not detect network|failed to fetch|network changed|underlying network|non-200 status/i.test(m)
  ) {
    return {
      rejected: false,
      text: 'Anvil is unreachable (wallet RPC failing). Start `anvil` on 127.0.0.1:8545, redeploy the contract, and click "Use Anvil Local".',
    };
  }
  return { rejected: false, text: m };
}

export default function App() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [tab, setTab] = useState('track');
  const [msg, setMsg] = useState('');

  // track
  const [searchId, setSearchId] = useState('');
  const [parcel, setParcel] = useState(null);
  const [history, setHistory] = useState([]);

  // admin
  const [newId, setNewId] = useState('');
  const [logAddr, setLogAddr] = useState('');

  // logistics
  const [upId, setUpId] = useState('');
  const [upStatus, setUpStatus] = useState('2');
  const [upNote, setUpNote] = useState('');

  // Keep UI in sync when user switches account/network in MetaMask.
  useEffect(() => {
    const eth = getInjectedProvider() || window.ethereum;
    if (!eth) return;
    const onAccounts = (accs) => setAccount(accs && accs[0] ? accs[0] : '');
    const onChain = () => window.location.reload();
    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  function needAddress() {
    if (!ADDRESS_OK) {
      setMsg('Contract address not set. Deploy locally (see README) and paste it into frontend/src/config.js.');
      return true;
    }
    return false;
  }

  async function connect() {
    try {
      const eth = getInjectedProvider();
      if (!eth) {
        setMsg('MetaMask not found or it is being blocked by another wallet extension (evmAsk/Coinbase/Phantom). Disable other wallet extensions, keep only MetaMask, and reload.');
        return;
      }
      const provider = new ethers.BrowserProvider(eth);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) {
        setMsg('No account authorized. Unlock MetaMask and approve the connection.');
        return;
      }
      const s = await provider.getSigner();
      const addr = await s.getAddress();
      const net = await provider.getNetwork();
      setAccount(addr);
      setChainId(Number(net.chainId));
      if (Number(net.chainId) === CHAIN_ID) {
        setMsg('Wallet connected (Anvil local).');
      } else {
        setMsg(`Connected, but MetaMask is on chain ${net.chainId}. Click "Use Anvil Local" to switch.`);
      }
    } catch (e) {
      const f = friendlyError(e);
      if (f.rejected) setMsg('Connection rejected in MetaMask. Click Connect again and approve.');
      else setMsg('Connect failed: ' + f.text);
    }
  }

  async function switchToAnvil() {
    try {
      const eth = getInjectedProvider();
      if (!eth) {
        setMsg('MetaMask not found or it is being blocked by another wallet extension. Disable other wallet extensions, keep only MetaMask, and reload.');
        return;
      }
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ANVIL_CHAIN_HEX }],
        });
      } catch (e) {
        if (e?.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: ANVIL_CHAIN_HEX,
              chainName: 'Anvil Local',
              rpcUrls: [RPC_URL],
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            }],
          });
        } else {
          throw e;
        }
      }
      await connect(); // refresh account + chain id after switch
    } catch (e) {
      const m = e?.message || String(e);
      if (e?.code === 4001 || /rejected/i.test(m)) setMsg('Network switch rejected in MetaMask.');
      else setMsg('Network switch failed: ' + m);
    }
  }

  // Public read — no wallet needed, straight to local RPC.
  async function track() {
    try {
      if (needAddress()) return;
      const id = searchId.trim();
      if (!id) {
        setMsg('Enter a tracking ID.');
        return;
      }
      setMsg('Loading...');
      const reader = new ethers.JsonRpcProvider(RPC_URL);
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, reader);
      const exists = await c.parcelExists(id);
      if (!exists) {
        setParcel(null);
        setHistory([]);
        setMsg(`Parcel "${id}" not found. Check the ID or create it in the Admin tab.`);
        return;
      }
      const p = await c.getParcel(id);
      const h = await c.getTrackingHistory(id);
      setParcel({ id: p[0], creator: p[1], status: Number(p[2]), createdAt: Number(p[3]) });
      setHistory(h.map((x) => ({ status: Number(x[0]), ts: Number(x[1]), by: x[2], note: x[3] })));
      setMsg('');
    } catch (e) {
      setParcel(null);
      setHistory([]);
      setMsg('Search failed: ' + friendlyError(e).text);
    }
  }

  async function tx(fn, okMsg) {
    try {
      const eth = getInjectedProvider();
      if (!eth) {
        setMsg('MetaMask not found or it is being blocked by another wallet extension. Disable other wallet extensions, keep only MetaMask, and reload.');
        return;
      }
      if (needAddress()) return;
      // Always build a fresh provider/signer — cached signers go stale after network switches.
      const provider = new ethers.BrowserProvider(eth);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) {
        setMsg('No account authorized. Click Connect MetaMask first.');
        return;
      }
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== CHAIN_ID) {
        setChainId(Number(net.chainId));
        setMsg(`Wrong network (chain ${net.chainId}). Click "Use Anvil Local" first.`);
        return;
      }
      const s = await provider.getSigner();
      setAccount(await s.getAddress());
      setChainId(Number(net.chainId));
      setMsg('Sending transaction — confirm in MetaMask...');
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, s);
      const t = await fn(c);
      await t.wait();
      setMsg(okMsg);
    } catch (e) {
      const f = friendlyError(e);
      if (f.rejected) setMsg('Transaction rejected in MetaMask.');
      else setMsg('Tx failed: ' + f.text);
    }
  }

  const wrongNetwork = chainId !== null && chainId !== CHAIN_ID;

  return (
    <div className="wrap">
      <h1>📦 BlockTrack</h1>
      <p><small>Minimal local PoC — admin creates, logistics updates, anyone tracks. (Anvil, chain {CHAIN_ID})</small></p>

      {!ADDRESS_OK && (
        <div className="card"><small>⚠️ CONTRACT_ADDRESS not set in frontend/src/config.js — deploy locally and paste it.</small></div>
      )}
      {!window.ethereum && (
        <div className="card"><small>⚠️ No wallet detected. Install MetaMask from metamask.io and reload.</small></div>
      )}

      <div className="card row">
        <button onClick={connect}>{account ? 'Connected' : 'Connect MetaMask'}</button>
        <button onClick={switchToAnvil}>Use Anvil Local</button>
        <small>{account ? `${account} (chain ${chainId ?? '?'})` : 'not connected'}</small>
      </div>
      {wrongNetwork && (
        <div className="card"><small>⚠️ MetaMask is on chain {chainId}, this app needs {CHAIN_ID}. Click "Use Anvil Local".</small></div>
      )}

      <div className="card tabs row">
        <button className={tab === 'track' ? 'active' : ''} onClick={() => setTab('track')}>Track</button>
        <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
        <button className={tab === 'logistics' ? 'active' : ''} onClick={() => setTab('logistics')}>Logistics</button>
      </div>

      {msg && <div className="card"><small>{msg}</small></div>}

      {tab === 'track' && (
        <div className="card">
          <h3>Public Tracking</h3>
          <input placeholder="Tracking ID e.g. BT1001" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
          <button onClick={track}>Search</button>
          {parcel && (
            <>
              <p><b>{parcel.id}</b> — {STATUSES[parcel.status]}</p>
              <p><small>Creator: {parcel.creator} | Created: {new Date(parcel.createdAt * 1000).toLocaleString()}</small></p>
              <div className="timeline">
                {history.map((h, i) => (
                  <div key={i}>
                    <b>{STATUSES[h.status]}</b> — {h.note}<br />
                    <small>{new Date(h.ts * 1000).toLocaleString()} by {h.by}</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'admin' && (
        <div className="card">
          <h3>Admin: Create Parcel</h3>
          <input placeholder="New tracking ID" value={newId} onChange={(e) => setNewId(e.target.value)} />
          <button onClick={() => tx((c) => c.createParcel(newId.trim()), 'Parcel created!')}>Create Parcel</button>
          <h3 style={{ marginTop: 20 }}>Admin: Manage Logistics</h3>
          <input placeholder="0x logistics address" value={logAddr} onChange={(e) => setLogAddr(e.target.value)} />
          <div className="row">
            <button onClick={() => tx((c) => c.addLogisticsUser(logAddr.trim()), 'Logistics added!')}>Add</button>
            <button onClick={() => tx((c) => c.removeLogisticsUser(logAddr.trim()), 'Logistics removed!')}>Remove</button>
          </div>
        </div>
      )}

      {tab === 'logistics' && (
        <div className="card">
          <h3>Logistics: Update Status</h3>
          <input placeholder="Tracking ID" value={upId} onChange={(e) => setUpId(e.target.value)} />
          <select value={upStatus} onChange={(e) => setUpStatus(e.target.value)}>
            <option value="1">Picked Up</option>
            <option value="2">In Transit</option>
            <option value="3">Out for Delivery</option>
            <option value="4">Delivered</option>
            <option value="5">Cancelled</option>
          </select>
          <input placeholder="Note e.g. left hub" value={upNote} onChange={(e) => setUpNote(e.target.value)} />
          <button onClick={() => tx((c) => c.updateParcelStatus(upId.trim(), Number(upStatus), upNote || STATUSES[Number(upStatus)]), 'Status updated!')}>Update</button>
        </div>
      )}
    </div>
  );
}
