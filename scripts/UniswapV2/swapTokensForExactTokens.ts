import { ethers } from "hardhat";
import { loadUniswapTestEnv } from "./utils";
import { printBalances, printEvents } from "../utils";
import { sendSimpleMessage } from "tac-l2-ccl";
import { InMessageStruct } from "tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";


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

    const amountInMax = 10n * 10n**9n;
    const amountOut = 13n * 10n**9n;
    const path = [await sttonToken.getAddress(), await tacToken.getAddress()];
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;
    const message: InMessageStruct = {
        queryId: 46,
        operationId: "test swapTokensForExactTokens",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await uniswapV2Proxy.getAddress(),
        methodName: 'swapTokensForExactTokens(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
            [
                amountOut,
                amountInMax,
                path,
                to,
                deadline,
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: await sttonToken.getAddress(), amount: amountInMax},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], true);

    await printBalances('\nBalances after operation', tokensToPrintBalances, entitiesToPrintBalances);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
    console.log("\n------------------SCRIPT FINISHED------------------")
};


main();
