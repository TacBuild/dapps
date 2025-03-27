import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { deployAgnosticProxy } from "../scripts/Agnostic/AgnosticProxyDeploy";
import { izumiTestnetConfig } from "../scripts/Izumi/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo } from "tac-l2-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";
import { IPool, ISwap, ILimitOrderManager, ILiquidityManager, AgnosticProxy } from "../typechain-types";
import { AgnosticProxySDK } from "../scripts/Agnostic/AgnosticProxySDK";

describe("AgnosticProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let agnosticProxySDK: AgnosticProxySDK;

    let agnosticProxy: AgnosticProxy;
    let pool: IPool;
    let swap: ISwap;
    let limitOrderManager: ILimitOrderManager;
    let liquidityManager: ILiquidityManager;


    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        agnosticProxySDK = new AgnosticProxySDK();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        agnosticProxy = await deployAgnosticProxy(admin, crossChainLayerAddress);
        
        pool = new ethers.Contract(izumiTestnetConfig.poolAddress, hre.artifacts.readArtifactSync('IPool').abi, admin) as unknown as IPool;
        swap = new ethers.Contract(izumiTestnetConfig.swapAddress, hre.artifacts.readArtifactSync('ISwap').abi, admin) as unknown as ISwap;
        limitOrderManager = new ethers.Contract(izumiTestnetConfig.limitOrderAddress, hre.artifacts.readArtifactSync('ILimitOrderManager').abi, admin) as unknown as ILimitOrderManager;
        liquidityManager = new ethers.Contract(izumiTestnetConfig.liquidityManagerAddress, hre.artifacts.readArtifactSync('ILiquidityManager').abi, admin) as unknown as ILiquidityManager;

    });

    it("AgnosticProxy test create new pool, mint tokens, add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Zap new pool mint add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const amount = ethers.parseEther("1");
        const amountToMint = ethers.parseEther("2");
        const target = await agnosticProxy.getAddress();
        
        const methodName = "Zap(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const fee = 3000;
        const currentPoint = 0;

        const contractInterfaces = {
            [izumiTestnetConfig.poolAddress]: pool.interface,
            [izumiTestnetConfig.swapAddress]: swap.interface,
            [izumiTestnetConfig.limitOrderAddress]: limitOrderManager.interface,
            [izumiTestnetConfig.liquidityManagerAddress]: liquidityManager.interface,
            [sttonEVMAddress]: stTon.interface,
            [tacEVMAddress]: tac.interface
        };

        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;
        const amountX = tokenX === sttonEVMAddress ? ethers.parseUnits("1", sttonTokenInfo.decimals) : ethers.parseUnits("1", tacTokenInfo.decimals);
        const amountY = tokenY === sttonEVMAddress ? ethers.parseUnits("1", sttonTokenInfo.decimals) : ethers.parseUnits("1", tacTokenInfo.decimals);
        

        const calls = [
            {
                to: izumiTestnetConfig.poolAddress,
                functionName: "newPool",
                params: [sttonEVMAddress, tacEVMAddress, fee, currentPoint]
            },
            {
                to: sttonEVMAddress,
                functionName: "approve",
                params: [izumiTestnetConfig.liquidityManagerAddress, ethers.MaxUint256]
            },
            {
                to: tacEVMAddress,
                functionName: "approve",
                params: [izumiTestnetConfig.liquidityManagerAddress, ethers.MaxUint256]
            },
            {
                to: izumiTestnetConfig.liquidityManagerAddress,
                functionName: "mint",
                    params: [[
                                target, // miner
                                tokenX,
                                tokenY, // tokenX
                                fee, // fee
                                207240n, // pl (leftPoint)
                                214200n,  // pr (rightPoint)
                                amountX, // xLim
                                amountY, // yLim
                                0n, // amountXMin
                                0n, // amountYMin
                                ethers.MaxUint256 // deadline
                    ]]
            },
            {
                to: izumiTestnetConfig.liquidityManagerAddress,
                functionName: "addLiquidity",
                params: [[6, amount, amount, 0, 0, ethers.MaxUint256]]
            }
        ];

        const zapCallData = agnosticProxySDK.createZapTransaction(contractInterfaces, calls);

        const mintTokens: TokenMintInfo[] = [
                    {
                        info: sttonTokenInfo,
                        mintAmount: amountToMint
                    },
                    {
                        info: tacTokenInfo,
                        mintAmount: amountToMint
                    }
                ];

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            zapCallData,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify pool creation
        const newPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(newPoolAddress).to.not.equal(ethers.ZeroAddress);

        // Verify point delta for fee
        const pointDelta = await pool.fee2pointDelta(fee);
        expect(pointDelta).to.not.equal(0);
    });

});

export const pointDeltaRoundingUp = (point: number, pointDelta: number) : number => {
    let mod = point % pointDelta
    if (mod < 0) {
        mod += pointDelta
    }
    if (mod === 0) {
        return point
    } else {
        return point + pointDelta - mod
    }
}

export const pointDeltaRoundingDown = (point: number, pointDelta: number) : number => {
    let mod = point % pointDelta
    if (mod < 0) {
        mod += pointDelta
    }
    if (mod === 0) {
        return point
    } else {
        return point - mod
    }
}
