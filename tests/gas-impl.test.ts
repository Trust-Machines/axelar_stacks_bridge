import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

describe('gas-impl contract test suite', () => {
    beforeEach(() => {
        simnet.mineEmptyBlock();
        // Start the implementation
        simnet.callPublicFn('gas-storage', 'start', [], deployer);
    });

    describe('authorization', () => {
        it('prevents direct calls to implementation', () => {
            const directCallTx = simnet.callPublicFn(
                'gas-impl',
                'pay-native-gas-for-contract-call',
                [
                    Cl.uint(1000),
                    Cl.principal(wallet1),
                    Cl.stringAscii('ethereum'),
                    Cl.stringAscii('0x1234'),
                    Cl.buffer(Buffer.from('test')),
                    Cl.principal(wallet1)
                ],
                wallet1
            );
            expect(directCallTx.result).toBeErr(Cl.uint(103)); // err-unauthorized
        });
    });

    describe('gas operations', () => {
        it('validates amount in pay-native-gas', () => {
            const invalidAmountTx = simnet.callPublicFn(
                'gas-impl',
                'pay-native-gas-for-contract-call',
                [
                    Cl.uint(0),
                    Cl.principal(wallet1),
                    Cl.stringAscii('ethereum'),
                    Cl.stringAscii('0x1234'),
                    Cl.buffer(Buffer.from('test')),
                    Cl.principal(wallet1)
                ],
                wallet1
            );
            expect(invalidAmountTx.result).toBeErr(Cl.uint(102)); // err-invalid-amount
        });

        it('validates principal in refund operation', () => {
            const nullPrincipalTx = simnet.callPublicFn(
                'gas-impl',
                'refund',
                [
                    Cl.buffer(Buffer.alloc(32)),
                    Cl.uint(0),
                    Cl.principal('SP000000000000000000002Q6VF78'),
                    Cl.uint(1000)
                ],
                deployer
            );
            expect(nullPrincipalTx.result).toBeErr(Cl.uint(105)); // ERR-INVALID-PRINCIPAL
        });
    });
}); 