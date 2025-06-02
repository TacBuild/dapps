import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Contract, Signer } from "ethers";
import { expect } from "chai";

import { ZerolendPoolConfig } from '../scripts/Zerolend/config/ZerolendConfig'
import { deployZerolendPoolProxy } from '../scripts/Zerolend/deployProxy'
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";

import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";
import { ZerolendPoolProxy, TacSAFactory, TacSmartAccount } from '../typechain-types';

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



    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        zerolendPoolProxy = await deployZerolendPoolProxy(admin,tacSAFactory, crossChainLayerAddress);
        });

    
    
 
});
