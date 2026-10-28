import { isAddress } from 'ethers';

export class DeploymentError extends Error {
  constructor(message, { missing = false } = {}) {
    super(message);
    this.name = 'DeploymentError';
    this.missing = missing;
  }
}

export async function loadDeployment() {
  let response;
  try {
    response = await fetch('/deployment.json', { cache: 'no-cache' });
  } catch (error) {
    throw new DeploymentError(
      `Could not load the runtime configuration. ${error.message}`
    );
  }

  if (response.status === 404) {
    throw new DeploymentError('No deployment file was found.', { missing: true });
  }
  if (!response.ok) {
    throw new DeploymentError(
      `Runtime configuration returned HTTP ${response.status}.`,
      { missing: true }
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new DeploymentError('Runtime configuration is not valid JSON.', {
      missing: true,
    });
  }

  if (!data || typeof data !== 'object') {
    throw new DeploymentError('Runtime configuration is empty.', {
      missing: true,
    });
  }
  if (!isAddress(data.contractAddress || '')) {
    throw new DeploymentError(
      'Runtime configuration has an invalid contract address.',
      { missing: true }
    );
  }
  if (!data.rpcUrl || typeof data.rpcUrl !== 'string') {
    throw new DeploymentError('Runtime configuration is missing an RPC URL.', {
      missing: true,
    });
  }

  return {
    version: data.version ?? 1,
    chainId: Number(data.chainId),
    rpcUrl: data.rpcUrl,
    contractAddress: data.contractAddress,
    deploymentBlock: Number(data.deploymentBlock ?? 0),
    deployedAt: data.deployedAt ?? null,
    demoMode: Boolean(data.demoMode),
    admin: data.admin ?? null,
  };
}
