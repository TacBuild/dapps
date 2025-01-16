import hre, { ethers } from "hardhat";
import { printBalances, printEvents } from "../utils";
import { loadUniswapTestEnv } from "./utils";
import { sendSimpleMessage } from "tac-l2-ccl";
import { InMessageStruct } from "tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();


async function main(showEvents=false) {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { tacToken, sttonToken, tacContracts, groups, uniswapV2Proxy, uniswapV2Router02, uniswapV2Factory, lpToken } = await loadUniswapTestEnv(signer);

    const entitiesToPrintBalances = [
        {name: "CrossChainLayer", address: await tacContracts.crossChainLayer.getAddress()},
        {name: 'UniswapV2Proxy', address: await uniswapV2Proxy.getAddress()},
        {name: 'UniswapV2Router02', address: await uniswapV2Router02.getAddress()},
        {name: 'TAC-stTON pair', address: await lpToken.getAddress()},
    ];
    const tokensToPrintBalances: {contract: ERC20, name?: string}[] = [{contract: tacToken}, {contract: sttonToken}, {contract: lpToken, name: 'TAC-stTON LP'}];

    await printBalances('\nBalances before operation', tokensToPrintBalances, entitiesToPrintBalances);

    const amountIn = 10n * 10n**9n;
    const amountOutMin = 1n * 10n**9n;
    const path = [await sttonToken.getAddress(), await tacToken.getAddress()];
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageStruct = {
        queryId: 42,
        operationId: "test swapExactTokensForTokens",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: to,
        methodName: 'swapExactTokensForTokens(bytes,bytes)',
        arguments:  abiCoder.encode(
            ["tuple(uint256,uint256,address[],address,uint256)"],
            [
                [   amountIn,
                    amountOutMin,
                    path,
                    to,
                    deadline
                ]
            ]
        ),
        caller: 'EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp',
        mint: [
            {l2Address: await sttonToken.getAddress(), amount: amountIn},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], "0x", true);

    await printBalances('\nBalances after operation', tokensToPrintBalances, entitiesToPrintBalances);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
    console.log("\n------------------SCRIPT FINISHED------------------")
}


main(true);
