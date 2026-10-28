import { Contract, Interface } from 'ethers';
import abi from '../shared/abi.json';

export const CONTRACT_ABI = abi;
export const contractInterface = new Interface(abi);

export function getContract(address, runner) {
  return new Contract(address, CONTRACT_ABI, runner);
}

export function isUserRejection(error) {
  if (!error) return false;
  if (error.code === 'ACTION_REJECTED' || error.code === 4001) return true;
  const message = String(error.shortMessage || error.message || '');
  return /user rejected|user denied|rejected the request|request rejected/i.test(
    message
  );
}

export function getRevertInfo(error) {
  if (!error) return null;

  if (error.revert?.name) return error.revert;

  const candidates = [
    error.data,
    error.info?.error?.data,
    error.error?.data,
    error.error?.error?.data,
    error.revert?.data,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.startsWith('0x')) continue;
    try {
      const parsed = contractInterface.parseError(candidate);
      if (parsed) return parsed;
    } catch {
      // Not a known contract error.
    }
  }
  return null;
}

const ERROR_MESSAGES = {
  NotAuthorized:
    'This wallet does not have permission to do that. Check which account you are using.',
  InvalidOwner: 'The order owner is not a valid wallet address.',
  InvalidHolder: 'One of the key recipients is not a valid wallet address.',
  DuplicateHolder: 'The same wallet was supplied twice for the order keys.',
  HoldersMismatch: 'The key recipient list and key envelopes do not match.',
  MissingOwnerKey:
    'The order is missing the customer key envelope. Ask the admin to initialize their vault and retry.',
  MissingAdminKey:
    'The order is missing the operations key envelope. The admin vault may not be initialized yet.',
  OrderAlreadyExists: 'That tracking ID is already registered. Try a new one.',
  OrderNotFound: 'This order does not exist on the contract.',
  OrderFinalized: 'This order is already completed or cancelled.',
  InvalidTrackingId: 'Use a tracking ID between 1 and 32 characters.',
  InvalidCiphertext: 'The encrypted payload is empty.',
  CiphertextTooLarge: 'The encrypted payload is too large for one transaction.',
  InvalidWrappedKey: 'A wrapped key is missing or malformed.',
  InvalidStatusTransition: 'That status change is not allowed from the current state.',
  NoteTooLarge: 'The private note is too large.',
  InvalidPublicKey: 'The encryption public key is invalid.',
  InvalidDisplayName: 'Use a display name between 1 and 48 characters.',
  ProfileAlreadyRegistered: 'This wallet already has a profile.',
  ProfileNotFound: 'This wallet has no profile yet.',
  InvalidCourier: 'Choose a valid courier wallet.',
  CourierRoleRequired: 'That wallet does not have the courier role.',
  AlreadyLogistics: 'That wallet is already a courier.',
  NotLogistics: 'That wallet is not a courier.',
  CannotCancel: 'Only the customer can cancel, and only before pickup.',
};

function rawMessage(error) {
  return String(
    error?.shortMessage ||
      error?.reason ||
      error?.info?.error?.message ||
      error?.message ||
      error ||
      ''
  );
}

/**
 * Turn an ethers / wallet / RPC error into something a person can act on.
 * Returns { title, message, rejected, code }.
 */
export function humanizeError(error) {
  if (!error) {
    return {
      title: 'Something went wrong',
      message: 'An unknown error occurred.',
      rejected: false,
      code: null,
    };
  }

  if (isUserRejection(error)) {
    return {
      title: 'Request cancelled',
      message: 'You rejected the request in your wallet. Nothing was sent.',
      rejected: true,
      code: 'rejected',
    };
  }

  const revert = getRevertInfo(error);
  if (revert?.name && ERROR_MESSAGES[revert.name]) {
    return {
      title: 'The contract rejected this',
      message: ERROR_MESSAGES[revert.name],
      rejected: false,
      code: revert.name,
    };
  }

  const message = rawMessage(error);
  const lower = message.toLowerCase();

  if (
    error.code === 'INSUFFICIENT_FUNDS' ||
    /insufficient funds|insufficient balance/.test(lower)
  ) {
    return {
      title: 'Not enough ETH for gas',
      message:
        'The connected demo wallet has no funds on this chain. Anvil accounts are pre-funded; restart the chain if this persists.',
      rejected: false,
      code: 'gas',
    };
  }

  if (
    error.code === 'NONCE_EXPIRED' ||
    /nonce has already been used|nonce too low|nonce expired/.test(lower)
  ) {
    return {
      title: 'Transaction nonce conflict',
      message:
        'A transaction with this nonce was already mined. Wait a second and try again.',
      rejected: false,
      code: 'nonce',
    };
  }

  if (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'SERVER_ERROR' ||
    /failed to fetch|econnrefused|could not detect network|network changed|non-200 status|timeout|underlying network/.test(
      lower
    )
  ) {
    return {
      title: 'Cannot reach the chain',
      message:
        'The local Anvil RPC is not responding. Make sure `npm run dev` is running, then retry.',
      rejected: false,
      code: 'network',
    };
  }

  if (/gas required exceeds allowance|out of gas|intrinsic gas/.test(lower)) {
    return {
      title: 'Transaction needs more gas',
      message:
        'The encrypted payload may be too large for the current gas limit. Reduce the payload or retry.',
      rejected: false,
      code: 'gas-limit',
    };
  }

  if (/unknown account|not unlocked|wallet not connected/.test(lower)) {
    return {
      title: 'Wallet disconnected',
      message: 'Reconnect the wallet and unlock the vault again.',
      rejected: false,
      code: 'account',
    };
  }

  if (error.code === 'CALL_EXCEPTION' && error.reason) {
    return {
      title: 'The contract rejected this',
      message: error.reason,
      rejected: false,
      code: 'call-exception',
    };
  }

  return {
    title: 'Something went wrong',
    message: message || 'An unknown error occurred.',
    rejected: false,
    code: error.code ?? null,
  };
}

export function shortContractError(error) {
  const human = humanizeError(error);
  return human.message;
}
