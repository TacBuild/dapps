import { ethers, Interface } from "ethers";

export interface PreHook {
    isFromSAPerspective: boolean;
    contractAddress: string;
    value: bigint;
    data: string;
}

export interface PostHook {
    isFromSAPerspective: boolean;
    contractAddress: string;
    value: bigint;
    data: string;
}

export interface MainCallHook {
    isFromSAPerspective: boolean;
    contractAddress: string;
    value: bigint;
    data: string;
}

export interface NFTBridgeHook {
    tokenAddress: string;
    tokenId: bigint;
    amount: bigint;
}

export interface TokenBridgeHook {
    tokenAddress: string;
}

export interface BridgeHook {
    nftBridgeHooks: NFTBridgeHook[];
    tokenBridgeHooks: TokenBridgeHook[];
    isFromSAPerspective: boolean;
}

export interface SaHooks {
    preHooks: PreHook[];
    postHooks: PostHook[];
    bridgeHooks: BridgeHook;
    mainCallHook: MainCallHook;
}

export class SaHooksBuilder {
    private hooks: SaHooks;
    private contractInterfaces: { [address: string]: Interface };

    constructor() {
        this.hooks = {
            preHooks: [],
            postHooks: [],
            bridgeHooks: {
                nftBridgeHooks: [],
                tokenBridgeHooks: []
            },
            mainCallHook: {
                isFromSAPerspective: false,
                contractAddress: ethers.ZeroAddress,
                value: 0n,
                data: "0x"
            }
        };
        this.contractInterfaces = {};
    }

    /**
     * Add a contract interface for a specific address
     * @param address Contract address
     * @param abi Contract ABI
     */
    public addContractInterface(address: string, abi: any[]): SaHooksBuilder {
        this.contractInterfaces[address] = new Interface(abi);
        return this;
    }

    /**
     * Encode a function call using the stored contract interface
     * @param address Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @returns Encoded function call
     */
    private encodeFunctionCall(
        address: string,
        functionName: string,
        params: any[]
    ): string {
        if (!this.contractInterfaces[address]) {
            throw new Error(`No interface found for contract at ${address}`);
        }
        return this.contractInterfaces[address].encodeFunctionData(functionName, params);
    }

    // Pre-hooks methods
    private addPreHook(hook: PreHook): SaHooksBuilder {
        this.hooks.preHooks.push(hook);
        return this;
    }

    private addPreHookFromSA(contractAddress: string, value: bigint, data: string): SaHooksBuilder {
        return this.addPreHook({
            isFromSAPerspective: true,
            contractAddress,
            value,
            data
        });
    }

    private addPreHookFromSelf(contractAddress: string, value: bigint, data: string): SaHooksBuilder {
        return this.addPreHook({
            isFromSAPerspective: false,
            contractAddress,
            value,
            data
        });
    }

    /**
     * Add a pre-hook with function call from SA perspective
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @param value ETH value to send
     */
    addPreHookCallFromSA(
        contractAddress: string,
        functionName: string,
        params: any[],
        value: bigint = 0n
    ): SaHooksBuilder {
        const data = this.encodeFunctionCall(contractAddress, functionName, params);
        return this.addPreHookFromSA(contractAddress, value, data);
    }

    /**
     * Add a pre-hook with function call from self perspective
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @param value ETH value to send
     */
    addPreHookCallFromSelf(
        contractAddress: string,
        functionName: string,
        params: any[],
        value: bigint = 0n
    ): SaHooksBuilder {
        const data = this.encodeFunctionCall(contractAddress, functionName, params);
        return this.addPreHookFromSelf(contractAddress, value, data);
    }

    // Post-hooks methods
    private addPostHook(hook: PostHook): SaHooksBuilder {
        this.hooks.postHooks.push(hook);
        return this;
    }

    private addPostHookFromSA(contractAddress: string, value: bigint, data: string): SaHooksBuilder {
        return this.addPostHook({
            isFromSAPerspective: true,
            contractAddress,
            value,
            data
        });
    }

    private addPostHookFromSelf(contractAddress: string, value: bigint, data: string): SaHooksBuilder {
        return this.addPostHook({
            isFromSAPerspective: false,
            contractAddress,
            value,
            data
        });
    }

    /**
     * Add a post-hook with function call from SA perspective
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @param value ETH value to send
     */
    addPostHookCallFromSA(
        contractAddress: string,
        functionName: string,
        params: any[],
        value: bigint = 0n
    ): SaHooksBuilder {
        const data = this.encodeFunctionCall(contractAddress, functionName, params);
        return this.addPostHookFromSA(contractAddress, value, data);
    }

    /**
     * Add a post-hook with function call from self perspective
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @param value ETH value to send
     */
    addPostHookCallFromSelf(
        contractAddress: string,
        functionName: string,
        params: any[],
        value: bigint = 0n
    ): SaHooksBuilder {
        const data = this.encodeFunctionCall(contractAddress, functionName, params);
        return this.addPostHookFromSelf(contractAddress, value, data);
    }

    // Main call hook methods
    private setMainCallHook(hook: MainCallHook): SaHooksBuilder {
        this.hooks.mainCallHook = hook;
        return this;
    }

    private setMainCallHookFromSA(contractAddress: string, value: bigint, data: string): SaHooksBuilder {
        return this.setMainCallHook({
            isFromSAPerspective: true,
            contractAddress,
            value,
            data
        });
    }

    private setMainCallHookFromSelf(contractAddress: string, value: bigint, data: string): SaHooksBuilder {
        return this.setMainCallHook({
            isFromSAPerspective: false,
            contractAddress,
            value,
            data
        });
    }

    /**
     * Set main call hook with function call from SA perspective
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @param value ETH value to send
     */
    setMainCallHookCallFromSA(
        contractAddress: string,
        functionName: string,
        params: any[],
        value: bigint = 0n
    ): SaHooksBuilder {
        const data = this.encodeFunctionCall(contractAddress, functionName, params);
        return this.setMainCallHookFromSA(contractAddress, value, data);
    }

    /**
     * Set main call hook with function call from self perspective
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param params Function parameters
     * @param value ETH value to send
     */
    setMainCallHookCallFromSelf(
        contractAddress: string,
        functionName: string,
        params: any[],
        value: bigint = 0n
    ): SaHooksBuilder {
        const data = this.encodeFunctionCall(contractAddress, functionName, params);
        return this.setMainCallHookFromSelf(contractAddress, value, data);
    }

    // Bridge hooks methods
    private _addNFTBridgeHook(hook: NFTBridgeHook): SaHooksBuilder {
        this.hooks.bridgeHooks.nftBridgeHooks.push(hook);
        return this;
    }

    private _addTokenBridgeHook(hook: TokenBridgeHook): SaHooksBuilder {
        this.hooks.bridgeHooks.tokenBridgeHooks.push(hook);
        return this;
    }

    addNFTBridgeHookFromSA(tokenAddress: string, tokenId: bigint, amount: bigint): SaHooksBuilder {
        return this._addNFTBridgeHook({
            isFromSAPerspective: true,
            tokenAddress,
            tokenId,
            amount
        });
    }

    addNFTBridgeHookFromSelf(tokenAddress: string, tokenId: bigint, amount: bigint): SaHooksBuilder {
        return this._addNFTBridgeHook({
            isFromSAPerspective: false,
            tokenAddress,
            tokenId,
            amount
        });
    }

    addTokenBridgeHookFromSA(tokenAddress: string): SaHooksBuilder {
        return this._addTokenBridgeHook({
            isFromSAPerspective: true,
            tokenAddress
        });
    }

    addTokenBridgeHookFromSelf(tokenAddress: string): SaHooksBuilder {
        return this._addTokenBridgeHook({
            isFromSAPerspective: false,
            tokenAddress
        });
    }

    // Helper methods for common operations
    addApprovePreHook(tokenAddress: string, spenderAddress: string, amount: bigint): SaHooksBuilder {
        return this.addPreHookCallFromSA(
            tokenAddress,
            "approve",
            [spenderAddress, amount]
        );
    }

    addTransferPreHook(tokenAddress: string, toAddress: string, amount: bigint): SaHooksBuilder {
        return this.addPreHookCallFromSA(
            tokenAddress,
            "transfer",
            [toAddress, amount]
        );
    }

    addApprovePostHook(tokenAddress: string, spenderAddress: string, amount: bigint): SaHooksBuilder {
        return this.addPostHookCallFromSelf(
            tokenAddress,
            "approve",
            [spenderAddress, amount]
        );
    }

    addTransferPostHook(tokenAddress: string, toAddress: string, amount: bigint): SaHooksBuilder {
        return this.addPostHookCallFromSelf(
            tokenAddress,
            "transfer",
            [toAddress, amount]
        );
    }

    // Build and encode methods
    build(): SaHooks {
        return this.hooks;
    }

    encode(): string {
        return ethers.AbiCoder.defaultAbiCoder().encode(
            [
                "tuple(" +
                "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data)[] preHooks," +
                "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data)[] postHooks," +
                "tuple(" +
                    "tuple(bool isFromSAPerspective, address tokenAddress, uint256 tokenId, uint256 amount)[] nftBridgeHooks," +
                    "tuple(bool isFromSAPerspective, address tokenAddress)[] tokenBridgeHooks" +
                ") bridgeHooks," +
                "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data) mainCallHook" +
            ")"
            ],
            [this.hooks]
        );
    }
}

// Example usage:
/*
const hooks = new SaHooksBuilder()
    .addContractInterface(tokenAddress, tokenABI)
    .addPreHookCallFromSA(
        tokenAddress,
        "approve",
        [spenderAddress, amount]
    )
    .addPostHookCallFromSelf(
        tokenAddress,
        "balanceOf",
        [recipientAddress]
    )
    .addNFTBridgeHook({
        isFromSAPerspective: true,
        tokenAddress: nftAddress,
        tokenId: 1n,
        amount: 1n
    })
    .build();

const encodedHooks = hooks.encode();
*/ 