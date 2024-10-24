import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

describe('gas-service contract test suite', () => {
    beforeEach(() => {
        simnet.mineEmptyBlock();
    });

    it('ensures initial state is correct', () => {
        const owner = simnet.callReadOnlyFn('gas-service', 'get-owner', [], deployer);
        const isDeployerOwner = simnet.callReadOnlyFn('gas-service', 'is-owner', [], deployer);
        const isWallet1Owner = simnet.callReadOnlyFn('gas-service', 'is-owner', [], wallet1);

        expect(owner.result).toBeOk(Cl.principal(deployer));
        expect(isDeployerOwner.result).toBeOk(Cl.bool(true));
        expect(isWallet1Owner.result).toBeOk(Cl.bool(false));
    });

    it('allows paying native gas for contract call', () => {
        const amount = 1000n;
        const sender = wallet2;  // Can be different from tx-sender now
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');
        const refundAddress = wallet2;

        const payTx = simnet.callPublicFn('gas-service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(sender),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload),
            Cl.principal(refundAddress)
        ], wallet1);  // wallet1 is paying for wallet2's transaction

        expect(payTx.result).toBeOk(Cl.bool(true));
    });

    it('allows adding native gas', () => {
        const amount = 1000n;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;
        const refundAddress = wallet2;

        const addGasTx = simnet.callPublicFn('gas-service', 'add-native-gas', [
            Cl.uint(amount),
            Cl.buffer(txHash),
            Cl.uint(logIndex),
            Cl.principal(refundAddress)
        ], wallet1);

        expect(addGasTx.result).toBeOk(Cl.bool(true));
    });

    it('allows owner to refund', () => {
        const amount = 1000n;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;
        const receiver = wallet1;

        // First, add some STX to the contract
        simnet.callPublicFn('gas-service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(wallet1),
            Cl.stringAscii('ethereum'),
            Cl.stringAscii('1234567890123456789012345678901234567890'),
            Cl.buffer(Buffer.from('test payload')),
            Cl.principal(wallet1)
        ], wallet1);

        const refundTx = simnet.callPublicFn('gas-service', 'refund', [
            Cl.buffer(txHash),
            Cl.uint(logIndex),
            Cl.principal(receiver),
            Cl.uint(amount)
        ], deployer);

        expect(refundTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents non-owner from refunding', () => {
        const amount = 1000n;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;
        const receiver = wallet1;

        const refundTx = simnet.callPublicFn('gas-service', 'refund', [
            Cl.buffer(txHash),
            Cl.uint(logIndex),
            Cl.principal(receiver),
            Cl.uint(amount)
        ], wallet1);

        expect(refundTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('allows owner to transfer ownership', () => {
        const transferTx = simnet.callPublicFn('gas-service', 'transfer-ownership', [Cl.principal(wallet1)], deployer);
        expect(transferTx.result).toBeOk(Cl.bool(true));

        const newOwner = simnet.callReadOnlyFn('gas-service', 'get-owner', [], deployer);
        expect(newOwner.result).toBeOk(Cl.principal(wallet1));
    });

    it('prevents non-owner from transferring ownership', () => {
        const transferTx = simnet.callPublicFn('gas-service', 'transfer-ownership', [Cl.principal(wallet2)], wallet1);
        expect(transferTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('checks contract balance', () => {
        const balanceBefore = simnet.callReadOnlyFn('gas-service', 'get-balance', [], deployer);
        expect(balanceBefore.result).toBeOk(Cl.uint(0));

        // Add some STX to the contract
        const amount = 1000n;
        simnet.callPublicFn('gas-service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(wallet1),
            Cl.stringAscii('ethereum'),
            Cl.stringAscii('1234567890123456789012345678901234567890'),
            Cl.buffer(Buffer.from('test payload')),
            Cl.principal(wallet1)
        ], wallet1);

        const balanceAfter = simnet.callReadOnlyFn('gas-service', 'get-balance', [], deployer);
        expect(balanceAfter.result).toBeOk(Cl.uint(amount));
    });

    it('verifies unimplemented functions return expected error', () => {
        const amount = 100n;
        const sender = wallet1;
        const destinationChain = 'ethereum';
        const destinationAddress = '1234567890123456789012345678901234567890';
        const payload = Buffer.from('test payload');
        const refundAddress = wallet2;
        const txHash = Buffer.alloc(32, 1);
        const logIndex = 0n;

        const payGasTx = simnet.callPublicFn('gas-service', 'pay-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(sender),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload),
            Cl.principal(refundAddress)
        ], wallet1);

        const addGasTx = simnet.callPublicFn('gas-service', 'add-gas', [
            Cl.uint(amount),
            Cl.principal(sender),
            Cl.buffer(txHash),
            Cl.uint(logIndex),
            Cl.principal(refundAddress)
        ], wallet1);

        const payExpressTx = simnet.callPublicFn('gas-service', 'pay-native-gas-for-express-call', [
            Cl.uint(amount),
            Cl.principal(sender),
            Cl.stringAscii(destinationChain),
            Cl.stringAscii(destinationAddress),
            Cl.buffer(payload),
            Cl.principal(refundAddress)
        ], wallet1);

        const addExpressGasTx = simnet.callPublicFn('gas-service', 'add-native-express-gas', [
            Cl.uint(amount),
            Cl.principal(sender),
            Cl.buffer(txHash),
            Cl.uint(logIndex),
            Cl.principal(refundAddress)
        ], wallet1);
        
        expect(payGasTx.result).toBeErr(Cl.error(Cl.uint(103))); // err-not-implemented
        expect(addGasTx.result).toBeErr(Cl.error(Cl.uint(103))); // err-not-implemented
        expect(payExpressTx.result).toBeErr(Cl.error(Cl.uint(103))); // err-not-implemented
        expect(addExpressGasTx.result).toBeErr(Cl.error(Cl.uint(103))); // err-not-implemented
    });

    it('allows owner to collect fees', () => {
        const amount = 1000n;
        const receiver = wallet2;

        // First, add some STX to the contract
        simnet.callPublicFn('gas-service', 'pay-native-gas-for-contract-call', [
            Cl.uint(amount),
            Cl.principal(wallet1),
            Cl.stringAscii('ethereum'),
            Cl.stringAscii('1234567890123456789012345678901234567890'),
            Cl.buffer(Buffer.from('test payload')),
            Cl.principal(wallet1)
        ], wallet1);

        const collectFeesTx = simnet.callPublicFn('gas-service', 'collect-fees', [
            Cl.principal(receiver),
            Cl.uint(amount)
        ], deployer);

        expect(collectFeesTx.result).toBeOk(Cl.bool(true));
    });

    it('prevents non-owner from collecting fees', () => {
        const amount = 1000n;
        const receiver = wallet2;

        const collectFeesTx = simnet.callPublicFn('gas-service', 'collect-fees', [
            Cl.principal(receiver),
            Cl.uint(amount)
        ], wallet1);

        expect(collectFeesTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('prevents collecting fees with insufficient balance', () => {
        const amount = 1000n;
        const receiver = wallet2;

        const collectFeesTx = simnet.callPublicFn('gas-service', 'collect-fees', [
            Cl.principal(receiver),
            Cl.uint(amount)
        ], deployer);

        expect(collectFeesTx.result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });
});
