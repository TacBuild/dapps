import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { deployMockTestContract } from "../scripts/TacSmartAccountFactory/mock/MockTestContractDeploy";
import { TacLocalTestSdk, TokenMintInfo } from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TestSmartAccountProxyUser, TacSAFactory, TacSmartAccount } from "../typechain-types";
import { SaHooksBuilder } from "../scripts/TacSmartAccountFactory/SDK/SaHooksSDK";
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
describe("Sa hooks test", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let testContract: TestSmartAccountProxyUser;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let hooksSdk: SaHooksBuilder;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        testContract = await deployMockTestContract(admin, await tacSAFactory.getAddress(), crossChainLayerAddress);

        hooksSdk = new SaHooksBuilder()
        hooksSdk.addContractInterface(await testContract.getAddress(), [
            "function increment()",
            "function mainCall(uint256)"
        ])
       

    });

    it("Hooks test", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Hooks test");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const amount = ethers.parseEther("1");
        const amountToMint = ethers.parseEther("2");
        const target = await testContract.getAddress();
        
        const methodName = "test(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        hooksSdk.addContractInterface(sttonEVMAddress, [
            "function transfer(address to, uint256 amount)",
        ])
        hooksSdk.addContractInterface(tacEVMAddress, [
            "function transfer(address to, uint256 amount)",
        ])
       
        hooksSdk.addPreHookCallFromSA(
            await testContract.getAddress(),
            "increment",
            []
        )

        hooksSdk.setMainCallHookCallFromSA(
            await testContract.getAddress(),
            "mainCall",
            [1]
        )

        hooksSdk.addPostHookCallFromSA(
            await testContract.getAddress(),
            "increment",
            []
        )

        hooksSdk.addPostHookCallFromSelf(
            sttonEVMAddress,
            "transfer",
            [admin.address, amount]
        )

        hooksSdk.addTokenBridgeHookFromSelf(
            sttonEVMAddress
        )

        hooksSdk.addTokenBridgeHookFromSelf(
            tacEVMAddress
        )

        console.log(hooksSdk.build())

        const calldata = hooksSdk.encode();

        const mintTokens: TokenMintInfo[] = [
                    {
                        info: sttonTokenInfo,
                        amount: amountToMint
                    },
                    {
                        info: tacTokenInfo,
                        amount: amountToMint
                    }
                ];

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            calldata,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp,
        );
        console.log(3)

        
    });

});

