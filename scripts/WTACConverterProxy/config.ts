export type WTACCoverterProxyConfig = {
    adminAddress: string;
    crossChainLayerAddress: string;
    wTACAddress: string;
};

export const mainnetConfig: WTACCoverterProxyConfig = {
    adminAddress: "0x592e0D5f382E83406eADC6532a559A457aae7d3b",
    crossChainLayerAddress: "0x9fee01e948353E0897968A3ea955815aaA49f58d",
    wTACAddress: "0xB63B9f0eb4A6E6f191529D71d4D88cc8900Df2C9",
};

export const testnetConfig: WTACCoverterProxyConfig = {
    adminAddress: "0x440E079445AA9586bf99971d5f57BF09E2B9A403",
    crossChainLayerAddress: "0x4f3b05a601B7103CF8Fc0aBB56d042e04f222ceE",
    wTACAddress: "0xCf61405b7525F09f4E7501fc831fE7cbCc823d4c",
};

