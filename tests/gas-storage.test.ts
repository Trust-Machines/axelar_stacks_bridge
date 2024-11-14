import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;

describe('gas-storage contract test suite', () => {
    beforeEach(() => {
        simnet.mineEmptyBlock();
    });

    describe('authorization', () => {
        it('only allows authorized contracts to emit events', () => {
            const unauthorizedEventTx = simnet.callPublicFn(
                'gas-storage',
                'emit-gas-paid-event',
                [
                    Cl.principal(wallet1),
                    Cl.uint(1000),
                    Cl.principal(wallet1),
                    Cl.stringAscii('ethereum'),
                    Cl.stringAscii('0x1234'),
                    Cl.buffer(Buffer.alloc(32))
                ],
                wallet1
            );
            expect(unauthorizedEventTx.result).toBeErr(Cl.uint(1000)); // err-unauthorized
        });

        it('only allows authorized contracts to set owner', () => {
            const unauthorizedSetOwnerTx = simnet.callPublicFn(
                'gas-storage',
                'set-owner',
                [Cl.principal(wallet1)],
                wallet1
            );
            expect(unauthorizedSetOwnerTx.result).toBeErr(Cl.uint(1000)); // err-unauthorized
        });
    });

    describe('owner management', () => {
        it('correctly stores and retrieves owner', () => {
            const ownerQuery = simnet.callReadOnlyFn(
                'gas-storage',
                'get-owner',
                [],
                deployer
            );
            expect(ownerQuery.result).toBeOk(Cl.principal(deployer));
        });
    });

    describe('started status', () => {
        it('correctly manages started status', () => {
            const beforeStart = simnet.callReadOnlyFn(
                'gas-storage',
                'get-is-started',
                [],
                deployer
            );
            expect(beforeStart.result).toBe(Cl.bool(false));

            const startTx = simnet.callPublicFn(
                'gas-storage',
                'start',
                [],
                deployer
            );
            expect(startTx.result).toBeOk(Cl.bool(true));

            const afterStart = simnet.callReadOnlyFn(
                'gas-storage',
                'get-is-started',
                [],
                deployer
            );
            expect(afterStart.result).toBe(Cl.bool(true));
        });
    });
}); 