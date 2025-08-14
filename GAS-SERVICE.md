# Gas Service Smart Contracts

## Overview

The Gas Service is implemented as a set of three contracts that work together using a proxy pattern:

1. **Gas Service (Proxy)**: The main entry point that delegates calls to the implementation
2. **Gas Implementation**: Contains the core business logic
3. **Gas Storage**: Manages the contract's state

This architecture allows for upgradability while maintaining a consistent state.

## Contract Architecture

### Gas Service (Proxy)

- Acts as the main entry point for all interactions
- Validates implementation contract before delegating calls
- Manages contract upgrades through governance
- Handles initial setup

### Gas Implementation

- Contains the core business logic
- Manages gas payments and refunds
- Handles fee collection
- Controls ownership and gas collector operations

### Gas Storage

- Stores all contract state
- Manages access control
- Emits events
- Maintains configuration data

## Core Functions

### pay-native-gas-for-contract-call

Allows users to pay for cross-chain contract calls using native STX.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract
- `amount`: uint - Amount of uSTX to pay
- `sender`: principal - The transaction initiator
- `destination-chain`: (string-ascii 20) - Target chain identifier/name
- `destination-address`: (string-ascii 128) - Target address on destination chain
- `payload`: (buff 64000) - Contract call payload
- `refund-address`: principal - Address for potential refunds

#### add-native-gas

Adds additional gas payment for an existing transaction.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract
- `amount`: uint - Additional uSTX amount
- `tx-hash`: (buff 32) - Original transaction hash
- `log-index`: uint - Log index of the original transaction
- `refund-address`: principal - Address for potential refunds

### refund

Allows gas collector to process refunds.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract
- `tx-hash`: (buff 32) - Transaction hash
- `log-index`: uint - Log index
- `receiver`: principal - Refund recipient
- `amount`: uint - Refund amount

### collect-fees

Enables gas collector to withdraw accumulated fees.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract
- `receiver`: principal - Fee recipient
- `amount`: uint - Amount to collect

### transfer-ownership

Transfers contract ownership to a new address.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract
- `new-owner`: principal - New owner address

### transfer-gas-collector

Transfers gas collector role to a new address.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract
- `new-gas-collector`: principal - New gas collector address

### get-balance

Returns the current STX balance of the contract.

Parameters:

- `gas-impl` <gas-impl-trait> - Current impl contract

### get-owner

Returns the current contract owner.

### get-gas-collector

Returns the current gas collector address.

## Access Control

The contracts implement several levels of access control:

1. **Owner**: Can transfer ownership
2. **Gas Collector**: Can process refunds and collect fees
3. **Proxy**: Can call implementation functions
4. **Implementation**: Can emit events and modify storage

## Error Codes

- `ERR-UNAUTHORIZED (u10111)`: Unauthorized access
- `ERR-OWNER-CANNOT-BE-COLLECTOR (u10112)`: Owner cannot be gas collector
- `ERR-INVALID-AMOUNT (u10112)`: Invalid amount specified
- `ERR-NOT-IMPLEMENTED (u10113)`: Function not implemented
- `ERR-INSUFFICIENT-BALANCE (u10114)`: Insufficient contract balance
- `ERR-INVALID-PRINCIPAL (u10115)`: Invalid principal provided
- `ERR-ONLY-OWNER (u10151)`: Action restricted to owner
- `ERR-ONLY-GAS-COLLECTOR (u10152)`: Action restricted to gas collector
- `ERR-INVALID-IMPL (u10211)`: Invalid implementation contract
- `ERR-STARTED (u60511)`: Contract already initialized

## Events

### Gas Payment Events

```clarity
{
    type: "native-gas-paid-for-contract-call",
    sender: principal,
    amount: uint,
    refund-address: principal,
    destination-chain: (string-ascii 20),
    destination-address: (string-ascii 128),
    payload-hash: (buff 32)
}
```

```clarity
{
    type: "native-gas-added",
    amount: uint,
    refund-address: principal,
    tx-hash: (buff 32),
    log-index: uint
}
```

### Administrative Events

```clarity
{
    type: "transfer-ownership",
    new-owner: principal
}
```

```clarity
{
    type: "transfer-gas-collector",
    new-gas-collector: principal
}
```

### Financial Events

```clarity
{
    type: "refunded",
    tx-hash: (buff 32),
    log-index: uint,
    receiver: principal,
    amount: uint
}
```

```clarity
{
    type: "fees-collected",
    receiver: principal,
    amount: uint
}
```

## Upgrade Process

The contract can be upgraded through the governance system:

1. Only the governance implementation can call `set-impl`
2. Previous implementation's balance is recorded
3. New implementation is set in storage
4. Event is emitted with upgrade details

## Security Considerations

1. All sensitive functions require appropriate authorization
2. Balance checks before transfers
3. Owner cannot be gas collector
4. Proxy pattern ensures state preservation during upgrades
5. Implementation validation before delegation
