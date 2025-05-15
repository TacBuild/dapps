import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Contract, Signer } from "ethers";
import { expect } from "chai";

import { deployCurveLiteTwocryptoswapProxy } from "../scripts/CurveLite/twocryptoswap/deployProxy";
import { deployCurveLiteRouterProxy } from "../scripts/CurveLite/deployRouterProxy";
import { deployPoolTwocryptoswap } from "../scripts/CurveLite/twocryptoswap/deployPoolTwocryptoswap";
import { CurveLiteTwocryptoswapTestnetConfig } from "../scripts/CurveLite/twocryptoswap/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { CurveLiteTwocryptoswapProxy, CurveLiteRouterProxy, ICurveLiteTwocryptoFactory } from "../typechain-types";
import { curveLiteTwocryptoProxySol } from "../typechain-types/factories/contracts/proxies/CurveLite";
import factoryAbi from "../scripts/CurveLite/twocryptoswap/factoryAbi.json"
import implementationAbi from "../scripts/CurveLite/twocryptoswap/implementationAbi.json"
import { erc20 } from "../typechain-types/factories/@openzeppelin/contracts/token";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { token } from "../typechain-types/@openzeppelin/contracts";
import addresses from "../addresses.json"

describe("CurveLiteTwocryptoswapProxy", function () {
    const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"
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
    let curveLiteTwocryptoswapProxy: CurveLiteTwocryptoswapProxy;
    let curveLiteRouterProxy: CurveLiteRouterProxy;
    let factoryContract: ICurveLiteTwocryptoFactory;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        
        curveLiteTwocryptoswapProxy = await deployCurveLiteTwocryptoswapProxy(admin, crossChainLayerAddress);
        curveLiteRouterProxy = await deployCurveLiteRouterProxy(admin, CurveLiteTwocryptoswapTestnetConfig.CurveLiteRouter, crossChainLayerAddress);
        factoryContract = new ethers.Contract(CurveLiteTwocryptoswapTestnetConfig.CurveLiteTwocryptoswapFactory, factoryAbi, admin) as unknown as ICurveLiteTwocryptoFactory;
    });

    it("deploy tokens", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add ERC20 DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const target = await admin.getAddress();
        
        const mintAmount = 2n

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: mintAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: mintAmount,
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
        expect(await sttonEVM.balanceOf(await admin.getAddress())).to.be.equal(mintAmount);
        expect(await tacEVM.balanceOf(await admin.getAddress())).to.be.equal(mintAmount);

    });


    it("CurveLiteTwocryptoswap pool deploy pool", async function () {
        const poolCountBefore = await factoryContract.pool_count()
        const tx = await factoryContract.deploy_pool(
            "stTON-TAC",
            "stTON-TAC",
            [await sttonEVM.getAddress(), await tacEVM.getAddress()],
            poolPresetParams.implementation_id,
            poolPresetParams.A,
            poolPresetParams.gamma,
            poolPresetParams.mid_fee,
            poolPresetParams.out_fee,
            poolPresetParams.fee_gamma,
            poolPresetParams.allowed_extra_profit,
            poolPresetParams.adjustment_step,
            poolPresetParams.ma_exp_time,
            poolPresetParams.initial_price,
            {
                gasLimit: 10000000
            }
        );
        const receipt = await tx.wait();
        expect(poolCountBefore).to.be.equal(await factoryContract.pool_count() - 1n);
    });

    it("CurveLiteTwocryptoswap pool check pool", async function () {
        const PoolAddress = await factoryContract.find_pool_for_coins(await sttonEVM.getAddress(), await tacEVM.getAddress(), 0)
        pool = new ethers.Contract(PoolAddress, implementationAbi, admin) as unknown as Contract;
        expect(await pool.coins(0)).to.be.equal(await sttonEVM.getAddress());
        expect(await pool.coins(1)).to.be.equal(await tacEVM.getAddress());
        expect(await pool.balances(0)).to.be.equal(await sttonEVM.balanceOf(await pool.getAddress()));
        expect(await pool.balances(1)).to.be.equal(await tacEVM.balanceOf(await pool.getAddress()));
    });

    it ("CurveLiteTwocryptoswap test add liquidity pool", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = 10n*10n**(await sttonEVM.decimals());
        const amountB = 10n*10n**(await tacEVM.decimals());


        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amountA,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: amountB,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256[2], uint256)'],
            [
                [
                    await pool.getAddress(),
                    [amountA, amountB],
                    0
                ]
            ],
        );

        const balanceBeforeA = await pool.balances(0);
        const balanceBeforeB = await pool.balances(1);
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

        expect(balanceBeforeA+amountA).to.be.equal(await pool.balances(0));
        expect(balanceBeforeB+amountB).to.be.equal(await pool.balances(1));

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        const liquidity = await pool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await pool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });

    it ("CurveLiteTwocryptoswap test exchange router", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteRouterProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = 1n*10n**(await sttonEVM.decimals());

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address[11], uint256[4][5], uint256, uint256)'],
            [
                [
                    [await sttonEVM.getAddress(), await pool.getAddress(), await tacEVM.getAddress(),
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS,NULL_ADDRESS
                    ],
                    [[0, 1, 1, 20],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
                    amount,
                    0
                ]
            ],
        );

        const balanceBeforeA = await pool.balances(0);
        const balanceBeforeB = await pool.balances(1);
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

        expect(balanceBeforeA + amount).to.be.equal(await pool.balances(0));
        expect(balanceBeforeB).to.be.gt(await pool.balances(1));

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteRouterProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(0);
    });

});
