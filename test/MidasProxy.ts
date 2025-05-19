import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BytesLike } from "ethers";

import { TacLocalTestSdk, TokenMintInfo } from "@tonappchain/evm-ccl";
import { deployMidasProxy } from "../scripts/Midas/deployMidasProxy";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { TacSAFactory, TacSmartAccount, IDepositVault, IRedemptionVault } from "../typechain-types";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { MidasProxy } from "../typechain-types";
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { midasTestnetConfig } from "../scripts/Midas/config/testnetConfig";

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";

describe("MidasProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let midasProxy: MidasProxy;
    let depositVault: IDepositVault;
    let redemptionVault: IRedemptionVault;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let stton: ERC20;
    let tac: ERC20;
    let mToken: ERC20;
    

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log("crossChainLayerAddress", crossChainLayerAddress);
        
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        midasProxy = await deployMidasProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        
        depositVault = new ethers.Contract(midasTestnetConfig.depositVaultAddress, hre.artifacts.readArtifactSync('IDepositVault').abi, admin) as unknown as IDepositVault;
        redemptionVault = new ethers.Contract(midasTestnetConfig.redemptionVaultAddress, hre.artifacts.readArtifactSync('IRedemptionVault').abi, admin) as unknown as IRedemptionVault;
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        mToken = new ethers.Contract(await depositVault.mToken(), hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
    });

    it("add payment token", async function () {

        console.log(await depositVault.getPaymentTokens())

        const tx = await depositVault.addPaymentToken(
            await stton.getAddress(),
            "0x7C32e4AfB7a86AE4D14Ab44D3a3E52EfDD562a23",
            0,
            true
        );
        const receipt = await tx.wait();
        
        console.log(await depositVault.getPaymentTokens())
        
    });

    it("midas deposit instant", async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit instant");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "depositInstant(bytes,bytes)";

        const amount = ethers.parseEther("1")
    
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, address, uint256, uint256, bytes32)'],
            [[
                midasTestnetConfig.depositVaultAddress,
                await stton.getAddress(),
                amount,
                0,
                "0x0000000000000000000000000000000000000000000000000000000000000000"
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
        
        console.log(await stton.balanceOf(testSdk.getCrossChainLayerAddress()))
        console.log(await mToken.balanceOf(testSdk.getCrossChainLayerAddress()))
        
    });
});
