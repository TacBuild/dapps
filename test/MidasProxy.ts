import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BytesLike } from "ethers";

import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";
import { deployMidasProxy } from "../scripts/Midas/deployMidasProxy";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ISAFactory, IDepositVault, IRedemptionVault } from "../typechain-types";

import { VaultMock, MidasProxy, TestToken } from "../typechain-types";

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";

import { reset, getStorageAt, setStorageAt } from "@nomicfoundation/hardhat-network-helpers"


describe("MidasProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let midasProxy: MidasProxy;

    let tacSAFactory: ISAFactory;

    let stton: ERC20;
    let tac: ERC20;
    let mToken: TestToken;
    let mockVault: VaultMock;

    before(async function () {
        await reset(process.env.TAC_TESTNET_URL, 4580693);
        
        admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        const testTokenFactory = await ethers.getContractFactory("TestToken", admin);
        const mockVaultFactory = await ethers.getContractFactory("VaultMock", admin);
        
        mToken = await testTokenFactory.deploy("mToken", "mToken");
        mockVault = await mockVaultFactory.deploy(await mToken.getAddress());

        tacSAFactory = await hre.ethers.getContractAt("ISAFactory", testSdk.getSmartAccountFactoryAddress()) as unknown as ISAFactory;

        midasProxy = await deployMidasProxy(admin, await tacSAFactory.getAddress(), await mockVault.getAddress(), await mockVault.getAddress(), crossChainLayerAddress);

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });


    it("midas deposit instant", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit instant");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "depositInstant(bytes,bytes)";

        const amount = ethers.parseEther("0.0001")

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256, bytes32)'],
            [[
                await stton.getAddress(),
                amount,
                0,
                ethers.ZeroHash
            ]]
        );



        const mintTokens: TokenMintInfo[] = [
        {
            info: sttonTokenInfo,
            amount: amount
        }];

        
        
        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(await mToken.balanceOf(testSdk.getCrossChainLayerAddress())).to.equal(amount);
    });

    it("midas deposit request", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "depositRequest(bytes,bytes)";

        const amount = ethers.parseEther("0.0001")

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, bytes32)'],
            [[
                await stton.getAddress(),
                amount,
                ethers.ZeroHash
            ]]
        );



        const mintTokens: TokenMintInfo[] = [
        {
            info: sttonTokenInfo,
            amount: amount
        }];


        expect(await mockVault.requestCount()).to.equal(0);

        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(await mockVault.requestCount()).to.equal(1);
        
        expect(await stton.balanceOf(await mockVault.getAddress())).to.equal(amount*2n);

    });

    it("midas redeem instant", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("redeem instant");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "redeemInstant(bytes,bytes)";

        const amount = ethers.parseEther("0.00005")

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256)'],
            [[
                await stton.getAddress(),
                amount,
                0
            ]]
        );



        const unlockTokens: TokenUnlockInfo[] = [{
            evmAddress: await mToken.getAddress(),
            amount: amount,
        }]

        const mTokenCCLBefore = await mToken.balanceOf(testSdk.getCrossChainLayerAddress())
        const sttonVaultBefore = await stton.balanceOf(await mockVault.getAddress())
        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            unlockTokens,
            0n,
            extraData,
            operationId,
            timestamp
        );
        expect(await mToken.balanceOf(testSdk.getCrossChainLayerAddress())).to.equal(mTokenCCLBefore-amount);
        expect(await stton.balanceOf(await mockVault.getAddress())).to.equal(sttonVaultBefore-amount);
    });


    it("midas redeem request", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("redeem request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "redeemRequest(bytes,bytes)";

        const amount = ethers.parseEther("0.00005")

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256)'],
            [[
                await stton.getAddress(),
                amount,
            ]]
        );



        const unlockTokens: TokenUnlockInfo[] = [{
            evmAddress: await mToken.getAddress(),
            amount: amount,
        }]

        const mTokenCCLBefore = await mToken.balanceOf(testSdk.getCrossChainLayerAddress())
        const sttonVaultBefore = await stton.balanceOf(await mockVault.getAddress())
        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            unlockTokens,
            0n,
            extraData,
            operationId,
            timestamp
        );
        expect(await mockVault.requestCount()).to.equal(2);
        expect(await mToken.balanceOf(testSdk.getCrossChainLayerAddress())).to.equal(mTokenCCLBefore-amount);
        expect(await stton.balanceOf(await mockVault.getAddress())).to.equal(sttonVaultBefore);
    });


});
