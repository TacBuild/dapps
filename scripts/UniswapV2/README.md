# L2 Uniswap.V2 Demo

## Overview

This is a demonstration of the Cross-Chain Layer L2 part of the UniswapV2 dApp, including examples of the main functions for working with the Uniswap DEX: adding and removing liquidity, as well as swaps with a specified input (swap exact tokens for tokens) and swaps with a specified output (swap tokens for exact tokens). The contracts of the DEX are deployed on a test Polygon node. Contract addresses and block explorer are given below.

**!** Before running the examples please create .env file in the project root by copying .env.polygon (with no changes).

## Addresses

CCL & dApp:

`0xeAd789bd8Ce8b9E94F5D0FCa99F8787c7e758817` - Cross-Chain Layer (CCL)

`0xeC827421505972a2AE9C320302d3573B42363C26` - UniswapV2Proxy - main Proxy contract between CCL and Uniswap dAPP

`0x6b39b761b1b64C8C095BF0e3Bb0c6a74705b4788` - UniswapV2Router02 - Uniswap dApp entry point

`0xb007167714e2940013EC3bb551584130B7497E22` - UniswapV2Factory - factory to deploy token pairs

Auxiliary test tokens:

`0x85d12185240d418c97Bf9df684a87011c1ec6adf` - wETH

`0x5a0F014001dbc714E76E3Bcfe8c5170Ff9e35F7c` - TKA

`0x6b7DCd9ca325CF694447A5f2074BC3aD757e8991` - TKB

`0x22D51c93820f7DEe10D9D6F13cDbab52260b029C` - TKC

## Node

We use test Polygon node:

RPC https://tac-dev-rpc.eu-north-2.gateway.fm <br>
Blockscout https://tac-dev-blockscout.eu-north-2.gateway.fm <br>
Bridge https://tac-dev-bridge.eu-north-2.gateway.fm <br>
Faucet https://tac-dev-faucet.eu-north-2.gateway.fm <br>

Signer account: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

Signer private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

## Achitecture

In this project, for demonstration purposes, all messages in the Cross-Chain Layer are sent directly, bypassing the sequencer consensus. Please note that this may take additional time, as each message is processed in a separate epoch (~10 seconds).
The execution scheme for any message (for example, token swapping) is as follows:

- A corresponding Merkle tree is formed for the message, the root of which is sent to the CCL contract
- The message is sent for execution along with the Merkle proof
- After validating the proof, CCL calls the required method of the corresponding dApp proxy contract (in this case, UniswapV2Proxy - a proxy to UniswapV2Router02)
- If the method execution is successful, the current transaction emits a message

## Demo
To directly demonstrate the functionality described above, you can add or remove liquidity to pairs of pre-deployed tokens TKA, TKB, etc., or perform their swap with a specified input or output, as described below. You can also add new tokens manually and perform all the described operations with them.

All operations can be monitored in the block explorer (see links above).

**!** Before running the examples please ensure you have .env file in the project root as described above.

### Adding Liquidity

To add liquidity to the TKA-TKB pair, execute the command:

```
npm run uniswap-addliq
```

As a result, you will see an increase in token balances on the pair contract:

```
Balances before operation:

CrossChainLayer balances:
  TKA:        0.000000
  TKB:        0.000000
  LP-TKA-TKB: 0.000000
TKA-TKB Pair balances:
  TKA:        10000.000000
  TKB:        20000.000000
  LP-TKA-TKB: 0.000155

...

Balances after operation:

CrossChainLayer balances:
  TKA:        0.000000
  TKB:        0.000000
  LP-TKA-TKB: 0.000155
TKA-TKB Pair balances:
  TKA:        20000.0000
  TKB:        40000.0000
  LP-TKA-TKB: 0.0000
```

### Removing Liquidity

To remove liquidity from the TKA-TKB pair, execute the command:

```
npm run uniswap-remliq
```

As a result, you will see a decrease in token balances on the pair contract:

```
Balances before operation:

CrossChainLayer balances:
  TKA:        0.000000
  TKB:        0.000000
  LP-TKA-TKB: 0.000155
TKA-TKB Pair balances:
  TKA:        20000.0000
  TKB:        40000.0000
  LP-TKA-TKB: 0.0000

...

Balances after operation:

CrossChainLayer balances:
  TKA:        0.000000
  TKB:        0.000000
  LP-TKA-TKB: 0.000131
TKA-TKB Pair balances:
  TKA:        19964.0000
  TKB:        39929.0000
  LP-TKA-TKB: 0.0000
```

### Swap with Exact Input

To perform a swap of TKA token for TKB token with an exact TKA value, execute the command:

```
npm run uniswap-swapexact
```

As a result, you will see a change in token balances on the pair contract:

```
Balances before operation:

TKA-TKB Pair balances:
  TKA:        19964.0000
  TKB:        39929.0000
  LP-TKA-TKB: 0.0000

...

Balances after operation:

TKA-TKB Pair balances:
  TKA:        19974.0000
  TKB:        39909.0000
  LP-TKA-TKB: 0.0000
```

### Swap with Exact Output

To perform a swap of TKA token for TKB token with an exact TKB value, execute the command:

```
npm run uniswap-swaptok
```

As a result, you will see a change in token balances on the pair contract:

```
Balances before operation:
TKA-TKB Pair balances:
  TKA:        19974.0000
  TKB:        39909.0000
  LP-TKA-TKB: 0.0000

...

Balances after operation:
TKA-TKB Pair balances:
  TKA:        19981.0000
  TKB:        39896.0000
  LP-TKA-TKB: 0.0000
```
