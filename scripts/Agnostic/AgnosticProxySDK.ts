import { ethers } from "ethers";
import { Interface } from "ethers";

export interface NFTData {
    nft: string;
    id: bigint;
    amount: bigint;
}

export interface BridgeData {
    tokens: string[];
    nfts: NFTData[];
    isRequired: boolean;
}

export interface ZapCallData {
    to: string[];
    encodedMission: string[];
    bridgeData: BridgeData;
}

export class AgnosticProxySDK {
    constructor() {}

    /**
     * Encodes a single function call for use in the Zap function
     * @param contractInterface The contract interface (ABI)
     * @param functionName The name of the function to call
     * @param params The parameters to pass to the function
     * @returns Encoded function call
     */
    public encodeFunctionCall(
        contractInterface: Interface,
        functionName: string,
        params: any[]
    ): string {
        return contractInterface.encodeFunctionData(functionName, params);
    }

    /**
     * Encodes multiple function calls for the Zap function
     * @param calls Array of contract addresses and their encoded function calls
     * @param bridgeTokens Array of token addresses to bridge after execution
     * @param bridgeNFTs Array of NFT data to bridge after execution
     * @param requiresBridge Whether bridging is required
     * @returns Encoded Zap function parameters
     */
    public encodeZapCall(
        calls: { to: string; encodedCall: string }[],
        bridgeTokens: string[] = [],
        bridgeNFTs: NFTData[] = [],
        requiresBridge: boolean = false
    ): ZapCallData {
        const to: string[] = [];
        const encodedMission: string[] = [];

        // Process each call
        for (const call of calls) {
            to.push(call.to);
            encodedMission.push(call.encodedCall);
        }

        // Create bridge data
        const bridgeData: BridgeData = {
            tokens: bridgeTokens,
            nfts: bridgeNFTs,
            isRequired: requiresBridge
        };

        return {
            to,
            encodedMission,
            bridgeData
        };
    }

    /**
     * Encodes the final Zap function call
     * @param zapData The Zap call data
     * @returns Encoded Zap function parameters
     */
    public encodeZapParameters(zapData: ZapCallData): string {
        return ethers.AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'bytes[]', 'tuple(address[],tuple(address,uint256,uint256)[],bool)'],
            [
                zapData.to,
                zapData.encodedMission,
                [
                    zapData.bridgeData.tokens,
                    zapData.bridgeData.nfts.map(nft => [nft.nft, nft.id, nft.amount]),
                    zapData.bridgeData.isRequired
                ]
            ]
        );
    }

    /**
     * Helper function to create a complete Zap transaction
     * @param contractInterfaces Array of contract interfaces
     * @param calls Array of function calls with their parameters
     * @param bridgeTokens Array of token addresses to bridge
     * @param bridgeNFTs Array of NFT data to bridge
     * @param requiresBridge Whether bridging is required
     * @returns Encoded Zap function parameters
     */
    public createZapTransaction(
        contractInterfaces: { [address: string]: Interface },
        calls: { to: string; functionName: string; params: any[] }[],
        bridgeTokens: string[] = [],
        bridgeNFTs: NFTData[] = [],
        requiresBridge: boolean = false
    ): string {
        const encodedCalls = calls.map(call => ({
            to: call.to,
            encodedCall: this.encodeFunctionCall(
                contractInterfaces[call.to],
                call.functionName,
                call.params
            )
        }));

        const zapData = this.encodeZapCall(encodedCalls, bridgeTokens, bridgeNFTs, requiresBridge);
        return this.encodeZapParameters(zapData);
    }
}