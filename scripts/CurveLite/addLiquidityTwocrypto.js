const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


const twocryptoImplementationAbi = [{
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "add_liquidity",
    "inputs": [
        {
            "name": "amounts",
            "type": "uint256[2]"
        },
        {
            "name": "min_mint_amount",
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
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "add_liquidity",
    "inputs": [
        {
            "name": "amounts",
            "type": "uint256[2]"
        },
        {
            "name": "min_mint_amount",
            "type": "uint256"
        },
        {
            "name": "receiver",
            "type": "address"
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
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "remove_liquidity",
    "inputs": [
        {
            "name": "_amount",
            "type": "uint256"
        },
        {
            "name": "min_amounts",
            "type": "uint256[2]"
        },
        {
            "name": "receiver",
            "type": "address"
        }
    ],
    "outputs": [
        {
            "name": "",
            "type": "uint256[2]"
        }
    ]
},
{
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "remove_liquidity",
    "inputs": [
        {
            "name": "_amount",
            "type": "uint256"
        },
        {
            "name": "min_amounts",
            "type": "uint256[2]"
        }
    ],
    "outputs": [
        {
            "name": "",
            "type": "uint256[2]"
        }
    ]
},
{
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "remove_liquidity_one_coin",
    "inputs": [
        {
            "name": "token_amount",
            "type": "uint256"
        },
        {
            "name": "i",
            "type": "uint256"
        },
        {
            "name": "min_amount",
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
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "remove_liquidity_one_coin",
    "inputs": [
        {
            "name": "token_amount",
            "type": "uint256"
        },
        {
            "name": "i",
            "type": "uint256"
        },
        {
            "name": "min_amount",
            "type": "uint256"
        },
        {
            "name": "receiver",
            "type": "address"
        }
    ],
    "outputs": [
        {
            "name": "",
            "type": "uint256"
        }
    ]
},{
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "exchange",
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
        },
        {
            "name": "min_dy",
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
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "exchange",
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
        },
        {
            "name": "min_dy",
            "type": "uint256"
        },
        {
            "name": "receiver",
            "type": "address"
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
    "name": "balances",
    "inputs": [
        {
            "name": "arg0",
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
    "name": "balanceOf",
    "inputs": [
        {
            "name": "arg0",
            "type": "address"
        }
    ],
    "outputs": [
        {
            "name": "",
            "type": "uint256"
        }
    ]
}]


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('CurveLiteTwocryptoswapProxy', 'CurveLiteTwocryptoswapProxy', null, process.env.CURVE_LITE_TWOCRYPTOSWAP_PROXY_ADDRESS);
    const poolAddress = '0xBD362ee863428e117b9E08B46aC195Aa4e536a45'


    await printBalances('\nBalances before operation', poolAddress);

    const tokenA = loadContractAddress('TKA');
    const tokenB = loadContractAddress('TKB');
    const amountA = 10n**8n;
    const amountB = 10n**8n;

    const to = await appProxyContract.getAddress();
    

    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'addLiquidity(address,uint256[2],uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256[2]', 'uint256'],
            [
                poolAddress, 
                [amountA,amountB], 
                0
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: tokenA, amount: amountA},
            {tokenAddress: tokenB, amount: amountB},
        ],
        unlock: [],
    };


    const receipt = await sendSimpleMessage(message);

    await printBalances('\nBalances after operation', poolAddress);

    if (showEvents) {
        printEvents(receipt, crossChainLayerContract);
    }
}


main(true);
