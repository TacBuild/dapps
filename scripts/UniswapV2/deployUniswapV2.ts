import hre from "hardhat";
import { deploy } from "@tonappchain/evm-ccl";
import factoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { ContractFactory, Signer } from 'ethers';
import { UniswapV2Proxy } from '../../typechain-types';
import { IUniswapV2Router02, IUniswapV2Factory } from '../../typechain-types';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS } from "../utils"

type UniswapContracts = {
    uniswapV2Factory: IUniswapV2Factory,
    uniswapV2Router02: IUniswapV2Router02,
    uniswapV2Proxy: UniswapV2Proxy,
}

export async function deployUniswapV2(deployer: Signer, wTACAddress: string, crossChainLayerAddress: string): Promise<UniswapContracts> {
    // Factory
    const uniswapV2Factory_factory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer);
    const uniswapV2Factory = (await uniswapV2Factory_factory.deploy(await deployer.getAddress())) as IUniswapV2Factory;
    console.log(`UniswapV2Factory deployed at: ${await uniswapV2Factory.getAddress()}`);
    // Router
    const uniswapV2Router02_factory = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, deployer);
    const uniswapV2Router02 = (await uniswapV2Router02_factory.deploy(await uniswapV2Factory.getAddress(), wTACAddress)) as IUniswapV2Router02;
    console.log(`UniswapV2Router02 deployed at: ${await uniswapV2Router02.getAddress()}`);
    // Proxy
    const uniswapV2Proxy = await deployUpgradable<UniswapV2Proxy>(deployer,
        hre.artifacts.readArtifactSync('UniswapV2Proxy'),
        [await deployer.getAddress(), await uniswapV2Router02.getAddress(), crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);

    return { uniswapV2Factory, uniswapV2Router02, uniswapV2Proxy };
}