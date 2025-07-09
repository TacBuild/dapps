import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { deployMockTestContract } from "../scripts/TacSmartAccountFactory/mock/MockTestContractDeploy";
import { TacLocalTestSdk, TokenMintInfo } from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TestSmartAccountProxyUser, TacSAFactory, TacSmartAccount, MockBluePrint, ISAFactory } from "../typechain-types";
import { SaHooksBuilder } from "../scripts/TacSmartAccountFactory/SDK/SaHooksSDK";
import { deployMockBluePrint } from "../scripts/TacSmartAccountFactory/mock/MockBlueprintDeploy";

describe("Sa hooks test", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let testContract: TestSmartAccountProxyUser;
    let tacSAFactory: ISAFactory;
    let hooksSdk: SaHooksBuilder;
    let mockBluePrint: MockBluePrint;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = new ethers.Contract(testSdk.getSmartAccountFactoryAddress(), hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        testContract = await deployMockTestContract(admin, await tacSAFactory.getAddress(), crossChainLayerAddress);
        mockBluePrint = await deployMockBluePrint(admin);

        hooksSdk = new SaHooksBuilder()
        hooksSdk.addContractInterface(await testContract.getAddress(), [
            "function increment()",
            "function mainCall(uint256,address)"
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
        const counter = await testContract.counter()
        const flag = await testContract.mainCallExecuted()
        const tokenToBridge = await testContract.tokenToBridge()
        const user = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await testContract.getAddress())

        expect(counter).to.equal(0)
        expect(flag).to.equal(false)
        expect(tokenToBridge).to.equal(ethers.ZeroAddress)

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
            [1, sttonEVMAddress]
        )

        hooksSdk.addPostHookCallFromSA(
            await testContract.getAddress(),
            "increment",
            []
        )


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

        expect(await testContract.counter()).to.equal(2)
        expect(await testContract.mainCallExecuted()).to.equal(true)
        expect(await testContract.tokenToBridge()).to.equal(sttonEVMAddress)
        expect(await testContract.user()).to.not.equal(await testContract.getAddress())
        expect(user).to.equal(await testContract.user())
    });

    it("Update blueprint test", async function () {
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const user = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await testContract.getAddress())
        try {
            await testContract.checkBlueprint(user)
        } catch (error) {
            expect(error).to.not.be.equal(undefined)
        }
        await tacSAFactory.updateBlueprint(await mockBluePrint.getAddress());
        expect(await testContract.checkBlueprint(user)).to.equal(true)
    })

});

