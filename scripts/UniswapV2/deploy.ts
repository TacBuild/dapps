import hre, { ethers } from 'hardhat';
import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import factoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { BaseContract, ContractFactory } from 'ethers';
import { Artifact } from 'hardhat/types';
import { UniswapV2Proxy } from '../../typechain-types/';
import { sign } from 'crypto';


async function main() {

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    // Factory
    const uniswapV2Factory_factory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer);
    const uniswapV2Factory = (await uniswapV2Factory_factory.deploy(await deployer.getAddress())) as BaseContract;
    saveContractAddress(addressesFilePath, 'uniswapV2Factory', await uniswapV2Factory.getAddress());

    // Router
    const uniswapV2Router02_factory = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, deployer);
    const uniswapV2Router02 = (await uniswapV2Router02_factory.deploy(await uniswapV2Factory.getAddress(), await tacContracts.wTAC.getAddress())) as BaseContract;
    saveContractAddress(addressesFilePath, 'uniswapV2Router02', await uniswapV2Router02.getAddress());
    // Proxy
    const uniswapV2Proxy = await deploy<UniswapV2Proxy>(deployer, hre.artifacts.readArtifactSync('UniswapV2Proxy'), [await uniswapV2Router02.getAddress(), await tacContracts.settings.getAddress()], undefined, true);
    saveContractAddress(addressesFilePath, 'uniswapV2Proxy', await uniswapV2Proxy.getAddress());
}


main();
