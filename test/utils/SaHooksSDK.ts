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

export interface NFTBridgeHook {
    tokenAddress: string;
    tokenId: bigint;
    amount: bigint;
}

export interface TokenBridgeHook {
    tokenAddress: string;
}

export interface SaHooks {
    preHooks: PreHook[];
    postHooks: PostHook[];
}

export class SaHooksBuilder {
    private hooks: SaHooks;
    private contractInterfaces: { [address: string]: Interface };

    constructor() {
        this.hooks = {
            preHooks: [],
            postHooks: [],
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
     * @param tokenAddress Token address
     * @param toAddress To address
     * @param amount Amount
     */
    addPreHookTransferTo(
        tokenAddress: string,
        toAddress: string,
        amount: bigint
    ): SaHooksBuilder {
        return this.addPreHook({
            isFromSAPerspective: false,
            contractAddress: tokenAddress,
            value: 0n,
            data: ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [toAddress, amount])
        });
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
     * @param tokenAddress Token address
     * @param toAddress To address
     * @param amount Amount
     */
    addPostHookTransferTo(
        tokenAddress: string,
        toAddress: string,
        amount: bigint
    ): SaHooksBuilder {
        return this.addPostHook({
            isFromSAPerspective: false,
            contractAddress: tokenAddress,
            value: 0n,
            data: ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [toAddress, amount])
        });
    }

    getDataForCall(contractAddress: string, functionName: string, params: any[]): string {
        return this.encodeFunctionCall(contractAddress, functionName, params);
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

    // addTransferFromToSaHook()

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
            ")"
            ],
            [this.hooks]
        );
    }

    tupleString(): string {
        return "tuple(" +
        "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data)[] preHooks," +
        "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data)[] postHooks," +
    ")"
    }

    bridgeString(): string {
        return "tuple(address[])";
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
