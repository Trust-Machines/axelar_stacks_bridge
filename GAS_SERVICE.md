# Gas Service Contract

## Overview

The Gas Service Contract manages gas payments and refunds for cross-chain communication on the Stacks network. It allows users to pay for gas for cross-chain calls and provides functionality for refunding and managing the contract's balance.

## Function Descriptions

### pay-native-gas-for-contract-call

This function allows anyone to pay for gas using native currency (STX) for a contract call. It deducts the specified amount from the caller's balance and adds it to the contract's balance.

Parameters:

- `amount`: The amount of STX to pay for gas
- `sender`: The address initiating the cross-chain call
- `destination-chain`: The target chain for the cross-chain call
- `destination-address`: The target address on the destination chain
- `payload`: Data payload for the contract call
- `refund-address`: The address where refunds, if any, should be sent

### add-native-gas

This function allows anyone to add additional native gas payment for an existing transaction. It deducts the specified amount from the caller's balance and adds it to the contract's balance.

Parameters:

- `amount`: The amount of STX to add as gas
- `sender`: The address that initiated the cross-chain call
- `tx-hash`: The transaction hash of the cross-chain call
- `log-index`: The log index for the cross-chain call
- `refund-address`: The address where refunds, if any, should be sent

### refund

This function can only be called by the contract owner to refund gas payment to a specified receiver. It transfers the specified amount from the contract's balance to the receiver.

Parameters:

- `tx-hash`: The transaction hash of the cross-chain call
- `log-index`: The log index for the cross-chain call
- `receiver`: The address to receive the refund
- `amount`: The amount of STX to refund

### transfer-ownership

This function allows the current owner to transfer ownership of the contract to a new address.

Parameters:

- `new-owner`: The address of the new owner

## Read-Only Functions

### get-balance

Returns the current balance of the contract.

### is-owner

Checks if the caller is the current owner of the contract.

### get-owner

Returns the current owner of the contract.

## Events

### native-gas-paid-for-contract-call

clarity
{
type: "native-gas-paid-for-contract-call",
sender: principal,
amount: uint,
refund-address: principal,
destination-chain: (string-ascii 32),
destination-address: (string-ascii 40),
payload-hash: (buff 32)
}

### native-gas-added

clarity
{
type: "native-gas-added",
sender: principal,
amount: uint,
refund-address: principal,
tx-hash: (buff 32),
log-index: uint
}

### refunded

{
type: "refunded",
sender: principal,
amount: uint,
tx-hash: (optional (buff 32)),
log-index: (optional uint)
}

### ownership-transferred

clarity
{
type: "ownership-transferred",
new-owner: principal
}
