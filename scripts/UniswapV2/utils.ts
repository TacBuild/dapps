import hre, { ethers } from "hardhat";
import path from 'path';
import { getCCLArtifacts, loadTacContracts } from "tac-l2-ccl";
import { CrossChainLayerToken } from "tac-l2-ccl/dist/typechain-types";
import { loadContractFromFile } from "../utils";
import { Contract, Signer } from "ethers";
import { UniswapV2Proxy, IUniswapV2Router02, IUniswapV2Factory } from "../../typechain-types";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";

import uniswapRouterArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import uniswapFactoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import erc20Artifact from "@uniswap/v2-core/build/ERC20.json";

async function ensurePairs(signer: Signer, uniswapV2Factory: IUniswapV2Factory, token1: ERC20, token2: ERC20) {
    console.log(`Ensuring pairs ${await token1.symbol()} - ${await token2.symbol()}`);
    const tokenPairs = [
        [await token1.getAddress(), await token2.getAddress()],
    ];
    for (const tokenPair of tokenPairs) {
        const pairAddress = await uniswapV2Factory.getPair(tokenPair[0], tokenPair[1])

        if (pairAddress == ethers.ZeroAddress) {
            console.log("Creating pair: ", tokenPair);
            const tx = await uniswapV2Factory.connect(signer).createPair(tokenPair[0], tokenPair[1]);
            await tx.wait();
        }
        else {
            console.log("Pair already exists, pair address:", pairAddress);
        }
    }
}

export async function loadUniswapTestEnv(signer: Signer) {
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const cclArtifacts = await getCCLArtifacts();
    const tacToken = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'TAC', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const sttonToken = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'stTON', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);

    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    const uniswapV2Proxy = loadContractFromFile<UniswapV2Proxy>(addressesFilePath, 'uniswapV2Proxy', hre.artifacts.readArtifactSync('UniswapV2Proxy').abi, signer);
    const uniswapV2Router02 = loadContractFromFile<IUniswapV2Router02>(addressesFilePath, 'uniswapV2Router02', uniswapRouterArtifact.abi, signer);
    const uniswapV2Factory = loadContractFromFile<IUniswapV2Factory>(addressesFilePath, 'uniswapV2Factory', uniswapFactoryArtifact.abi, signer);

    await ensurePairs(signer, uniswapV2Factory, sttonToken, tacToken);

    const pairAddress = await uniswapV2Factory.getPair(await sttonToken.getAddress(), await tacToken.getAddress());

    const lpToken = new Contract(pairAddress, erc20Artifact.abi, signer) as unknown as ERC20;

    return { tacToken, sttonToken, tacContracts, uniswapV2Proxy, uniswapV2Router02, uniswapV2Factory, lpToken }
}