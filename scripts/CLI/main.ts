import { select, Separator, input, checkbox } from '@inquirer/prompts';
import { deployMorphoProxy } from '../Morpho/MorphoProxyDeploy';
import { deployTacSmartAccount } from "../TacSmartAccountFactory/SABlueprintDeploy"
import { deployTacSAFactory } from "../TacSmartAccountFactory/FactoryDeploy"
import { deployIzumiProxy } from "../Izumi/deployIzumiProxy"
import { TESTNET_URL, MAINNET_URL, DEPLOYER_PRIVATE_KEY, CROSS_CHAIN_LAYER_ADDRESS_TESTNET, CROSS_CHAIN_LAYER_ADDRESS_MAINNET } from './config';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { deployAgnosticProxy } from '../Agnostic/AgnosticProxyDeploy';
import { deployUniswapV2 } from '../UniswapV2/deployUniswapV2';

const availableDeployments = [
    "MorphoProxy",
    "TacSmartAccountBlueprint",
    "TacSmartAccountFactory",
    "IzumiProxy",
    "AgnosticProxy",
    "UniswapV2Proxy"
]

export async function main() {
    try {
        const answer = await select({
            message: 'Select action',
            choices: [
              {
                name: 'Deploy Contract',
                value: 'deployContract',
              },
              {
                name: 'Quit',
                value: 'quit'
              },
            ],
          });
          switch (answer) {
            case 'deployContract':
                await deployContract();
                break;
            case 'quit':
                break;
            default:
                break;
          }
    } catch (error) {
        console.log(error);
    }
}

async function deployContract() {
    let RPC_URL = "";
    let CROSS_CHAIN_LAYER_ADDRESS = "";
    const network = await select({
        message: 'Select network',
        choices: ['testnet', 'mainnet' , 'localhost_mainnet', 'localhost_testnet']
    });

    switch (network) {
        case 'localhost_mainnet':
            RPC_URL = "http://localhost:8545";
            CROSS_CHAIN_LAYER_ADDRESS = CROSS_CHAIN_LAYER_ADDRESS_MAINNET;
            break;
        case 'localhost_testnet':
            RPC_URL = "http://localhost:8545";
            CROSS_CHAIN_LAYER_ADDRESS = CROSS_CHAIN_LAYER_ADDRESS_TESTNET;
            break;
        case 'testnet':
            RPC_URL = TESTNET_URL || "";
            CROSS_CHAIN_LAYER_ADDRESS = CROSS_CHAIN_LAYER_ADDRESS_TESTNET;
            break;
        case 'mainnet':
            RPC_URL = MAINNET_URL || "";
            CROSS_CHAIN_LAYER_ADDRESS = CROSS_CHAIN_LAYER_ADDRESS_MAINNET;
            break;
    }
    

    const answer = await select({
        message: 'Select contract',
        choices: availableDeployments.map(contract => ({
            name: contract,
            value: contract
        }))
    });

    const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY || "", hre.ethers.provider!);

    switch (answer) {
        case 'MorphoProxy':
            const tacSaFactoryAddress = await input({
                message: 'Enter the tac smart account factory address'
            });
            await deployMorphoProxy(deployer, CROSS_CHAIN_LAYER_ADDRESS, tacSaFactoryAddress);
            break;
        case 'TacSmartAccountBlueprint':
            await deployTacSmartAccount(deployer);
            break;
        case 'TacSmartAccountFactory':
            const initBlueprint = await input({
                message: 'Enter the init blueprint address'
            });
            try {
                await deployTacSAFactory(deployer, initBlueprint);
            } catch (error) {
                console.log(error);
            }
            break;
        case 'IzumiProxy':
            await deployIzumiProxy(deployer, CROSS_CHAIN_LAYER_ADDRESS);
            break;
        case 'AgnosticProxy':
            await deployAgnosticProxy(deployer, CROSS_CHAIN_LAYER_ADDRESS);
            break;
        case 'UniswapV2Proxy':
            const wTacAddress = await input({
                message: 'Enter the wTac address'
            });
            await deployUniswapV2(deployer, wTacAddress, CROSS_CHAIN_LAYER_ADDRESS);
            break;
    }
}
main();
