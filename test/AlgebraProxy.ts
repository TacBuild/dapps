import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Contract, Signer } from "ethers";
import { expect } from "chai";


import { algebraTestnetConfig } from "../scripts/Algebra/config/testnetConfig";
import { deployAlgebraRouterProxy, deployAlgebraNonfungiblePositionManager } from "../scripts/Algebra/deployProxy";
import factoryABI from "../scripts/Algebra/abis/factoryABI.json";
import nonfungiblePositionManagerABI from "../scripts/Algebra/abis/nonfungiblePositionManagerABI.json";
import poolABI from "../scripts/Algebra/abis/poolABI.json";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { AlgebraNonfungiblePositionManagerProxy, AlgebraRouterProxy } from "../typechain-types";
import { erc20 } from "../typechain-types/factories/@openzeppelin/contracts/token";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { token } from "../typechain-types/@openzeppelin/contracts";

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


describe("AlgebraRouterProxy", function () {
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
    let algebraRouterProxy: AlgebraRouterProxy;
    let algebraNonfungiblePositionManagerProxy: AlgebraNonfungiblePositionManagerProxy;
    let poolAddress: string;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        algebraRouterProxy = await deployAlgebraRouterProxy(admin, algebraTestnetConfig, crossChainLayerAddress);
        algebraNonfungiblePositionManagerProxy = await deployAlgebraNonfungiblePositionManager(admin, algebraTestnetConfig, crossChainLayerAddress);
    });

    it("deploy tokens", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add ERC20 DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const target = await admin.getAddress();
        const amountA = 100n*10n**(sttonTokenInfo.decimals);
        const amountB = 100n*10n**(tacTokenInfo.decimals);

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            mintAmount: amountA,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            mintAmount: amountB,
        }

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            "", // method name
            "0x", // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        expect(sttonEVMAddress).to.be.equal(deployedTokens[0].evmAddress);
        expect(tacEVMAddress).to.be.equal(deployedTokens[1].evmAddress);
        sttonEVM = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tacEVM = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        expect(await sttonEVM.balanceOf(await admin.getAddress())).to.be.equal(amountA);
        expect(await tacEVM.balanceOf(await admin.getAddress())).to.be.equal(amountB);

    });

    it("Algebra pool deploy pool", async function () {

        const positionManager = new ethers.Contract(algebraTestnetConfig.algebraNonfungiblePositionManager, nonfungiblePositionManagerABI, admin);

        const factoryContract = new ethers.Contract(algebraTestnetConfig.algebraFactory, factoryABI, admin);


        let token0: string;
        let token1: string;

        if ((await sttonEVM.getAddress()) < (await tacEVM.getAddress())) {
            token0 = await sttonEVM.getAddress()
            token1 = await tacEVM.getAddress()
        } else {
            token0 = await tacEVM.getAddress()
            token1 = await sttonEVM.getAddress()
        }

        const tx = await positionManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            ethers.ZeroAddress, 2n ** 96n, '0x',
            {
                gasLimit: 10000000
            }
        );
        const receipt = await tx.wait();
        poolAddress = await factoryContract.poolByPair(await sttonEVM.getAddress(), await tacEVM.getAddress());

        expect(poolAddress).not.to.be.equal(ethers.ZeroAddress);
        expect(await sttonEVM.balanceOf(poolAddress)).to.be.equal(0);
        expect(await tacEVM.balanceOf(poolAddress)).to.be.equal(0);


    });

    it("Algebra mint pool", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("mint");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await algebraNonfungiblePositionManagerProxy.getAddress();
        const methodName = "mint(bytes,bytes)";

        const amountA = 1000n*10n**(await sttonEVM.decimals());
        const amountB = 1000n*10n**(await tacEVM.decimals());


        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            mintAmount: amountA,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            mintAmount: amountB,
        }


        let token0: string;
        let token1: string;
        let amount0: bigint;
        let amount1: bigint;

        if ((await sttonEVM.getAddress()) < (await tacEVM.getAddress())) {
            token0 = await sttonEVM.getAddress()
            amount0 = amountA
            token1 = await tacEVM.getAddress()
            amount1 = amountB
        } else {
            token0 = await tacEVM.getAddress()
            amount0 = amountB
            token1 = await sttonEVM.getAddress()
            amount1 = amountA
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,address,address,int24,int24,uint256,uint256,uint256,uint256,address,uint256)'],
            [
                [
                    token0,
                    token1,
                    ethers.ZeroAddress,
                    -887220,
                    887220,
                    amount0,
                    amount1,
                    0n,
                    0n,
                    target,
                    ethers.MaxUint256
                ]
            ],
        );


        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        const factoryContract = new ethers.Contract(algebraTestnetConfig.algebraFactory, factoryABI, admin);
        poolAddress = await factoryContract.poolByPair(await sttonEVM.getAddress(), await tacEVM.getAddress());
        console.log("poolAddress")
        console.log(poolAddress)
        console.log("sttonEVM")
        console.log(await sttonEVM.getAddress())
        console.log("tacEVM")
        console.log(await tacEVM.getAddress())

        pool = new ethers.Contract(poolAddress, poolABI, admin);
        console.log(await pool.getReserves())
        // expect(await sttonEVM.balanceOf(poolAddress)).to.be.equal(0);
        // expect(await tacEVM.balanceOf(poolAddress)).to.be.equal(0);
        console.log(await sttonEVM.balanceOf(poolAddress))
        console.log(await tacEVM.balanceOf(poolAddress))
        console.log(amountA)
        console.log(amountB)
    });

    it("Algebra swap sttonEVM->tacEVM", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exactInputSingle");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await algebraRouterProxy.getAddress();
        const methodName = "exactInputSingle(bytes,bytes)";

        const amount = 1n*10n**(await sttonEVM.decimals());

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            mintAmount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,address,address,address,uint256,uint256,uint256,uint160)'],
            [
                [
                    await sttonEVM.getAddress(),
                    await tacEVM.getAddress(),
                    ethers.ZeroAddress,
                    target,
                    ethers.MaxUint256,
                    amount,
                    0,
                    0
                ]
            ],
        );

        const balanceBeforeA = await sttonEVM.balanceOf(testSdk.getCrossChainLayerAddress());
        const balanceBeforeB = await tacEVM.balanceOf(testSdk.getCrossChainLayerAddress());

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );
        console.log("sent")

        const factoryContract = new ethers.Contract(algebraTestnetConfig.algebraFactory, factoryABI, admin);
        poolAddress = await factoryContract.poolByPair(await sttonEVM.getAddress(), await tacEVM.getAddress());
        console.log("poolAddress")
        console.log(poolAddress)

        // expect(await sttonEVM.balanceOf(poolAddress)).to.be.equal(0);
        // expect(await tacEVM.balanceOf(poolAddress)).to.be.equal(0);
        console.log(balanceBeforeA)
        console.log(balanceBeforeB)
        console.log(await sttonEVM.balanceOf(testSdk.getCrossChainLayerAddress()))
        console.log(await tacEVM.balanceOf(testSdk.getCrossChainLayerAddress()))
        console.log(await sttonEVM.balanceOf(await admin.getAddress()))
        console.log(await tacEVM.balanceOf(await admin.getAddress()))
        console.log(await sttonEVM.balanceOf(poolAddress))
        console.log(await tacEVM.balanceOf(poolAddress))
        console.log(amount)
    });

    
});
