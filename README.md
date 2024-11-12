# Stacks Integration for Axelar Bridge

A Stacks blockchain integration with the Axelar network, enabling cross-chain communication and asset transfers using Clarity smart contracts.

## Overview

This project implements the Stacks blockchain side of an Axelar bridge integration, allowing for:
- Cross-chain token transfers
- Message passing between Stacks and other blockchain networks
- Secure validation of cross-chain transactions

## Project Structure

```
├── contracts/         # Clarity smart contracts
├── deployments/       # Deployment configurations
├── settings/          # Environment settings
└── tests/             # Test scripts in javascript
```

## Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) - Clarity development tool
- [Axelar Network Access](https://docs.axelar.dev/) - For cross-chain functionality
- [Node.js](https://nodejs.org/en/download/) - For running the test suite

## Installation

1. Install Clarinet:

[Installation Guide](https://github.com/hirosystems/clarinet?tab=readme-ov-file#installation)

2. Clone the repository:

```
git clone https://github.com/Trust-Machines/stacks-axelar
```

## Development

### Test Smart Contracts

`npm run test`

### Check Contract Syntax

`clarinet check`

### Console Mode

`clarinet console`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Resources

- [Clarity Documentation](https://docs.stacks.co/clarity/)
- [Clarinet Documentation](https://docs.hiro.so/smart-contracts/clarinet)
- [Stacks Documentation](https://docs.stacks.co/)
