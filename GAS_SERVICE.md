## Function Descriptions

### pay-native-gas-for-contract-call

This function is called by the contract owner to pay for gas using native currency (STX) for a contract call. It deducts the specified amount from the contract balance.

### add-native-gas

This function is called by the contract owner to add additional native gas payment for an existing transaction. It deducts the specified amount from the contract balance.

### refund

This function can be called by anyone to add STX to the contract balance, effectively refunding or topping up the contract.

### transfer-ownership

This function allows the current owner to transfer ownership of the contract to a new address.

## Read-Only Functions

### get-balance

Returns the current balance of the contract.

### is-contract-owner

Checks if the caller is the current contract owner.

### get-contract-owner

Returns the principal of the current contract owner.

## Events

### NativeGasPaidForContractCall

clarity
{
event: "NativeGasPaidForContractCall",
sender: principal,
amount: uint,
refundAddress: principal,
destinationChain: (string-ascii 32),
destinationAddress: (string-ascii 40),
payloadHash: (buff 32)
}

### NativeGasAdded

clarity
{
event: "NativeGasAdded",
sender: principal,
amount: uint,
refundAddress: principal,
txHash: (buff 32),
logIndex: uint
}

### Refunded

clarity
{
event: "Refunded",
receiver: principal,
amount: uint
}

### OwnershipTransferred

clarity
{
event: "OwnershipTransferred",
newOwner: principal
}
