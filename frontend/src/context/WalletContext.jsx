import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';
import { useQueryClient } from '@tanstack/react-query';
import {
  DEMO_BY_ID,
  DEMO_CHAIN_ID,
  DEMO_PERSONAS,
} from '../shared/personas.js';
import { humanizeError } from '../lib/contract.js';
import { readString, removeKey, writeString } from '../lib/storage.js';

const WalletContext = createContext(null);

function getInjectedProvider() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers.find((candidate) => candidate?.isMetaMask) || eth.providers[0];
  }
  return eth;
}

function chainHex(chainId) {
  return `0x${Number(chainId).toString(16)}`;
}

export function WalletProvider({ deployment, children }) {
  const queryClient = useQueryClient();
  const provider = useMemo(
    () =>
      new JsonRpcProvider(deployment.rpcUrl, deployment.chainId, {
        staticNetwork: true,
      }),
    [deployment.rpcUrl, deployment.chainId]
  );

  const [address, setAddress] = useState('');
  const [signer, setSigner] = useState(null);
  const [mode, setMode] = useState(null);
  const [personaId, setPersonaId] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [chainError, setChainError] = useState(null);
  const [chainChecking, setChainChecking] = useState(false);

  const bootstrapped = useRef(false);
  const demoEnabled = Boolean(
    deployment.demoMode && Number(deployment.chainId) === DEMO_CHAIN_ID
  );

  useEffect(() => {
    return () => provider.destroy();
  }, [provider]);

  const checkChain = useCallback(async () => {
    setChainChecking(true);
    try {
      await provider.getBlockNumber();
      setChainError(null);
      return true;
    } catch (cause) {
      setChainError(
        'The local chain is not responding. Start it with `npm run dev` and retry.'
      );
      return false;
    } finally {
      setChainChecking(false);
    }
  }, [provider]);

  useEffect(() => {
    checkChain();
    const timer = setInterval(checkChain, 20_000);
    return () => clearInterval(timer);
  }, [checkChain]);

  const applyDemoPersona = useCallback(
    (id) => {
      const persona = DEMO_BY_ID[id];
      if (!persona) throw new Error('Unknown demo account.');
      const wallet = new Wallet(persona.privateKey, provider);
      setAddress(persona.address);
      setSigner(wallet);
      setMode('demo');
      setPersonaId(id);
      setWalletChainId(Number(deployment.chainId));
      setError(null);
      queryClient.clear();
      writeString('demoPersona', id);
      return persona;
    },
    [deployment.chainId, provider, queryClient]
  );

  const connectDemo = useCallback(
    async (id) => {
      if (!demoEnabled) {
        const message = 'Demo accounts are disabled for this deployment.';
        setError(message);
        throw new Error(message);
      }
      setConnecting(true);
      try {
        applyDemoPersona(id);
      } finally {
        setConnecting(false);
      }
    },
    [applyDemoPersona, demoEnabled]
  );

  const applyInjected = useCallback(
    async (eth, account) => {
      const browserProvider = new BrowserProvider(eth);
      const network = await browserProvider.getNetwork();
      const injectedSigner = await browserProvider.getSigner(account);
      const nextAddress = await injectedSigner.getAddress();

      setAddress(nextAddress);
      setSigner(injectedSigner);
      setMode('injected');
      setPersonaId(null);
      setWalletChainId(Number(network.chainId));
      removeKey('demoPersona');
      queryClient.clear();
      if (Number(network.chainId) !== Number(deployment.chainId)) {
        setError(
          `Your wallet is on chain ${network.chainId}; this app runs on chain ${deployment.chainId}. Switch networks to continue.`
        );
      } else {
        setError(null);
      }
      return { browserProvider, signer: injectedSigner, address: nextAddress };
    },
    [deployment.chainId, queryClient]
  );

  const switchNetwork = useCallback(async () => {
    const eth = getInjectedProvider();
    if (!eth) {
      setError('No browser wallet was found.');
      return false;
    }
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex(deployment.chainId) }],
      });
    } catch (switchError) {
      if (switchError?.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainHex(deployment.chainId),
                chainName: 'Anvil Local',
                rpcUrls: [deployment.rpcUrl],
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              },
            ],
          });
        } catch (addError) {
          const human = humanizeError(addError);
          setError(`${human.title}. ${human.message}`);
          return false;
        }
      } else {
        const human = humanizeError(switchError);
        setError(`${human.title}. ${human.message}`);
        return false;
      }
    }

    try {
      const browserProvider = new BrowserProvider(eth);
      const network = await browserProvider.getNetwork();
      setWalletChainId(Number(network.chainId));
      const accounts = await eth.request({ method: 'eth_accounts' });
      if (accounts?.length) {
        const nextSigner = await browserProvider.getSigner(accounts[0]);
        setSigner(nextSigner);
        setAddress(await nextSigner.getAddress());
      }
      setError(null);
      return true;
    } catch (cause) {
      const human = humanizeError(cause);
      setError(`${human.title}. ${human.message}`);
      return false;
    }
  }, [deployment.chainId, deployment.rpcUrl]);

  const connectInjected = useCallback(async () => {
    const eth = getInjectedProvider();
    if (!eth) {
      setError(
        'No browser wallet detected. Use a demo account below, or install MetaMask.'
      );
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) {
        throw new Error('No account was authorised in the wallet.');
      }
      const browserProvider = new BrowserProvider(eth);
      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== Number(deployment.chainId)) {
        const switched = await switchNetwork();
        if (!switched) {
          return;
        }
      }
      await applyInjected(eth, accounts[0]);
    } catch (cause) {
      const human = humanizeError(cause);
      setError(`${human.title}. ${human.message}`);
    } finally {
      setConnecting(false);
    }
  }, [applyInjected, deployment.chainId, switchNetwork]);

  const disconnect = useCallback(() => {
    setAddress('');
    setSigner(null);
    setMode(null);
    setPersonaId(null);
    setWalletChainId(null);
    setError(null);
    removeKey('demoPersona');
    queryClient.clear();
  }, [queryClient]);

  // Restore the last demo persona (or an already-authorised injected account)
  // once, without prompting.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const restore = async () => {
      const stored = readString('demoPersona');
      if (demoEnabled && stored && DEMO_BY_ID[stored]) {
        try {
          applyDemoPersona(stored);
          return;
        } catch {
          removeKey('demoPersona');
        }
      }
      const eth = getInjectedProvider();
      if (!eth) return;
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (accounts?.length) {
          await applyInjected(eth, accounts[0]);
        }
      } catch {
        // Auto-restore is best effort only.
      }
    };

    restore();
  }, [applyDemoPersona, applyInjected, demoEnabled]);

  useEffect(() => {
    if (mode !== 'injected') return;
    const eth = getInjectedProvider();
    if (!eth?.on) return;

    const onAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        disconnect();
        return;
      }
      try {
        await applyInjected(eth, accounts[0]);
      } catch (cause) {
        const human = humanizeError(cause);
        setError(`${human.title}. ${human.message}`);
      }
    };

    const onChainChanged = (nextChainId) => {
      const parsed = Number.parseInt(nextChainId, 16);
      setWalletChainId(Number.isFinite(parsed) ? parsed : null);
    };

    eth.on('accountsChanged', onAccountsChanged);
    eth.on('chainChanged', onChainChanged);
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged);
      eth.removeListener?.('chainChanged', onChainChanged);
    };
  }, [applyInjected, disconnect, mode]);

  const isWrongNetwork = Boolean(
    mode === 'injected' &&
      walletChainId !== null &&
      Number(walletChainId) !== Number(deployment.chainId)
  );

  const assertCanWrite = useCallback(() => {
    if (!signer || !address) {
      throw new Error('Connect a wallet before writing to the chain.');
    }
    if (isWrongNetwork) {
      throw new Error(
        `Your wallet is on chain ${walletChainId}. Switch to chain ${deployment.chainId} before sending a transaction.`
      );
    }
    return signer;
  }, [address, deployment.chainId, isWrongNetwork, signer, walletChainId]);

  const persona = mode === 'demo' && personaId ? DEMO_BY_ID[personaId] : null;

  const value = useMemo(
    () => ({
      deployment,
      provider,
      address,
      signer,
      mode,
      persona,
      personaId,
      walletChainId,
      connecting,
      error,
      setError,
      chainError,
      chainChecking,
      demoEnabled,
      demoPersonas: demoEnabled ? DEMO_PERSONAS : [],
      isWrongNetwork,
      isConnected: Boolean(address && signer),
      ready: Boolean(address && signer && !isWrongNetwork),
      connectDemo,
      connectInjected,
      switchNetwork,
      disconnect,
      retryChain: checkChain,
      assertCanWrite,
      refreshInjected: async () => {
        const eth = getInjectedProvider();
        if (!eth) return;
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (accounts?.length) await applyInjected(eth, accounts[0]);
      },
    }),
    [
      deployment,
      provider,
      address,
      signer,
      mode,
      persona,
      personaId,
      walletChainId,
      connecting,
      error,
      chainError,
      chainChecking,
      demoEnabled,
      isWrongNetwork,
      connectDemo,
      connectInjected,
      switchNetwork,
      disconnect,
      checkChain,
      assertCanWrite,
      applyInjected,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
}
