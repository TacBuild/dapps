# L1-EVM Project Documentation

## Overview

This project aims to act as a EVM-side Layer 2 (L2) support to integrate and run decentralized applications (dApps) natively in a fully EVM-compatible infrastructure. It facilitates seamless interaction between the main TON network (Layer 1) and the Layer 2 EVM network, enabling efficient execution of dApps with lower gas fees and faster transaction speeds.

## Project Structure

The project is organized into several directories, each serving a distinct purpose. Here is a detailed breakdown of the project structure:

### `contracts/`

This directory contains all the Solidity contracts that form the core of the project.

#### `interfaces/`

This subdirectory contains interface contracts that define the standard functions and structures used across the project.

- `IAppProxy.sol`
  - Interface for the App Proxy contract.
- `ICrossChainLayer.sol`
  - Interface for the main CrossChainLayer contract.

#### `L2/`

This subdirectory contains the core contracts for the Layer 2 operations, libraries and utility methods.

- `AppProxy.sol`
  - A base class for any dApp Proxy contract.
- `CallLib.sol`
  - Library to perform an efficient low level calls.
- `CrossChainLayer.sol`
  - Implementation of the CrossChainLayer contract. A contract for managing cross-chain messages and tokens.
- `CrossChainLayerToken.sol`
  - Implementation of the CrossChainLayerToken contract. A contract for all L2 tokens.
- `Errors.sol`
  - Contains custom error definitions.
- `Events.sol`
  - Contains event definitions.
- `Structs.sol`
  - Defines the structs used in various contracts.
- `MerkleTreeLib.sol`
  - Library for utility functions for working with Merkle trees and messages.
- `MerkleTreeUtils.sol`
  - Utility contract for working with Merkle trees and messages.

#### `proxies/`

This subdirectory contains the proxy contracts to all elegible dApps. Proxies serve as an intermediate between native dApp contracts and L2. It contains a proxy to native UniswapV2 contracts (UniswapV2Router02) for the demonstration purposes.

### `scripts/`

Contains scripts for deploying, testing, and interacting with the smart contracts.

### `tests/`

Contains test scripts to ensure the functionality and reliability of the smart contracts.
It also includes an end-to-end examples to the demo apps (see `tests/examples/`).

Tests can be run with the command
   ```
   npm run tests
   ```

Please be sure to run a test node, build and deploy all the contracts before run any tests (see below for details).

### `config.js`

Configuration file for the project.

## Contracts Overview

### `AppProxy.sol`

Proxy contracts serve as an intermediary between the dApps and the cross-chain layer, ensuring that messages are properly routed and executed.
The `AppProxy` contract is a base contract for application proxies. It inherits from Ownable and implements the IAppProxy interface. This contract is designed to manage an application address and interact with a cross-chain layer.

### `CrossChainLayer.sol`

The `CrossChainLayer` contract serves as the core of the L2 bridge, managing the execution of messages, communications with the dApps via proxies, and managing cross-chain tokens. It provides functionality to handle cross-chain interactions, including minting, unlocking, and burning tokens, as well as processing messages based on Merkle proofs. It ensures that only authorized sequencers and application proxies can perform specific actions.

#### Key Features
- **Sequencer Management**: Add and block sequencers to control who can process cross-chain messages.
- **Application Proxy Management**: Add and block application proxies to authorize specific applications to interact with the contract.
- **Merkle Root Management**: Update the Merkle root used for validating cross-chain messages.
- **Message Processing (Execution)**: Execute messages on the L2 side if a valid Merkle proof is provided.
- **Callback Handling**: Process callbacks from decentralized applications (dApps) and handle token burning and locking.

### `CrossChainLayerToken.sol`

The `CrossChainLayerToken` contract for all L2 tokens.

### `CallLib.sol`

Library to perform an efficient low level calls.

### `Errors.sol`

Defines custom errors used throughout the contracts to provide more meaningful error messages and facilitate debugging.

### `Events.sol`

Defines events that are emitted by the contracts to signal state changes and important actions.

### `Structs.sol`

Defines the structs used in various contracts.

### `MerkleTreeLib.sol`

This library contains utility functions for working with messages, such as hashing messages and calculating Merkle roots.

### `MerkleTreeUtils.sol`

Provides utility functions for working with Merkle trees, which are used to ensure the integrity of data.

## Setup and Deployment

1. **Install Dependencies:**
   ```
   npm install
   ```

2. **Raise up a test hardhat node:**
   ```
   npx hardhat node
   ```

3. **Compile and deploy contracts:**
   ```
   npm run run-uniswap-example
   ```

4. **Run tests:**
  To run unit tests with a single command execute 
   ```
   npm run deploy-and-tests
   ```
  To run UniswapV2 examples execute the following command
   ```
   node tests/examples/UniswapV2.*.js
   ```
  where UniswapV2.*.js - any of the scripts inside `tests/examples` folder.