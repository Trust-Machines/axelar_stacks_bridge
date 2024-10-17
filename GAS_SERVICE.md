## Function Descriptions

### native-gas-paid-for-contract-call

This function is called by the contract owner to pay for gas using native currency (STX) for a contract call. It deducts the specified amount from the contract balance.

### native-gas-added

This function is called by the contract owner to add additional native gas payment for an existing transaction. It deducts the specified amount from the contract balance.

### refunded

This function can be called by anyone to add STX to the contract balance, effectively refunding or topping up the contract.

### ownership-transferred

This function allows the current owner to transfer ownership of the contract to a new address.

## Events

### native-gas-paid-for-contract-call

clarity
{
event: "native-gas-paid-for-contract-call",
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
event: "native-gas-added",
sender: principal,
amount: uint,
refund-address: principal,
tx-hash: (buff 32),
log-index: uint
}

### refunded

clarity
{
event: "refunded",
sender: principal,
amount: uint
}

### ownership-transferred

clarity
{
event: "ownership-transferred",
new-owner: principal
}
