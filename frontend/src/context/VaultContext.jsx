import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from './WalletContext.jsx';
import {
  VAULT_MESSAGE,
  deriveVaultKey,
  keyFingerprint,
  vaultPublicKey,
  zeroize,
} from '../shared/crypto.js';
import { humanizeError } from '../lib/contract.js';

const VaultContext = createContext(null);

export function VaultProvider({ children }) {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('locked');
  const [vaultKey, setVaultKey] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [fingerprint, setFingerprint] = useState(null);
  const [error, setError] = useState(null);

  const keyRef = useRef(null);
  const manualLockForRef = useRef(null);

  const clearKey = useCallback(() => {
    if (keyRef.current) zeroize(keyRef.current);
    keyRef.current = null;
    setVaultKey(null);
    setPublicKey(null);
    setFingerprint(null);
  }, []);

  const unlock = useCallback(async () => {
    if (!wallet.signer || !wallet.address) {
      setError('Connect a wallet first.');
      setStatus('error');
      return;
    }

    setStatus('unlocking');
    setError(null);
    let derived = null;
    try {
      const signature = await wallet.signer.signMessage(VAULT_MESSAGE);
      derived = await deriveVaultKey(signature);
      const nextPublicKey = vaultPublicKey(derived);
      const nextFingerprint = keyFingerprint(nextPublicKey);

      if (keyRef.current) zeroize(keyRef.current);
      keyRef.current = derived;
      setVaultKey(derived);
      setPublicKey(nextPublicKey);
      setFingerprint(nextFingerprint);
      setStatus('unlocked');
    } catch (cause) {
      if (derived) zeroize(derived);
      const human = humanizeError(cause);
      setError(
        human.rejected
          ? 'Signature cancelled. Unlock again when you are ready.'
          : human.message
      );
      setStatus('error');
    }
  }, [wallet.address, wallet.signer]);

  const lock = useCallback(() => {
    manualLockForRef.current = wallet.address;
    clearKey();
    setError(null);
    setStatus('locked');
    queryClient.clear();
  }, [clearKey, queryClient, wallet.address]);

  useEffect(() => {
    clearKey();
    setError(null);
    setStatus('locked');

    if (!wallet.signer || !wallet.address) return;

    const manuallyLocked = manualLockForRef.current === wallet.address;
    if (wallet.mode === 'demo' && !manuallyLocked) {
      unlock();
    }
  }, [
    clearKey,
    unlock,
    wallet.address,
    wallet.mode,
    wallet.signer,
  ]);

  useEffect(() => {
    return () => {
      if (keyRef.current) zeroize(keyRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      vaultKey,
      publicKey,
      fingerprint,
      error,
      isUnlocked: status === 'unlocked' && Boolean(vaultKey && publicKey),
      isUnlocking: status === 'unlocking',
      unlock,
      lock,
      clearError: () => setError(null),
    }),
    [status, vaultKey, publicKey, fingerprint, error, unlock, lock]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used inside VaultProvider');
  return context;
}
