# Agnostic Proxy
Agnostic proxy smart contract is tool for reactive development inside TAC ecosystem. Originaly, every dapp should have a proxy on our EVM crosschain layer to be able to bias TON and EVM dapps located on crosschain layer blockchain. Developing every proxy requires knowledge of TAC infrastracture and integrated protocol infrastructure and requires some time to be developed. We want to present agnostic solution to bootstrap development process.

## Base
AgnosticProxy smart contract as it can be extracted from name can be biased to almost any dapp. The logic behind is to transfer all logic on backend/frontend via constructing chain of calls. Agnostic proxy itself will just execute them in order that dapp predefined.

## Steps to mainnet with AgnosticProxy
1. Deploying set of an external protocol smart contracts on TAC EVM crosschain layer
2. Deploy predefined agnostic proxy
3. Integrate sdk into the process of forming call to blockchain in protocol's back/front

## Example with Uniswap V2 swap function
### Regular interaction on regular evm chain
1. Form a call with user's information to approve and execute approve with selected Token A
2. Form a call with provided information to swap Token A to Token B and execute

### Regular interaction on TAC EVM crosschain layer
1. Form a call using our sdk and execute transaction(Note: Specific proxy contract that will incapsulate all interactions should be developed)

### Interaction via AgnosticProxy on TAC EVM crosschain layer
1. Form chain of calls(approve, swap) using our sdk and execute transaction(Note: Nothing additional should developed in this case)

## Code example of interaction with AgnosticProxy via sdk
```typescript
//Initialize SDK
agnosticProxySDK = new AgnosticProxySDK();

// Create mapping with all interfaces that will be used inside calls
const contractInterfaces = {
            [UniswapRouterAddress]: UniSwapRouter.interface,
            [TokenAAddress]: TokenA.interface
        };
// Constructing chain of calls. This will be your regular communication with your protocol. If you need to do more approves, then just add them, if you need more specific communications, just include them here
const calls = [
            {
                to: TokenAAddress,
                functionName: "approve",
                params: [UniswapRouterAddress, ethers.MaxUint256]
            },
            {
                to: UniswapRouterAddress,
                functionName: "swapExactTokensForTokens",
                    params: [amountIn, amountOutMin, path, to, deadline]
            }
        ];
        
// Not every interaction should have bridge back logic. Here we are swapping TokenA to Token B, so, Token B should be bridged back. If your interaction doesn't need bridge back logic, just skip them and leave this fields empty 
const bridgeBackTokens = [TokenB];
const bridgeBackRequires = true;

// Main function that will construct calldata that you should pass as an argument to function call. Also Call target will be agnostic proxy.
const zapCallData = agnosticProxySDK.createZapTransaction(contractInterfaces, calls, bridgeBackTokens, bridgeBackRequires);
```