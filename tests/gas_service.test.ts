import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

describe('gas-service contract test suite', () => {
    beforeEach(async () => {
        // Reset the contract state before each test
        await simnet.mineEmptyBlock();
    });

    it('ensures initial state is correct', async () => {
        const balance = await simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        const owner = await simnet.callReadOnlyFn('gas_service', 'get-contract-owner', [], deployer);
        const isDeployerOwner = await simnet.callReadOnlyFn('gas_service', 'is-contract-owner', [], deployer);
        const isWallet1Owner = await simnet.callReadOnlyFn('gas_service', 'is-contract-owner', [], wallet1);

        expect(balance.result).toBeOk(Cl.uint(0));
        expect(owner.result).toBeOk(Cl.principal(deployer));
        expect(isDeployerOwner.result).toBeOk(Cl.bool(true));
        expect(isWallet1Owner.result).toBeOk(Cl.bool(false));
    });

    it('allows refunding (topping up) the contract', async () => {
        const refundAmount = 1000;
        const refundTx = await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(refundAmount), Cl.principal(wallet1)], wallet1);
        expect(refundTx.result).toBeOk(Cl.bool(true));

        const balance = await simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balance.result).toBeOk(Cl.uint(refundAmount));
    });

    it('prevents refunding with invalid amount', async () => {
        const refundTx = await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(0), Cl.principal(wallet1)], wallet1);
        expect(refundTx.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it('allows owner to pay native gas for contract call', async () => {
        // First, refund the contract to have some balance.
        await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(2000), Cl.principal(wallet1)], wallet1);

        const payTx = await simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(1000),
            Cl.principal(wallet2),
            Cl.stringAscii("destination-chain"),
            Cl.stringAscii("destination-address"),
            Cl.buffer(Buffer.from("payload"))
        ], deployer);

        expect(payTx.result).toBeOk(Cl.bool(true));

        const balance = await simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balance.result).toBeOk(Cl.uint(1000)); // 2000 - 1000
    });

    it('prevents non-owner from paying native gas', async () => {
        const payTx = await simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(1000),
            Cl.principal(wallet2),
            Cl.stringAscii("destination-chain"),
            Cl.stringAscii("destination-address"),
            Cl.buffer(Buffer.from("payload"))
        ], wallet1);

        expect(payTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it('allows owner to add native gas', async () => {
        // First, refund the contract to have some balance
        await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(2000), Cl.principal(wallet1)], wallet1);

        const addGasTx = await simnet.callPublicFn('gas_service', 'add-native-gas', [
            Cl.uint(500),
            Cl.principal(wallet2),
            Cl.buffer(Buffer.alloc(32, 0)),
            Cl.uint(1)
        ], deployer);

        expect(addGasTx.result).toBeOk(Cl.bool(true));

        const balance = await simnet.callReadOnlyFn('gas_service', 'get-balance', [], deployer);
        expect(balance.result).toBeOk(Cl.uint(1500)); // 2000 - 500
    });

    it('prevents paying or adding gas more than contract balance', async () => {
        // First, refund the contract to have some balance
        await simnet.callPublicFn('gas_service', 'refund', [Cl.uint(1000), Cl.principal(wallet1)], wallet1);

        const payTx = await simnet.callPublicFn('gas_service', 'pay-native-gas-for-contract-call', [
            Cl.uint(2000),
            Cl.principal(wallet2),
            Cl.stringAscii("destination-chain"),
            Cl.stringAscii("destination-address"),
            Cl.buffer(Buffer.from("payload"))
        ], deployer);

        expect(payTx.result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });

    it('allows owner to transfer ownership', async () => {
        const transferTx = await simnet.callPublicFn('gas_service', 'transfer-ownership', [Cl.principal(wallet1)], deployer);
        expect(transferTx.result).toBeOk(Cl.bool(true));

        const newOwner = await simnet.callReadOnlyFn('gas_service', 'get-contract-owner', [], deployer);
        expect(newOwner.result).toBeOk(Cl.principal(wallet1));
    });

    it('prevents non-owner from transferring ownership', async () => {
        const transferTx = await simnet.callPublicFn('gas_service', 'transfer-ownership', [Cl.principal(wallet2)], wallet1);
        expect(transferTx.result).toBeErr(Cl.uint(100)); // err-owner-only
    });
});
