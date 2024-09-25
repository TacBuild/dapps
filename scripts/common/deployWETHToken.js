const { deployToken } = require('../utils.js');


async function main() {
    const wethAddress = await deployToken('Token wETH', 'wETH', 9, 'EQD_OypVyiEgi7PqXNHTHuGx7ANKj8ZLX_DzSfVxV_oTt9aw', 'UQAkt8jdhSqv6UjhVZr6xO3DKARyaP3UcEl7X2q-RVzaxs6l');

    console.log(wethAddress);  
}


main();
