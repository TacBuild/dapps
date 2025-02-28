import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployUniswapV2 } from './deployUniswapV2';
import path from 'path';


async function main() {

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const { uniswapV2Factory, uniswapV2Router02, uniswapV2Proxy } = await deployUniswapV2(deployer, await tacContracts.wTAC.getAddress(), await  tacContracts.crossChainLayer.getAddress());

    saveContractAddress(addressesFilePath, 'uniswapV2Factory', await uniswapV2Factory.getAddress());
    saveContractAddress(addressesFilePath, 'uniswapV2Router02', await uniswapV2Router02.getAddress());
    saveContractAddress(addressesFilePath, 'uniswapV2Proxy', await uniswapV2Proxy.getAddress());
}

main();
