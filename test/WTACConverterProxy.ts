import hre, { ethers } from 'hardhat';
import { Signer } from 'ethers';

import { JettonInfo, TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from '@tonappchain/evm-ccl';
import { expect } from "chai";

import { IWTAC } from '@tonappchain/evm-ccl/dist/typechain-types';
import { WTACConverterProxy } from '../typechain-types';
import { deployWTACConverterProxy } from '../scripts/WTACConverterProxy/deployWTACConverterProxy';

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

describe('WTACConverterProxy', () => {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let wTAC: IWTAC;

    let wTACConverterProxy: WTACConverterProxy;

    before(async () => {
        // setup
        [admin] = await ethers.getSigners();

        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log(`CrossChainLayer deployed at: ${crossChainLayerAddress}`);
        wTAC = await ethers.getContractAt('IWTAC', testSdk.getWTACAddress());
        console.log(`WTAC deployed at: ${await wTAC.getAddress()}`);

        wTACConverterProxy = await deployWTACConverterProxy(admin,
            {
                adminAddress: await admin.getAddress(),
                crossChainLayerAddress: crossChainLayerAddress,
                wTACAddress: await wTAC.getAddress()
            }
        );
    });


    it('should convert WTAC to TAC', async () => {

        const wtacAmount = ethers.parseEther('1000');

        // lock wtac on ccl

        // convert tac to wtac
        let tx = await wTAC.connect(admin).deposit({value: wtacAmount});
        await tx.wait();

        // lock
        tx = await wTAC.connect(admin).transfer(testSdk.getCrossChainLayerAddress(), wtacAmount);
        await tx.wait();
        console.log(`Locked ${wtacAmount} WTAC on CrossChainLayer`);

        // send cross-chain message
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("test");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));

        const tvmWalletCaller = "USER_TVM_ADDRESS";

        const target = await wTACConverterProxy.getAddress();
        const methodName = "convertWrappedToNativeTac(bytes,bytes)";

        const unlockInfo: TokenUnlockInfo = {
            evmAddress: await wTAC.getAddress(),
            amount: wtacAmount,
        };

        const encodedArguments = abiCoder.encode(["uint256"], [wtacAmount]);
        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [unlockInfo], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(outMessages.length).to.equal(1, "Expected one out message to be sent");

        const outMessage = outMessages[0];

        expect(outMessage.tokensLocked.length).to.equal(1, "Expected one token to be locked in the out message");
        const lockedToken = outMessage.tokensLocked[0];
        expect(lockedToken.evmAddress).to.equal(testSdk.getNativeTokenAddress(), "Expected locked token to be native TAC");
        expect(lockedToken.amount).to.equal(wtacAmount, "Expected locked token amount to match WTAC amount");
    });
});