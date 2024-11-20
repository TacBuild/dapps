import hre, { ethers } from 'hardhat';
import { deploy } from 'tac-l2-ccl';

import factoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { BaseContract, ContractFactory } from 'ethers';
import { Artifact } from 'hardhat/types';
import { UniswapV2Proxy } from '../../typechain-types';


async function main() {

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const settingsAddress = process.env.EVM_SETTINGS_ADDRESS;
    const wethAddress = process.env.EVM_WTAC_ADDRESS!;

    // Factory
    const uniswapV2Factory_factory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer);
    const uniswapV2Factory = (await uniswapV2Factory_factory.deploy(await deployer.getAddress())) as BaseContract;

    // Router
    const uniswapV2Router02_factory = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, deployer);
    const uniswapV2Router02 = (await uniswapV2Router02_factory.deploy(await uniswapV2Factory.getAddress(), wethAddress)) as BaseContract;

    // Proxy
    const uniswapV2Proxy = await deploy<UniswapV2Proxy>(deployer, 'UniswapV2Proxy', [await uniswapV2Router02.getAddress(), settingsAddress], undefined, false);
}


main();
