# L2 Uniswap.V2 Demo

## Overview

This is a demonstration of the Cross-Chain Layer L2 part of the UniswapV2 dApp, including examples of the main functions for working with the Uniswap DEX: adding and removing liquidity, as well as swaps with a specified input (swap exact tokens for tokens) and swaps with a specified output (swap tokens for exact tokens). The contracts of the DEX are deployed on a test Polygon node. Contract addresses and block explorer are given below.

## Addresses

`0x770f1a50450347cD107726b32CaE7a155d96CD84` - Cross-Chain Layer (CCL)

`0x37A4Baba35679150caabc74780fd18E009886c0F` - UniswapV2Proxy - main Proxy contract between CCL and Uniswap dAPP

`0x4EF8CDFAa84a31a7A8349a7303fF4198AF61e38D` - UniswapV2Router02 - Uniswap dApp entry point

`0x809d550fca64d94Bd9F66E60752A544199cfAC3D` - UniswapV2Factory - factory to deploy pairs

Auxiliary test tokens:

`0x43011da9C720c763a57d7Bcff06C99887A9b50af` - wETH

`0xDF44c429F8978485b0827ca229b620981f215eB2` - TKA

`0x6Ceb0d8dFD626E724FdE25B4D5f9ab62c955FAc1` - TKB

`0x55D40c2276F1Cb26FA215344fB44404dA348451f` - TKC

## Node

We use test Polygon node:

RPC https://tac-dev-rpc.eu-north-2.gateway.fm <br>
Blockscout https://tac-dev-blockscout.eu-north-2.gateway.fm <br>
Bridge https://tac-dev-bridge.eu-north-2.gateway.fm <br>
Faucet https://tac-dev-faucet.eu-north-2.gateway.fm <br>

Signer account: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` -

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

### Adding Liquidity

To add liquidity to the TKA-TKB bpair, execute the command:

```
npm run uniswap-addliq
```

As a result, you will see an increase in token balances on the pair contract:

```
Balances before operation:
TKA-TKB Pair balances:
  TKA:        10000.0000
  TKB:        20000.0000
  LP-TKA-TKB: 0.0000

...

Balances after operation:
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
TKA-TKB Pair balances:
  TKA:        20000.0000
  TKB:        40000.0000
  LP-TKA-TKB: 0.0000

...

Balances after operation:
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
