import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BytesLike } from "ethers";

import { TacLocalTestSdk, TokenMintInfo } from "@tonappchain/evm-ccl";
import { deployMidasProxy } from "../scripts/Midas/deployMidasProxy";
//import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { IDepositVault, IMTbill, IManageableVault } from "../typechain-types";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { MidasProxy } from "../typechain-types";

describe("MidasProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let midasProxy: MidasProxy;
    let mToken: Contract;
    let tokenIn: Contract;

    const mintAmount = 10n*10n**9n;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);

        midasProxy = await deployMidasProxy(admin, crossChainLayerAddress);
    });

    it("should perform depositInstant and bridge mToken", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit instant");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const target = await midasProxy.getAddress();

        // const evmTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);

        // tokenIn = new ethers.Contract(evmTokenAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin);

        // const sttonTokenMintInfo: TokenMintInfo = {
        //     info: sttonTokenInfo,
        //     amount: mintAmount,
        // }
    
        const evmTokenAddress = "0x35e1BAF9Edb192536E68d0B5c1214a7DA21e0F32";

        tokenIn = new ethers.Contract(evmTokenAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin);


        const tokenMintInfo: TokenMintInfo = {
            info: {
                tvmAddress: "",
                name: "USDT",
                symbol: "USDT",
                decimals: 9n,
            },
            amount: mintAmount,
        }


        

        // depositInstant
        const encodedArgs = new ethers.AbiCoder().encode(
            ["address", "uint256", "uint256", "bytes32"],
            [await tokenIn.getAddress(), mintAmount, 0, ethers.ZeroHash]
        );

        const method = "depositInstant(bytes,bytes)";

        // Выполняем кроссчейн вызов
        const { outMessages } = await testSdk.sendMessage(
            shardsKey,
            target,
            method,
            encodedArgs,
            tvmWalletCaller,
            [tokenMintInfo],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Проверяем результат
        expect(outMessages.length).to.equal(1);
        const outMessage = outMessages[0];

        expect(outMessage.operationId).to.equal(operationId);
        expect(outMessage.shardsKey).to.equal(shardsKey);
        expect(outMessage.callerAddress).to.equal(target);
        expect(outMessage.targetAddress).to.equal(tvmWalletCaller);
        expect(outMessage.tokensLocked.length).to.equal(1);

        const mTokenAddress = outMessage.tokensLocked[0].evmAddress;
        const mTokenAmount = outMessage.tokensLocked[0].amount;

        expect(mTokenAddress).to.not.equal(ethers.ZeroAddress);
        expect(mTokenAmount).to.be.gt(0n);

        mToken = new ethers.Contract(mTokenAddress as string, hre.artifacts.readArtifactSync("ERC20").abi, admin);
        const balance = await mToken.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(balance).to.equal(mTokenAmount);
    });
});
