import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployIzumiProxy } from "../scripts/Izumi/deployIzumiProxy";
import { izumiTestnetConfig } from "../scripts/Izumi/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo, NFTUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { IzumiPoolAbi } from "./abis/IzumiPool";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { IzumiProxy, IPool, ISwap, ILimitOrderManager, ILiquidityManager, EulerProxy } from "../typechain-types";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");


describe("EulerProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;

    let eulerProxy: EulerProxy;
    let izumiProxy: IzumiProxy;
    let pool: IPool;
    let swap: ISwap;
    let limitOrderManager: ILimitOrderManager;
    let liquidityManager: ILiquidityManager;
    let izumiMintId: string;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        izumiProxy = await deployIzumiProxy(admin, izumiTestnetConfig, crossChainLayerAddress);
        
        pool = new ethers.Contract(izumiTestnetConfig.poolAddress, hre.artifacts.readArtifactSync('IPool').abi, admin) as unknown as IPool;
        swap = new ethers.Contract(izumiTestnetConfig.swapAddress, hre.artifacts.readArtifactSync('ISwap').abi, admin) as unknown as ISwap;
        limitOrderManager = new ethers.Contract(izumiTestnetConfig.limitOrderAddress, hre.artifacts.readArtifactSync('ILimitOrderManager').abi, admin) as unknown as ILimitOrderManager;
        liquidityManager = new ethers.Contract(izumiTestnetConfig.liquidityManagerAddress, hre.artifacts.readArtifactSync('ILiquidityManager').abi, admin) as unknown as ILiquidityManager;
    });

    it("Izumi test create new pool", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("create new pool");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "newPool(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const fee = 3000;
        const currentPoint = 0;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24)'],
            [[
                sttonEVMAddress,
                tacEVMAddress,
                fee,
                currentPoint
            ]]
        );

        const initialPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(initialPoolAddress).to.equal(ethers.ZeroAddress);

        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        const newPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(newPoolAddress).to.not.equal(ethers.ZeroAddress);

        const pointDelta = await pool.fee2pointDelta(fee);
        expect(pointDelta).to.not.equal(0);
    });
});