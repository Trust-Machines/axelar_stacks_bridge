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
});
