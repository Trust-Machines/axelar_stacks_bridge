import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

// Get the contract's address
describe('gas-service contract test suite', () => {
    beforeEach(async () => {
        await simnet.mineEmptyBlock();
    });

    it('ensures initial state is correct', async () => {
        const owner = await simnet.callReadOnlyFn('gas_service', 'get-owner', [], deployer);
        const isDeployerOwner = await simnet.callReadOnlyFn('gas_service', 'is-owner', [], deployer);
        const isWallet1Owner = await simnet.callReadOnlyFn('gas_service', 'is-owner', [], wallet1);

        expect(owner.result).toBeOk(Cl.principal(deployer));
        expect(isDeployerOwner.result).toBeOk(Cl.bool(true));
        expect(isWallet1Owner.result).toBeOk(Cl.bool(false));
    });

    it('allows refunding (topping up) the contract', async () => {
        const refundAmount = 1000n;
        const refundTx = await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(refundAmount)], wallet1);
        expect(refundTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents refunding with invalid amount', async () => {
        const refundTx = await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(0)], wallet1);
        expect(refundTx.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it('allows owner to transfer ownership', async () => {
        const transferTx = await simnet.callPublicFn('gas_service', 'transfer-ownership', [Cl.principal(wallet1)], deployer);
        expect(transferTx.result).toBeOk(Cl.bool(true));

        const newOwner = await simnet.callReadOnlyFn('gas_service', 'get-owner', [], deployer);
        expect(newOwner.result).toBeOk(Cl.principal(wallet1));
    });

    it('prevents non-owner from transferring ownership', async () => {
        const transferTx = await simnet.callPublicFn('gas_service', 'transfer-ownership', [Cl.principal(wallet2)], wallet1);
        expect(transferTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('allows owner to pay native gas for contract call', async () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');

        // First, refund some STX to the contract
        const refundAmount = 1000n;
        await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(refundAmount)], wallet1);

        const payTx = await simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], deployer);

        expect(payTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents non-owner from paying native gas for contract call', async () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');

        const payTx = await simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], wallet1);

        expect(payTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('allows owner to add native gas', async () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        // First, refund some STX to the contract
        const refundAmount = 1000n;
        await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(refundAmount)], wallet1);

        const addGasTx = await simnet.callPublicFn('gas_service', 'add-native-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], deployer);

        expect(addGasTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents non-owner from adding native gas', async () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        const addGasTx = await simnet.callPublicFn('gas_service', 'add-native-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], wallet1);

        expect(addGasTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('checks contract balance', async () => {
        const balanceBefore = await simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balanceBefore.result).toBeOk(Cl.uint(0));

        // Refund some STX to the contract
        const refundAmount = 1000n;
        await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(refundAmount)], wallet1);

        const balanceAfter = await simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balanceAfter.result).toBeOk(Cl.uint(refundAmount));
    });

    it('prevents paying native gas with insufficient balance', async () => {
        const amount = 1000000n; // Large amount to ensure insufficient balance
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');

        const payTx = await simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], deployer);

        expect(payTx.result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });

    it('verifies unimplemented functions return expected error', async () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        const payGasTx = await simnet.callPublicFn('gas_service', 'pay-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], deployer);

        const addGasTx = await simnet.callPublicFn('gas_service', 'add-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], deployer);

        expect(payGasTx.result).toBeErr(Cl.uint(0)); // Not implemented
        expect(addGasTx.result).toBeErr(Cl.uint(0)); // Not implemented
    });
});
