# Update Token Managers Source Script

## Overview

The `update-token-managers-source.ts` script is a utility that updates contract verification parameters for the Axelar Stacks Bridge project. It deploys contracts to the Stacks testnet and updates local files with real-world verification data for testing purposes.

## What it does

This script performs the following operations:

1. **Reads contract source code** from:

   - `contracts/token-manager.clar`
   - `contracts/native-interchain-token.clar`

2. **Deploys contracts to Stacks testnet**:

   - Deploys `native-interchain-token` contract with a timestamped name
   - Deploys `token-manager` contract with a timestamped name
   - Waits for deployment transactions to complete successfully

3. **Updates verification parameters**:

   - Extracts real verification parameters from the deployed contracts
   - Updates `tests/verification-util.ts` with new `nitMockParams` and `tmMockParams`

4. **Updates verify-onchain contract**:
   - Replaces contract source strings in `contracts/verify-onchain.clar`
   - Updates `nit-contract-code` constant with escaped native-interchain-token source
   - Updates `token-manager-contract-code` constant with escaped token-manager source

## Prerequisites

- Node.js environment with TypeScript support
- Access to Stacks testnet
- Valid deployer private key (configured in the script)
- Required dependencies installed (`@stacks/transactions`, etc.)

## Usage

```bash
# Run the script using your preferred TypeScript runner
npx tsx tests/update-token-managers-source.ts

```

## Configuration

- **Deployer Key**: The script uses a hardcoded private key for testnet deployments
- **Timestamp**: Uses a fixed timestamp for contract naming (can be updated for new deployments)
- **Network**: Configured for Stacks testnet (`testnet`)
- **Fee**: Set to `0x10000` (65536 microSTX)

## Output

The script modifies the following files:

- `contracts/verify-onchain.clar` - Updates contract source constants
- `tests/verification-util.ts` - Updates mock parameters for testing

## Notes

- The script waits for transaction confirmation before proceeding
- Uses a 5-second polling interval to check transaction status
- Contract names are timestamped to ensure uniqueness
- Source code is properly escaped for inclusion in Clarity constants

## Error Handling

- Throws errors if transactions fail or have non-success status
- Validates API responses from Hiro testnet API
- Handles file read/write operations with appropriate error propagation
