export interface MorphoTestnetConfig {
    morphoAddress: string;
    urdAddress: string;
    lrmAddress: string;
    metaMorphoV1_1Address: string;
}

export interface MorphoProxyDeployments {
    proxyAddress: string;
    MockOracleAddress: string;
    smartAccountFactoryAddress: string;
    crossChainLayerAddress: string;
}

export const morphoMainnetConfig: MorphoTestnetConfig = {
    morphoAddress: "0x918B9F2E4B44E20c6423105BB6cCEB71473aD35c",
    urdAddress: "0xCAC63E17984EdEF10cE0597FCAA2d533B56B28e2",
    lrmAddress: "0x7E82b16496fA8CC04935528dA7F5A2C684A3C7A3",
    metaMorphoV1_1Address: "0xcDA78f4979d17Ec93052A84A12001fe0088AD734"
}; 

export const morphoMainnetProxyDeployments: MorphoProxyDeployments = {
    proxyAddress: "0x001e29479B3DFbaA0c371EaA5E23E157e188871d",
    MockOracleAddress: "0x2F54D1563963fC04770E85AF819c89Dc807f6a06",
    smartAccountFactoryAddress: "0x070820Ed658860f77138d71f74EfbE173775895b",
    crossChainLayerAddress: "0x9fee01e948353E0897968A3ea955815aaA49f58d"
};