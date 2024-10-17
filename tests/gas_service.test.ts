import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

// Get the contract's address
describe('gas-service contract test suite', () => {
    beforeEach(() => {
        simnet.mineEmptyBlock();
    });

    it('ensures initial state is correct', () => {
        const owner = simnet.callReadOnlyFn('gas_service', 'get-owner', [], deployer);
        const isDeployerOwner = simnet.callReadOnlyFn('gas_service', 'is-owner', [], deployer);
        const isWallet1Owner = simnet.callReadOnlyFn('gas_service', 'is-owner', [], wallet1);

        expect(owner.result).toBeOk(Cl.principal(deployer));
        expect(isDeployerOwner.result).toBeOk(Cl.bool(true));
        expect(isWallet1Owner.result).toBeOk(Cl.bool(false));
    });

    it('allows refunding (topping up) the contract', () => {
        const refundAmount = 1000n;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;
        const refundTx = simnet.callPublicFn('gas_service', 'refund', [
            Cl.uint(refundAmount),
            Cl.some(Cl.buffer(txHash)),
            Cl.some(Cl.uint(logIndex))
        ], wallet1);
        expect(refundTx.result).toBeOk(Cl.bool(true));
    });

    it('allows refunding without tx-hash and log-index', () => {
        const refundAmount = 1000n;
        const refundTx = simnet.callPublicFn('gas_service', 'refund', [
            Cl.uint(refundAmount),
            Cl.none(),
            Cl.none()
        ], wallet1);
        expect(refundTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents refunding with invalid amount', () => {
        const refundTx = simnet.callPublicFn('gas_service', 'refund', [
            Cl.uint(0),
            Cl.none(),
            Cl.none()
        ], wallet1);
        expect(refundTx.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it('allows owner to transfer ownership', () => {
        const transferTx = simnet.callPublicFn('gas_service', 'transfer-ownership', [Cl.principal(wallet1)], deployer);
        expect(transferTx.result).toBeOk(Cl.bool(true));

        const newOwner = simnet.callReadOnlyFn('gas_service', 'get-owner', [], deployer);
        expect(newOwner.result).toBeOk(Cl.principal(wallet1));
    });

    it('prevents non-owner from transferring ownership', () => {
        const transferTx = simnet.callPublicFn('gas_service', 'transfer-ownership', [Cl.principal(wallet2)], wallet1);
        expect(transferTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('allows owner to pay native gas for contract call', () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');

        // First, refund some STX to the contract
        const refundAmount = 1000n;
        simnet.callPublicFn('gas_service', 'refund', [
            Cl.uint(refundAmount),
            Cl.none(),
            Cl.none()
        ], wallet1);

        const payTx = simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], deployer);

        expect(payTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents non-owner from paying native gas for contract call', () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');

        const payTx = simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], wallet1);

        expect(payTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('allows owner to add native gas', () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        // First, refund some STX to the contract
        const refundAmount = 1000n;
        simnet.callPublicFn('gas_service', 'refund', [
            Cl.uint(refundAmount),
            Cl.none(),
            Cl.none()
        ], wallet1);

        const addGasTx = simnet.callPublicFn('gas_service', 'add-native-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], deployer);

        expect(addGasTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents non-owner from adding native gas', () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        const addGasTx = simnet.callPublicFn('gas_service', 'add-native-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], wallet1);

        expect(addGasTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('checks contract balance', () => {
        const balanceBefore = simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balanceBefore.result).toBeOk(Cl.uint(0));

        // Refund some STX to the contract
        const refundAmount = 1000n;
        simnet.callPublicFn('gas_service', 'refund', [
            Cl.uint(refundAmount),
            Cl.none(),
            Cl.none()
        ], wallet1);

        const balanceAfter = simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balanceAfter.result).toBeOk(Cl.uint(refundAmount));
    });

    it('prevents paying native gas with insufficient balance', () => {
        const amount = 1000000n; // Large amount to ensure insufficient balance
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');

        const payTx = simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], deployer);

        expect(payTx.result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });

    it('verifies unimplemented functions return expected error', () => {
        const amount = 100n;
        const refundAddress = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        const payGasTx = simnet.callPublicFn('gas_service', 'pay-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], deployer);

        const addGasTx = simnet.callPublicFn('gas_service', 'add-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], deployer);

        const addGasExpressTx = simnet.callPublicFn('gas_service', 'add-native-express-gas', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.buffer(txHash),
            Cl.uint(logIndex)
        ], wallet1);

        const payExpressTx = simnet.callPublicFn('gas_service', 'pay-native-gas-for-express-call', [
            Cl.uint(amount),
            Cl.principal(refundAddress),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload)
        ], wallet1);

    expect(payGasTx.result).toBeErr(Cl.error(Cl.uint(103)));
    expect(addGasTx.result).toBeErr(Cl.error(Cl.uint(103)));
    expect(addGasExpressTx.result).toBeErr(Cl.error(Cl.uint(103)));
    expect(payExpressTx.result).toBeErr(Cl.error(Cl.uint(103)));
    });
});
