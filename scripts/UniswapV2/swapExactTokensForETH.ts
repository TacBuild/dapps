import hre, { ethers } from "hardhat";
import { printBalances, printEvents } from "../utils";
import { loadUniswapTestEnv } from "./utils";
import { sendSimpleMessageV1, simulateReceiveMessageV1, decodeCrossChainLayerErrorData } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from '@tonappchain/evm-ccl/dist/typechain-types/contracts/core/Structs.sol/IStructsInterface';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";

async function main(showEvents=false) {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { sttonToken, tacContracts, uniswapV2Proxy, wtacToken } = await loadUniswapTestEnv(sequencerSigner);

    const amountIn = 500n * 10n**9n;
    const amountOutMin = 100n * 10n**9n;
    const path = [await sttonToken.getAddress(), await wtacToken.getAddress()];
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageV1Struct = {
        shardsKey: 42,
        gasLimit: 0n,
        operationId: ethers.encodeBytes32String("test swapExactTokensForETH"),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: to,
        methodName: 'swapExactTokensForETH(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['tuple(uint256, uint256, address[], address, uint256)'],
            [
                [
                    amountIn,
                    amountOutMin,
                    path,
                    to,
                    deadline,
                ]
            ]
        ),
        caller: 'EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp',
        mint: [
            {evmAddress: await sttonToken.getAddress(), amount: amountIn},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const simulationResult = await simulateReceiveMessageV1(tacContracts, message, "0x", 10);

    if (!simulationResult.simulationStatus) {
        const decodedError = decodeCrossChainLayerErrorData(simulationResult.errorReason);
        throw new Error(`Error while sending message: ${decodedError}`);
    }

    // set esimtated gas limit
    message.gasLimit = simulationResult.gasLimit * 120n / 100n;

    const receipt = await sendSimpleMessageV1([sequencerSigner], message, tacContracts, "0x", true);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main(true);
