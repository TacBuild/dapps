import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Contract, Signer } from "ethers";
import { expect } from "chai";

import { deployCurveLiteTwocryptoswapProxy } from "../scripts/CurveLite/twocryptoswap/deployProxy";
import { deployPoolTwocryptoswap } from "../scripts/CurveLite/twocryptoswap/deployPoolTwocryptoswap";
import { CurveLiteTwocryptoswapTestnetConfig } from "../scripts/CurveLite/twocryptoswap/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo } from "@tonappchain/evm-ccl";

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { CurveLiteTwocryptoswapProxy, ICurveLiteTwocryptoFactory } from "../typechain-types";
import { curveLiteTwocryptoProxySol } from "../typechain-types/factories/contracts/proxies/CurveLite";
import factoryAbi from "../scripts/CurveLite/twocryptoswap/factoryAbi.json"
import implementationAbi from "../scripts/CurveLite/twocryptoswap/implementationAbi.json"
import { erc20 } from "../typechain-types/factories/@openzeppelin/contracts/token";


describe("CurveLiteTwocryptoswapProxy", function () {
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
    let usdtEVM: ERC20;
    let wethEVM: ERC20;
    let usdtTVMAddress: string;
    let wethTVMAddress: string;
    let pool: Contract
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let curveLiteTwocryptoswapProxy: CurveLiteTwocryptoswapProxy;
    let factoryContract: ICurveLiteTwocryptoFactory;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        const usdtEVMAddress = "0x40d02AAe9D294Ebefe818Bc9020a9883E055154e";
        usdtEVM = new ethers.Contract(usdtEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        usdtTVMAddress = "EQDHWeU8l1QZkcK3Db5fDys7rdzJYuFHzToFxZNAurRNLf17"
        const wethEVMAddress = "0x2183Bb115F6f90840B1d6FEd0857149546e4BF22";
        wethEVM = new ethers.Contract(wethEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        wethTVMAddress = "EQDHWeU8l1QZkcK3Db5fDys7rdzJYuFHzToFxZNAurRNLf17"
        curveLiteTwocryptoswapProxy = await deployCurveLiteTwocryptoswapProxy(admin, crossChainLayerAddress);
        factoryContract = new ethers.Contract(CurveLiteTwocryptoswapTestnetConfig.CurveLiteTwocryptoswapFactory, factoryAbi, admin) as unknown as ICurveLiteTwocryptoFactory;
    });

    it("CurveLiteTwocryptoswap pool deploy pool", async function () {
        const poolCountBefore = await factoryContract.pool_count()
        const tx = await factoryContract.deploy_pool(
            "USDT-wETH",
            "USDT-wETH",
            [await usdtEVM.getAddress(), await wethEVM.getAddress()],
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
        const PoolAddress = await factoryContract.find_pool_for_coins(await usdtEVM.getAddress(), await wethEVM.getAddress(), 0)
        pool = new ethers.Contract(PoolAddress, implementationAbi, admin) as unknown as Contract;
        expect(await pool.coins(0)).to.be.equal(await usdtEVM.getAddress());
        expect(await pool.coins(1)).to.be.equal(await wethEVM.getAddress());
        expect(await pool.balances(0)).to.be.equal(await usdtEVM.balanceOf(await pool.getAddress()));
        expect(await pool.balances(1)).to.be.equal(await wethEVM.balanceOf(await pool.getAddress()));
    });

    it ("CurveLiteTwocryptoswap test add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = 1n;
        const amountB = 1n;

        const usdtTokenMintInfo: TokenMintInfo = {
            info: {
                decimals: await usdtEVM.decimals(),
                name: await usdtEVM.name(),
                symbol: await usdtEVM.symbol(),
                tvmAddress: usdtTVMAddress,
            },
            mintAmount: amountA,
        }
        const wethTokenMintInfo: TokenMintInfo = {
            info: {
                decimals: await wethEVM.decimals(),
                name: await wethEVM.name(),
                symbol: await wethEVM.symbol(),
                tvmAddress: wethTVMAddress,
            },
            mintAmount: amountB,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256[2], uint256)'],
            [
                [await pool.getAddress(),
                [amountA, amountB],
                0]
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
            [usdtTokenMintInfo, wethTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        console.log(balanceBeforeA)
        console.log(balanceBeforeB)
        console.log(await pool.balances(0))
        console.log(await pool.balances(1))

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



});
