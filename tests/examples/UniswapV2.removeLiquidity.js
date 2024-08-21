const { ethers } = require('hardhat')

const {
    printEvents,
    getContract,
    commutativeKeccak256,
}  = require('../../scripts/utils.js');
const {
    baseSetUp,
    printBalances,
} = require('./UniswapV2.utils.js');

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");


async function setUp() {
    // ...
}


it("UniswapV2: removeLiquidity", async()=>{
    await baseSetUp();
    await setUp();

    const utilsContract = await getContract('MerkleTreeUtils', 'MerkleTreeUtils');
    const crossChainLayerContract = await getContract('CrossChainLayer', 'CrossChainLayer');
    const groupContract = await getContract('Group', 'Group1');
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy');
    const tokenTKAContract = await getContract('CrossChainLayerToken', 'TKA');
    const tokenTKBContract = await getContract('CrossChainLayerToken', 'TKB');
    const factoryContract = await getContract('UniswapV2Factory', 'UniswapV2Factory', factoryArtifact);
    const tokenLPABAddress = await factoryContract.getPair(
        await tokenTKAContract.getAddress(), await tokenTKBContract.getAddress())

    const tokenA = await tokenTKAContract.getAddress();
    const tokenB = await tokenTKBContract.getAddress();

    // message#1: ADD_LIQUIDITY
    var amountADesired = 100n * 10n**9n;
    var amountBDesired = 200n * 10n**9n;
    var amountAMin = 91n * 10n**9n;
    var amountBMin = 151n * 10n**9n;
    var to = await appProxyContract.getAddress();
    var deadline = 19010987500n;
    const messageAddLiquidity = {
        queryId: 122,
        timestamp: Math.floor(Math.random() * 2**32),
        target: await appProxyContract.getAddress(),
        methodName: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: tokenA, amount: amountADesired},
            {tokenAddress: tokenB, amount: amountBDesired},
        ],
        unlock: [],
    };

    await printBalances('Balances before action');

    // message#2: REMOVE_LIQUIDITY
    var liquidity = 50n * 10n**9n;
    amountAMin = 20n * 10n**9n;
    amountBMin = 40n * 10n**9n;
    to = await appProxyContract.getAddress();
    deadline = 19010987500n;
    const messageRemoveLiquidity = {
        queryId: 123,
        timestamp: Math.floor(Math.random() * 2**32),
        target: await appProxyContract.getAddress(),
        methodName: 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [],
        unlock: [
            {tokenAddress: tokenLPABAddress, amount: liquidity},
        ],
    };

    // set proper Merkle root for a single message (one leaf tree)
    const h0 = await utilsContract.hashInMessage(messageAddLiquidity)
    const h1 = await utilsContract.hashInMessage(messageRemoveLiquidity)
    const messageHash = commutativeKeccak256(h0, h1);
    console.log('setting Merkle root to ', messageHash)
    console.log('epoch before setting Merkle root:', await groupContract.getCurrentEpoch())

    await groupContract.vote(messageHash)

    // execute messages
    
    console.log('CrossChainLayer execute messages')
    await crossChainLayerContract.receiveMessage(messageAddLiquidity, [h1], 0)
    const tx = await crossChainLayerContract.receiveMessage(messageRemoveLiquidity, [h0], 0)
    const receipt = await tx.wait()
    
    await printBalances('After call message');

    console.log('\n------------------- Events -------------------\n')
    printEvents(receipt, crossChainLayerContract);
})
