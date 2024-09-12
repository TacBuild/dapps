const {
    useContract,
    getContract,
    loadContractAddress,
    printContractBalance,
} = require('../utils.js');

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Router02");


async function printBalances(name, poolAddress) {
    const tokenTKAAddress = process.env.EVM_TKA_ADDRESS;
    const tokenTKBAddress = process.env.EVM_TKB_ADDRESS;
    const tokenLPABAddress = poolAddress;

    const tokenAddresses = {
        'TKA': tokenTKAAddress,
        'TKB': tokenTKBAddress,
        'LP-TKA-TKB': tokenLPABAddress,
    };

    console.log(`----------------- ${name}:`);

    const cclContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    await printContractBalance(
        'CrossChainLayer', await cclContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )

    const appProxyContract = await getContract('CurveLiteTwocryptoswapProxy', 'CurveLiteTwocryptoswapProxy', null, process.env.CURVE_LITE_TWOCRYPTOSWAP_PROXY_ADDRESS);
    await printContractBalance(
        'CurveLiteTwocryptoswapProxy', await appProxyContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )


    const pairContractAddress = tokenLPABAddress;
    await printContractBalance(
        'TKA-TKB Pair', pairContractAddress, tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )
}

async function printBalancesTKATKBTKC(name, poolAddress) {
    const tokenTKAAddress = process.env.EVM_TKA_ADDRESS;
    const tokenTKBAddress = process.env.EVM_TKB_ADDRESS;
    const tokenTKCAddress = process.env.EVM_TKC_ADDRESS;
    const tokenLPABAddress = poolAddress;

    const tokenAddresses = {
        'TKA': tokenTKAAddress,
        'TKB': tokenTKBAddress,
        'TKC': tokenTKCAddress,
        'LP-TKA-TKB-TKC': tokenLPABAddress,
    };

    console.log(`----------------- ${name}:`);

    const cclContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    await printContractBalance(
        'CrossChainLayer', await cclContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'TKC', 'LP-TKA-TKB-TKC']
    )

    const appProxyContract = await getContract('CurveLiteTwocryptoswapProxy', 'CurveLiteTwocryptoswapProxy', null, process.env.CURVE_LITE_TWOCRYPTOSWAP_PROXY_ADDRESS);
    await printContractBalance(
        'CurveLiteTwocryptoswapProxy', await appProxyContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'TKC', 'LP-TKA-TKB-TKC']
    )


    const pairContractAddress = tokenLPABAddress;
    await printContractBalance(
        'TKA-TKB-TKC Pool', pairContractAddress, tokenAddresses,
        ['TKA', 'TKB', 'TKC', 'LP-TKA-TKB-TKC']
    )
}

async function getPoolFinderContract(factoryAddress) {
    const poolFinderAbi = [{
        "stateMutability": "view",
        "type": "function",
        "name": "find_pool_for_coins",
        "inputs": [
            {
                "name": "_from",
                "type": "address"
            },
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "i",
                "type": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ]
    }
    ];

    return new ethers.Contract(factoryAddress, poolFinderAbi, (await ethers.getSigners())[0]);
}

async function getImplementationContract(poolAddress) {
    const implementationAbi = [{
        "stateMutability": "view",
        "type": "function",
        "name": "get_dy",
        "inputs": [
            {
                "name": "i",
                "type": "uint256"
            },
            {
                "name": "j",
                "type": "uint256"
            },
            {
                "name": "dx",
                "type": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ]
    },
    {
        "stateMutability": "view",
        "type": "function",
        "name": "coins",
        "inputs": [
            {
                "name": "arg0",
                "type": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ]
    }
    ];

    return new ethers.Contract(poolAddress, implementationAbi, (await ethers.getSigners())[0]);
}


module.exports = {
    printBalances,
    getPoolFinderContract,
    getImplementationContract,
    printBalancesTKATKBTKC
};
