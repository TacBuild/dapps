import { ethers } from "ethers";
import { Interface } from "ethers";

export interface BridgeData {
    tokens: string[];
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
     * @param requiresBridge Whether bridging is required
     * @returns Encoded Zap function parameters
     */
    public encodeZapCall(
        calls: { to: string; encodedCall: string }[],
        bridgeTokens: string[] = [],
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
            ['address[]', 'bytes[]', 'tuple(address[],bool)'],
            [
                zapData.to,
                zapData.encodedMission,
                [zapData.bridgeData.tokens, zapData.bridgeData.isRequired]
            ]
        );
    }

    /**
     * Helper function to create a complete Zap transaction
     * @param contractInterfaces Array of contract interfaces
     * @param calls Array of function calls with their parameters
     * @param bridgeTokens Array of token addresses to bridge
     * @param requiresBridge Whether bridging is required
     * @returns Encoded Zap function parameters
     */
    public createZapTransaction(
        contractInterfaces: { [address: string]: Interface },
        calls: { to: string; functionName: string; params: any[] }[],
        bridgeTokens: string[] = [],
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

        const zapData = this.encodeZapCall(encodedCalls, bridgeTokens, requiresBridge);
        return this.encodeZapParameters(zapData);
    }
}