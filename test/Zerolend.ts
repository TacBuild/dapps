import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Contract, Signer } from "ethers";
import { expect } from "chai";

import { zerolendPoolConfig } from '../scripts/Zerolend/config/ZerolendConfig'
import { deployZerolendPoolProxy } from '../scripts/Zerolend/deployProxy'
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";

import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";
import { ZerolendPoolProxy, TacSAFactory, TacSmartAccount, MockZerolendPool } from '../typechain-types';

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types"
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { token } from "../typechain-types/@openzeppelin/contracts";

describe("ZerolandPoolProxy", function () {
    const poolPresetParams = {
        implementation_id: 0,
        A: 20000000n,
        gamma: 1000000000000000n,
        mid_fee: 5000000n,
        out_fee: 45000000n,
        fee_gamma: 5000000000000000n,
        allowed_extra_profit: 10000000000n,
        adjustment_step: 5500000000000n,
        ma_exp_time: 866n,
        initial_price: 10n ** 18n
    };
    let sttonEVM: ERC20;
    let tacEVM: ERC20;
    let pool: Contract
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let zerolendPoolProxy: ZerolendPoolProxy;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let mockPool: MockZerolendPool;

    const tokenValue = 100000n

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        zerolendPoolProxy = await deployZerolendPoolProxy(admin, zerolendPoolConfig.appAddress,await tacSAFactory.getAddress(), crossChainLayerAddress);
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        sttonEVM = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tacEVM = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;    
    
        const mockPoolFactory = await ethers.getContractFactory("MockZerolendPool", admin);
        mockPool = await mockPoolFactory.deploy(sttonEVMAddress, tokenValue);


    });

    it("Zerolend supply", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("supply");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await zerolendPoolProxy.getAddress();
        const methodName = "supply(bytes,bytes)";

        const amount = 100n

        const onBehalf = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await zerolendPoolProxy.getAddress());

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,address,uint256)'],
            [[
                await tacEVM.getAddress(),
                amount,
                onBehalf,
                0
            ]]
        );
        
        const mintTokens: TokenMintInfo[] = [
        {
            info: tacTokenInfo,
            amount: ethers.parseUnits("100", tacTokenInfo.decimals)
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
    });



});
